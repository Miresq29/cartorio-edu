import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import * as admin from "firebase-admin";

const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
// E-mail remetente verificado no Resend. Ex: "MJ Consultoria <avisos@seudominio.com.br>".
// Configure com: firebase functions:config isn't used in v2 — defina via
// `firebase functions:secrets:set` ou variável de ambiente EMAIL_FROM no deploy.
const EMAIL_FROM = defineString("EMAIL_FROM", { default: "MJ Consultoria <onboarding@resend.dev>" });

const DIAS_ANTES_EXPIRACAO = 7;

function db() {
  return admin.firestore();
}

async function sendEmail(apiKey: string, from: string, to: string, subject: string, html: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data?.message || `HTTP ${res.status}` };
    }
    return { ok: true, id: data?.id };
  } catch (err: any) {
    return { ok: false, error: err.message || "Erro de rede ao enviar e-mail." };
  }
}

async function logEmailEvidencia(params: {
  tenantId: string;
  destinatarioEmail: string;
  destinatarioNome: string;
  tipoNotificacao: string;
  assunto: string;
  ok: boolean;
  erro?: string;
  resendId?: string;
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
      ...(params.resendId ? { resendId: params.resendId } : {}),
      ...(params.erro ? { erro: params.erro } : {}),
      ...(params.relatedId ? { relatedId: params.relatedId } : {}),
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function resolveRecipients(tenantIds: string[]): Promise<{ id: string; email: string; name: string; tenantId: string }[]> {
  const isGlobal = tenantIds.includes("GLOBAL");
  const snap = isGlobal
    ? await db().collection("users").where("active", "==", true).get()
    : await db().collection("users").where("tenantId", "in", tenantIds.slice(0, 30)).where("active", "==", true).get();

  return snap.docs
    .map((d) => {
      const u = d.data();
      return { id: d.id, email: u.email, name: u.name || u.email, tenantId: u.tenantId };
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

function htmlAviso(titulo: string, corpo: string, rodape: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
    <h2 style="color:#0A1628;margin-bottom:4px">${titulo}</h2>
    <div style="font-size:14px;line-height:1.6;white-space:pre-wrap">${corpo}</div>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
    <p style="font-size:11px;color:#94a3b8">${rodape}</p>
  </div>`;
}

// ─── Trigger: novo comunicado publicado → e-mail para os colaboradores do(s) cartório(s) ──
export const notificarComunicado = onDocumentCreated(
  { document: "comunicados/{docId}", secrets: [RESEND_API_KEY] },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const tenantIds: string[] = data.tenantIds || [];
    const apiKey = RESEND_API_KEY.value();
    const from = EMAIL_FROM.value();
    const assunto = `[Aviso] ${data.titulo || "Novo comunicado"}`;

    const destinatarios = await resolveRecipients(tenantIds);
    for (const dest of destinatarios) {
      const result = await sendEmail(apiKey, from, dest.email, assunto,
        htmlAviso(data.titulo || "Comunicado", data.corpo || "", "Você recebeu este e-mail porque é colaborador cadastrado na plataforma MJ Consultoria."));
      await logEmailEvidencia({
        tenantId: dest.tenantId, destinatarioEmail: dest.email, destinatarioNome: dest.name,
        tipoNotificacao: "comunicado", assunto, ok: result.ok, erro: result.error, resendId: result.id,
        relatedId: event.params.docId,
      });
    }
  }
);

// ─── Trigger: nova trilha de treinamento → e-mail para os perfis alvo do(s) cartório(s) ──
export const notificarTrilha = onDocumentCreated(
  { document: "trilhas/{docId}", secrets: [RESEND_API_KEY] },
  async (event) => {
    const data = event.data?.data();
    if (!data || data.ativa === false) return;
    const tenantIds: string[] = data.tenantIds || [];
    const perfis: string[] = data.perfis || [];
    const apiKey = RESEND_API_KEY.value();
    const from = EMAIL_FROM.value();
    const assunto = `Nova trilha de treinamento: ${data.titulo || ""}`;

    const destinatarios = await resolveRecipientsComPerfil(tenantIds, perfis);
    for (const dest of destinatarios) {
      const result = await sendEmail(apiKey, from, dest.email, assunto,
        htmlAviso("Nova trilha disponível", `A trilha "${data.titulo}" foi liberada para o seu perfil.\n\n${data.descricao || ""}`,
          "Acesse a plataforma MJ Consultoria para iniciar a trilha."));
      await logEmailEvidencia({
        tenantId: dest.tenantId, destinatarioEmail: dest.email, destinatarioNome: dest.name,
        tipoNotificacao: "trilha", assunto, ok: result.ok, erro: result.error, resendId: result.id,
        relatedId: event.params.docId,
      });
    }
  }
);

// ─── Agendado diário: certificados perto de expirar → e-mail de aviso ao colaborador ──
export const verificarExpiracoes = onSchedule(
  { schedule: "every day 08:00", timeZone: "America/Sao_Paulo", secrets: [RESEND_API_KEY] },
  async () => {
    const apiKey = RESEND_API_KEY.value();
    const from = EMAIL_FROM.value();
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
      const result = await sendEmail(apiKey, from, email, assunto,
        htmlAviso("Certificado próximo de expirar",
          `O certificado "${cert.trilhaTitulo || cert.moduloTitulo}" emitido em favor de ${cert.colaboradorNome} vence em ${diasRestantes} dia(s) (${validoAte.toLocaleDateString("pt-BR")}). Procure seu gestor para renovação.`,
          "Aviso automático da plataforma MJ Consultoria."));

      await logEmailEvidencia({
        tenantId: cert.tenantId, destinatarioEmail: email, destinatarioNome: cert.colaboradorNome || email,
        tipoNotificacao: "expiracao_certificado", assunto, ok: result.ok, erro: result.error, resendId: result.id,
        relatedId: doc.id,
      });

      await doc.ref.update({ avisoExpiracaoEnviado: true });
    }
  }
);

// ─── Callable de teste: SUPERADMIN dispara um e-mail de teste pra si mesmo ──
export const testarEnvioEmail = onCall({ secrets: [RESEND_API_KEY] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login necessário.");
  const callerSnap = await db().collection("users").doc(request.auth.uid).get();
  const caller = callerSnap.data();
  if (!caller || caller.role !== "SUPERADMIN") {
    throw new HttpsError("permission-denied", "Apenas SUPERADMIN pode testar o envio de e-mail.");
  }
  const email = String(caller.email || "");
  if (!email) throw new HttpsError("failed-precondition", "Sua conta não tem e-mail cadastrado.");

  const apiKey = RESEND_API_KEY.value();
  const from = EMAIL_FROM.value();
  const result = await sendEmail(apiKey, from, email, "Teste de envio — MJ Consultoria",
    htmlAviso("Teste de configuração", "Se você recebeu este e-mail, o envio de notificações está funcionando corretamente.", "Disparado manualmente via botão de teste."));

  await logEmailEvidencia({
    tenantId: caller.tenantId || "", destinatarioEmail: email, destinatarioNome: caller.name || email,
    tipoNotificacao: "teste", assunto: "Teste de envio — MJ Consultoria", ok: result.ok, erro: result.error, resendId: result.id,
  });

  if (!result.ok) throw new HttpsError("internal", result.error || "Falha ao enviar e-mail de teste.");
  return { success: true };
});
