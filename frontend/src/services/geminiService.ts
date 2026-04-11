/**
 * SERVIÇO DE INTEGRAÇÃO COM GEMINI (FRONTEND DIRETO)
 * Chama a API do Google Gemini diretamente.
 * Chave configurada via VITE_GEMINI_API_KEY no Vercel.
 */

// Usa VITE_GEMINI_API_KEY se disponível; caso contrário usa VITE_FIREBASE_API_KEY
// (ambas são chaves do mesmo projeto Google Cloud — a chave Firebase funciona para a API Gemini)
const GEMINI_API_KEY =
  import.meta.env.VITE_GEMINI_API_KEY ||
  import.meta.env.VITE_FIREBASE_API_KEY;

// gemini-2.0-flash: 1500 req/dia grátis vs 50/dia do gemini-2.5-pro
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

/**
 * Remove blocos de código Markdown e extrai JSON limpo
 */
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

/**
 * Função base: envia prompt para o Gemini e retorna texto da resposta
 */
const callGemini = async (prompt: string): Promise<string> => {
  if (!GEMINI_API_KEY) {
    console.error('[Gemini] VITE_GEMINI_API_KEY não configurada. Verifique as variáveis de ambiente no Vercel e no .env');
    throw new Error('Chave da API Gemini não configurada. Contate o administrador.');
  }
  console.info(`[Gemini] chamando ${GEMINI_MODEL} | prompt ${prompt.length} chars`);

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
      }
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err?.error?.message || response.statusText;
    const status = response.status;
    // 429 = cota esgotada, 400 = modelo/chave inválida, 403 = sem permissão
    throw new Error(`[Gemini ${status}] ${msg}`);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta da IA.';
};

/**
 * Chat principal — usado por todos os módulos
 */
export const chat = async (message: string, context: string, _token?: string) => {
  try {
    const prompt = context ? `Contexto: ${context}\n\n${message}` : message;
    const text = await callGemini(prompt);
    return { text };
  } catch (error: any) {
    console.error('Erro Gemini chat:', error);
    throw new Error('Falha ao conectar com o motor de IA.');
  }
};

/**
 * Parecer direto (Expert Review)
 */
export const getGeminiResponse = async (prompt: string): Promise<string> => {
  try {
    return await callGemini(prompt);
  } catch (error: any) {
    console.error('Erro Expert Review:', error);
    return 'Erro ao gerar parecer técnico.';
  }
};

/**
 * Auditoria de conformidade com JSON estruturado
 */
export const analyzeComplianceDeep = async (
  doc: { text?: string },
  checklist: string[],
  context: string
) => {
  const prompt = `Analise o documento abaixo contra o checklist. Retorne APENAS um array JSON válido, sem texto adicional, sem markdown:
[{"requirement": "...", "compliant": true/false, "comment": "...", "suggestion": "..."}]

Checklist:
${checklist.map(item => `- ${item}`).join('\n')}

Contexto legal: ${context}

Documento: ${doc.text || 'Conteúdo não disponível.'}`;

  try {
    const text = await callGemini(prompt);
    const cleaned = cleanJsonOutput(text);
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Erro conformidade:', e);
    return [{ requirement: 'Erro de Processamento', compliant: false, comment: 'A IA não gerou JSON válido.', suggestion: 'Tente novamente.' }];
  }
};

/**
 * Extração de checklist de documento
 */
export const extractChecklistFromDocument = async (doc: { text: string; fileName: string }) => {
  const prompt = `Extraia requisitos do documento "${doc.fileName}" para checklist notarial.
Retorne APENAS um array JSON: [{"id": "1", "text": "requisito"}]

Documento: ${doc.text}`;

  try {
    const text = await callGemini(prompt);
    const cleaned = cleanJsonOutput(text);
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Erro extração:', e);
    return [];
  }
};

/**
 * Gera 3 opções distintas de roteiro de treinamento em JSON estruturado
 */
