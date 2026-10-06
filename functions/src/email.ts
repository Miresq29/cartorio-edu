import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";

// Conta Gmail usada para enviar os avisos. Não é segredo — é o próprio
// remetente visível em todo e-mail enviado. A senha de app, sim, fica em
// Secret Manager (GMAIL_APP_PASSWORD) e nunca aparece no código/repositório.
export const GMAIL_USER = "dpoagconsultoria@gmail.com";
export const GMAIL_APP_PASSWORD = defineSecret("GMAIL_APP_PASSWORD");

const DIAS_ANTES_EXPIRACAO = 7;

export function db() {
  return admin.firestore();
}

let transporterCache: { user: string; transporter: nodemailer.Transporter } | null = null;

function getTransporter(user: string, appPassword: string): nodemailer.Transporter {
  if (transporterCache && transporterCache.user === user) return transporterCache.transporter;
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass: appPassword },
  });
  transporterCache = { user, transporter };
  return transporter;
}

export async function sendEmail(user: string, appPassword: string, to: string, subject: string, html: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const transporter = getTransporter(user, appPassword);
    const info = await transporter.sendMail({
      from: `"MJ Consultoria" <${user}>`,
      to,
      subject,
      html,
    });
    return { ok: true, id: info.messageId };
  } catch (err: any) {
    return { ok: false, error: err.message || "Erro ao enviar e-mail." };
  }
}

