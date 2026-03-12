// backend/src/constants.ts

export const APP_CONFIG = {
  // Configurações de Segurança e Sessão
  MAX_FAILED_ATTEMPTS: 5,
  LOCK_DURATION_MS: 5 * 60 * 1000, // 5 minutos de bloqueio
  SESSION_TIMEOUT_MIN: 30,

  // Limites de Operação Notarial
  MAX_SEARCH_RESULTS: 15,
  MAX_COMPLIANCE_RULES: 15,

  // Definições de Modelos de IA (Tier Pago - Gemini 3)
  // Modelo para tarefas complexas, análise jurídica profunda e visão multimodal
  GEMINI_MODEL: 'gemini-3-flash', 
  
  // Modelo otimizado para tarefas rápidas, extração de texto e checklists
  FAST_MODEL: 'gemini-3-flash-8b',

  // Configurações de IA
  DEFAULT_TEMPERATURE: 0.3,
  AI_TIMEOUT_MS: 30000,
};

export const STORAGE_KEYS = {
  USER_DATA: 'cartorio_user',
  DOCUMENTS: 'cartorio_docs',
  LOGS: 'cartorio_logs',
  REVIEWS: 'cartorio_reviews',
};
