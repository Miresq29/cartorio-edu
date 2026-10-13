import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

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

  return { text: await chamarGemini(prompt, maxOutputTokens, jsonMode) };
});

async function chamarGemini(prompt: string, maxOutputTokens: number, jsonMode: boolean): Promise<string> {
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
  return candidate?.content?.parts?.[0]?.text || "Sem resposta da IA.";
}

// ── Exames (geração e correção no servidor) ──────────────────────────────────
// Antes a prova era gerada pela IA NO NAVEGADOR, com o gabarito junto, e a nota calculada e
// gravada em examesResultados pelo próprio cliente — qualquer colaborador podia gravar
// "aprovado: true, score: 100" direto no Firestore e depois pedir o certificado
// (emitirCertificadoExame confia em examesResultados). Agora: gerarExame busca o conteúdo no
// banco, gera as questões e guarda o gabarito em examesSessoes/ (sem acesso nenhum pelo
// cliente — ver firestore.rules); o cliente recebe só enunciados/alternativas. submeterExame
// corrige contra a sessão e é o ÚNICO caminho que grava examesResultados.
const EXAME_NUM_QUESTOES = 7;
const EXAME_NOTA_APROVACAO = 70;
const EXAME_DIAS_BLOQUEIO = 5;
const EXAME_SESSAO_VALIDADE_MS = 6 * 60 * 60 * 1000;
const PLATFORM_STAFF_ROLES = ["SUPERADMIN", "equipe_mj"];

type TipoFonteExame = "treinamento" | "knowledgeBase" | "video" | "trilha";
const COLECAO_FONTE: Record<TipoFonteExame, string> = {
  treinamento: "treinamentos",
  knowledgeBase: "knowledgeBase",
  video: "repositorio",
  trilha: "trilhas",
};

interface QuestaoExameServidor {
  id: number;
  enunciado: string;
  alternativas: { letra: string; texto: string }[];
  correta: string;
  bloom: string;
  justificativa: string;
}

// Mesma montagem de título/conteúdo que ExamesView.tsx fazia no cliente — o fonteTitulo
// gravado precisa continuar idêntico, porque emitirCertificadoExame e os relatórios casam por ele.
function montarFonteExame(tipo: TipoFonteExame, d: FirebaseFirestore.DocumentData): { titulo: string; conteudo: string } {
  if (tipo === "video") {
    return {
      titulo: d.titulo || "Sem título",
      conteudo: [d.titulo, d.categoria, d.trilhaTitulo, d.descricao].filter(Boolean).join("\n"),
    };
  }
  if (tipo === "trilha") {
    return {
      titulo: d.titulo || "Sem título",
      conteudo: ((d.modulos || []) as { titulo?: string; conteudo?: string }[])
        .map((m) => `${m.titulo ? m.titulo + ":\n" : ""}${m.conteudo || ""}`)
        .join("\n\n"),
    };
  }
  const campoTitulo = tipo === "treinamento" ? "titulo" : "title";
  const campoConteudo = tipo === "treinamento" ? "descricao" : "rawText";
  return {
    titulo: d[campoTitulo] || d.title || d.nome || "Sem título",
    conteudo: d[campoConteudo] || d.content || d.rawText || d.descricao || "",
  };
}

// Mesmas regras de "assistiu/leu" que o cliente usa pra liberar a prova.
async function concluiuFonte(uid: string, tipo: TipoFonteExame, fonteId: string): Promise<boolean> {
  if (tipo === "video") {
    const s = await db.collection("repositorioProgresso")
      .where("userId", "==", uid).where("midiaId", "==", fonteId).get();
    return s.docs.some((d) => d.data().visto === true);
  }
  if (tipo === "trilha") {
    const s = await db.collection("trilhasProgresso")
      .where("userId", "==", uid).where("trilhaId", "==", fonteId).get();
    return s.docs.some((d) => d.data().concluida === true || d.data().percentualObrigatorios === 100);
  }
  const s = await db.collection("leituraProgresso").doc(`${uid}_${fonteId}`).get();
  return s.exists && s.data()!.lido === true;
}

// Reprovação recente bloqueia nova tentativa até proximaTentativa.
async function diasDeBloqueio(uid: string, fonteId: string): Promise<number> {
  const s = await db.collection("examesResultados")
    .where("userId", "==", uid).where("fonteId", "==", fonteId).get();
  const agora = Date.now();
  const fim = Math.max(0, ...s.docs
    .filter((d) => d.data().aprovado !== true)
    .map((d) => (d.data().proximaTentativa?.toMillis?.() as number | undefined) || 0));
  return fim > agora ? Math.ceil((fim - agora) / 86_400_000) : 0;
}

// A IA tende a pôr a resposta certa nas primeiras letras (num teste de 2026-10-11, todas as 7
// ficaram em A ou B) — embaralha a ordem das alternativas e re-letra A-D, levando a correta junto.
function embaralharAlternativas(q: QuestaoExameServidor): QuestaoExameServidor {
  const itens = q.alternativas.map((a) => ({ texto: a.texto, correta: a.letra === q.correta }));
  for (let i = itens.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    [itens[i], itens[j]] = [itens[j], itens[i]];
  }
  const letras = ["A", "B", "C", "D"];
  return {
    ...q,
    alternativas: itens.map((a, i) => ({ letra: letras[i], texto: a.texto })),
    correta: letras[itens.findIndex((a) => a.correta)],
  };
}

function validarQuestoes(bruto: unknown, blooms = ["compreensao", "aplicacao", "analise"], bloomPadrao = "aplicacao"): QuestaoExameServidor[] {
  if (!Array.isArray(bruto) || bruto.length < EXAME_NUM_QUESTOES) {
    throw new HttpsError("internal", "A IA não gerou questões suficientes. Tente novamente.");
  }
  // A IA às vezes escreve "A)", "Alternativa B" ou só o texto — normaliza pra uma letra A-D.
  const letraDe = (v: unknown) => (String(v ?? "").toUpperCase().match(/\b([A-D])\b/) || [])[1] || "";
  return bruto.slice(0, EXAME_NUM_QUESTOES).map((q: any, i: number) => {
    const alternativas = Array.isArray(q?.alternativas)
      ? q.alternativas.slice(0, 4).map((a: any, j: number) => ({
        letra: letraDe(a?.letra) || "ABCD"[j],
        texto: String(typeof a === "string" ? a : (a?.texto ?? "")),
      }))
      : [];
    const correta = letraDe(q?.correta)
      || (alternativas.find((a: { texto: string }) => a.texto && a.texto === String(q?.correta ?? ""))?.letra ?? "");
    if (!q?.enunciado || alternativas.length !== 4 || !alternativas.some((a: { letra: string }) => a.letra === correta)) {
      console.warn("questão da IA em formato inválido:", JSON.stringify(q).slice(0, 800));
      throw new HttpsError("internal", "A IA gerou uma questão em formato inválido. Tente novamente.");
    }
    return embaralharAlternativas({
      id: i + 1,
      enunciado: String(q.enunciado),
      alternativas,
      correta,
      bloom: blooms.includes(q.bloom) ? q.bloom : bloomPadrao,
      justificativa: String(q.justificativa || ""),
    });
  });
}

