/**
 * SERVIÇO DE INTEGRAÇÃO COM GEMINI (FRONTEND DIRETO)
 * Chama a API do Google Gemini diretamente.
 * Chave configurada via VITE_GEMINI_API_KEY no Vercel.
 *
 * OTIMIZAÇÕES APLICADAS:
 * - maxOutputTokens ajustado por função (era 8192 em todas)
 * - Inputs truncados para evitar tokens desnecessários
 * - Cache em memória para resumos (evita chamadas repetidas)
 * - Checklist estático para provimentos conhecidos (zero tokens)
 * - generateTrainingOptions: context truncado + estrutura simplificada
 */

const GEMINI_API_KEY =
  import.meta.env.VITE_GEMINI_API_KEY ||
  import.meta.env.VITE_FIREBASE_API_KEY;

// gemini-2.0-flash: 1500 req/dia grátis, bom custo-benefício
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ─── Cache em memória para resumos ───────────────────────────────────────────
// Chave: hash simples de docTitle + summaryType
// Evita rechamar a API para o mesmo documento/tipo já gerado na sessão
const summaryCache = new Map<string, string>();

const makeCacheKey = (title: string, type: string): string =>
  `${title.trim().toLowerCase()}::${type}`;

// ─── Checklists estáticos para provimentos conhecidos ────────────────────────
// Elimina 100% das chamadas Gemini para documentos fixos do acervo
const STATIC_CHECKLISTS: Record<string, { id: string; text: string }[]> = {
  'provimento 213': [
    { id: '1', text: 'Designar Responsável Técnico de TI (art. 3º)' },
    { id: '2', text: 'Designar Encarregado de Dados (DPO) (art. 4º)' },
    { id: '3', text: 'Elaborar Política de Segurança da Informação (PSI)' },
    { id: '4', text: 'Elaborar Plano de Continuidade de Negócios (PCN)' },
    { id: '5', text: 'Manter inventário de ativos de TI atualizado' },
    { id: '6', text: 'Formalizar contratos com operadores de dados (DPA)' },
    { id: '7', text: 'Elaborar ROPA (Registro de Operações de Tratamento)' },
    { id: '8', text: 'Realizar treinamento de equipe em LGPD' },
    { id: '9', text: 'Implantar canal de atendimento ao titular de dados' },
    { id: '10', text: 'Implementar controles de acesso e autenticação' },
  ],
  'provimento 149': [
    { id: '1', text: 'Manter sistema de gestão eletrônica de documentos' },
    { id: '2', text: 'Garantir backup periódico dos dados' },
    { id: '3', text: 'Controlar acesso lógico aos sistemas' },
    { id: '4', text: 'Registrar logs de acesso e alterações' },
    { id: '5', text: 'Comunicar incidentes ao CNJ no prazo previsto' },
  ],
  'provimento 161': [
    { id: '1', text: 'Implementar programa PLD/FTP (Lei 9.613/98)' },
    { id: '2', text: 'Realizar identificação e cadastro de clientes (KYC)' },
    { id: '3', text: 'Monitorar operações suspeitas de lavagem de dinheiro' },
    { id: '4', text: 'Comunicar operações suspeitas ao COAF' },
    { id: '5', text: 'Treinar colaboradores em PLD/FTP anualmente' },
    { id: '6', text: 'Manter registros pelo prazo legal (5 anos)' },
  ],
};

/**
 * Retorna checklist estático se o nome do arquivo contiver um provimento conhecido.
 * Retorna null se não houver match (deve chamar a IA).
 */
const getStaticChecklist = (
  fileName: string
): { id: string; text: string }[] | null => {
  const nameLower = fileName.toLowerCase();
  for (const [key, items] of Object.entries(STATIC_CHECKLISTS)) {
    if (nameLower.includes(key)) return items;
  }
  return null;
};

