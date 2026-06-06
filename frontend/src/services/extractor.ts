/**
 * extractor.ts — VERSÃO SEM DEPENDÊNCIA DE IA PARA PDFs
 *
 * Estratégia por tipo de arquivo:
 * - PDF     → pdfjs-dist (extração local no browser, sem API)
 * - DOCX    → mammoth.js (extração local no browser, sem API)
 * - Imagens → Gemini API (único caso que ainda precisa de IA)
 * - TXT/outros → file.text() direto
 *
 * Gemini só é chamado para imagens (jpg, png, etc.)
 */

import { Document as AppDocument } from "../types";

const GEMINI_API_KEY =
  import.meta.env.VITE_GEMINI_API_KEY ||
  import.meta.env.VITE_FIREBASE_API_KEY;

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

// ─── Extração de PDF via pdfjs-dist (local, sem IA) ──────────────────────────
const extractTextFromPDF = async (file: File): Promise<string> => {
  try {
    // Importação dinâmica para não aumentar o bundle inicial
    const pdfjsLib = await import('pdfjs-dist');

    // Worker necessário para pdfjs funcionar no browser
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    return fullText.trim();
  } catch (err) {
    console.error('Erro ao extrair PDF com pdfjs:', err);
    throw new Error('Não foi possível extrair texto do PDF. O arquivo pode estar corrompido ou protegido.');
  }
};

// ─── Extração de DOCX via mammoth (local, sem IA) ────────────────────────────
const extractTextFromDOCX = async (file: File): Promise<string> => {
  try {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
  } catch (err) {
    console.error('Erro ao extrair DOCX com mammoth:', err);
    // Fallback: tenta como texto simples
    return await file.text();
  }
};

// ─── Extração de imagem via Gemini (único caso com IA) ───────────────────────
const extractTextFromImageWithGemini = async (
  base64: string,
  mimeType: string,
  fileName: string
): Promise<string> => {
  if (!GEMINI_API_KEY) throw new Error('VITE_GEMINI_API_KEY não configurada.');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64 } },
            { text: `Extraia TODO o texto desta imagem "${fileName}" de forma fiel. Retorne apenas o texto extraído.` }
          ]
        }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 4000,
        }
      })
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.error?.message || 'Erro ao extrair texto da imagem com Gemini');
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

// ─── Função principal ─────────────────────────────────────────────────────────
export const extractTextFromFile = async (
  file: File
): Promise<Partial<AppDocument> & { base64?: string; mimeType: string }> => {
  const mimeType = file.type;
  const nameLower = file.name.toLowerCase();

  const isPDF  = mimeType === 'application/pdf' || nameLower.endsWith('.pdf');
  const isDOCX = mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              || nameLower.endsWith('.docx');
  const isImage = mimeType.startsWith('image/')
               || nameLower.match(/\.(jpg|jpeg|png|webp|bmp|gif)$/i) !== null;

  try {
    let rawText = '';
    let base64: string | undefined;

    if (isPDF) {
      // ✅ PDF: extração local com pdfjs — sem chamar Gemini
      rawText = await extractTextFromPDF(file);
    } else if (isDOCX) {
      // ✅ DOCX: extração local com mammoth — sem chamar Gemini
      rawText = await extractTextFromDOCX(file);
    } else if (isImage) {
      // ⚠️ Imagem: único caso que ainda usa Gemini
      base64 = await fileToBase64(file);
      rawText = await extractTextFromImageWithGemini(base64, mimeType, file.name);
    } else {
      // TXT, CSV, JSON, etc.: leitura direta
      rawText = await file.text();
    }

    if (!rawText.trim()) {
      throw new Error('Não foi possível extrair texto do arquivo. Verifique se o documento contém texto legível.');
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
