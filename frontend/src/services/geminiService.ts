/**
 * SERVIÇO DE INTEGRAÇÃO COM GEMINI (FRONTEND DIRETO)
 * Usa VITE_GEMINI_API_KEY ou VITE_FIREBASE_API_KEY (mesmo projeto Google Cloud).
 *
 * Estratégia de quota:
 *  - gemini-2.0-flash-lite  → tarefas simples (resumo, chat, campanhas, treinamento)
 *  - gemini-2.0-flash       → tarefas pesadas (exame com Bloom, conformidade)
 * Cada modelo tem cota diária independente no Google AI Studio (free tier: 1500 req/dia por modelo).
 */

const ENV_KEY =
  import.meta.env.VITE_GEMINI_API_KEY ||
  import.meta.env.VITE_FIREBASE_API_KEY;

// Chave configurada pelo cartório (sobrepõe a chave da plataforma)
let _tenantKey: string | null = null;

/** Chamado pelo AppContext após carregar a config do tenant */
export const configure = (key: string | null) => {
  _tenantKey = key || null;
};

const getKey = () => _tenantKey || ENV_KEY;

const LITE_MODEL = 'gemini-2.0-flash-lite';
const PRO_MODEL  = 'gemini-2.0-flash';

const apiUrl = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${getKey()}`;

export const cleanJsonOutput = (text: string): string => {
  if (!text) return '[]';
  let c = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const fb = c.indexOf('['), lb = c.lastIndexOf(']');
  if (fb !== -1 && lb > fb) c = c.substring(fb, lb + 1);
  return c;
};

// ─── Core caller ────────────────────────────────────────────────────────────

const callGemini = async (
  prompt: string,
  model: string,
  maxOutputTokens: number,
  temperature = 0.2
): Promise<string> => {
  if (!getKey()) {
    throw new Error('Chave da API Gemini não configurada. Configure em Configurações do cartório ou contate o administrador.');
  }
  console.info(`[Gemini] ${model} | in:${prompt.length}ch | maxOut:${maxOutputTokens}`);

  const res = await fetch(apiUrl(model), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || res.statusText;
    if (res.status === 429) {
      throw new Error(`Cota da API Gemini (${model}) esgotada. Aguarde ou verifique ai.google.dev.`);
    }
    throw new Error(`[Gemini ${res.status}] ${msg}`);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta da IA.';
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const cap = (s: string, n: number) => s.length > n ? s.substring(0, n) + '…' : s;

const extractJsonObject = (text: string): any => {
  const c = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const fb = c.indexOf('['), lb = c.lastIndexOf(']');
  if (fb !== -1 && lb > fb) {
    try { return JSON.parse(c.substring(fb, lb + 1)); } catch {}
  }
  const fB = c.indexOf('{'), lB = c.lastIndexOf('}');
  if (fB !== -1 && lB > fB) {
    try { return JSON.parse(c.substring(fB, lB + 1)); } catch {}
  }
  throw new Error('JSON inválido na resposta da IA');
};

// ─── Public API ───────────────────────────────────────────────────────────────

/** Chat principal (IA de Treinamento) */
export const chat = async (message: string, context: string, _token?: string) => {
  // Truncate heavy context to avoid burning large token batches
  const ctx = context ? `Contexto: ${cap(context, 2000)}\n\n` : '';
  const text = await callGemini(`${ctx}${cap(message, 1000)}`, LITE_MODEL, 800);
  return { text };
};

/** Parecer Expert Review */
export const getGeminiResponse = async (prompt: string): Promise<string> => {
  try {
    return await callGemini(cap(prompt, 3000), PRO_MODEL, 1200);
  } catch (e: any) {
    console.error('Erro Expert Review:', e);
    return 'Erro ao gerar parecer técnico.';
  }
};

/** Auditoria de conformidade */
export const analyzeComplianceDeep = async (
  doc: { text?: string },
  checklist: string[],
  context: string
) => {
  const prompt = `Analise o documento contra o checklist. Retorne APENAS array JSON sem markdown:
[{"requirement":"...","compliant":true/false,"comment":"...","suggestion":"..."}]

Checklist:
${checklist.map(i => `- ${i}`).join('\n')}

Contexto: ${cap(context, 300)}
Documento: ${cap(doc.text || '', 2500)}`;

  try {
    const text = await callGemini(prompt, PRO_MODEL, 1500);
    return JSON.parse(cleanJsonOutput(text));
  } catch (e) {
    console.error('Erro conformidade:', e);
    return [{ requirement: 'Erro', compliant: false, comment: 'IA não retornou JSON válido.', suggestion: 'Tente novamente.' }];
  }
};

/** Extração de checklist de documento */
export const extractChecklistFromDocument = async (doc: { text: string; fileName: string }) => {
  const prompt = `Extraia requisitos de "${doc.fileName}" para checklist notarial.
Retorne APENAS array JSON: [{"id":"1","text":"requisito"}]
Documento: ${cap(doc.text, 2000)}`;

  try {
    const text = await callGemini(prompt, LITE_MODEL, 800);
    return JSON.parse(cleanJsonOutput(text));
  } catch (e) {
    console.error('Erro extração checklist:', e);
    return [];
  }
};

/** Gera 3 opções de roteiro de treinamento */
export const generateTrainingOptions = async (context: string, customRequest?: string): Promise<any[]> => {
  const prompt = `${cap(context, 1500)}
