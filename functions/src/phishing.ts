import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { GMAIL_USER, GMAIL_APP_PASSWORD, db, sendEmail, logEmailEvidencia, resolveRecipients } from "./email";

// URL fixa da função phishClick (2ª geração, região padrão us-central1).
const PHISH_CLICK_URL = "https://us-central1-cartorio-edu.cloudfunctions.net/phishClick";

// ─── Trigger: nova simulação criada → dispara e-mails com link individual rastreável ──
export const notificarSimulacaoPhishing = onDocumentCreated(
  { document: "simulacoesPhishing/{docId}", secrets: [GMAIL_APP_PASSWORD] },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const simId = event.params.docId;
    const tenantIds: string[] = data.tenantIds || [];
    const user = GMAIL_USER;
    const pass = GMAIL_APP_PASSWORD.value();

    const destinatarios = await resolveRecipients(tenantIds);
    for (const dest of destinatarios) {
      const tokenRef = db().collection("simulacoesPhishingCliques").doc(`${simId}_${dest.id}`);
      await tokenRef.set({
        simId, userId: dest.id, email: dest.email, nome: dest.name, tenantId: dest.tenantId,
        clicado: false, criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      const link = `${PHISH_CLICK_URL}?token=${tokenRef.id}`;
      const corpo = String(data.corpoEmail || "")
        .replace(/{{NOME}}/g, dest.name)
        .replace(/{{LINK}}/g, link);

      const result = await sendEmail(user, pass, dest.email, data.assuntoEmail || "Ação necessária",
        corpo.split("\n").map((l) => `<p style="margin:0 0 12px">${l}</p>`).join(""));

      await logEmailEvidencia({
        tenantId: dest.tenantId, destinatarioEmail: dest.email, destinatarioNome: dest.name,
        tipoNotificacao: "phishing_simulacao", assunto: data.assuntoEmail || "", ok: result.ok, erro: result.error, messageId: result.id,
        relatedId: simId,
      });
    }
  }
);

function paginaEducativa(): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Simulação de Phishing — MJ Consultoria</title>
  <style>
    body{font-family:Arial,sans-serif;background:#0A1628;color:#fff;margin:0;padding:0;display:flex;align-items:center;justify-content:center;min-height:100vh}
    .card{max-width:520px;margin:24px;background:#fff;color:#0f172a;border-radius:20px;padding:32px;text-align:center}
    h1{color:#D97706;font-size:22px;margin:12px 0}
    p{font-size:14px;line-height:1.6;color:#334155}
    .tips{text-align:left;background:#f8fafc;border-radius:12px;padding:16px;margin-top:20px;font-size:13px}
    .tips li{margin-bottom:8px}
  </style></head><body>
  <div class="card">
    <h1>⚠️ Este era um teste de phishing simulado</h1>
    <p>Você clicou em um link enviado como parte de um exercício interno de conscientização em segurança da MJ Consultoria.
    Nenhum dado foi coletado e nenhuma senha foi solicitada.</p>
    <div class="tips">
      <strong>Como identificar um phishing real:</strong>
      <ul>
        <li>Remetente com domínio estranho ou levemente diferente do oficial</li>
        <li>Urgência excessiva ("ação em 24h", "sua conta será bloqueada")</li>
        <li>Links que não correspondem ao texto exibido</li>
        <li>Pedidos de senha, dados bancários ou assinatura fora do fluxo normal</li>
      </ul>
    </div>
    <p style="margin-top:20px">Em caso de dúvida sobre um e-mail real, confirme com seu gestor antes de clicar.</p>
  </div>
  </body></html>`;
}

// ─── Endpoint público: registra o clique e mostra a página educativa ──
export const phishClick = onRequest(async (req, res) => {
  const token = String(req.query.token || "");
  if (token) {
    try {
      const ref = db().collection("simulacoesPhishingCliques").doc(token);
      const snap = await ref.get();
      if (snap.exists && snap.data()?.clicado !== true) {
        await ref.update({ clicado: true, clicadoEm: admin.firestore.FieldValue.serverTimestamp() });
        const data = snap.data()!;
        await db().collection("auditLogs").add({
          tipo: "phishing_clique",
          descricao: `Clique em simulação de phishing por ${data.nome} <${data.email}>`,
          usuario: "Sistema (simulação de phishing)",
          tenantId: data.tenantId || "",
          metadata: { simId: data.simId, email: data.email },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (err) {
      console.error("Erro ao registrar clique de phishing:", err);
    }
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(paginaEducativa());
});
