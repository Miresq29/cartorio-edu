/**
 * SERVIÇO DE INTEGRAÇÃO COM GEMINI (FRONTEND DIRETO)
 * Chama a API do Google Gemini diretamente.
 * Chave configurada via VITE_GEMINI_API_KEY no Vercel.
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;

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
    throw new Error('VITE_GEMINI_API_KEY não configurada.');
  }

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
    const err = await response.json();
    throw new Error(err?.error?.message || `Erro Gemini: ${response.statusText}`);
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
    // Extrai o JSON do objeto
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      return JSON.parse(text.substring(firstBrace, lastBrace + 1));
    }
    return {};
  } catch (e) {
    console.error('Erro ao gerar posts de campanha:', e);
    return {};
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
};