// Gera e valida; se a IA devolver formato inválido, tenta mais uma vez antes de desistir.
async function gerarQuestoesIA(prompt: string, blooms?: string[], bloomPadrao?: string): Promise<QuestaoExameServidor[]> {
  try {
    return validarQuestoes(await gerarJsonIA(prompt), blooms, bloomPadrao);
  } catch (e) {
    if (!(e instanceof HttpsError) || e.code !== "internal") throw e;
    return validarQuestoes(await gerarJsonIA(prompt), blooms, bloomPadrao);
  }
}

async function gerarJsonIA(prompt: string): Promise<unknown> {
  const texto = await chamarGemini(prompt, 1500 * EXAME_NUM_QUESTOES + 3000, true);
  try {
    const parsed = JSON.parse(texto);
    return Array.isArray(parsed) ? parsed : parsed?.questoes;
  } catch {
    throw new HttpsError("internal", "Formato inválido na resposta da IA. Tente novamente.");
  }
}

const FORMATO_QUESTOES_JSON = `Regras: 4 alternativas (A-D), 1 correta, distractores plausíveis, justificativa breve.
Na justificativa, NÃO cite letras de alternativas (a ordem será embaralhada) — explique pelo conteúdo.

Retorne APENAS array JSON sem markdown:
[{"id":1,"enunciado":"...","alternativas":[{"letra":"A","texto":"..."},{"letra":"B","texto":"..."},{"letra":"C","texto":"..."},{"letra":"D","texto":"..."}],"correta":"A","bloom":"...","justificativa":"..."}]`;

export const gerarExame = onCall({ secrets: [GEMINI_API_KEY], timeoutSeconds: 120 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login necessário.");
  }
  const caller = await getCallerProfile(request.auth.uid);
  await enforceRateLimit(caller.uid, "gerarExame", 10, 60_000);

  const fonteId = String(request.data?.fonteId || "").trim();
  const tipo = String(request.data?.tipo || "") as TipoFonteExame;
  if (!fonteId || !COLECAO_FONTE[tipo]) {
    throw new HttpsError("invalid-argument", "Conteúdo do exame inválido.");
  }

  const fonteSnap = await db.collection(COLECAO_FONTE[tipo]).doc(fonteId).get();
  if (!fonteSnap.exists) {
    throw new HttpsError("not-found", "Conteúdo não encontrado.");
  }
  const fonteData = fonteSnap.data()!;
  const tenantIds = (fonteData.tenantIds as string[] | undefined) || [];
  const visivel = PLATFORM_STAFF_ROLES.includes(caller.role)
    || tenantIds.includes("GLOBAL") || (!!caller.tenantId && tenantIds.includes(caller.tenantId));
  if (!visivel || (tipo === "video" && fonteData.ativo === false)) {
    throw new HttpsError("permission-denied", "Esse conteúdo não está disponível para você.");
  }

  const { titulo, conteudo } = montarFonteExame(tipo, fonteData);
  if (conteudo.length < 10) {
    throw new HttpsError("failed-precondition", "Este conteúdo não possui texto suficiente para gerar um exame.");
  }
  const bloqueio = await diasDeBloqueio(caller.uid, fonteId);
  if (bloqueio > 0) {
    throw new HttpsError("failed-precondition", `Você está bloqueado por mais ${bloqueio} dia(s). Aguarde antes de tentar novamente.`);
  }
  if (!(await concluiuFonte(caller.uid, tipo, fonteId))) {
    throw new HttpsError("failed-precondition", tipo === "treinamento" || tipo === "knowledgeBase"
      ? "Você ainda não leu esse conteúdo por completo. Leia o conteúdo antes de fazer a prova."
      : "Você ainda não assistiu esse treinamento por completo. Assista o conteúdo antes de fazer a prova.");
  }

  const prompt = `Especialista em avaliação educacional corporativa.

TEMA: "${titulo}"
CONTEÚDO:
${conteudo.substring(0, 4000)}

Gere EXATAMENTE ${EXAME_NUM_QUESTOES} questões de múltipla escolha (Taxonomia de Bloom nível médio):
- 2 COMPREENSÃO (bloom: "compreensao")
- 3 APLICAÇÃO (bloom: "aplicacao")
- 2 ANÁLISE (bloom: "analise")

Regras: 4 alternativas (A-D), 1 correta, distractores plausíveis, justificativa breve.
Na justificativa, NÃO cite letras de alternativas (a ordem será embaralhada) — explique pelo conteúdo.

Retorne APENAS array JSON sem markdown:
[{"id":1,"enunciado":"...","alternativas":[{"letra":"A","texto":"..."},{"letra":"B","texto":"..."},{"letra":"C","texto":"..."},{"letra":"D","texto":"..."}],"correta":"A","bloom":"compreensao","justificativa":"..."}]`;

  const questoes = await gerarQuestoesIA(prompt);

  const sessaoRef = db.collection("examesSessoes").doc();
  await sessaoRef.set({
    userId: caller.uid,
    tenantId: caller.tenantId,
    fonteId,
    fonteTipo: tipo,
    fonteTitulo: titulo,
    questoes,
    status: "aberta",
    criadaEm: admin.firestore.FieldValue.serverTimestamp(),
    expiraEm: admin.firestore.Timestamp.fromMillis(Date.now() + EXAME_SESSAO_VALIDADE_MS),
  });

  return {
    sessaoId: sessaoRef.id,
    fonteTitulo: titulo,
    questoes: questoes.map(({ id, enunciado, alternativas, bloom }) => ({ id, enunciado, alternativas, bloom })),
  };
});

