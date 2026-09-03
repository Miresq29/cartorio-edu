/**
 * SERVIÇO DE INTEGRAÇÃO COM GEMINI (FRONTEND DIRETO)
 * Chama a API do Google Gemini diretamente.
 * Chave configurada via VITE_GEMINI_API_KEY no Vercel.
 *
 * OTIMIZAÇÕES APLICADAS:
 * - maxOutputTokens ajustado por função (era 8192 em todas)
 * - Inputs truncados para evitar tokens desnecessários
 * - Cache em memória para resumos (evita chamadas repetidas)
 * - generateTrainingOptions: context truncado + estrutura simplificada
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// gemini-2.0-flash: 1500 req/dia grátis, bom custo-benefício
const GEMINI_MODEL = 'gemini-flash-latest';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ─── Cache persistente para resumos (localStorage) ───────────────────────────
// Persiste entre sessões — evita rechamar a API para o mesmo doc+tipo
// TTL: 30 dias (provimentos mudam raramente)
const SUMMARY_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const makeCacheKey = (title: string, type: string): string =>
  `mjc_summary_v3__${title.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}__${type}`;

const readSummaryCache = (key: string): string | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { value, ts } = JSON.parse(raw);
    if (Date.now() - ts > SUMMARY_CACHE_TTL_MS) { localStorage.removeItem(key); return null; }
    return value;
  } catch { return null; }
};

const writeSummaryCache = (key: string, value: string) => {
  try { localStorage.setItem(key, JSON.stringify({ value, ts: Date.now() })); } catch {}
};

// Cache em memória para a sessão atual (evita releitura do localStorage)
const summaryMemCache = new Map<string, string>();

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
  maxOutputTokens: number = 1024,
  jsonMode: boolean = false
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
    headers: { 'Content-Type': 'application/json', 'X-goog-api-key': GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens,
        ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
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
// 2000 tokens: respostas conversacionais de treinamento podem ser longas
export const chat = async (message: string, context: string, _token?: string) => {
  const ctxTruncated = context ? context.substring(0, 2000) : '';
  const prompt = ctxTruncated ? `Contexto: ${ctxTruncated}\n\n${message}` : message;
  const text = await callGemini(prompt, 2000);
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

// ─── Roteiros de treinamento ──────────────────────────────────────────────────
// 4096 tokens: template JSON completo com 3 objetos + módulos
// Context truncado em 1500 chars
// Templates base garantem estrutura JSON válida — IA só personaliza os campos de texto
const TRAINING_TEMPLATES = [
  { tipo: 'essencial',  duracao: '1h30',  publico: 'Toda a equipe',           modulos: 3 },
  { tipo: 'completo',   duracao: '4h',    publico: 'Equipe completa + gestores', modulos: 5 },
  { tipo: 'relampago',  duracao: '45min', publico: 'Colaboradores experientes', modulos: 2 },
];

export const generateTrainingOptions = async (
  context: string,
  customRequest?: string
): Promise<any[]> => {
  const ctxTruncated = context.substring(0, 4000);
  // Template pre-definido: IA substitui apenas os textos marcados — sem verbosidade
  const prompt = `Analise o documento e preencha o JSON abaixo substituindo apenas os campos marcados com ">>PREENCHER<<". Retorne o JSON completo sem explicacoes. Escreva SEMPRE em portugues brasileiro.

DOCUMENTO:
${ctxTruncated}
${customRequest ? `PEDIDO: ${customRequest}\n` : ''}
Regras:
- nomes dos modulos: max 5 palavras em portugues
- objetivo de cada modulo: max 10 palavras, use 1 verbo de acao (aplicar, analisar, avaliar, propor, examinar, decidir, desenvolver)
- descricao e justificativa: max 1 frase curta em portugues

[{"titulo":">>PREENCHER<<","tipo":"essencial","descricao":">>PREENCHER<<","duracao":"1h30","publico":"Toda a equipe","justificativa":">>PREENCHER<<","modulos":[{"nome":">>PREENCHER<<","objetivo":">>PREENCHER<<","duracao":"30min","obrigatorio":true},{"nome":">>PREENCHER<<","objetivo":">>PREENCHER<<","duracao":"30min","obrigatorio":true},{"nome":">>PREENCHER<<","objetivo":">>PREENCHER<<","duracao":"30min","obrigatorio":false}]},{"titulo":">>PREENCHER<<","tipo":"completo","descricao":">>PREENCHER<<","duracao":"4h","publico":"Equipe completa + gestores","justificativa":">>PREENCHER<<","modulos":[{"nome":">>PREENCHER<<","objetivo":">>PREENCHER<<","duracao":"45min","obrigatorio":true},{"nome":">>PREENCHER<<","objetivo":">>PREENCHER<<","duracao":"45min","obrigatorio":true},{"nome":">>PREENCHER<<","objetivo":">>PREENCHER<<","duracao":"45min","obrigatorio":true},{"nome":">>PREENCHER<<","objetivo":">>PREENCHER<<","duracao":"30min","obrigatorio":true},{"nome":">>PREENCHER<<","objetivo":">>PREENCHER<<","duracao":"15min","obrigatorio":false}]},{"titulo":">>PREENCHER<<","tipo":"relampago","descricao":">>PREENCHER<<","duracao":"45min","publico":"Colaboradores experientes","justificativa":">>PREENCHER<<","modulos":[{"nome":">>PREENCHER<<","objetivo":">>PREENCHER<<","duracao":"25min","obrigatorio":true},{"nome":">>PREENCHER<<","objetivo":">>PREENCHER<<","duracao":"20min","obrigatorio":true}]}]`;

  try {
    // Template pre-preenchido: IA substitui apenas textos — JSON minimo e previsivel
    const text = await callGemini(prompt, 5000, true);
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Array inválido');
    return parsed;
  } catch (e) {
    console.error('Erro ao gerar opções de treinamento:', e);
    // Fallback: retorna templates com contexto básico extraído
    const docMatch = context.match(/DOCUMENTO:\s*(.+)/);
    const titulo = docMatch ? docMatch[1].trim().replace(/\.(pdf|docx|txt)$/i, '').substring(0, 50) : 'Treinamento Notarial';
    return TRAINING_TEMPLATES.map(t => ({
      titulo: `${titulo} — ${t.tipo.charAt(0).toUpperCase() + t.tipo.slice(1)}`,
      tipo: t.tipo,
      descricao: `Roteiro ${t.tipo} baseado no documento`,
      duracao: t.duracao,
      publico: t.publico,
      modulos: Array.from({ length: t.modulos }, (_, i) => ({
        nome: `Módulo ${i + 1}`,
        objetivo: 'Consulte o documento para detalhar este módulo',
        duracao: '30min',
        obrigatorio: i < 2,
      })),
      justificativa: `Cobertura ${t.tipo} do conteúdo normativo`,
    }));
  }
};

// ─── Detalhamento de roteiro selecionado ─────────────────────────────────────
// Gera conteudo educativo real para cada modulo em chamadas PARALELAS independentes.
// Texto simples (nao JSON) por modulo — sem risco de truncamento de JSON.
// Sem regex: texto gerado vai direto para exibicao.

const buildModulePrompt = (
  titulo: string,
  publico: string,
  modulo: any,
  index: number,
  total: number,
  ctx: string
): string =>
  `Voce e um PROFESSOR DOUTOR especialista em direito notarial e cartorial brasileiro. Escreva TODO o texto em portugues brasileiro. Nunca use ingles.

BASE LEGAL OFICIAL (cite artigos, paragrafos e incisos deste documento):
${ctx}

TREINAMENTO: "${titulo}" | Publico-alvo: ${publico}
MODULO ${index + 1} de ${total}: ${modulo.nome}
${modulo.objetivo ? 'Competencia do modulo: ' + modulo.objetivo : ''}

Elabore o conteudo educativo COMPLETO em nivel MEDIO-ALTO (Aplicar, Analisar, Avaliar — Taxonomia de Bloom). Seja tecnico, especifico, cite artigos reais. Use texto corrido, sem asteriscos, sem hashtags.

FUNDAMENTOS LEGAIS:
Escreva 3 topicos numerados. Para cada topico: titulo em maiusculas, artigo especifico citado, o que a norma determina, por que esse requisito existe, como o colaborador aplica na pratica e o que ocorre em caso de descumprimento. Minimo 4 frases por topico.

CASO PRATICO:
Descreva em texto corrido um atendimento real e detalhado no balcao do cartorio. Em 9 a 11 frases: tipo de servico solicitado, documentos apresentados, cada verificacao que o colaborador realiza (cite o artigo que justifica cada etapa), ponto critico ou irregularidade encontrada, raciocinio juridico aplicado, decisao tomada com fundamentacao legal, comunicacao ao cliente e registro realizado.

EXERCICIO DE AVALIACAO:
Nivel Avaliar de Bloom. Apresente um caso com ambiguidade ou irregularidade que o colaborador deve resolver em grupo. Descreva: a situacao completa, o problema juridico a identificar, a decisao correta com o artigo correspondente, como o colaborador justifica ao grupo e o criterio de avaliacao do facilitador. 6 a 8 frases.

ERROS COMUNS:
Liste 4 erros frequentes que colaboradores cometem neste tema. Para cada erro: o que e feito errado, o artigo legal violado e como corrigir o procedimento.`;

const stripMarkdown = (text: string): string =>
  text
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .trim();

export const generateTrainingDetail = async (
  option: any,
  context: string
): Promise<any> => {
  const ctxTruncated = context.substring(0, 4000);
  const originalModulos: any[] = option.modulos || [];

  const enrichedModulos = await Promise.all(
    originalModulos.map(async (m: any, i: number) => {
      const prompt = buildModulePrompt(
        option.titulo, option.publico, m, i, originalModulos.length, ctxTruncated
      );
      try {
        const raw  = await callGemini(prompt, 3500, false);
        const text = stripMarkdown(raw);
        return { ...m, conteudo: text, exemplos: '', atividade: '' };
      } catch (e) {
        console.error(`Erro no modulo ${i + 1}:`, e);
        return m;
      }
    })
  );

  return {
    ...option,
    objetivoGeral: `Capacitar a equipe do cartorio em ${option.titulo} com dominio tecnico e pratico dos dispositivos normativos aplicaveis.`,
    prerequisitos: 'Nenhum conhecimento previo necessario.',
    modulos: enrichedModulos,
  };
};

// ─── Resumo de documento ──────────────────────────────────────────────────────
// OTIMIZAÇÃO: cache em memória — mesmo doc+tipo não chama a API novamente
// 2000 tokens: resumos detalhados com headers e bullets
export const generateSummary = async (
  docContent: string,
  docTitle: string,
  summaryType: 'executivo' | 'tecnico' | 'didatico' | 'operacional'
): Promise<string> => {
  const cacheKey = makeCacheKey(docTitle, summaryType);
  // 1º: cache em memória (mesma sessão)
  if (summaryMemCache.has(cacheKey)) {
    console.info(`[Gemini] Cache memória hit: ${cacheKey}`);
    return summaryMemCache.get(cacheKey)!;
  }
  // 2º: cache localStorage (entre sessões, TTL 30 dias)
  const persisted = readSummaryCache(cacheKey);
  if (persisted) {
    console.info(`[Gemini] Cache localStorage hit: ${cacheKey}`);
    summaryMemCache.set(cacheKey, persisted);
    return persisted;
  }

  const instructions: Record<string, string> = {
    executivo: `Crie um PARECER EXECUTIVO completo com as seguintes secoes obrigatorias:
OBJETIVO: (o que o documento determina e por que importa)
PONTOS-CHAVE: (lista numerada com os 5-8 principais pontos de atencao)
IMPACTOS PARA O CARTORIO: (consequencias praticas para a operacao)
ACOES NECESSARIAS: (lista do que o cartorio deve fazer)
CONCLUSAO: (sintese e recomendacao)`,
    tecnico: `Crie uma ANALISE TECNICO-JURIDICA completa com as seguintes secoes obrigatorias:
BASE LEGAL: (fundamentacao juridica, dispositivos que embasam o normativo)
ARTIGOS E DISPOSITIVOS PRINCIPAIS: (cite e explique cada artigo relevante)
REQUISITOS NORMATIVOS: (lista detalhada de todos os requisitos exigidos)
OBRIGACOES E RESPONSABILIDADES: (o que o cartorio e os colaboradores devem fazer)
PRAZOS E PENALIDADES: (prazos de adequacao e consequencias do descumprimento)
CONCLUSAO TECNICA: (analise critica e pontos de maior impacto juridico)`,
    didatico: `Crie um GUIA DIDATICO completo com as seguintes secoes obrigatorias:
O QUE E ESTE DOCUMENTO: (explicacao simples do que e e por que existe)
CONCEITOS BASICOS: (explicacao dos termos tecnicos em linguagem simples)
COMO FUNCIONA NA PRATICA: (descricao do fluxo de trabalho relacionado)
EXEMPLOS DO DIA A DIA: (situacoes concretas que ocorrem no balcao)
O QUE MUDA PARA O COLABORADOR: (impacto direto no trabalho de cada um)
DICAS E PONTOS DE ATENCAO: (erros comuns a evitar e boas praticas)`,
    operacional: `Crie um MANUAL OPERACIONAL completo com as seguintes secoes obrigatorias:
FLUXO DE ATENDIMENTO: (passo a passo do procedimento completo)
DOCUMENTOS NECESSARIOS: (lista de documentos que devem ser exigidos/verificados)
CHECKLIST DE CONFERENCIA: (lista de verificacao antes de concluir o ato)
PONTOS DE ATENCAO: (situacoes especiais e excecoes ao procedimento padrao)
ERROS COMUNS: (falhas frequentes e como evita-las)
REFERENCIAS: (artigos e dispositivos que amparam cada procedimento)`,
  };

  const prompt = `Voce e um especialista em direito notarial da MJ Consultoria com 20 anos de experiencia.
Documento analisado: "${docTitle}"

CONTEUDO DO DOCUMENTO:
${docContent.substring(0, 6000)}

INSTRUCAO: ${instructions[summaryType]}

REGRAS OBRIGATORIAS DE FORMATACAO:
- Texto simples SEM asteriscos nem markdown
- Titulos de secao em MAIUSCULAS seguidos de dois-pontos (como acima)
- Listas com "- " no inicio de cada item
- Numere os topicos quando houver sequencia
- Gere o documento COMPLETO com todas as secoes indicadas
- Escreva em portugues brasileiro claro e tecnico`;

  try {
    const result = await callGemini(prompt, 4000);
    summaryMemCache.set(cacheKey, result);
    writeSummaryCache(cacheKey, result);
    return result;
  } catch (e) {
    console.error('Erro ao gerar resumo:', e);
    return 'Erro ao gerar resumo. Tente novamente.';
  }
};

// ─── Posts para campanhas ─────────────────────────────────────────────────────
// Cache: localStorage com TTL de 7 dias — posts do mesmo tema/plataformas/tom
const POSTS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const makePostsCacheKey = (topic: string, platforms: string[], tone: string) =>
  `mjc_posts__${topic.trim().toLowerCase().replace(/\s+/g, '_').substring(0, 40)}__${platforms.sort().join('-')}__${tone}`;

export const generateCampaignPosts = async (
  topic: string,
  platforms: string[],
  tone: string,
  additionalContext?: string
): Promise<Record<string, string>> => {
  const cacheKey = makePostsCacheKey(topic, platforms, tone);
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) {
      const { value, ts } = JSON.parse(raw);
      if (Date.now() - ts < POSTS_CACHE_TTL_MS) {
        console.info(`[Gemini] Cache posts hit: ${topic}`);
        return value;
      }
      localStorage.removeItem(cacheKey);
    }
  } catch {}

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
      const result = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      try { localStorage.setItem(cacheKey, JSON.stringify({ value: result, ts: Date.now() })); } catch {}
      return result;
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
    // jsonMode=true: Gemini garante JSON valido; 6000 tokens para questoes detalhadas
    const text = await callGemini(prompt, 6000, true);
    const questoes = JSON.parse(text);
    if (!Array.isArray(questoes) || questoes.length === 0)
      throw new Error('Formato inválido na resposta da IA.');
    return questoes;
  } catch (e: any) {
    console.error('Erro ao gerar exame:', e);
    throw new Error(e?.message || 'Não foi possível gerar o exame. Tente novamente.');
  }
};

// ─── Geração de JSON genérico (uso livre por outras telas) ───────────────────
export const generateJSON = async (prompt: string, maxOutputTokens: number = 3000): Promise<string> => {
  return callGemini(prompt, maxOutputTokens, true);
};

// ─── Exportações ──────────────────────────────────────────────────────────────
export const GeminiService = {
  chat,
  getGeminiResponse,
  generateJSON,
  generateTrainingOptions,
  generateTrainingDetail,
  generateSummary,
  generateCampaignPosts,
  generateExam,
};