// ─── Remove markdown e extrai JSON limpo ─────────────────────────────────────
export const cleanJsonOutput = (text: string): string => {
  if (!text) return '[]';
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    cleaned = cleaned.substring(firstBracket, lastBracket + 1);
  }
  return cleaned;
};

// ─── Extrai JSON (array ou objeto) de resposta livre ─────────────────────────
const extractJsonObject = (text: string): any => {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try { return JSON.parse(cleaned.substring(firstBracket, lastBracket + 1)); } catch {}
  }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try { return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1)); } catch {}
  }
  throw new Error('JSON inválido na resposta da IA');
};

// ─── Função base com maxOutputTokens configurável ────────────────────────────
const callGemini = async (
  prompt: string,
  maxOutputTokens: number = 1024
): Promise<string> => {
  if (!GEMINI_API_KEY) {
    console.error('[Gemini] VITE_GEMINI_API_KEY não configurada.');
    throw new Error('Chave da API Gemini não configurada. Contate o administrador.');
  }
  console.info(
    `[Gemini] ${GEMINI_MODEL} | input: ${prompt.length} chars | maxOut: ${maxOutputTokens}`
  );

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens, // ← agora cada função define seu próprio limite
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err?.error?.message || response.statusText;
    const status = response.status;
    if (status === 400 && msg?.includes('blocked')) {
      throw new Error('Chave de API bloqueada. Configure VITE_GEMINI_API_KEY no Vercel.');
    }
    if (status === 429) {
      throw new Error('Cota da API Gemini esgotada. Aguarde ou verifique ai.google.dev.');
    }
    throw new Error(`[Gemini ${status}] ${msg}`);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta da IA.';
};

// ─── Chat principal ───────────────────────────────────────────────────────────
// 800 tokens: respostas conversacionais são curtas
export const chat = async (message: string, context: string, _token?: string) => {
  const ctxTruncated = context ? context.substring(0, 2000) : '';
  const prompt = ctxTruncated ? `Contexto: ${ctxTruncated}\n\n${message}` : message;
  const text = await callGemini(prompt, 800);
  return { text };
};

// ─── Parecer direto (Expert Review) ──────────────────────────────────────────
// 1200 tokens: pareceres técnicos concisos
export const getGeminiResponse = async (prompt: string): Promise<string> => {
  try {
    return await callGemini(prompt, 1200);
  } catch (error: any) {
    console.error('Erro Expert Review:', error);
    return 'Erro ao gerar parecer técnico.';
  }
};

// ─── Auditoria de conformidade ────────────────────────────────────────────────
// 2000 tokens: JSON estruturado com N itens do checklist
// Input do documento truncado em 4000 chars para controle de custo
export const analyzeComplianceDeep = async (
  doc: { text?: string },
  checklist: string[],
  context: string
) => {
  const docText = (doc.text || 'Conteúdo não disponível.').substring(0, 4000);
  const prompt = `Analise o documento abaixo contra o checklist. Retorne APENAS um array JSON válido, sem texto adicional, sem markdown:
[{"requirement": "...", "compliant": true/false, "comment": "...", "suggestion": "..."}]

Checklist:
${checklist.map((item) => `- ${item}`).join('\n')}

Contexto legal: ${context}

Documento: ${docText}`;

  try {
    const text = await callGemini(prompt, 2000);
    const cleaned = cleanJsonOutput(text);
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Erro conformidade:', e);
    return [
      {
        requirement: 'Erro de Processamento',
        compliant: false,
        comment: 'A IA não gerou JSON válido.',
        suggestion: 'Tente novamente.',
      },
    ];
  }
};