export const submeterExame = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login necessário.");
  }
  const caller = await getCallerProfile(request.auth.uid);
  await enforceRateLimit(caller.uid, "submeterExame", 10, 60_000);

  const sessaoId = String(request.data?.sessaoId || "").trim();
  const respostas = (request.data?.respostas || {}) as Record<string, unknown>;
  if (!sessaoId) {
    throw new HttpsError("invalid-argument", "Sessão do exame é obrigatória.");
  }

  const userSnap = await db.collection("users").doc(caller.uid).get();
  const sessaoRef = db.collection("examesSessoes").doc(sessaoId);
  const resultadoRef = db.collection("examesResultados").doc();

  // Transação: a sessão só pode ser corrigida uma vez (sem reenvio pra "tentar de novo").
  const resultado = await db.runTransaction(async (tx) => {
    const snap = await tx.get(sessaoRef);
    if (!snap.exists || snap.data()!.userId !== caller.uid) {
      throw new HttpsError("not-found", "Exame não encontrado.");
    }
    const s = snap.data()!;
    if (s.status !== "aberta") {
      throw new HttpsError("failed-precondition", "Este exame já foi enviado.");
    }
    if ((s.expiraEm?.toMillis?.() || 0) < Date.now()) {
      throw new HttpsError("deadline-exceeded", "O prazo deste exame expirou. Gere um novo exame.");
    }

    const questoes = s.questoes as QuestaoExameServidor[];
    let acertos = 0;
    const detalhes = questoes.map((q) => {
      const escolhida = String(respostas[String(q.id)] || "").trim().toUpperCase();
      if (escolhida === q.correta) acertos++;
      return { questaoId: q.id, escolhida, correta: q.correta };
    });
    if (detalhes.some((d) => !d.escolhida)) {
      throw new HttpsError("invalid-argument", "Responda todas as questões antes de enviar.");
    }
    const score = Math.round((acertos / questoes.length) * 100);
    const aprovado = score >= EXAME_NOTA_APROVACAO;
    const proximaTentativa = aprovado
      ? null
      : admin.firestore.Timestamp.fromMillis(Date.now() + EXAME_DIAS_BLOQUEIO * 86_400_000);

    tx.set(resultadoRef, {
      userId: caller.uid,
      userName: (userSnap.data()?.name as string) || "",
      tenantId: s.tenantId,
      fonteId: s.fonteId,
      fonteTitulo: s.fonteTitulo,
      score,
      aprovado,
      respostas: detalhes,
      numQuestoes: questoes.length,
      sessaoId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      proximaTentativa,
    });
    tx.update(sessaoRef, { status: "finalizada", finalizadaEm: admin.firestore.FieldValue.serverTimestamp(), resultadoId: resultadoRef.id });
    return { score, aprovado, gabarito: questoes };
  });

  return resultado;
});

// ── Ranking de Metas & Premiação ─────────────────────────────────────────────
// Colaborador não lê mais notas/progresso dos colegas (firestore.rules) — o ranking, que é
// a única tela que precisa disso, passa a ser calculado aqui e devolve SÓ nome + valor
// agregado por métrica (o mesmo que o card de ranking sempre exibiu). Mesma regra de cálculo
// que calcularRanking() tinha no MetasView.tsx: agrupado pelo nome gravado em cada registro.
type MetricaMeta = "media_quizzes" | "trilhas_concluidas" | "exames_aprovados" | "total_pontos";

export const rankingMetas = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login necessário.");
  }
  const caller = await getCallerProfile(request.auth.uid);
  await enforceRateLimit(caller.uid, "rankingMetas", 30, 60_000);

  // Equipe da plataforma (SUPERADMIN/equipe_mj) "acessa" clientes sem pertencer a eles —
  // só ela pode escolher o tenant; os demais sempre veem o próprio.
  const pedido = String(request.data?.tenantId || "").trim();
  const tenantId = PLATFORM_STAFF_ROLES.includes(caller.role) && pedido ? pedido : caller.tenantId;
  if (!tenantId) {
    throw new HttpsError("invalid-argument", "Cliente não informado.");
  }

  const [quizSnap, trilhasSnap, examesSnap] = await Promise.all([
    db.collection("treinamentosQuizResults").where("tenantId", "==", tenantId).get(),
    db.collection("trilhasProgresso").where("tenantId", "==", tenantId).where("concluida", "==", true).get(),
    db.collection("examesResultados").where("tenantId", "==", tenantId).where("aprovado", "==", true).get(),
  ]);

  const usuarios: Record<string, { quizNotas: number[]; trilhas: number; exames: number }> = {};
  const de = (nome: string) => (usuarios[nome] ||= { quizNotas: [], trilhas: 0, exames: 0 });
  quizSnap.docs.forEach((d) => de(String(d.data().colaborador ?? "")).quizNotas.push(Number(d.data().nota) || 0));
  trilhasSnap.docs.forEach((d) => de(String(d.data().userName ?? "")).trilhas++);
  examesSnap.docs.forEach((d) => de(String(d.data().userName ?? "")).exames++);

  const calcular = (metrica: MetricaMeta) => Object.entries(usuarios).map(([nome, u]) => {
    const mediaQuiz = u.quizNotas.length ? Math.round(u.quizNotas.reduce((a, b) => a + b, 0) / u.quizNotas.length) : 0;
    const valor = metrica === "media_quizzes" ? mediaQuiz
      : metrica === "trilhas_concluidas" ? u.trilhas
      : metrica === "exames_aprovados" ? u.exames
      : mediaQuiz + u.trilhas * 10 + u.exames * 15;
    return { nome, valor };
  }).sort((a, b) => b.valor - a.valor);

  return {
    media_quizzes: calcular("media_quizzes"),
    trilhas_concluidas: calcular("trilhas_concluidas"),
    exames_aprovados: calcular("exames_aprovados"),
    total_pontos: calcular("total_pontos"),
  };
});

