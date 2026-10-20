import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { GMAIL_USER, GMAIL_APP_PASSWORD, db, sendEmail, htmlAviso } from "./email";

// ─── Alerta de crédito da IA (mesmo do CartórioRAG e do Nexus Pro, out/2026) ──
// A conta de faturamento do Gemini pode ser PRÉ-PAGA (créditos do AI Studio). Quando o saldo
// acaba, o Google recusa toda chamada com "prepayment credits are depleted" e provas, quizzes e
// resumos param — sem aviso para a MJ, que só descobria pela reclamação. Agora:
//  - a primeira recusa do dia grava alertasPlataforma/credito-gemini__{dia} e o trigger manda e-mail;
//  - às 07h uma geração mínima confere o saldo antes de os clientes começarem o dia.
export const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
export const GEMINI_MODEL = "gemini-flash-latest";
const DESTINO_ALERTA = "dpoagconsultoria@gmail.com";
const DOC_ESTADO = "system/credito_gemini";

/**
 * Crédito pré-pago esgotado. Decide pelo TEXTO, não pelo status: em 10/09/2026 o Google mandava
 * 429/RESOURCE_EXHAUSTED e em 21/09/2026 passou a 402, com a mesma mensagem. 429 sem esse texto
 * é cota por minuto/dia, não falta de saldo.
 */
export function ehCreditoEsgotado(status: number, corpo: unknown): boolean {
  const texto = typeof corpo === "string"
    ? corpo
    : String((corpo as { error?: { message?: string } } | null)?.error?.message ?? "");
  if (status === 402) return /prepayment credits are depleted|prepaid credits|billing/i.test(texto);
  if (status === 429) return /prepayment credits are depleted|prepaid credits/i.test(texto);
  return false;
}

/**
 * Teto de gasto MENSAL do projeto (ai.studio/spend). Também chega como 429, sem details, e esperar
 * não resolve — com saldo sobrando, a IA para até o teto subir ou o mês virar. Foi o que parou as
 * provas em 20/10/2026 (conta com R$ 94 de crédito e recarga automática ligada).
 */
export function ehTetoDeGasto(status: number, corpo: unknown): boolean {
  const texto = String((corpo as { error?: { message?: string } } | null)?.error?.message ?? "");
  return status === 429 && /spending cap|spend cap/i.test(texto);
}

export type MotivoIaParada = "CREDITO_ESGOTADO" | "TETO_DE_GASTO";

export function motivoIaParada(status: number, corpo: unknown): MotivoIaParada | null {
  if (ehCreditoEsgotado(status, corpo)) return "CREDITO_ESGOTADO";
  if (ehTetoDeGasto(status, corpo)) return "TETO_DE_GASTO";
  return null;
}

const DETALHE: Record<MotivoIaParada, string> = {
  CREDITO_ESGOTADO: "O crédito pré-pago da conta de faturamento que paga a IA do Integra-Academy acabou. "
    + "Provas, quizzes e demais recursos de IA estão recusados até recarregar (AI Studio → Projects → Billing, "
    + "no projeto da chave GEMINI_API_KEY). O saldo é da CONTA de faturamento: outros projetos dela também param.",
  TETO_DE_GASTO: "O projeto da chave GEMINI_API_KEY atingiu o TETO DE GASTO MENSAL configurado no AI Studio. "
    + "Mesmo com crédito na conta, provas, quizzes e demais recursos de IA estão recusados até o teto ser "
    + "elevado em ai.studio/spend (ou o mês virar).",
};

