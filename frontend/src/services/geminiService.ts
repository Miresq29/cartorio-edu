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

export const GeminiService = {
  chat,
  getGeminiResponse,
  analyzeComplianceDeep,
  extractChecklistFromDocument
};