// ── Quizzes corrigidos no servidor (Trilhas, Treinamentos, Desempate) ────────
// Mesmo problema que os Exames tinham: questões com gabarito no navegador e nota/aprovação
// gravadas pelo próprio cliente (trilhasProgresso, treinamentosQuizResults, metasDesempate).
// Agora o gabarito fica em quizSessoes/ ou metasDesempateGabarito/ (sem acesso pelo cliente)
// e só estas functions gravam nota, aprovação, progresso e resultado.
const QUIZ_SESSAO_VALIDADE_MS = 6 * 60 * 60 * 1000;
const QUIZ_TREINAMENTO_DIAS_BLOQUEIO = 3;
const QUIZ_TREINAMENTO_NOTA_APROVACAO = 70;

function podeVerConteudo(caller: CallerProfile, tenantIds: string[] | undefined): boolean {
  const ids = tenantIds || [];
  return PLATFORM_STAFF_ROLES.includes(caller.role) || ids.includes("GLOBAL") || (!!caller.tenantId && ids.includes(caller.tenantId));
}

interface ModuloTrilha { id: string; titulo?: string; descricao?: string; conteudo?: string; tipo?: string; temQuiz?: boolean; notaMinima?: number }
interface ModuloProgressoServidor { assistido: boolean; aprovado: boolean; nota: number | null; tentativas: number }

// Mesma regra de calcPercObrigatorios() do TrailsView.tsx.
function calcularPercentual(modulos: ModuloTrilha[], prog: Record<string, ModuloProgressoServidor>): number {
  const obrigatorios = modulos.filter((m) => m.tipo === "obrigatorio");
  if (obrigatorios.length === 0) return 100;
  const concluidos = obrigatorios.filter((m) => {
    const p = prog[m.id];
    return !!p && p.assistido && (!m.temQuiz || p.aprovado);
  });
  return Math.round((concluidos.length / obrigatorios.length) * 100);
}

// Carrega progresso do próprio usuário + trilha + módulo, validando dono e visibilidade.
async function carregarProgressoModulo(caller: CallerProfile, progressoId: string, moduloId: string) {
  const progRef = db.collection("trilhasProgresso").doc(progressoId);
  const progSnap = await progRef.get();
  if (!progSnap.exists || progSnap.data()!.userId !== caller.uid) {
    throw new HttpsError("not-found", "Progresso da trilha não encontrado.");
  }
  const prog = progSnap.data()!;
  const trilhaSnap = await db.collection("trilhas").doc(String(prog.trilhaId || "")).get();
  if (!trilhaSnap.exists || !podeVerConteudo(caller, trilhaSnap.data()!.tenantIds)) {
    throw new HttpsError("not-found", "Trilha não encontrada.");
  }
  const trilha = trilhaSnap.data()!;
  const modulos = (trilha.modulos || []) as ModuloTrilha[];
  const modulo = modulos.find((m) => m.id === moduloId);
  if (!modulo) {
    throw new HttpsError("not-found", "Módulo não encontrado.");
  }
  return { progRef, prog, trilha, trilhaId: trilhaSnap.id, modulos, modulo };
}

// Grava o progresso recalculado e registra a conclusão no auditLogs (uma vez, na transição).
async function salvarProgresso(
  caller: CallerProfile, progRef: FirebaseFirestore.DocumentReference, prog: FirebaseFirestore.DocumentData,
  modulos: ModuloTrilha[], novosModulos: Record<string, ModuloProgressoServidor>,
) {
  const percentualObrigatorios = calcularPercentual(modulos, novosModulos);
  const concluida = percentualObrigatorios === 100;
  await progRef.update({ modulos: novosModulos, percentualObrigatorios, concluida, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  if (concluida && !prog.concluida) {
    await db.collection("auditLogs").add({
      tipo: "trilha_concluida", descricao: "Trilha concluida: " + (prog.trilhaTitulo || ""),
      usuario: prog.userName || "", usuarioId: caller.uid, tenantId: prog.tenantId || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  return { id: progRef.id, ...prog, modulos: novosModulos, percentualObrigatorios, concluida };
}

export const marcarModuloAssistido = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login necessário.");
  const caller = await getCallerProfile(request.auth.uid);
  await enforceRateLimit(caller.uid, "marcarModuloAssistido", 60, 60_000);
  const { progRef, prog, modulos, modulo } = await carregarProgressoModulo(
    caller, String(request.data?.progressoId || ""), String(request.data?.moduloId || ""));
  const atuais = (prog.modulos || {}) as Record<string, ModuloProgressoServidor>;
  const atual = atuais[modulo.id] || { assistido: false, aprovado: false, nota: null, tentativas: 0 };
  return { progresso: await salvarProgresso(caller, progRef, prog, modulos, { ...atuais, [modulo.id]: { ...atual, assistido: true } }) };
});

export const gerarQuizModulo = onCall({ secrets: [GEMINI_API_KEY], timeoutSeconds: 120 }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login necessário.");
  const caller = await getCallerProfile(request.auth.uid);
  await enforceRateLimit(caller.uid, "gerarQuizModulo", 10, 60_000);
  const progressoId = String(request.data?.progressoId || "");
  const { trilha, trilhaId, modulo } = await carregarProgressoModulo(caller, progressoId, String(request.data?.moduloId || ""));
  if (!modulo.temQuiz) throw new HttpsError("failed-precondition", "Este módulo não tem quiz.");

  const prompt = `Você é um gerador de quiz para treinamento corporativo.

Módulo: ${modulo.titulo || ""}
Conteúdo:
${String(modulo.conteudo || modulo.descricao || "").substring(0, 4000)}

Gere EXATAMENTE ${EXAME_NUM_QUESTOES} questões de múltipla escolha sobre este conteúdo (bloom: "compreensao", "aplicacao" ou "analise").
${FORMATO_QUESTOES_JSON}`;
  const questoes = await gerarQuestoesIA(prompt);

  const sessaoRef = db.collection("quizSessoes").doc();
  await sessaoRef.set({
    tipo: "modulo", userId: caller.uid, tenantId: caller.tenantId, progressoId, trilhaId,
    trilhaTitulo: trilha.titulo || "", moduloId: modulo.id, moduloTitulo: modulo.titulo || "",
    notaMinima: Number(modulo.notaMinima) || 0, questoes, status: "aberta",
    criadaEm: admin.firestore.FieldValue.serverTimestamp(),
    expiraEm: admin.firestore.Timestamp.fromMillis(Date.now() + QUIZ_SESSAO_VALIDADE_MS),
  });
  return { sessaoId: sessaoRef.id, questoes: questoes.map((q) => ({ pergunta: q.enunciado, opcoes: q.alternativas.map((a) => a.texto) })) };
});

const LETRAS_QUIZ = ["A", "B", "C", "D"];

// Marca a sessão como finalizada numa transação (impede reenvio) e devolve seus dados.
async function fecharSessao(caller: CallerProfile, sessaoId: string, tipo: string): Promise<FirebaseFirestore.DocumentData> {
  const ref = db.collection("quizSessoes").doc(sessaoId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data()!.userId !== caller.uid || snap.data()!.tipo !== tipo) {
      throw new HttpsError("not-found", "Quiz não encontrado.");
    }
    const s = snap.data()!;
    if (s.status !== "aberta") throw new HttpsError("failed-precondition", "Este quiz já foi enviado.");
    if ((s.expiraEm?.toMillis?.() || 0) < Date.now()) throw new HttpsError("deadline-exceeded", "O prazo deste quiz expirou. Gere um novo.");
    tx.update(ref, { status: "finalizada", finalizadaEm: admin.firestore.FieldValue.serverTimestamp() });
    return s;
  });
}

