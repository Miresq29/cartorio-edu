/**
 * extractor.ts — COM TESSERACT OCR
 *
 * PDF nativo  → pdfjs-dist (local, sem API)
 * PDF escaneado → pdfjs-dist tenta; se texto vazio, usa Tesseract OCR
 * DOCX        → mammoth (local, sem API)
 * Imagem      → Tesseract OCR (local, sem API — substituiu Gemini)
 * TXT/outros  → file.text() direto
 */

import { Document as AppDocument } from "../types";

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

// ─── Extração de PDF via pdfjs-dist ──────────────────────────────────────────
const extractTextFromPDF = async (file: File): Promise<string> => {
  const pdfjsLib = await import('pdfjs-dist');
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
};

// ─── OCR via Tesseract.js (imagens e PDFs escaneados) ────────────────────────
const extractTextWithTesseract = async (file: File): Promise<string> => {
  try {
    const Tesseract = await import('tesseract.js');
    const { data } = await Tesseract.recognize(file, 'por', {
      logger: () => {},
    });
    return data.text.trim();
  } catch (err) {
    console.error('Erro no Tesseract OCR:', err);
    throw new Error('Não foi possível extrair texto via OCR.');
  }
};

// ─── Extração de DOCX via mammoth ────────────────────────────────────────────
const extractTextFromDOCX = async (file: File): Promise<string> => {
  try {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
  } catch {
    return await file.text();
  }
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
               || nameLower.match(/\.(jpg|jpeg|png|webp|bmp|gif|tiff|tif)$/i) !== null;

  try {
    let rawText = '';

    if (isPDF) {
      // Tenta extração nativa primeiro
      rawText = await extractTextFromPDF(file);

      if (!rawText || rawText.replace(/\s/g, '').length < 50) {
        throw new Error('PDF escaneado detectado. Converta para PDF com texto antes de indexar.');

      }
    } else if (isDOCX) {
      rawText = await extractTextFromDOCX(file);
    } else if (isImage) {
      // ✅ Imagens agora usam Tesseract em vez de Gemini — sem custo de API
      rawText = await extractTextWithTesseract(file);
    } else {
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
      mimeType,
      status: 'analyzed'
    };
  } catch (err: any) {
    console.error('Erro na extração:', err);
    throw new Error(err.message || 'Não foi possível processar o arquivo.');
  }
};