export const generateTrainingOptions = async (context: string, customRequest?: string): Promise<any[]> => {
  const prompt = `${context}

${customRequest ? `Pedido específico: ${customRequest}\n\n` : ''}Gere EXATAMENTE 3 opções distintas de roteiro de treinamento para esta unidade notarial.
Cada opção deve ter uma abordagem diferente:
- Opção 1: Treinamento ESSENCIAL (básico, foco nos itens críticos, duração curta)
- Opção 2: Treinamento COMPLETO (abrangente, todos os módulos, profundidade técnica)
- Opção 3: Treinamento RELÂMPAGO (formato intensivo, pontos-chave, ideal para reciclagem)

Retorne APENAS um array JSON válido com exatamente 3 objetos, sem texto adicional, sem markdown:
[{
  "titulo": "Nome da opção",
  "tipo": "essencial|completo|relampago",
  "descricao": "Breve descrição da abordagem",
  "duracao": "ex: 4 horas",
  "publico": "ex: Atendentes novos",
  "modulos": [
    {"nome": "Nome do módulo", "objetivo": "O que o aluno aprenderá", "duracao": "30 min", "obrigatorio": true}
  ],
  "justificativa": "Por que esta opção é indicada"
}]`;

  try {
    const text = await callGemini(prompt);
    const cleaned = cleanJsonOutput(text);
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Erro ao gerar opções de treinamento:', e);
    return [];
  }
};

/**
 * Gera resumo de documento com tipo escolhido pelo usuário
 */
export const generateSummary = async (
  docContent: string,
  docTitle: string,
  summaryType: 'executivo' | 'tecnico' | 'didatico' | 'operacional'
): Promise<string> => {
  const instructions: Record<string, string> = {
    executivo: 'Resumo executivo de 1 página: pontos principais, impactos e conclusão. Linguagem direta para gestores.',
    tecnico: 'Resumo técnico detalhado: fundamentos legais, artigos relevantes, requisitos normativos e análise crítica.',
    didatico: 'Resumo didático para treinamento: explique como se fosse para um colaborador novo, com exemplos práticos e pontos de atenção.',
    operacional: 'Resumo operacional: foque em procedimentos, checklists de ação e passo a passo para aplicação no dia a dia.',
  };

  const prompt = `Você é um especialista em direito notarial da MJ Consultoria.
Documento: "${docTitle}"

INSTRUÇÃO: ${instructions[summaryType]}

CONTEÚDO DO DOCUMENTO:
${docContent.substring(0, 6000)}

Gere o resumo no formato solicitado. Use formatação clara com títulos em MAIÚSCULAS e bullets quando necessário.`;

  try {
    return await callGemini(prompt);
  } catch (e) {
    console.error('Erro ao gerar resumo:', e);
    return 'Erro ao gerar resumo. Tente novamente.';
  }
};

/**
 * Gera posts para campanhas de comunicação em múltiplas plataformas
 */
export const generateCampaignPosts = async (
  topic: string,
  platforms: string[],
  tone: string,
  additionalContext?: string
): Promise<Record<string, string>> => {
  const platformInstructions: Record<string, string> = {
    linkedin: 'Post profissional para LinkedIn: até 1300 caracteres, linguagem formal, hashtags relevantes ao final, foco em autoridade e credibilidade.',
    instagram: 'Post para Instagram: até 300 caracteres na legenda principal + chamada para ação, emojis moderados, 5-10 hashtags relevantes.',
    whatsapp: 'Mensagem para WhatsApp/grupos: informal mas respeitoso, direto ao ponto, máximo 3 parágrafos curtos, sem hashtags excessivas.',
    email: 'Assunto + corpo de e-mail institucional: formal, estruturado com cumprimento, desenvolvimento e encerramento, assinatura da cartório.',
  };

  const platformsText = platforms.map(p => `### ${p.toUpperCase()}\n${platformInstructions[p] || ''}`).join('\n\n');

  const prompt = `Você é especialista em comunicação institucional para cartórios.
Unidade: MJ Consultoria | Tom desejado: ${tone}
${additionalContext ? `Contexto adicional: ${additionalContext}\n` : ''}
TEMA DA CAMPANHA: ${topic}

Crie posts DISTINTOS e adaptados para cada plataforma abaixo:

${platformsText}

Retorne APENAS um objeto JSON válido, sem markdown, no formato:
{${platforms.map(p => `"${p}": "conteúdo do post"`).join(', ')}}`;

  try {
    const text = await callGemini(prompt);
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
    }
    return {};
  } catch (e) {
    console.error('Erro ao gerar posts de campanha:', e);
    return {};
  }
};

