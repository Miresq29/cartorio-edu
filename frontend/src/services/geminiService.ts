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

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// gemini-2.0-flash: 1500 req/dia grátis, bom custo-benefício
const GEMINI_MODEL = 'gemini-flash-latest';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ─── Cache persistente para resumos (localStorage) ───────────────────────────
// Persiste entre sessões — evita rechamar a API para o mesmo doc+tipo
// TTL: 30 dias (provimentos mudam raramente)
const SUMMARY_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const makeCacheKey = (title: string, type: string): string =>
  `mjc_summary__${title.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}__${type}`;

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

// ─── Checklists estáticos para provimentos conhecidos ────────────────────────
// Elimina 100% das chamadas Gemini para documentos fixos do acervo
const STATIC_CHECKLISTS: Record<string, { id: string; text: string }[]> = {
  // ── LGPD / Segurança da Informação ────────────────────────────────────────
  'provimento 213': [
    { id: '1',  text: 'Designar Responsável Técnico de TI (art. 3º)' },
    { id: '2',  text: 'Designar Encarregado de Dados (DPO) (art. 4º)' },
    { id: '3',  text: 'Elaborar Política de Segurança da Informação (PSI)' },
    { id: '4',  text: 'Elaborar Plano de Continuidade de Negócios (PCN)' },
    { id: '5',  text: 'Manter inventário de ativos de TI atualizado' },
    { id: '6',  text: 'Formalizar contratos com operadores de dados (DPA)' },
    { id: '7',  text: 'Elaborar ROPA (Registro de Operações de Tratamento)' },
    { id: '8',  text: 'Realizar treinamento de equipe em LGPD' },
    { id: '9',  text: 'Implantar canal de atendimento ao titular de dados' },
    { id: '10', text: 'Implementar controles de acesso e autenticação' },
  ],
  // ── Segurança cibernética / backup ────────────────────────────────────────
  'provimento 149': [
    { id: '1', text: 'Manter sistema de gestão eletrônica de documentos' },
    { id: '2', text: 'Garantir backup periódico dos dados' },
    { id: '3', text: 'Controlar acesso lógico aos sistemas' },
    { id: '4', text: 'Registrar logs de acesso e alterações' },
    { id: '5', text: 'Comunicar incidentes ao CNJ no prazo previsto' },
  ],
  // ── PLD/FTP (Prevenção à Lavagem de Dinheiro) ────────────────────────────
  'provimento 161': [
    { id: '1', text: 'Implementar programa PLD/FTP (Lei 9.613/98)' },
    { id: '2', text: 'Realizar identificação e cadastro de clientes (KYC)' },
    { id: '3', text: 'Monitorar operações suspeitas de lavagem de dinheiro' },
    { id: '4', text: 'Comunicar operações suspeitas ao COAF' },
    { id: '5', text: 'Treinar colaboradores em PLD/FTP anualmente' },
    { id: '6', text: 'Manter registros pelo prazo legal (5 anos)' },
  ],
  // ── Inventário e partilha extrajudicial (Resolução 35/CNJ) ───────────────
  'resolução 35': [
    { id: '1', text: 'Verificar inexistência de herdeiros incapazes (art. 2º)' },
    { id: '2', text: 'Exigir certidão de óbito do autor da herança' },
    { id: '3', text: 'Identificar todos os bens, dívidas e obrigações' },
    { id: '4', text: 'Verificar quitação do ITCMD (imposto de transmissão)' },
    { id: '5', text: 'Lavrar escritura de inventário/partilha com todos os herdeiros' },
    { id: '6', text: 'Registrar escritura no Cartório de Imóveis (se houver imóvel)' },
  ],
  // ── Divórcio e separação extrajudicial ───────────────────────────────────
  'provimento 65': [
    { id: '1', text: 'Verificar ausência de filhos menores ou incapazes (art. 1º)' },
    { id: '2', text: 'Obter certidão de casamento atualizada' },
    { id: '3', text: 'Identificar e discriminar todos os bens partilhados' },
    { id: '4', text: 'Lavrar escritura com advogado constituído pelas partes' },
    { id: '5', text: 'Registrar averbação no Cartório de Registro Civil' },
    { id: '6', text: 'Registrar averbação no Cartório de Imóveis (se houver imóvel)' },
  ],
  // ── Apostilamento de Haia ────────────────────────────────────────────────
  'provimento 32': [
    { id: '1', text: 'Verificar autenticidade do documento público a ser apostilado' },
    { id: '2', text: 'Confirmar que o país de destino é signatário da Convenção de Haia' },
    { id: '3', text: 'Lançar dados no sistema e-Apostila do CNJ' },
    { id: '4', text: 'Apor apostila com código de verificação único' },
    { id: '5', text: 'Registrar o ato no livro competente' },
    { id: '6', text: 'Arquivar cópia do documento apostilado' },
  ],
  // ── Atos notariais eletrônicos ───────────────────────────────────────────
  'provimento 100': [
    { id: '1', text: 'Usar plataforma e-Notariado homologada pelo CNJ' },
    { id: '2', text: 'Verificar identidade das partes por videoconferência' },
    { id: '3', text: 'Coletar assinaturas com certificado ICP-Brasil' },
    { id: '4', text: 'Gerar QR Code para verificação da escritura' },
    { id: '5', text: 'Arquivar instrumento eletrônico em servidor certificado' },
    { id: '6', text: 'Registrar ato no livro eletrônico do e-Notariado' },
  ],
  // ── Reconhecimento de parentalidade socioafetiva ─────────────────────────
  'provimento 63': [
    { id: '1', text: 'Verificar manifestação espontânea e livre de vício' },
    { id: '2', text: 'Exigir idade mínima de 18 anos do declarante' },
    { id: '3', text: 'Confirmar diferença mínima de 16 anos entre as partes' },
    { id: '4', text: 'Lavrar escritura declaratória de reconhecimento' },
    { id: '5', text: 'Comunicar o ato ao Cartório de Registro Civil' },
    { id: '6', text: 'Averbação na certidão de nascimento do filho' },
  ],
  // ── Usucapião extrajudicial ───────────────────────────────────────────────
  'provimento 65_usucapiao': [
    { id: '1', text: 'Verificar requisitos do art. 1.238 a 1.244 do CC' },
    { id: '2', text: 'Exigir ata notarial de constatação de posse' },
    { id: '3', text: 'Obter planta e memorial descritivo do imóvel' },
    { id: '4', text: 'Notificar confinantes e titulares de direitos reais' },
    { id: '5', text: 'Registrar procedimento no Cartório de Imóveis' },
    { id: '6', text: 'Emitir certidão de conclusão do procedimento' },
  ],
  // ── Qualidade e excelência notarial ──────────────────────────────────────
  'provimento 150': [
    { id: '1', text: 'Implementar sistema de gestão da qualidade (SGQ)' },
    { id: '2', text: 'Estabelecer indicadores de desempenho (KPIs notariais)' },
    { id: '3', text: 'Realizar avaliação de satisfação do usuário periodicamente' },
    { id: '4', text: 'Manter equipe capacitada com horas mínimas de treinamento' },
    { id: '5', text: 'Elaborar relatório de gestão anual' },
    { id: '6', text: 'Submeter-se à auditoria do sistema de qualidade' },
  ],
  // ── Escritura pública em geral ────────────────────────────────────────────
  'escritura publica': [
    { id: '1',  text: 'Verificar identidade e capacidade civil das partes' },
    { id: '2',  text: 'Conferir representação legal (procuração/mandato)' },
    { id: '3',  text: 'Verificar impedimentos legais ao ato' },
    { id: '4',  text: 'Ler o instrumento às partes ou confirmar leitura' },
    { id: '5',  text: 'Colher assinaturas de todas as partes e testemunhas' },
    { id: '6',  text: 'Assinar e autenticar com sinal público do tabelião' },
    { id: '7',  text: 'Lavrar no livro de notas com numeração sequencial' },
    { id: '8',  text: 'Arquivar minutas e documentos comprobatórios' },
    { id: '9',  text: 'Expedir certidão (traslado/certidão) quando solicitado' },
    { id: '10', text: 'Recolher emolumentos conforme tabela estadual' },
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
  const ctxTruncated = context.substring(0, 1500);
  const prompt = `Conteúdo do documento notarial:
${ctxTruncated}
${customRequest ? `\nPedido: ${customRequest}` : ''}

Preencha o JSON abaixo com títulos e módulos específicos para ESTE documento. Não altere a estrutura — apenas preencha os campos "titulo", "descricao", "justificativa", e o array "modulos" de cada opção. Retorne APENAS o JSON completo sem markdown:
[
  {"titulo":"PREENCHER","tipo":"essencial","descricao":"PREENCHER","duracao":"1h30","publico":"Toda a equipe","modulos":[{"nome":"PREENCHER","objetivo":"PREENCHER","duracao":"30min","obrigatorio":true},{"nome":"PREENCHER","objetivo":"PREENCHER","duracao":"30min","obrigatorio":true},{"nome":"PREENCHER","objetivo":"PREENCHER","duracao":"30min","obrigatorio":false}],"justificativa":"PREENCHER"},
  {"titulo":"PREENCHER","tipo":"completo","descricao":"PREENCHER","duracao":"4h","publico":"Equipe completa + gestores","modulos":[{"nome":"PREENCHER","objetivo":"PREENCHER","duracao":"45min","obrigatorio":true},{"nome":"PREENCHER","objetivo":"PREENCHER","duracao":"45min","obrigatorio":true},{"nome":"PREENCHER","objetivo":"PREENCHER","duracao":"45min","obrigatorio":true},{"nome":"PREENCHER","objetivo":"PREENCHER","duracao":"30min","obrigatorio":true},{"nome":"PREENCHER","objetivo":"PREENCHER","duracao":"15min","obrigatorio":false}],"justificativa":"PREENCHER"},
  {"titulo":"PREENCHER","tipo":"relampago","descricao":"PREENCHER","duracao":"45min","publico":"Colaboradores experientes","modulos":[{"nome":"PREENCHER","objetivo":"PREENCHER","duracao":"25min","obrigatorio":true},{"nome":"PREENCHER","objetivo":"PREENCHER","duracao":"20min","obrigatorio":true}],"justificativa":"PREENCHER"}
]`;

  try {
    // jsonMode=true: Gemini garante JSON válido — sem truncamento nem chars não-escapados
    const text = await callGemini(prompt, 4096, true);
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Array inválido');
    return parsed;
  } catch (e) {
    console.error('Erro ao gerar opções de treinamento:', e);
    // Fallback: retorna templates com contexto básico extraído
    const titulo = ctxTruncated.split('\n')[0]?.substring(0, 60) || 'Documento Notarial';
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
    const result = await callGemini(prompt, 2000);
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
    // jsonMode=true: Gemini garante JSON válido
    const text = await callGemini(prompt, 4096, true);
    const questoes = JSON.parse(text);
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
  extractChecklistFromDocument,
  generateTrainingOptions,
  generateSummary,
  generateCampaignPosts,
  generateExam,
};