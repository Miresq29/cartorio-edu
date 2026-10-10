import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { createHash, randomBytes } from "node:crypto";

admin.initializeApp();

export { notificarComunicado, notificarTrilha, verificarExpiracoes, testarEnvioEmail, notificarReforco, verificarReexamesPendentes } from "./email";
export { notificarSimulacaoPhishing, phishClick } from "./phishing";
export { verificarDemoExpirada } from "./demo";

const db = admin.firestore();

const GESTOR_ROLES = ["SUPERADMIN", "gestor", "admin", "equipe_mj"];
const CREATABLE_ROLES = ["gestor", "admin", "colaborador", "curador", "equipe_mj"];

interface CallerProfile {
  uid: string;
  role: string;
  tenantId: string;
  active: boolean;
}

async function getCallerProfile(uid: string): Promise<CallerProfile> {
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) {
    throw new HttpsError("permission-denied", "Perfil do usuário autenticado não encontrado.");
  }
  const data = snap.data()!;
  if (data.active !== true) {
    throw new HttpsError("permission-denied", "Conta desativada.");
  }
  return { uid, role: data.role || "", tenantId: data.tenantId || "", active: true };
}

// Limita quantas vezes um usuário pode chamar uma função sensível em uma janela de tempo —
// uma conta comprometida (ou gestor mal-intencionado) não consegue criar contas/cartorios em
// massa ou martelar reset de senhas só porque tem um token valido. Contador por uid+acao em
// rateLimits/, nunca exposto ao cliente (só gravado aqui, via Admin SDK).
async function enforceRateLimit(uid: string, action: string, maxPerWindow: number, windowMs: number): Promise<void> {
  const ref = db.collection("rateLimits").doc(`${uid}_${action}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    if (!snap.exists || now - (snap.data()!.windowStart as number) > windowMs) {
      tx.set(ref, { count: 1, windowStart: now });
      return;
    }
    if ((snap.data()!.count as number) >= maxPerWindow) {
      throw new HttpsError("resource-exhausted", "Muitas solicitações em pouco tempo. Aguarde um instante e tente novamente.");
    }
    tx.update(ref, { count: admin.firestore.FieldValue.increment(1) });
  });
}

export const createTenant = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login necessário.");
  }
  const caller = await getCallerProfile(request.auth.uid);
  if (caller.role !== "SUPERADMIN") {
    throw new HttpsError("permission-denied", "Apenas SUPERADMIN pode criar cartórios.");
  }
  await enforceRateLimit(caller.uid, "createTenant", 5, 60_000);

  const rawName = String(request.data?.name || "").trim();
  const rawSlug = String(request.data?.slug || "").trim();
  if (!rawName || !rawSlug) {
    throw new HttpsError("invalid-argument", "Nome e ID do cliente são obrigatórios.");
  }
  // Define se a UI falará "cartório" ou "empresa" para este cliente — "cartorio" é o
  // padrão (compatível com todos os clientes criados antes deste campo existir).
  const tipoOrganizacao = request.data?.tipoOrganizacao === "empresa" ? "empresa" : "cartorio";

  const slug = rawSlug.toLowerCase().replace(/\s+/g, "-");
  const tenantRef = db.collection("tenants").doc(slug);
  const existing = await tenantRef.get();
  if (existing.exists) {
    throw new HttpsError("already-exists", `Já existe um cliente com o ID "${slug}".`);
  }

  await tenantRef.set({
    name: rawName,
    tipoOrganizacao,
    active: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: caller.uid,
  });

  return { id: slug };
});

export const createCollaborator = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login necessário.");
  }
  const caller = await getCallerProfile(request.auth.uid);
  if (!GESTOR_ROLES.includes(caller.role)) {
    throw new HttpsError("permission-denied", "Sem permissão para criar colaboradores.");
  }
  await enforceRateLimit(caller.uid, "createCollaborator", 20, 60_000);

  const name = String(request.data?.name || "").trim();
  const email = String(request.data?.email || "").trim().toLowerCase();
  const role = String(request.data?.role || "");
  const cargo = String(request.data?.cargo || "");
  const cpf = String(request.data?.cpf || "").trim();
  const tenantId = String(request.data?.tenantId || "").trim();
  const password = String(request.data?.password || "");

  if (!name || !email || !password) {
    throw new HttpsError("invalid-argument", "Nome, e-mail e senha são obrigatórios.");
  }
  // Exige nome e sobrenome — pelo menos duas palavras com 2+ letras cada, para evitar
  // cadastros incompletos como "João" ou iniciais soltas tipo "J S".
  if (!/^\S{2,}(\s+\S{2,})+$/.test(name)) {
    throw new HttpsError("invalid-argument", "Informe nome e sobrenome completos.");
  }
  if (!CREATABLE_ROLES.includes(role)) {
    throw new HttpsError("invalid-argument", "Perfil de acesso inválido.");
  }
  // Curador e equipe_mj são equipe interna da MJ Consultoria — não pertencem a nenhum
  // cartório específico, então não exigem tenantId. Só o SUPERADMIN de verdade (nunca outro
  // curador/equipe_mj) pode criar essas contas, para não se autorreplicarem.
  if (role === "curador" || role === "equipe_mj") {
    if (caller.role !== "SUPERADMIN") {
      throw new HttpsError(
        "permission-denied",
        role === "curador"
          ? "Apenas SUPERADMIN pode criar contas de curador."
          : "Apenas SUPERADMIN pode criar contas da equipe MJ."
      );
    }
  } else {
    if (!tenantId) {
      throw new HttpsError("invalid-argument", "Cartório (tenantId) é obrigatório.");
    }
    if (!["SUPERADMIN", "equipe_mj"].includes(caller.role) && tenantId !== caller.tenantId) {
      throw new HttpsError("permission-denied", "Só é possível criar colaboradores do próprio cartório.");
    }
  }

  let uid: string;
  let reused = false;
  try {
    const created = await admin.auth().createUser({ email, password, displayName: name });
    uid = created.uid;
  } catch (err: any) {
    if (err.code === "auth/email-already-exists") {
      const existingUser = await admin.auth().getUserByEmail(email);
      uid = existingUser.uid;
      reused = true;
      // A conta ja existia com outra senha — sem isto, a senha temporaria informada/gerada
      // aqui nunca entra em vigor e a pessoa nao consegue logar com o que foi comunicado a ela.
      await admin.auth().updateUser(uid, { password }).catch(() => {});
    } else if (err.code === "auth/invalid-password") {
      throw new HttpsError("invalid-argument", "Senha inválida — mínimo 6 caracteres.");
    } else {
      throw new HttpsError("internal", err.message || "Erro ao criar conta de acesso.");
    }
  }

  try {
    await db.collection("users").doc(uid).set(
      {
        name,
        email,
        role,
        cargo,
        ...(cpf ? { cpf } : {}),
        tenantId,
        active: true,
        ativo: true,
        isFirstLogin: true,
        mustChangePassword: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: caller.uid,
      },
      { merge: true }
    );
  } catch (err: any) {
    if (!reused) {
      await admin.auth().deleteUser(uid).catch(() => {});
    }
    throw new HttpsError("internal", "Conta criada, mas falha ao salvar perfil. Tente novamente.");
  }

  return { uid, reused };
});

function isStrongPassword(pass: string): boolean {
  return (
    pass.length >= 12 &&
    /[A-Z]/.test(pass) &&
    /[a-z]/.test(pass) &&
    /\d/.test(pass) &&
    /[!@#$%^&*(),.?":{}|<>_-]/.test(pass)
  );
}

// Redefine a senha de TODOS os colaboradores de um cartorio de uma vez (ex.: apos suspeita de
// vazamento, ou para padronizar acesso inicial de um grupo). Forca troca no proximo login
// (isFirstLogin/mustChangePassword) — igual ao fluxo de criacao de colaborador.
export const resetTenantPasswords = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login necessário.");
  }
  const caller = await getCallerProfile(request.auth.uid);
  if (!["SUPERADMIN", "equipe_mj"].includes(caller.role)) {
    throw new HttpsError("permission-denied", "Sem permissão para redefinir senhas em massa.");
  }
  await enforceRateLimit(caller.uid, "resetTenantPasswords", 3, 60_000);

  const tenantId = String(request.data?.tenantId || "").trim();
  const password = String(request.data?.password || "");
  if (!tenantId) {
    throw new HttpsError("invalid-argument", "Cartório (tenantId) é obrigatório.");
  }
  if (!isStrongPassword(password)) {
    throw new HttpsError(
      "invalid-argument",
      "Senha fraca. Mínimo 12 caracteres, com maiúscula, minúscula, número e caractere especial."
    );
  }

  const usersSnap = await db.collection("users").where("tenantId", "==", tenantId).get();
  if (usersSnap.empty) {
    throw new HttpsError("not-found", "Nenhum colaborador encontrado para este cartório.");
  }

  let updated = 0;
  const failed: string[] = [];
  for (const doc of usersSnap.docs) {
    try {
      await admin.auth().updateUser(doc.id, { password });
      await doc.ref.update({
        isFirstLogin: true,
        mustChangePassword: true,
        passwordUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      updated++;
    } catch (err: any) {
      failed.push(doc.data().email || doc.id);
    }
  }

  return { total: usersSnap.size, updated, failed };
});

// ── Proxy para a API do Gemini ───────────────────────────────────────────────
// Antes, o frontend chamava generativelanguage.googleapis.com direto do navegador com
// a chave em VITE_GEMINI_API_KEY — qualquer um que inspecionasse o bundle JS publicado
// extraía a chave e usava a cota (e a fatura) da MJ Consultoria. Agora a chave fica só
// aqui, como secret do Cloud Functions, e o cliente chama esta function autenticada.
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const GEMINI_MODEL = "gemini-flash-latest";

export const geminiGenerate = onCall({ secrets: [GEMINI_API_KEY] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login necessário.");
  }
  const caller = await getCallerProfile(request.auth.uid);
  await enforceRateLimit(caller.uid, "geminiGenerate", 30, 60_000);

  const prompt = String(request.data?.prompt || "");
  if (!prompt) {
    throw new HttpsError("invalid-argument", "Prompt é obrigatório.");
  }
  const maxOutputTokens = Number(request.data?.maxOutputTokens) || 1024;
  const jsonMode = request.data?.jsonMode === true;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-goog-api-key": GEMINI_API_KEY.value() },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens,
        // gemini-flash-latest (2.5) "pensa" antes de responder por padrao, consumindo
        // parte do maxOutputTokens com raciocinio interno — desliga pra reservar o
        // budget inteiro pra resposta (igual ao comportamento anterior no frontend).
        thinkingConfig: { thinkingBudget: 0 },
        ...(jsonMode ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });

  if (!response.ok) {
    const err: any = await response.json().catch(() => ({}));
    const msg = err?.error?.message || response.statusText;
    if (response.status === 429) {
      throw new HttpsError("resource-exhausted", "Cota da API Gemini esgotada. Aguarde ou verifique ai.google.dev.");
    }
    throw new HttpsError("internal", `[Gemini ${response.status}] ${msg}`);
  }

  const data: any = await response.json();
  const candidate = data?.candidates?.[0];
  if (candidate?.finishReason === "MAX_TOKENS") {
    throw new HttpsError(
      "resource-exhausted",
      "A resposta da IA foi cortada por exceder o limite de tokens. Tente novamente com menos questões/itens."
    );
  }
  return { text: candidate?.content?.parts?.[0]?.text || "Sem resposta da IA." };
});

// ── Controle de tentativas de login (anti brute-force) ──────────────────────
// Roda ANTES da sessao Firebase Auth existir, entao estas duas funcoes nao exigem
// request.auth de proposito. Antes, o client gravava direto no Firestore num doc
// cujo ID era so o e-mail com "." e "@" trocados por "_" — reversivel e com leitura
// publica, dava pra qualquer um verificar/isolar o status de bloqueio de qualquer
// e-mail (oraculo de enumeracao) e empurrar lockedUntil pra frente em loop (DoS
// direcionado). Mover pra ca: o ID agora e um hash, e o Firestore nao aceita mais
// leitura/escrita direta nessa colecao (ver firestore.rules) — so por aqui.
const LOGIN_MAX_ATTEMPTS = 20;
const LOGIN_LOCKOUT_MS = 60_000;

function loginAttemptKey(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export const checkLoginLock = onCall(async (request) => {
  const email = String(request.data?.email || "").trim().toLowerCase();
  if (!email) throw new HttpsError("invalid-argument", "E-mail é obrigatório.");
  const snap = await db.collection("loginAttempts").doc(loginAttemptKey(email)).get();
  if (!snap.exists) return { locked: false };
  const lockedUntil = snap.data()!.lockedUntil as admin.firestore.Timestamp | null | undefined;
  if (lockedUntil && lockedUntil.toMillis() > Date.now()) {
    return { locked: true, minutesLeft: Math.ceil((lockedUntil.toMillis() - Date.now()) / 60_000) };
  }
  return { locked: false };
});

export const reportLoginResult = onCall(async (request) => {
  const email = String(request.data?.email || "").trim().toLowerCase();
  const success = request.data?.success === true;
  if (!email) throw new HttpsError("invalid-argument", "E-mail é obrigatório.");
  const ref = db.collection("loginAttempts").doc(loginAttemptKey(email));

  if (success) {
    await ref.set(
      { attempts: 0, lockedUntil: null, lastAttempt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    return { ok: true };
  }

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const attempts = (snap.exists ? (snap.data()!.attempts as number) || 0 : 0) + 1;
    const update: Record<string, unknown> = { attempts, lastAttempt: admin.firestore.FieldValue.serverTimestamp() };
    if (attempts >= LOGIN_MAX_ATTEMPTS) {
      update.lockedUntil = admin.firestore.Timestamp.fromMillis(Date.now() + LOGIN_LOCKOUT_MS);
      update.attempts = 0;
    }
    tx.set(ref, update, { merge: true });
  });
  return { ok: true };
});

// ── Verificação pública de certificado (modelo 1, legado) ────────────────────
// Fórmula antiga: hash derivado do ID do doc (autoId do Firestore) + dados do certificado.
// Mantida só para continuar verificando certificados emitidos ANTES do modelo 2 existir —
// esses docs não têm "versaoModelo" nem o campo "hash".
function gerarHashVerificacao(docId: string, colaboradorId: string, trilhaTitulo: string, notaFinal: number, tenantId: string): string {
  const input = `${docId}|${colaboradorId}|${trilhaTitulo}|${notaFinal}|${tenantId}`;
  const hex = createHash("sha256").update(input).digest("hex").toUpperCase();
  const code = hex.slice(0, 16);
  return `MJ-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}-${code.slice(12, 16)}`;
}

// ── Certificados (modelo 2) ───────────────────────────────────────────────────
// O código deixou de ser DERIVADO do hash (o que exigia o ID do doc, que só existe depois de
// criado — uma circularidade) — agora é gerado ALEATORIAMENTE primeiro (crypto.randomBytes),
// vira o próprio ID do documento (certificados/{codigo}, via transação com retry em caso de
// colisão) e só DEPOIS entra como mais um campo no hash. O hash cobre TODOS os dados visíveis
// no certificado (não só nota/treinamento) — qualquer alteração em qualquer campo depois da
// emissão quebra a verificação. Assinatura/instrutor/emissora vêm de config/certificado e são
// GRAVADOS no próprio certificado na hora da emissão (não lidos de novo depois), pra o
// certificado continuar verificável do jeito que foi emitido mesmo se a config mudar depois.
function gerarCodigoCertificado(): string {
  const hex = randomBytes(8).toString("hex").toUpperCase();
  return `MJ-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`;
}

function canonicalStringify(obj: Record<string, unknown>): string {
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) sorted[k] = obj[k];
  return JSON.stringify(sorted);
}

interface ConfigCertificado {
  instrutorNome: string;
  instrutorCargo: string;
  instrutorQualificacoes: string;
  assinaturaUrl: string;
  emissoraRazaoSocial: string;
  emissoraCnpj: string;
  localEmissaoPadrao: string;
  modalidadePadrao: string;
}

async function obterConfigCertificado(): Promise<ConfigCertificado> {
  const snap = await db.collection("config").doc("certificado").get();
  const c = snap.exists ? snap.data()! : {};
  return {
    instrutorNome: (c.instrutorNome as string) || "Mirian Jabur",
    instrutorCargo: (c.instrutorCargo as string) || "Instrutora e Responsável Técnica",
    instrutorQualificacoes: (c.instrutorQualificacoes as string) || "DPO EXIN · CISM · ISO/IEC 27001 Lead Auditor",
    assinaturaUrl: (c.assinaturaUrl as string) || "",
    emissoraRazaoSocial: (c.emissoraRazaoSocial as string) || "AG Serviços em TI Ltda. (MJ Consultoria)",
    emissoraCnpj: (c.emissoraCnpj as string) || "07.113.086/0001-08",
    localEmissaoPadrao: (c.localEmissaoPadrao as string) || "Belo Horizonte/MG",
    modalidadePadrao: (c.modalidadePadrao as string) || "EAD assíncrona",
  };
}

interface DadosCertificado {
  tenantId: string;
  colaboradorId: string;
  colaboradorNome: string;
  cpf: string;
  cargo: string;
  cartorio: string;
  trilhaTitulo: string;
  moduloTitulo: string;
  tipo: string;
  notaFinal: number;
  notaMinima: number;
  cargaHoraria: number;
  modalidade: string;
  instrutor: string;
  instrutorCargo: string;
  instrutorQualificacoes: string;
  assinaturaUrl: string;
  emissoraRazaoSocial: string;
  emissoraCnpj: string;
  localEmissao: string;
  dataConclusao: string;
  dataEmissao: string;
  emitidoPor: string;
  validoAte: string;
}

function hashCertificado(codigo: string, dados: DadosCertificado): string {
  return createHash("sha256").update(canonicalStringify({ codigo, versaoModelo: 2, ...dados })).digest("hex");
}

// Mesma combinação de campos usada desde o modelo 1 pra identificar "o mesmo certificado":
// um colaborador só pode ter UM certificado por treinamento+tipo(+módulo) por tenant.
async function buscarCertificadoExistente(dados: Pick<DadosCertificado, "tenantId" | "colaboradorId" | "trilhaTitulo" | "tipo" | "moduloTitulo">): Promise<string | null> {
  const snap = await db.collection("certificados")
    .where("tenantId", "==", dados.tenantId)
    .where("colaboradorId", "==", dados.colaboradorId)
    .where("trilhaTitulo", "==", dados.trilhaTitulo)
    .where("tipo", "==", dados.tipo)
    .get();
  const match = snap.docs.find((d) => ((d.data().moduloTitulo as string) || "") === (dados.moduloTitulo || ""));
  return match ? match.id : null;
}

async function criarCertificado(dados: DadosCertificado): Promise<{ codigo: string; novo: boolean }> {
  const existente = await buscarCertificadoExistente(dados);
  if (existente) return { codigo: existente, novo: false };

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const codigo = gerarCodigoCertificado();
    const ref = db.collection("certificados").doc(codigo);
    const criado = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) return false;
      tx.set(ref, {
        ...dados,
        codigo,
        versaoModelo: 2,
        codigoVerificacao: codigo,
        hash: hashCertificado(codigo, dados),
        emitidoEm: admin.firestore.FieldValue.serverTimestamp(),
      });
      return true;
    });
    if (criado) return { codigo, novo: true };
  }
  throw new HttpsError("internal", "Não foi possível gerar um código de certificado único. Tente novamente.");
}

// Função pública de propósito (sem request.auth) — o caso de uso é um auditor externo do CNJ
// digitar o código e confirmar autenticidade sem precisar de login.
export const verificarCertificado = onCall(async (request) => {
  const codigo = String(request.data?.codigo || "").trim().toUpperCase();
  if (!codigo) {
    throw new HttpsError("invalid-argument", "Código é obrigatório.");
  }

  // Modelo 2: o código É o ID do documento. Fallback por query: certificados modelo 1, cujo
  // código fica só no campo codigoVerificacao de um doc com ID autogerado pelo Firestore.
  let docSnap = await db.collection("certificados").doc(codigo).get();
  if (!docSnap.exists) {
    const snap = await db.collection("certificados").where("codigoVerificacao", "==", codigo).limit(1).get();
    if (snap.empty) return { valido: false };
    docSnap = snap.docs[0];
  }

  const c = docSnap.data()!;
  const versaoModelo = (c.versaoModelo as number) || 1;
  let adulterado: boolean;

  if (versaoModelo >= 2) {
    const dados: DadosCertificado = {
      tenantId: c.tenantId, colaboradorId: c.colaboradorId, colaboradorNome: c.colaboradorNome,
      cpf: c.cpf || "", cargo: c.cargo || "", cartorio: c.cartorio || "",
      trilhaTitulo: c.trilhaTitulo, moduloTitulo: c.moduloTitulo || "", tipo: c.tipo,
      notaFinal: c.notaFinal, notaMinima: c.notaMinima || 0, cargaHoraria: c.cargaHoraria,
      modalidade: c.modalidade || "", instrutor: c.instrutor || "", instrutorCargo: c.instrutorCargo || "",
      instrutorQualificacoes: c.instrutorQualificacoes || "", assinaturaUrl: c.assinaturaUrl || "",
      emissoraRazaoSocial: c.emissoraRazaoSocial || "", emissoraCnpj: c.emissoraCnpj || "",
      localEmissao: c.localEmissao || "", dataConclusao: c.dataConclusao || "", dataEmissao: c.dataEmissao || "",
      emitidoPor: c.emitidoPor || "", validoAte: c.validoAte || "",
    };
    adulterado = hashCertificado(docSnap.id, dados) !== c.hash;
  } else {
    adulterado = gerarHashVerificacao(docSnap.id, c.colaboradorId, c.trilhaTitulo, c.notaFinal, c.tenantId) !== codigo;
  }

  if (adulterado) {
    // O código bate com algum registro, mas os dados do certificado foram alterados
    // depois da emissão (nota, treinamento etc.) — o hash recalculado não confere mais.
    return { valido: false, adulterado: true };
  }

  return {
    valido: true,
    versaoModelo,
    colaboradorNome: c.colaboradorNome as string,
    cpf: (c.cpf as string) || "",
    cargo: (c.cargo as string) || "",
    cartorio: (c.cartorio as string) || "",
    trilhaTitulo: c.trilhaTitulo as string,
    tipo: c.tipo as string,
    notaFinal: c.notaFinal as number,
    cargaHoraria: c.cargaHoraria as number,
    modalidade: (c.modalidade as string) || "",
    instrutor: (c.instrutor as string) || "",
    instrutorCargo: (c.instrutorCargo as string) || "",
    emissoraRazaoSocial: (c.emissoraRazaoSocial as string) || "",
    emitidoEm: c.emitidoEm?.toDate ? c.emitidoEm.toDate().toISOString() : null,
    validoAte: (c.validoAte as string) || null,
  };
});

// ── Certificado automático após aprovação em exame (autoatendimento) ─────────
// A regra do Firestore não deixa mais NINGUÉM gravar direto em certificados/ (nem gestor) —
// toda emissão passa por aqui ou por emitirCertificadoManual, nunca direto do cliente, pra não
// permitir forjar nota/instrutor/hash. Aqui especificamente: o PRÓPRIO colaborador aciona a
// emissão assim que passa num exame (ExamesView), então confirmamos contra examesResultados
// que a aprovação é real antes de emitir qualquer coisa.
export const emitirCertificadoExame = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login necessário.");
  }
  const caller = await getCallerProfile(request.auth.uid);
  await enforceRateLimit(caller.uid, "emitirCertificadoExame", 30, 60_000);

  const trilhaTitulo = String(request.data?.trilhaTitulo || "").trim();
  if (!trilhaTitulo) {
    throw new HttpsError("invalid-argument", "Treinamento é obrigatório.");
  }

  const examesSnap = await db.collection("examesResultados")
    .where("userId", "==", caller.uid)
    .where("fonteTitulo", "==", trilhaTitulo)
    .where("aprovado", "==", true)
    .get();
  if (examesSnap.empty) {
    throw new HttpsError("failed-precondition", "Nenhuma aprovação encontrada para esse treinamento.");
  }
  const melhorScore = Math.max(...examesSnap.docs.map((d) => (d.data().score as number) || 0));

  const userSnap = await db.collection("users").doc(caller.uid).get();
  const userData = userSnap.data() || {};
  const tenantSnap = await db.collection("tenants").doc(caller.tenantId).get();
  const tenantData = tenantSnap.data() || {};
  const cartorioNome = (tenantData.nomeOficial as string) || (tenantData.name as string) || caller.tenantId;

  const trilhaSnap = await db.collection("trilhas").where("titulo", "==", trilhaTitulo).limit(1).get();
  const trilhaData = trilhaSnap.empty ? null : trilhaSnap.docs[0].data();
  const config = await obterConfigCertificado();
  const instrutor = trilhaData?.oficial ? config.instrutorNome : ((trilhaData?.instrutor as string) || config.instrutorNome);
  const cargaHoraria = Math.max(1, (trilhaData?.cargaHoraria as number) || 1);
  const modalidade = (trilhaData?.modalidade as string) || config.modalidadePadrao;

  const agora = new Date();
  const dataIso = agora.toISOString().slice(0, 10);
  const validoAte = new Date(agora);
  validoAte.setFullYear(validoAte.getFullYear() + 1);

  const { codigo, novo } = await criarCertificado({
    tenantId: caller.tenantId,
    colaboradorId: caller.uid,
    colaboradorNome: (userData.name as string) || "",
    cpf: (userData.cpf as string) || "",
    cargo: (userData.cargo as string) || (userData.role as string) || "",
    cartorio: cartorioNome,
    trilhaTitulo,
    moduloTitulo: "",
    tipo: "exame",
    notaFinal: melhorScore,
    notaMinima: 70,
    cargaHoraria,
    modalidade,
    instrutor,
    instrutorCargo: config.instrutorCargo,
    instrutorQualificacoes: config.instrutorQualificacoes,
    assinaturaUrl: config.assinaturaUrl,
    emissoraRazaoSocial: config.emissoraRazaoSocial,
    emissoraCnpj: config.emissoraCnpj,
    localEmissao: config.localEmissaoPadrao,
    dataConclusao: dataIso,
    dataEmissao: dataIso,
    emitidoPor: (userData.name as string) || "Sistema",
    validoAte: validoAte.toISOString().slice(0, 10),
  });
  return {
    codigoVerificacao: codigo,
    novo,
    cpf: (userData.cpf as string) || "",
    instrutor,
    instrutorCargo: config.instrutorCargo,
    assinaturaUrl: config.assinaturaUrl,
    localEmissao: config.localEmissaoPadrao,
  };
});

// ── Certificado emitido pelo gestor/admin ─────────────────────────────────────
// Substitui a gravação direta que o CertificadoView.tsx fazia em certificados/ — agora o
// cliente só lê essa coleção, nunca escreve nela (ver firestore.rules). O gestor continua
// escolhendo colaborador/treinamento/tipo na UI; aqui só confirmamos a permissão (mesmo
// cartório, ou SUPERADMIN/equipe_mj) e montamos o certificado com os dados oficiais
// (serventia, config de assinatura/instrutor) antes de gerar o código e o hash.
export const emitirCertificadoManual = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login necessário.");
  }
  const caller = await getCallerProfile(request.auth.uid);
  if (!GESTOR_ROLES.includes(caller.role)) {
    throw new HttpsError("permission-denied", "Sem permissão para emitir certificados.");
  }
  await enforceRateLimit(caller.uid, "emitirCertificadoManual", 200, 60_000);

  const colaboradorId = String(request.data?.colaboradorId || "").trim();
  const trilhaTitulo = String(request.data?.trilhaTitulo || "").trim();
  const moduloTitulo = String(request.data?.moduloTitulo || "").trim();
  const tipo = String(request.data?.tipo || "");
  const notaFinal = Number(request.data?.notaFinal) || 0;
  const cargaHorariaInformada = Number(request.data?.cargaHoraria) || 0;

  if (!colaboradorId || !trilhaTitulo || !["trilha", "modulo", "exame"].includes(tipo)) {
    throw new HttpsError("invalid-argument", "Colaborador, treinamento e tipo são obrigatórios.");
  }

  const colabSnap = await db.collection("users").doc(colaboradorId).get();
  if (!colabSnap.exists) {
    throw new HttpsError("not-found", "Colaborador não encontrado.");
  }
  const colabData = colabSnap.data()!;
  const tenantId = (colabData.tenantId as string) || "";
  if (!["SUPERADMIN", "equipe_mj"].includes(caller.role) && tenantId !== caller.tenantId) {
    throw new HttpsError("permission-denied", "Só é possível emitir certificado para colaboradores do próprio cartório.");
  }

  const tenantSnap = await db.collection("tenants").doc(tenantId).get();
  const tenantData = tenantSnap.data() || {};
  const cartorioNome = (tenantData.nomeOficial as string) || (tenantData.name as string) || tenantId;

  const trilhaSnap = await db.collection("trilhas").where("titulo", "==", trilhaTitulo).limit(1).get();
  const trilhaData = trilhaSnap.empty ? null : trilhaSnap.docs[0].data();
  const config = await obterConfigCertificado();
  const instrutor = trilhaData?.oficial ? config.instrutorNome : ((trilhaData?.instrutor as string) || config.instrutorNome);
  const cargaHoraria = Math.max(1, cargaHorariaInformada || (trilhaData?.cargaHoraria as number) || 1);
  const modalidade = (trilhaData?.modalidade as string) || config.modalidadePadrao;

  const callerSnap = await db.collection("users").doc(caller.uid).get();
  const emitidoPorNome = (callerSnap.data()?.name as string) || "Sistema";

  const agora = new Date();
  const dataIso = agora.toISOString().slice(0, 10);
  const validoAte = new Date(agora);
  validoAte.setFullYear(validoAte.getFullYear() + 1);

  const { codigo, novo } = await criarCertificado({
    tenantId,
    colaboradorId,
    colaboradorNome: (colabData.name as string) || "",
    cpf: (colabData.cpf as string) || "",
    cargo: (colabData.cargo as string) || (colabData.role as string) || "",
    cartorio: cartorioNome,
    trilhaTitulo,
    moduloTitulo,
    tipo,
    notaFinal,
    notaMinima: 70,
    cargaHoraria,
    modalidade,
    instrutor,
    instrutorCargo: config.instrutorCargo,
    instrutorQualificacoes: config.instrutorQualificacoes,
    assinaturaUrl: config.assinaturaUrl,
    emissoraRazaoSocial: config.emissoraRazaoSocial,
    emissoraCnpj: config.emissoraCnpj,
    localEmissao: config.localEmissaoPadrao,
    dataConclusao: dataIso,
    dataEmissao: dataIso,
    emitidoPor: emitidoPorNome,
    validoAte: validoAte.toISOString().slice(0, 10),
  });
  return { id: codigo, codigoVerificacao: codigo, novo };
});