/**
 * Extrai JSON de qualquer formato (com ou sem blocos markdown)
 * Tenta array [] primeiro (mais comum), depois objeto {}
 */
const extractJsonObject = (text: string): any => {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  // 1. Tenta array [] — prioridade porque generateExam retorna array
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try { return JSON.parse(cleaned.substring(firstBracket, lastBracket + 1)); } catch {}
  }

  // 2. Tenta objeto {}
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try { return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1)); } catch {}
  }

  throw new Error('JSON inválido na resposta da IA');
};

export interface QuestaoExame {
  id: number;
  enunciado: string;
  alternativas: { letra: string; texto: string }[];
  correta: string;
  bloom: 'compreensao' | 'aplicacao' | 'analise';
  justificativa: string;
}

/**
 * Gera exame com Taxonomia de Bloom (nível médio)
 * 3 questões de Compreensão + 4 de Aplicação + 3 de Análise = 10 questões
 */
export const generateExam = async (
  titulo: string,
  conteudo: string,
  numQuestoes: number = 10
): Promise<QuestaoExame[]> => {
  const prompt = `Você é um especialista em avaliação educacional corporativa.

TEMA DO EXAME: "${titulo}"
CONTEÚDO BASE:
${conteudo.substring(0, 5000)}

Gere EXATAMENTE ${numQuestoes} questões de múltipla escolha usando a TAXONOMIA DE BLOOM nível médio:
- ${Math.round(numQuestoes * 0.3)} questões de COMPREENSÃO (bloom: "compreensao") — explique, descreva, identifique
- ${Math.round(numQuestoes * 0.4)} questões de APLICAÇÃO (bloom: "aplicacao") — demonstre, utilize, execute, aplique
- ${Math.round(numQuestoes * 0.3)} questões de ANÁLISE (bloom: "analise") — compare, diferencie, examine, avalie

REGRAS OBRIGATÓRIAS:
1. Cada questão tem exatamente 4 alternativas (A, B, C, D)
2. Apenas 1 alternativa correta por questão
3. As alternativas incorretas devem ser plausíveis (não óbvias)
4. Justifique brevemente por que a resposta está correta
5. Questões contextualizadas na realidade corporativa/profissional
6. Linguagem clara e objetiva

Retorne APENAS um array JSON válido, sem markdown, sem texto adicional:
[{
  "id": 1,
  "enunciado": "texto da questão",
  "alternativas": [
    {"letra": "A", "texto": "..."},
    {"letra": "B", "texto": "..."},
    {"letra": "C", "texto": "..."},
    {"letra": "D", "texto": "..."}
  ],
  "correta": "A",
  "bloom": "compreensao|aplicacao|analise",
  "justificativa": "Explicação breve da resposta correta"
}]`;

  try {
    const text = await callGemini(prompt);
    const questoes = extractJsonObject(text);
    if (!Array.isArray(questoes) || questoes.length === 0) throw new Error('Formato inválido na resposta da IA.');
    return questoes;
  } catch (e: any) {
    console.error('Erro ao gerar exame:', e);
    throw new Error(e?.message || 'Não foi possível gerar o exame. Tente novamente.');
  }
};

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