export async function logEmailEvidencia(params: {
  tenantId: string;
  destinatarioEmail: string;
  destinatarioNome: string;
  tipoNotificacao: string;
  assunto: string;
  ok: boolean;
  erro?: string;
  messageId?: string;
  relatedId?: string;
}) {
  await db().collection("auditLogs").add({
    tipo: params.ok ? "email_enviado" : "email_erro",
    descricao: `${params.ok ? "E-mail enviado" : "Falha ao enviar e-mail"}: "${params.assunto}" para ${params.destinatarioNome} <${params.destinatarioEmail}>`,
    usuario: "Sistema (notificações automáticas)",
    tenantId: params.tenantId,
    metadata: {
      destinatarioEmail: params.destinatarioEmail,
      tipoNotificacao: params.tipoNotificacao,
      assunto: params.assunto,
      ...(params.messageId ? { messageId: params.messageId } : {}),
      ...(params.erro ? { erro: params.erro } : {}),
      ...(params.relatedId ? { relatedId: params.relatedId } : {}),
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export async function resolveRecipients(tenantIds: string[]): Promise<{ id: string; email: string; name: string; tenantId: string; cargo: string; role: string }[]> {
  const isGlobal = tenantIds.includes("GLOBAL");
  const snap = isGlobal
    ? await db().collection("users").where("active", "==", true).get()
    : await db().collection("users").where("tenantId", "in", tenantIds.slice(0, 30)).where("active", "==", true).get();

  return snap.docs
    .map((d) => {
      const u = d.data();
      return { id: d.id, email: u.email, name: u.name || u.email, tenantId: u.tenantId, cargo: u.cargo || "", role: u.role || "" };
    })
    .filter((u) => !!u.email);
}

async function resolveRecipientsComPerfil(tenantIds: string[], perfis: string[]): Promise<{ id: string; email: string; name: string; tenantId: string; role: string }[]> {
  const isGlobal = tenantIds.includes("GLOBAL");
  const snap = isGlobal
    ? await db().collection("users").where("active", "==", true).get()
    : await db().collection("users").where("tenantId", "in", tenantIds.slice(0, 30)).where("active", "==", true).get();

  return snap.docs
    .map((d) => {
      const u = d.data();
      return { id: d.id, email: u.email, name: u.name || u.email, tenantId: u.tenantId, role: u.role || "" };
    })
    .filter((u) => u.email && perfis.includes(u.role));
}

// Escapa HTML de conteúdo digitado por gestores/colaboradores (título, corpo) antes de
// embutir em e-mails — sem isso, um "<" ou "&" no texto quebra visualmente o e-mail
// renderizado mesmo com o dado intacto no Firestore.
export function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function htmlAviso(titulo: string, corpo: string, rodape: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
    <h2 style="color:#0A1628;margin-bottom:4px">${escapeHtml(titulo)}</h2>
    <div style="font-size:14px;line-height:1.6;white-space:pre-wrap">${escapeHtml(corpo)}</div>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
    <p style="font-size:11px;color:#94a3b8">${rodape}</p>
  </div>`;
}

// ─── Trigger: novo comunicado publicado → e-mail para os colaboradores do(s) cartório(s) ──
export const notificarComunicado = onDocumentCreated(
  { document: "comunicados/{docId}", secrets: [GMAIL_APP_PASSWORD] },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    // Envio por e-mail é opt-in por comunicado — o gestor decide, no momento da
    // publicação, se aquele assunto precisa mesmo interromper a caixa de entrada
    // de todo mundo, em vez de disparar automaticamente para todo comunicado.
    if (data.notificarEmail !== true) return;
    const tenantIds: string[] = data.tenantIds || [];
    const user = GMAIL_USER;
    const pass = GMAIL_APP_PASSWORD.value();
    const assunto = `[Aviso] ${data.titulo || "Novo comunicado"}`;

    const destinatarios = await resolveRecipients(tenantIds);
    for (const dest of destinatarios) {
      const result = await sendEmail(user, pass, dest.email, assunto,
        htmlAviso(data.titulo || "Comunicado", data.corpo || "", "Você recebeu este e-mail porque é colaborador cadastrado na plataforma MJ Consultoria."));
      await logEmailEvidencia({
        tenantId: dest.tenantId, destinatarioEmail: dest.email, destinatarioNome: dest.name,
        tipoNotificacao: "comunicado", assunto, ok: result.ok, erro: result.error, messageId: result.id,
        relatedId: event.params.docId,
      });
    }
  }
);

// ─── Trigger: nova trilha de treinamento → e-mail para os perfis alvo do(s) cartório(s) ──
export const notificarTrilha = onDocumentCreated(
  { document: "trilhas/{docId}", secrets: [GMAIL_APP_PASSWORD] },
  async (event) => {
    const data = event.data?.data();
    if (!data || data.ativa === false) return;
    // Assim como em comunicados, o envio de e-mail é opt-in por trilha.
    if (data.notificarEmail !== true) return;
    const tenantIds: string[] = data.tenantIds || [];
    const perfis: string[] = data.perfis || [];
    const user = GMAIL_USER;
    const pass = GMAIL_APP_PASSWORD.value();
    const assunto = `Nova trilha de treinamento: ${data.titulo || ""}`;

    const destinatarios = await resolveRecipientsComPerfil(tenantIds, perfis);
    for (const dest of destinatarios) {
      const result = await sendEmail(user, pass, dest.email, assunto,
        htmlAviso("Nova trilha disponível", `A trilha "${data.titulo}" foi liberada para o seu perfil.\n\n${data.descricao || ""}`,
          "Acesse a plataforma MJ Consultoria para iniciar a trilha."));
      await logEmailEvidencia({
        tenantId: dest.tenantId, destinatarioEmail: dest.email, destinatarioNome: dest.name,
        tipoNotificacao: "trilha", assunto, ok: result.ok, erro: result.error, messageId: result.id,
        relatedId: event.params.docId,
      });
    }
  }
);

// ─── Trigger: 2ª reprovação num mesmo teste → e-mail de reforço para o colaborador ──
export const notificarReforco = onDocumentCreated(
  { document: "reforcosPendentes/{docId}", secrets: [GMAIL_APP_PASSWORD] },
  async (event) => {
    const data = event.data?.data();
    if (!data?.userId) return;

    // A regra do Firestore só valida userId/tenantId — colaboradorEmail vem do
    // cliente e não é confiável como destinatário. Resolve o e-mail real a
    // partir do próprio cadastro do usuário para impedir que a conta emita
    // e-mails da plataforma para qualquer endereço arbitrário.
    const userSnap = await db().collection("users").doc(data.userId).get();
    const userData = userSnap.data();
    if (!userSnap.exists || !userData?.email) return;
    if (userData.tenantId && data.tenantId && userData.tenantId !== data.tenantId) return;

    const user = GMAIL_USER;
    const pass = GMAIL_APP_PASSWORD.value();
    const treinamento = String(data.treinamento || "");
    const quizTitulo = String(data.quizTitulo || "");
    const nota = data.nota;
    const assunto = `Treinamento de reforço recomendado: ${treinamento || quizTitulo}`;

    const result = await sendEmail(user, pass, userData.email, assunto,
      htmlAviso("Treinamento de reforço recomendado",
        `Identificamos duas ou mais reprovações no teste "${quizTitulo}" (treinamento: "${treinamento}"). Última nota: ${nota}%.\n\nRecomendamos revisar o material antes de tentar novamente.`,
        "Aviso automático da plataforma MJ Consultoria."));

    await logEmailEvidencia({
      tenantId: userData.tenantId || data.tenantId || "", destinatarioEmail: userData.email, destinatarioNome: userData.name || userData.email,
      tipoNotificacao: "reforco_treinamento", assunto, ok: result.ok, erro: result.error, messageId: result.id,
      relatedId: event.params.docId,
    });
  }
);

// ─── Agendado diário: certificados perto de expirar → e-mail de aviso ao colaborador ──
export const verificarExpiracoes = onSchedule(
  { schedule: "every day 08:00", timeZone: "America/Sao_Paulo", secrets: [GMAIL_APP_PASSWORD] },
  async () => {
    const user = GMAIL_USER;
    const pass = GMAIL_APP_PASSWORD.value();
    const limite = new Date();
    limite.setDate(limite.getDate() + DIAS_ANTES_EXPIRACAO);

    // "validoAte" é gravado como string ISO 8601 — comparação lexicográfica
    // funciona igual à cronológica nesse formato, evitando o problema do
    // operador "!=" (que exclui documentos onde o campo nem existe).
    const snap = await db().collection("certificados")
      .where("validoAte", "<=", limite.toISOString())
      .get();

    for (const doc of snap.docs) {
      const cert = doc.data();
      if (!cert.validoAte || cert.avisoExpiracaoEnviado === true) continue;
      const validoAte = new Date(cert.validoAte);

      const userSnap = cert.colaboradorId ? await db().collection("users").doc(cert.colaboradorId).get() : null;
      const email = userSnap?.data()?.email;
      if (!email) continue;

      const diasRestantes = Math.max(0, Math.ceil((validoAte.getTime() - Date.now()) / 86_400_000));
      const assunto = `Seu certificado "${cert.trilhaTitulo || cert.moduloTitulo || ""}" vence em ${diasRestantes} dia(s)`;
      const result = await sendEmail(user, pass, email, assunto,
        htmlAviso("Certificado próximo de expirar",
          `O certificado "${cert.trilhaTitulo || cert.moduloTitulo}" emitido em favor de ${cert.colaboradorNome} vence em ${diasRestantes} dia(s) (${validoAte.toLocaleDateString("pt-BR")}). Procure seu gestor para renovação.`,
          "Aviso automático da plataforma MJ Consultoria."));

      await logEmailEvidencia({
        tenantId: cert.tenantId, destinatarioEmail: email, destinatarioNome: cert.colaboradorNome || email,
        tipoNotificacao: "expiracao_certificado", assunto, ok: result.ok, erro: result.error, messageId: result.id,
        relatedId: doc.id,
      });

      await doc.ref.update({ avisoExpiracaoEnviado: true });
    }
  }
);

// ─── Agendado diário: reprovações com prova já liberada para nova tentativa ──
// 1º lembrete assim que a prova é liberada de novo (DIAS_BLOQUEIO, hoje 5 dias, já
// definido no momento da reprovação em ExamesView); 2º lembrete 10 dias depois
// dessa liberação, caso a pessoa ainda não tenha refeito a prova.
const DIAS_LEMBRETE_ATRASO = 10;

export const verificarReexamesPendentes = onSchedule(
  { schedule: "every day 09:00", timeZone: "America/Sao_Paulo", secrets: [GMAIL_APP_PASSWORD] },
  async () => {
    const user = GMAIL_USER;
    const pass = GMAIL_APP_PASSWORD.value();

    // Limita a janela pra nao varrer o historico inteiro todo dia — uma reprovacao
    // relevante pra lembrete sempre tem uma tentativa (ou falta dela) recente.
    const desde = admin.firestore.Timestamp.fromMillis(Date.now() - 90 * 86_400_000);
    const snap = await db().collection("examesResultados").where("createdAt", ">=", desde).get();

    // So interessa a tentativa MAIS RECENTE de cada par usuario+fonte — se a pessoa
    // já refez (passando ou não) depois da reprovação que gerou o bloqueio, aquela
    // reprovação antiga não deve mais gerar lembrete.
    const porChave = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    for (const doc of snap.docs) {
      const data = doc.data();
      if (!data.userId || !data.fonteId) continue;
      const chave = `${data.userId}_${data.fonteId}`;
      const atual = porChave.get(chave);
      const tAtual = atual?.data().createdAt?.toMillis?.() ?? 0;
      const tNovo = data.createdAt?.toMillis?.() ?? 0;
      if (!atual || tNovo > tAtual) porChave.set(chave, doc);
    }

    const agora = Date.now();
    for (const doc of porChave.values()) {
      const data = doc.data();
      if (data.aprovado !== false || !data.proximaTentativa) continue; // aprovado na ultima tentativa, ou sem bloqueio registrado

      const liberadoEm = data.proximaTentativa.toDate ? data.proximaTentativa.toDate() : new Date(data.proximaTentativa);
      if (agora < liberadoEm.getTime()) continue; // ainda dentro do bloqueio — nada a avisar

      const userSnap = await db().collection("users").doc(data.userId).get();
      const userData = userSnap.data();
      if (!userSnap.exists || !userData?.email) continue;

      const diasDesdeLiberacao = Math.floor((agora - liberadoEm.getTime()) / 86_400_000);

      if (!data.lembreteLiberacaoEnviado) {
        const assunto = `Prova liberada novamente: ${data.fonteTitulo || "seu treinamento"}`;
        const result = await sendEmail(user, pass, userData.email, assunto,
          htmlAviso("Prova liberada para nova tentativa",
            `Você já pode refazer a prova "${data.fonteTitulo}" (última nota: ${data.score}%).\n\nAcesse a plataforma MJ Consultoria e tente novamente.`,
            "Aviso automático da plataforma MJ Consultoria."));
        await logEmailEvidencia({
          tenantId: data.tenantId || userData.tenantId || "", destinatarioEmail: userData.email, destinatarioNome: userData.name || userData.email,
          tipoNotificacao: "reexame_liberado", assunto, ok: result.ok, erro: result.error, messageId: result.id, relatedId: doc.id,
        });
        await doc.ref.update({ lembreteLiberacaoEnviado: true, lembreteLiberacaoEnviadoEm: admin.firestore.FieldValue.serverTimestamp() });
      }

      if (diasDesdeLiberacao >= DIAS_LEMBRETE_ATRASO && !data.lembreteAtrasoEnviado) {
        const assunto = `Pendente: prova "${data.fonteTitulo || ""}" ainda não foi refeita`;
        const result = await sendEmail(user, pass, userData.email, assunto,
          htmlAviso("Prova pendente há mais de 10 dias",
            `Já se passaram ${diasDesdeLiberacao} dias desde que a prova "${data.fonteTitulo}" foi liberada para nova tentativa e você ainda não refez. Regularize o quanto antes.`,
            "Aviso automático da plataforma MJ Consultoria."));
        await logEmailEvidencia({
          tenantId: data.tenantId || userData.tenantId || "", destinatarioEmail: userData.email, destinatarioNome: userData.name || userData.email,
          tipoNotificacao: "reexame_atrasado", assunto, ok: result.ok, erro: result.error, messageId: result.id, relatedId: doc.id,
        });
        await doc.ref.update({ lembreteAtrasoEnviado: true, lembreteAtrasoEnviadoEm: admin.firestore.FieldValue.serverTimestamp() });
      }
    }
  }
);

// ─── Callable de teste: SUPERADMIN dispara um e-mail de teste pra si mesmo ──
export const testarEnvioEmail = onCall({ secrets: [GMAIL_APP_PASSWORD] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login necessário.");
  const callerSnap = await db().collection("users").doc(request.auth.uid).get();
  const caller = callerSnap.data();
  if (!caller || caller.role !== "SUPERADMIN") {
    throw new HttpsError("permission-denied", "Apenas SUPERADMIN pode testar o envio de e-mail.");
  }
  const email = String(caller.email || "");
  if (!email) throw new HttpsError("failed-precondition", "Sua conta não tem e-mail cadastrado.");

  const user = GMAIL_USER;
  const pass = GMAIL_APP_PASSWORD.value();
  const result = await sendEmail(user, pass, email, "Teste de envio — MJ Consultoria",
    htmlAviso("Teste de configuração", "Se você recebeu este e-mail, o envio de notificações está funcionando corretamente.", "Disparado manualmente via botão de teste."));

  await logEmailEvidencia({
    tenantId: caller.tenantId || "", destinatarioEmail: email, destinatarioNome: caller.name || email,
    tipoNotificacao: "teste", assunto: "Teste de envio — MJ Consultoria", ok: result.ok, erro: result.error, messageId: result.id,
  });

  if (!result.ok) throw new HttpsError("internal", result.error || "Falha ao enviar e-mail de teste.");
  return { success: true };
});