// Um documento por motivo por dia (o id leva a data), gravado com create: o e-mail sai na PRIMEIRA
// recusa, não a cada chamada. Nunca leva a chave.
export async function registrarIaParada(motivo: MotivoIaParada, origem: string, agora = new Date()): Promise<void> {
  const dia = agora.toISOString().slice(0, 10);
  try {
    await db().collection("alertasPlataforma").doc(`${motivo === "TETO_DE_GASTO" ? "teto-gemini" : "credito-gemini"}__${dia}`).create({
      tipo: motivo, severidade: "CRITICO", modelo: GEMINI_MODEL, origem,
      detalhe: DETALHE[motivo], criadoEm: admin.firestore.FieldValue.serverTimestamp(), resolvido: false,
    });
  } catch (err: any) {
    // ALREADY_EXISTS (6): já avisado hoje.
    if (err?.code !== 6 && !/ALREADY_EXISTS/i.test(String(err?.message || ""))) throw err;
  }
}

export const avisarAlertaPlataforma = onDocumentCreated(
  { document: "alertasPlataforma/{docId}", secrets: [GMAIL_APP_PASSWORD] },
  async (event) => {
    const a = event.data?.data();
    if (!a) return;
    const assunto = a.tipo === "CREDITO_ESGOTADO" ? "[Integra-Academy] IA PARADA — sem crédito no Gemini"
      : a.tipo === "TETO_DE_GASTO" ? "[Integra-Academy] IA PARADA — teto de gasto mensal do Gemini atingido"
      : `[Integra-Academy] Alerta: ${a.tipo}`;
    const r = await sendEmail(GMAIL_USER, GMAIL_APP_PASSWORD.value(), DESTINO_ALERTA, assunto,
      htmlAviso(assunto, `${a.detalhe}\n\nOrigem: ${a.origem || "—"}`, "Alerta automático da plataforma."));
    if (!r.ok) console.error("[credito-gemini] falha ao enviar o alerta por e-mail:", r.error);
  },
);

// 07h, antes de os clientes começarem: falta de saldo descoberta às 7h é recarga a tempo.
// Sem crédito: alerta todo dia (o doc do dia). Outra resposta que não 200: só quando a situação muda.
export const verificarCreditoGemini = onSchedule(
  { schedule: "every day 07:00", timeZone: "America/Sao_Paulo", secrets: [GEMINI_API_KEY, GMAIL_APP_PASSWORD] },
  async () => {
    const estadoRef = db().doc(DOC_ESTADO);
    const anterior = (await estadoRef.get()).data()?.situacao as string | undefined;

    // Uma geração mínima: models.get responde 200 mesmo sem saldo, então não serve.
    let situacao: string;
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-goog-api-key": GEMINI_API_KEY.value() },
        body: JSON.stringify({ contents: [{ parts: [{ text: "Responda apenas: ok" }] }], generationConfig: { maxOutputTokens: 16, thinkingConfig: { thinkingBudget: 0 } } }),
      });
      const corpo = await r.json().catch(() => ({}));
      const motivo = motivoIaParada(r.status, corpo);
      situacao = motivo === "CREDITO_ESGOTADO" ? "sem_credito" : motivo === "TETO_DE_GASTO" ? "teto_de_gasto" : r.ok ? "ok" : `HTTP ${r.status}`;
    } catch (err) {
      situacao = `rede: ${err instanceof Error ? err.message : String(err)}`;
    }
    await estadoRef.set({ situacao, verificadoEm: admin.firestore.FieldValue.serverTimestamp() });
    console.log("[credito-gemini] conferido:", situacao);

    if (situacao === "sem_credito" || situacao === "teto_de_gasto") {
      await registrarIaParada(situacao === "sem_credito" ? "CREDITO_ESGOTADO" : "TETO_DE_GASTO", "verificação diária (verificarCreditoGemini)");
    } else if (situacao !== "ok" && situacao !== anterior) {
      const assunto = "[Integra-Academy] Crédito da IA não conferido";
      await sendEmail(GMAIL_USER, GMAIL_APP_PASSWORD.value(), DESTINO_ALERTA, assunto, htmlAviso(assunto,
        `A conferência diária do crédito do Gemini respondeu ${situacao}. O saldo não pôde ser conferido hoje — confira a chave GEMINI_API_KEY e o faturamento.`,
        "Verificação automática diária (verificarCreditoGemini), 07h."));
    }
  },
);