export const submeterQuizModulo = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login necessário.");
  const caller = await getCallerProfile(request.auth.uid);
  await enforceRateLimit(caller.uid, "submeterQuizModulo", 10, 60_000);
  const respostas = (request.data?.respostas || []) as unknown[];
  const sessaoId = String(request.data?.sessaoId || "");

  // Valida as respostas antes de consumir a sessão.
  const pre = await db.collection("quizSessoes").doc(sessaoId).get();
  const totalPre = (pre.data()?.questoes as unknown[] | undefined)?.length || 0;
  if (!pre.exists || respostas.length < totalPre || respostas.slice(0, totalPre).some((r) => r === null || r === undefined || r === "")) {
    throw new HttpsError("invalid-argument", "Responda todas as questões antes de enviar.");
  }
  const s = await fecharSessao(caller, sessaoId, "modulo");
  const questoes = s.questoes as QuestaoExameServidor[];
  const acertos = questoes.filter((q, i) => LETRAS_QUIZ[Number(respostas[i])] === q.correta).length;
  const nota = Math.round((acertos / questoes.length) * 10 * 10) / 10;
  const aprovado = nota >= (Number(s.notaMinima) || 0);

  const { progRef, prog, modulos, modulo } = await carregarProgressoModulo(caller, s.progressoId, s.moduloId);
  const atuais = (prog.modulos || {}) as Record<string, ModuloProgressoServidor>;
  const tentativas = (atuais[modulo.id]?.tentativas || 0) + 1;
  const progresso = await salvarProgresso(caller, progRef, prog, modulos,
    { ...atuais, [modulo.id]: { assistido: true, aprovado, nota, tentativas } });

  // Registro para Relatórios/Certificados/risco (antes gravado pelo cliente).
  await db.collection("treinamentosQuizResults").add({
    colaborador: prog.userName || "", userId: caller.uid, nota: nota * 10, aprovado,
    trailTitle: s.trilhaTitulo, moduleTitle: s.moduloTitulo, ia: true, tenantId: prog.tenantId || "",
    sessaoId, createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return {
    progresso, nota, aprovado,
    gabarito: questoes.map((q) => ({ correta: LETRAS_QUIZ.indexOf(q.correta), explicacao: q.justificativa })),
  };
});