// ─── Extração de checklist de documento ──────────────────────────────────────
// OTIMIZAÇÃO: usa checklist estático para provimentos conhecidos (0 tokens)
// Só chama a IA para documentos desconhecidos
export const extractChecklistFromDocument = async (doc: {
  text: string;
  fileName: string;
}) => {
  // Tenta checklist estático primeiro
  const staticResult = getStaticChecklist(doc.fileName);
  if (staticResult) {
    console.info(`[Gemini] Checklist estático usado para: ${doc.fileName}`);
    return staticResult;
  }

  // Documento desconhecido → chama IA com input truncado
  const docText = doc.text.substring(0, 3000);
  const prompt = `Extraia requisitos do documento "${doc.fileName}" para checklist notarial.
Retorne APENAS um array JSON: [{"id": "1", "text": "requisito"}]
Máximo 15 itens. Seja conciso.

Documento: ${docText}`;

  try {
    const text = await callGemini(prompt, 800);
    const cleaned = cleanJsonOutput(text);
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Erro extração:', e);
    return [];
  }
};

// ─── Roteiros de treinamento ──────────────────────────────────────────────────
// 3000 tokens: 3 objetos JSON com módulos
// Context truncado em 3000 chars
export const generateTrainingOptions = async (
  context: string,
  customRequest?: string
): Promise<any[]> => {
  const ctxTruncated = context.substring(0, 3000);
  const prompt = `${ctxTruncated}

${customRequest ? `Pedido específico: ${customRequest}\n\n` : ''}Gere EXATAMENTE 3 opções de roteiro de treinamento notarial com abordagens diferentes:
- Opção 1: ESSENCIAL (básico, itens críticos, duração curta)
- Opção 2: COMPLETO (abrangente, todos os módulos)
- Opção 3: RELÂMPAGO (intensivo, pontos-chave, reciclagem)

Retorne APENAS array JSON com 3 objetos, sem markdown:
[{"titulo":"...","tipo":"essencial|completo|relampago","descricao":"...","duracao":"...","publico":"...","modulos":[{"nome":"...","objetivo":"...","duracao":"...","obrigatorio":true}],"justificativa":"..."}]`;

  try {
    const text = await callGemini(prompt, 3000);
    const cleaned = cleanJsonOutput(text);
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Erro ao gerar opções de treinamento:', e);
    return [];
  }
};

// ─── Resumo de documento ──────────────────────────────────────────────────────
// OTIMIZAÇÃO: cache em memória — mesmo doc+tipo não chama a API novamente
// 1000 tokens: resumos de 1 página são suficientes
export const generateSummary = async (
  docContent: string,
  docTitle: string,
  summaryType: 'executivo' | 'tecnico' | 'didatico' | 'operacional'
): Promise<string> => {
  // Verifica cache antes de chamar a API
  const cacheKey = makeCacheKey(docTitle, summaryType);
  if (summaryCache.has(cacheKey)) {
    console.info(`[Gemini] Cache hit para resumo: ${cacheKey}`);
    return summaryCache.get(cacheKey)!;
  }

  const instructions: Record<string, string> = {
    executivo:
      'Resumo executivo (máx. 400 palavras): pontos principais, impactos e conclusão. Linguagem direta para gestores.',
    tecnico:
      'Resumo técnico (máx. 500 palavras): fundamentos legais, artigos relevantes e requisitos normativos.',
    didatico:
      'Resumo didático (máx. 400 palavras): linguagem simples para colaborador novo, com exemplos práticos.',
    operacional:
      'Resumo operacional (máx. 400 palavras): procedimentos e passo a passo para o dia a dia.',
  };

  const prompt = `Você é especialista em direito notarial da MJ Consultoria.
Documento: "${docTitle}"

INSTRUÇÃO: ${instructions[summaryType]}

CONTEÚDO:
${docContent.substring(0, 5000)}

Gere o resumo com títulos em MAIÚSCULAS e bullets quando necessário.`;

  try {
    const result = await callGemini(prompt, 1000);
    summaryCache.set(cacheKey, result); // salva no cache
    return result;
  } catch (e) {
    console.error('Erro ao gerar resumo:', e);
    return 'Erro ao gerar resumo. Tente novamente.';
  }
};

