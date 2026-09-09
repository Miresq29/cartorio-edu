import { onSchedule } from "firebase-functions/v2/scheduler";
import { GMAIL_USER, GMAIL_APP_PASSWORD, sendEmail, logEmailEvidencia, htmlAviso, db } from "./email";

// ─── Agendado diário: demonstração vencida → desativa o cartório e avisa por e-mail ──
// Segue o mesmo padrão de verificarExpiracoes (email.ts): uma única cláusula de
// desigualdade na query (sem índice composto) e o filtro fino feito em memória.
export const verificarDemoExpirada = onSchedule(
  { schedule: "every day 07:00", timeZone: "America/Sao_Paulo", secrets: [GMAIL_APP_PASSWORD] },
  async () => {
    const user = GMAIL_USER;
    const pass = GMAIL_APP_PASSWORD.value();
    const agora = new Date();

    const snap = await db().collection("tenants")
      .where("demoExpiraEm", "<=", agora)
      .get();

    for (const tenantDoc of snap.docs) {
      const tenant = tenantDoc.data();
      // Só age sobre demos ainda ativas e cujo aviso não foi enviado — evita
      // reprocessar cartórios já desativados ou que já converteram em clientes.
      if (!tenant.demoExpiraEm || tenant.active === false || tenant.demoAvisoEnviado === true) continue;

      await tenantDoc.ref.update({ active: false, demoAvisoEnviado: true });

      const destinatariosSnap = await db().collection("users")
        .where("tenantId", "==", tenantDoc.id)
        .where("active", "==", true)
        .where("role", "in", ["gestor", "admin"])
        .get();

      const nomeCartorio = tenant.name || tenantDoc.id;
      const assunto = `Seu período de demonstração na plataforma MJ Consultoria terminou`;

      for (const userDoc of destinatariosSnap.docs) {
        const u = userDoc.data();
        if (!u.email) continue;
        const result = await sendEmail(user, pass, u.email, assunto,
          htmlAviso(
            "Período de demonstração encerrado",
            `O período de testes de "${nomeCartorio}" na plataforma MJ Consultoria chegou ao fim e o acesso da equipe foi temporariamente suspenso.\n\n` +
            `Gostaríamos muito de continuar essa parceria! Entre em contato com a MJ Consultoria para adquirir a plataforma e reativar o acesso imediatamente.`,
            "Aviso automático da plataforma MJ Consultoria."
          ));

        await logEmailEvidencia({
          tenantId: tenantDoc.id, destinatarioEmail: u.email, destinatarioNome: u.name || u.email,
          tipoNotificacao: "demo_expirada", assunto, ok: result.ok, erro: result.error, messageId: result.id,
          relatedId: tenantDoc.id,
        });
      }
    }
  }
);