// Quiz de Treinamentos: o quiz (questões + gabarito) é criado pela gestão em treinamentosQuizzes;
// a correção e o registro do resultado passam a ser feitos aqui.
export const submeterQuizTreinamento = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login necessário.");
  const caller = await getCallerProfile(request.auth.uid);
  await enforceRateLimit(caller.uid, "submeterQuizTreinamento", 10, 60_000);

  const quizId = String(request.data?.quizId || "");
  const respostas = (request.data?.respostas || []) as unknown[];
  const quizSnap = await db.collection("treinamentosQuizzes").doc(quizId).get();
  if (!quizSnap.exists || !podeVerConteudo(caller, quizSnap.data()!.tenantIds)) {
    throw new HttpsError("not-found", "Questionário não encontrado.");
  }
  const quiz = quizSnap.data()!;
  const questoes = (quiz.questoes || []) as { correta: number }[];
  if (!questoes.length || respostas.length < questoes.length) {
    throw new HttpsError("invalid-argument", "Responda todas as questões antes de enviar.");
  }

  const anteriores = (await db.collection("treinamentosQuizResults")
    .where("userId", "==", caller.uid).where("quizId", "==", quizId).get()).docs
    .map((d) => d.data())
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  const ultimaFalha = anteriores.find((r) => !r.aprovado);
  const liberadoEm = (ultimaFalha?.createdAt?.toMillis?.() || 0) + QUIZ_TREINAMENTO_DIAS_BLOQUEIO * 86_400_000;
  if (ultimaFalha && liberadoEm > Date.now()) {
    throw new HttpsError("failed-precondition", `Novo teste liberado em ${new Date(liberadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`);
  }

  const resps = questoes.map((_, i) => Number(respostas[i]));
  const corretas = resps.filter((r, i) => r === Number(questoes[i].correta)).length;
  const nota = Math.round((corretas / questoes.length) * 100);
  const aprovado = nota >= QUIZ_TREINAMENTO_NOTA_APROVACAO;

  const user = (await db.collection("users").doc(caller.uid).get()).data() || {};
  const resultado = {
    quizId, quizTitulo: quiz.titulo || "", treinamento: quiz.treinamento || "",
    colaborador: (user.name as string) || "", userId: caller.uid,
    trailTitle: quiz.treinamento || "", cargo: caller.role, nota, total: questoes.length,
    aprovado, respostas: resps, tenantId: caller.tenantId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  const ref = await db.collection("treinamentosQuizResults").add(resultado);

  // 2 reprovações seguidas no mesmo teste → reforço por e-mail (trigger notificarReforco).
  if (!aprovado && anteriores[0] && !anteriores[0].aprovado && user.email) {
    await db.collection("reforcosPendentes").add({
      userId: caller.uid, colaboradorNome: user.name || "", colaboradorEmail: user.email,
      quizId, quizTitulo: quiz.titulo || "", treinamento: quiz.treinamento || "",
      nota, tenantId: caller.tenantId, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  return { id: ref.id, nota, aprovado, total: questoes.length, corretas };
});

// Desempate de Metas: a gestão cria (questões geradas aqui), os participantes respondem e a
// correção é feita aqui. O documento público (metasDesempate) não leva gabarito — ele fica em
// metasDesempateGabarito/{mesmo id}, sem acesso pelo cliente.
export const criarDesempate = onCall({ secrets: [GEMINI_API_KEY], timeoutSeconds: 120 }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login necessário.");
  const caller = await getCallerProfile(request.auth.uid);
  if (!GESTOR_ROLES.includes(caller.role)) throw new HttpsError("permission-denied", "Só a gestão pode iniciar desempate.");
  await enforceRateLimit(caller.uid, "criarDesempate", 5, 60_000);

  const metaSnap = await db.collection("metas").doc(String(request.data?.metaId || "")).get();
  if (!metaSnap.exists) throw new HttpsError("not-found", "Meta não encontrada.");
  const meta = metaSnap.data()!;
  if (!PLATFORM_STAFF_ROLES.includes(caller.role) && meta.tenantId !== caller.tenantId) {
    throw new HttpsError("permission-denied", "Meta de outro cliente.");
  }
  const participantes = ((request.data?.participantes || []) as unknown[]).map(String).filter(Boolean);
  if (participantes.length < 2) throw new HttpsError("invalid-argument", "O desempate precisa de pelo menos 2 participantes.");

  const prompt = `Você é um especialista em avaliação educacional corporativa.

Gere EXATAMENTE ${EXAME_NUM_QUESTOES} questões de múltipla escolha de ALTO NÍVEL usando a Taxonomia de Bloom:
- 4 questões de AVALIAÇÃO (bloom: "avaliacao", Nível 5) — julgar, justificar, defender, criticar posições
- 3 questões de CRIAÇÃO (bloom: "criacao", Nível 6) — propor, elaborar, construir, formular soluções

Contexto: Meta de premiação "${meta.titulo || ""}".
As questões devem ser sobre boas práticas de conformidade, LGPD, gestão de qualidade e segurança da informação.
As questões devem exigir raciocínio complexo, análise crítica e síntese — não memorização simples.
${FORMATO_QUESTOES_JSON}`;
  const questoes = await gerarQuestoesIA(prompt, ["avaliacao", "criacao"], "avaliacao");

  const ref = db.collection("metasDesempate").doc();
  await db.batch()
    .set(ref, {
      metaId: metaSnap.id, metaTitulo: meta.titulo || "", participantes,
      questoes: questoes.map(({ id, enunciado, alternativas, bloom }) => ({ id, enunciado, alternativas, bloom })),
      resultados: {}, status: "aberto", tenantId: meta.tenantId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    .set(db.collection("metasDesempateGabarito").doc(ref.id), { questoes, tenantId: meta.tenantId })
    .commit();
  return { id: ref.id, total: questoes.length };
});

export const submeterDesempate = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login necessário.");
  const caller = await getCallerProfile(request.auth.uid);
  await enforceRateLimit(caller.uid, "submeterDesempate", 10, 60_000);

  const sessaoId = String(request.data?.sessaoId || "");
  const respostas = (request.data?.respostas || {}) as Record<string, unknown>;
  const nome = ((await db.collection("users").doc(caller.uid).get()).data()?.name as string) || "";
  const ref = db.collection("metasDesempate").doc(sessaoId);
  const gabarito = ((await db.collection("metasDesempateGabarito").doc(sessaoId).get()).data()?.questoes || []) as QuestaoExameServidor[];
  if (!gabarito.length) throw new HttpsError("not-found", "Desempate não encontrado.");

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Desempate não encontrado.");
    const s = snap.data()!;
    if (s.tenantId !== caller.tenantId || !(s.participantes as string[]).includes(nome)) {
      throw new HttpsError("permission-denied", "Você não participa deste desempate.");
    }
    if (s.status !== "aberto" || s.resultados?.[nome]) throw new HttpsError("failed-precondition", "Você já respondeu este desempate.");
    const escolhas = gabarito.map((_, i) => String(respostas[String(i)] || "").toUpperCase());
    if (escolhas.some((e) => !e)) throw new HttpsError("invalid-argument", "Responda todas as questões antes de enviar.");

    const score = gabarito.filter((q, i) => escolhas[i] === q.correta).length;
    const nota = Math.round((score / gabarito.length) * 100);
    const resultados = { ...(s.resultados || {}), [nome]: { score, nota } };
    const todosResponderam = (s.participantes as string[]).every((p) => resultados[p]);
    tx.update(ref, { resultados, ...(todosResponderam ? { status: "encerrado" } : {}) });
    return { score, nota, todosResponderam, gabarito: gabarito.map((q) => ({ correta: q.correta, justificativa: q.justificativa })) };
  });
});

// ── Mídia do Repositório hospedada no Google Drive ───────────────────────────
// O ID do arquivo no Drive saiu do doc repositorio/{id} (legível por todo o tenant) e foi
// para repositorioPrivado/{id} (só gestão). O colaborador recebe o endereço do player só
// aqui, depois de conferir login, visibilidade do conteúdo para o cliente dele e se o item
// está ativo. (O fallback para repositorio.driveId cobre itens ainda não migrados.)
export const abrirMidia = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login necessário.");
  const caller = await getCallerProfile(request.auth.uid);
  await enforceRateLimit(caller.uid, "abrirMidia", 60, 60_000);

  const midiaId = String(request.data?.midiaId || "");
  const snap = await db.collection("repositorio").doc(midiaId).get();
  if (!snap.exists || snap.data()!.ativo === false || !podeVerConteudo(caller, snap.data()!.tenantIds)) {
    throw new HttpsError("not-found", "Conteúdo não encontrado.");
  }
  const privado = (await db.collection("repositorioPrivado").doc(midiaId).get()).data();
  const driveId = String(privado?.driveId || snap.data()!.driveId || "");
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(driveId)) {
    throw new HttpsError("failed-precondition", "Este conteúdo está sem arquivo vinculado.");
  }
  return { embedUrl: `https://drive.google.com/file/d/${driveId}/preview` };
});