// ─── Posts para campanhas ─────────────────────────────────────────────────────
// 1500 tokens: suficiente para até 4 plataformas
export const generateCampaignPosts = async (
  topic: string,
  platforms: string[],
  tone: string,
  additionalContext?: string
): Promise<Record<string, string>> => {
  const platformInstructions: Record<string, string> = {
    linkedin:
      'Post LinkedIn: até 1300 chars, formal, hashtags ao final.',
    instagram:
      'Post Instagram: até 300 chars + CTA, emojis moderados, 5-10 hashtags.',
    whatsapp:
      'WhatsApp: informal, direto, máx. 3 parágrafos curtos.',
    email:
      'E-mail institucional: assunto + corpo formal com cumprimento e encerramento.',
  };

  const platformsText = platforms
    .map((p) => `### ${p.toUpperCase()}\n${platformInstructions[p] || ''}`)
    .join('\n\n');

  const prompt = `Especialista em comunicação institucional para cartórios.
Unidade: MJ Consultoria | Tom: ${tone}
${additionalContext ? `Contexto: ${additionalContext.substring(0, 500)}\n` : ''}
TEMA: ${topic}

Crie posts distintos para cada plataforma:
${platformsText}

Retorne APENAS JSON válido sem markdown:
{${platforms.map((p) => `"${p}": "conteúdo"`).join(', ')}}`;

  try {
    const text = await callGemini(prompt, 1500);
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
    }
    return {};
  } catch (e) {
    console.error('Erro ao gerar posts:', e);
    return {};
  }
};

// ─── Geração de exame (Taxonomia de Bloom) ────────────────────────────────────
// 2500 tokens: 10 questões × ~250 tokens cada
// Input truncado em 4000 chars
export interface QuestaoExame {
  id: number;
  enunciado: string;
  alternativas: { letra: string; texto: string }[];
  correta: string;
  bloom: 'compreensao' | 'aplicacao' | 'analise';
  justificativa: string;
}

export const generateExam = async (
  titulo: string,
  conteudo: string,
  numQuestoes: number = 10
): Promise<QuestaoExame[]> => {
  const prompt = `Especialista em avaliação educacional corporativa.

TEMA: "${titulo}"
CONTEÚDO:
${conteudo.substring(0, 4000)}

Gere EXATAMENTE ${numQuestoes} questões de múltipla escolha (Taxonomia de Bloom nível médio):
- ${Math.round(numQuestoes * 0.3)} COMPREENSÃO (bloom: "compreensao")
- ${Math.round(numQuestoes * 0.4)} APLICAÇÃO (bloom: "aplicacao")
- ${Math.round(numQuestoes * 0.3)} ANÁLISE (bloom: "analise")

Regras: 4 alternativas (A-D), 1 correta, distractores plausíveis, justificativa breve.

Retorne APENAS array JSON sem markdown:
[{"id":1,"enunciado":"...","alternativas":[{"letra":"A","texto":"..."},{"letra":"B","texto":"..."},{"letra":"C","texto":"..."},{"letra":"D","texto":"..."}],"correta":"A","bloom":"compreensao","justificativa":"..."}]`;

  try {
    const text = await callGemini(prompt, 2500);
    const questoes = extractJsonObject(text);
    if (!Array.isArray(questoes) || questoes.length === 0)
      throw new Error('Formato inválido na resposta da IA.');
    return questoes;
  } catch (e: any) {
    console.error('Erro ao gerar exame:', e);
    throw new Error(e?.message || 'Não foi possível gerar o exame. Tente novamente.');
  }
};

// ─── Exportações ──────────────────────────────────────────────────────────────
export const GeminiService = {
  chat,
  getGeminiResponse,
  analyzeComplianceDeep,
  extractChecklistFromDocument,
  generateTrainingOptions,
  generateSummary,
  generateCampaignPosts,
  generateExam,
};