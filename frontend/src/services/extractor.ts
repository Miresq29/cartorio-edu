import { Document as AppDocument } from "../types";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      } else {
        reject(new Error("Falha ao converter para Base64"));
      }
    };
    reader.onerror = (error) => reject(error);
  });
};

const extractTextWithGemini = async (base64: string, mimeType: string, fileName: string): Promise<string> => {
  if (!GEMINI_API_KEY) throw new Error('VITE_GEMINI_API_KEY não configurada.');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: base64
              }
            },
            {
              text: `Extraia TODO o texto deste documento "${fileName}" de forma fiel e completa, preservando a estrutura original. Retorne apenas o texto extraído, sem comentários adicionais.`
            }
          ]
        }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 8192,
        }
      })
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.error?.message || 'Erro ao extrair texto com Gemini');
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

export const extractTextFromFile = async (
  file: File
): Promise<Partial<AppDocument> & { base64?: string; mimeType: string }> => {
  const mimeType = file.type;
  const isBinaryForAI = mimeType === 'application/pdf' ||
    mimeType.startsWith('image/') ||
    file.name.toLowerCase().endsWith('.pdf') ||
    file.name.toLowerCase().match(/\.(jpg|jpeg|png|webp|bmp|gif)$/i) !== null;

  try {
    let rawText = '';
    let base64: string | undefined;

    if (isBinaryForAI) {
      base64 = await fileToBase64(file);
      rawText = await extractTextWithGemini(base64, mimeType, file.name);

      if (!rawText.trim()) {
        throw new Error('Não foi possível extrair texto do arquivo. Verifique se o documento contém texto legível.');
      }
    } else {
      rawText = await file.text();
    }

    return {
      title: file.name,
      fileName: file.name,
      content: rawText,
      rawText: rawText,
      base64,
      mimeType,
      status: 'analyzed'
    };
  } catch (err: any) {
    console.error('Erro na extração:', err);
    throw new Error(err.message || 'Não foi possível processar o arquivo.');
  }
};