// ── Histórico de senhas (não repetir as últimas 3) ───────────────────────────
// Antes ficava em users/{uid}.passwordHistory como SHA-256 com um "sal" fixo que está no
// bundle do site — e users/ é legível pelos colegas do mesmo cliente, o que permitia quebrar
// senhas fracas offline. Agora: scrypt com sal aleatório por senha, em senhasHistorico/{uid}
// (sem acesso pelo cliente). Entradas "legado-sha256" são as migradas do formato antigo,
// mantidas só pra a regra das últimas 3 continuar valendo até serem empurradas pra fora.
const SENHA_LEGADO_SAL = "cartorio-rag-salt-2026";
const SENHA_HISTORICO_MAX = 3;
// Chave pública da Web API do Firebase (a mesma que vai no bundle do site — não é segredo);
// usada só pra confirmar, via REST, que a senha informada é de fato a senha atual da conta.
const FIREBASE_WEB_API_KEY = "AIzaSyD7jXKOb1kmasmFppfT0PAto6FfsyEWfVw";

interface EntradaSenha { tipo: "scrypt" | "legado-sha256"; hash: string; sal?: string }

function senhaForte(s: string): boolean {
  return s.length >= 12 && /[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s) && /[!@#$%^&*(),.?":{}|<>_-]/.test(s);
}

function scryptHex(senha: string, sal: string): Promise<string> {
  return new Promise((resolve, reject) =>
    scrypt(senha, sal, 64, { N: 16384, r: 8, p: 1 }, (err, buf) => (err ? reject(err) : resolve(buf.toString("hex")))));
}

async function senhaJaUsada(senha: string, entradas: EntradaSenha[]): Promise<boolean> {
  for (const e of entradas) {
    const calculado = e.tipo === "scrypt"
      ? await scryptHex(senha, e.sal || "")
      : createHash("sha256").update(senha + SENHA_LEGADO_SAL).digest("hex");
    if (calculado.length === e.hash.length && timingSafeEqual(Buffer.from(calculado), Buffer.from(e.hash))) return true;
  }
  return false;
}

export const validarNovaSenha = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login necessário.");
  await enforceRateLimit(request.auth.uid, "validarNovaSenha", 10, 60_000);
  const novaSenha = String(request.data?.novaSenha || "");
  if (!senhaForte(novaSenha)) {
    throw new HttpsError("invalid-argument", "Senha fraca. Mínimo 12 caracteres, com maiúscula, minúscula, número e caractere especial.");
  }
  const hist = ((await db.collection("senhasHistorico").doc(request.auth.uid).get()).data()?.entradas || []) as EntradaSenha[];
  if (await senhaJaUsada(novaSenha, hist.slice(-SENHA_HISTORICO_MAX))) {
    throw new HttpsError("failed-precondition", "Esta senha já foi utilizada recentemente. Escolha uma senha diferente das últimas 3.");
  }
  return { ok: true };
});