${customRequest ? `\nPedido: ${cap(customRequest, 200)}\n` : ''}
Gere EXATAMENTE 3 roteiros distintos (essencial/completo/relampago).
Retorne APENAS array JSON sem markdown:
[{"titulo":"...","tipo":"essencial|completo|relampago","descricao":"...","duracao":"...","publico":"...","modulos":[{"nome":"...","objetivo":"...","duracao":"...","obrigatorio":true}],"justificativa":"..."}]`;

  try {
    const text = await callGemini(prompt, LITE_MODEL, 1500);
    return JSON.parse(cleanJsonOutput(text));
  } catch (e) {
    console.error('Erro opções treinamento:', e);
    return [];
  }
};

/** Resumo inteligente de documento */
export const generateSummary = async (
  docContent: string,
  docTitle: string,
  summaryType: 'executivo' | 'tecnico' | 'didatico' | 'operacional'
): Promise<string> => {
  const inst: Record<string, string> = {
    executivo:   'Resumo executivo: pontos-chave, impactos, conclusão. Linguagem direta para gestores.',
    tecnico:     'Resumo técnico: fundamentos legais, artigos relevantes, requisitos normativos.',
    didatico:    'Resumo didático: explique para colaborador novo, com exemplos práticos e pontos de atenção.',
    operacional: 'Resumo operacional: procedimentos, checklists e passo a passo para o dia a dia.',
  };

  const prompt = `Especialista em direito notarial. Documento: "${docTitle}"
Instrução: ${inst[summaryType]}
Conteúdo: ${cap(docContent, 2500)}
Gere o resumo com títulos em MAIÚSCULAS e bullets quando útil.`;

  try {
    return await callGemini(prompt, LITE_MODEL, 700);
  } catch (e: any) {
    console.error('Erro resumo:', e);
    throw e;
  }
};

/** Posts para campanhas de comunicação */
export const generateCampaignPosts = async (
  topic: string,
  platforms: string[],
  tone: string,
  additionalContext?: string
): Promise<Record<string, string>> => {
  const plat: Record<string, string> = {
    linkedin:  'LinkedIn: até 800ch, formal, hashtags.',
    instagram: 'Instagram: até 250ch, emojis moderados, 5 hashtags.',
    whatsapp:  'WhatsApp: máx 3 parágrafos curtos, informal.',
    email:     'E-mail: assunto + corpo formal com cumprimento e encerramento.',
  };

  const prompt = `Comunicação institucional para cartório. Tom: ${tone}.
${additionalContext ? `Contexto: ${cap(additionalContext, 200)}\n` : ''}Tema: ${cap(topic, 200)}
Crie posts distintos para: ${platforms.join(', ')}
${platforms.map(p => `${p.toUpperCase()}: ${plat[p] || ''}`).join('\n')}
Retorne APENAS objeto JSON: {${platforms.map(p => `"${p}":"..."`).join(',')}}`;

  try {
    const text = await callGemini(prompt, LITE_MODEL, 1200);
    const c = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const fB = c.indexOf('{'), lB = c.lastIndexOf('}');
    if (fB !== -1 && lB > fB) return JSON.parse(c.substring(fB, lB + 1));
    return {};
  } catch (e) {
    console.error('Erro campanhas:', e);
    return {};
  }
};

export interface QuestaoExame {
  id: number;
  enunciado: string;
  alternativas: { letra: string; texto: string }[];
  correta: string;
  bloom: 'compreensao' | 'aplicacao' | 'analise';
  justificativa: string;
}

/** Gera exame com Taxonomia de Bloom */
export const generateExam = async (
  titulo: string,
  conteudo: string,
  numQuestoes = 10
): Promise<QuestaoExame[]> => {
  const c = Math.round(numQuestoes * 0.3);
  const a = Math.round(numQuestoes * 0.4);
  const an = numQuestoes - c - a;

  const prompt = `Avaliação educacional corporativa. Tema: "${titulo}"
Conteúdo: ${cap(conteudo, 2500)}

Gere EXATAMENTE ${numQuestoes} questões de múltipla escolha (Taxonomia de Bloom):
- ${c} COMPREENSÃO | ${a} APLICAÇÃO | ${an} ANÁLISE
Regras: 4 alternativas (A-D), 1 correta, incorretas plausíveis, justificativa breve.

Retorne APENAS array JSON sem markdown:
[{"id":1,"enunciado":"...","alternativas":[{"letra":"A","texto":"..."}],"correta":"A","bloom":"compreensao|aplicacao|analise","justificativa":"..."}]`;

  try {
    const text = await callGemini(prompt, PRO_MODEL, 2500);
    const questoes = extractJsonObject(text);
    if (!Array.isArray(questoes) || questoes.length === 0) throw new Error('Formato inválido.');
    return questoes;
  } catch (e: any) {
    console.error('Erro exame:', e);
    throw new Error(e?.message || 'Não foi possível gerar o exame. Tente novamente.');
  }
};

export const GeminiService = {
  configure,
  chat,
  getGeminiResponse,
  analyzeComplianceDeep,
  extractChecklistFromDocument,
  generateTrainingOptions,
  generateSummary,
  generateCampaignPosts,
  generateExam,
};