// Chamada DEPOIS que o cliente trocou a senha no Firebase Auth: confirma (login REST) que a
// senha informada é mesmo a atual e só então registra no histórico e libera o primeiro acesso.
export const registrarNovaSenha = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login necessário.");
  const uid = request.auth.uid;
  await enforceRateLimit(uid, "registrarNovaSenha", 5, 60_000);
  const novaSenha = String(request.data?.novaSenha || "");
  const email = (await admin.auth().getUser(uid)).email || "";

  const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`, {
    method: "POST",
    // Referer do site: a chave pode estar restrita por domínio no Google Cloud.
    headers: { "Content-Type": "application/json", Referer: "https://cartorio-edu.vercel.app/" },
    body: JSON.stringify({ email, password: novaSenha, returnSecureToken: false }),
  });
  if (!resp.ok) throw new HttpsError("permission-denied", "A senha informada não confere com a senha atual da conta.");

  const sal = randomBytes(16).toString("hex");
  const entrada: EntradaSenha = { tipo: "scrypt", sal, hash: await scryptHex(novaSenha, sal) };
  const histRef = db.collection("senhasHistorico").doc(uid);
  await db.runTransaction(async (tx) => {
    const atuais = ((await tx.get(histRef)).data()?.entradas || []) as EntradaSenha[];
    tx.set(histRef, { entradas: [...atuais, entrada].slice(-SENHA_HISTORICO_MAX), atualizadoEm: admin.firestore.FieldValue.serverTimestamp() });
    tx.update(db.collection("users").doc(uid), {
      isFirstLogin: false, mustChangePassword: false,
      passwordUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      passwordHistory: admin.firestore.FieldValue.delete(),
    });
  });
  return { ok: true };
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
  serventiaUf: string;
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
  dataInicio: string;
  dataConclusao: string;
  dataEmissao: string;
  emitidoPor: string;
  validoAte: string;
}

// O hash cobre só os campos que atestam o conteúdo em si do certificado (identidade,
// curso, nota, datas) — exatamente o conjunto pedido: codigo, versaoModelo, tenantId, uid,
// nome, cpf, cargo, serventia, curso, cargaHorariaHoras, modalidade, dataInicio, dataConclusao,
// aproveitamento, notaMinima, dataEmissao. Os nomes gravados no Firestore (colaboradorId,
// trilhaTitulo, cartorio, notaFinal, cargaHoraria...) são os mesmos de sempre, pra não quebrar
// Relatórios/Dossiê/Meu Progresso, que já leem esses campos — o mapeamento pro nome "canônico"
// acontece só na hora de montar o JSON que é hasheado. Instrutor/assinatura/emissora NÃO entram
// no hash (são metadados de exibição, config da plataforma — não "fatos" sobre a aprovação).
function hashCertificado(codigo: string, dados: DadosCertificado): string {
  const canonico = {
    codigo,
    versaoModelo: 2,
    tenantId: dados.tenantId,
    uid: dados.colaboradorId,
    nome: dados.colaboradorNome,
    cpf: dados.cpf || "",
    cargo: dados.cargo,
    serventia: dados.cartorio,
    curso: dados.trilhaTitulo,
    cargaHorariaHoras: dados.cargaHoraria,
    modalidade: dados.modalidade,
    dataInicio: dados.dataInicio,
    dataConclusao: dados.dataConclusao,
    aproveitamento: dados.notaFinal,
    notaMinima: dados.notaMinima,
    dataEmissao: dados.dataEmissao,
  };
  return createHash("sha256").update(canonicalStringify(canonico)).digest("hex");
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
      cpf: c.cpf || "", cargo: c.cargo || "", cartorio: c.cartorio || "", serventiaUf: c.serventiaUf || "",
      trilhaTitulo: c.trilhaTitulo, moduloTitulo: c.moduloTitulo || "", tipo: c.tipo,
      notaFinal: c.notaFinal, notaMinima: c.notaMinima || 0, cargaHoraria: c.cargaHoraria,
      modalidade: c.modalidade || "", instrutor: c.instrutor || "", instrutorCargo: c.instrutorCargo || "",
      instrutorQualificacoes: c.instrutorQualificacoes || "", assinaturaUrl: c.assinaturaUrl || "",
      emissoraRazaoSocial: c.emissoraRazaoSocial || "", emissoraCnpj: c.emissoraCnpj || "",
      localEmissao: c.localEmissao || "", dataInicio: c.dataInicio || "", dataConclusao: c.dataConclusao || "", dataEmissao: c.dataEmissao || "",
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

  // Minimização LGPD: esta function é pública (sem login) — nunca devolve CPF, uid ou e-mail,
  // só o que é necessário pra confirmar autenticidade (nome, curso, nota, datas, status do hash).
  return {
    valido: true,
    versaoModelo,
    colaboradorNome: c.colaboradorNome as string,
    cargo: (c.cargo as string) || "",
    cartorio: (c.cartorio as string) || "",
    trilhaTitulo: c.trilhaTitulo as string,
    tipo: c.tipo as string,
    notaFinal: c.notaFinal as number,
    notaMinima: (c.notaMinima as number) || null,
    cargaHoraria: c.cargaHoraria as number,
    modalidade: (c.modalidade as string) || "",
    dataInicio: (c.dataInicio as string) || null,
    dataConclusao: (c.dataConclusao as string) || null,
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
  // dataInicio = aprovação mais antiga nesse exame e dataConclusao = a mais recente (só as
  // aprovadas entram na consulta acima) — não existe "matrícula" pra exame avulso (não é uma
  // trilha com progresso), então a primeira aprovação registrada serve de proxy de início.
  // Se só houver uma aprovação, dataInicio e dataConclusao coincidem.
  const tentativas = examesSnap.docs.map((d) => d.data().createdAt?.toDate?.() as Date | undefined).filter(Boolean) as Date[];
  const dataInicioDate = tentativas.length ? new Date(Math.min(...tentativas.map((d) => d.getTime()))) : new Date();
  const dataConclusaoDate = tentativas.length ? new Date(Math.max(...tentativas.map((d) => d.getTime()))) : new Date();

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
  const dataEmissaoIso = agora.toISOString().slice(0, 10);
  const validoAte = new Date(agora);
  validoAte.setFullYear(validoAte.getFullYear() + 1);

  const { codigo, novo } = await criarCertificado({
    tenantId: caller.tenantId,
    colaboradorId: caller.uid,
    colaboradorNome: (userData.name as string) || "",
    cpf: (userData.cpf as string) || "",
    cargo: (userData.cargo as string) || (userData.role as string) || "",
    cartorio: cartorioNome,
    serventiaUf: (tenantData.uf as string) || "",
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
    dataInicio: dataInicioDate.toISOString().slice(0, 10),
    dataConclusao: dataConclusaoDate.toISOString().slice(0, 10),
    dataEmissao: dataEmissaoIso,
    emitidoPor: (userData.name as string) || "Sistema",
    validoAte: validoAte.toISOString().slice(0, 10),
  });
  // O cliente lê o restante dos dados direto do documento criado (certificados/{codigo} — a
  // leitura já é permitida pro próprio titular), em vez de duplicar aqui todos os campos
  // precisados pra montar o certificadoTemplate(dados) no frontend.
  return { codigoVerificacao: codigo, novo };
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

  // Data de início: pra trilha/módulo, usa quando o colaborador abriu a trilha pela primeira
  // vez (trilhasProgresso.iniciadoEm, se existir); pra exame, a tentativa mais antiga registrada.
  // Data de conclusão: quando concluiu a trilha, ou a aprovação mais recente no exame. Sem
  // nenhum desses dados (trilha antiga, sem o campo), cai no fallback: a própria data de emissão.
  const agora = new Date();
  const dataEmissaoIso = agora.toISOString().slice(0, 10);
  let dataInicioIso = dataEmissaoIso;
  let dataConclusaoIso = dataEmissaoIso;

  if (tipo === "exame") {
    const tentativasSnap = await db.collection("examesResultados")
      .where("userId", "==", colaboradorId).where("fonteTitulo", "==", trilhaTitulo).get();
    const datas = tentativasSnap.docs.map((d) => d.data().createdAt?.toDate?.() as Date | undefined).filter(Boolean) as Date[];
    if (datas.length) {
      dataInicioIso = new Date(Math.min(...datas.map((d) => d.getTime()))).toISOString().slice(0, 10);
      dataConclusaoIso = new Date(Math.max(...datas.map((d) => d.getTime()))).toISOString().slice(0, 10);
    }
  } else {
    const progressoSnap = await db.collection("trilhasProgresso")
      .where("userId", "==", colaboradorId).where("trilhaTitulo", "==", trilhaTitulo).limit(1).get();
    const progresso = progressoSnap.empty ? null : progressoSnap.docs[0].data();
    if (progresso?.iniciadoEm?.toDate) dataInicioIso = progresso.iniciadoEm.toDate().toISOString().slice(0, 10);
    if (progresso?.updatedAt?.toDate) dataConclusaoIso = progresso.updatedAt.toDate().toISOString().slice(0, 10);
  }

  const validoAte = new Date(agora);
  validoAte.setFullYear(validoAte.getFullYear() + 1);

  const { codigo, novo } = await criarCertificado({
    tenantId,
    colaboradorId,
    colaboradorNome: (colabData.name as string) || "",
    cpf: (colabData.cpf as string) || "",
    cargo: (colabData.cargo as string) || (colabData.role as string) || "",
    cartorio: cartorioNome,
    serventiaUf: (tenantData.uf as string) || "",
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
    dataInicio: dataInicioIso,
    dataConclusao: dataConclusaoIso,
    dataEmissao: dataEmissaoIso,
    emitidoPor: emitidoPorNome,
    validoAte: validoAte.toISOString().slice(0, 10),
  });
  return { id: codigo, codigoVerificacao: codigo, novo };
});
