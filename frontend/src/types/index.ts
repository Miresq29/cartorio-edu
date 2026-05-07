// frontend/src/types/index.ts — versão completa atualizada

export type UserRole = 'SUPERADMIN' | 'TENANT_ADMIN' | 'gestor' | 'atendente' | 'auditor' | 'admin' | 'expert' | 'viewer';

export interface User {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: UserRole;
  sector?: string;
  active: boolean;
  isFirstLogin?: boolean;
  mustChangePassword?: boolean;
  passwordHash?: string;
  passwordHistory?: string[];
  failedAttempts?: number;
  lockUntil?: string | null;
  avatar?: string;
}

export interface Tenant {
  id: string;
  name: string;
  cnpj?: string;
  createdAt: string;
  active: boolean;
}

export interface Document {
  id: string;
  tenantId?: string;
  title?: string;
  fileName?: string;
  category?: string;
  storagePath?: string;
  fileSize?: number;
  uploadedAt?: string;
  uploadedBy?: string;
  content?: string;
  rawText?: string;
  base64?: string;
  mimeType?: string;
  status?: 'pending' | 'analyzed' | 'error';
  createdAt?: any;
}

export type AuditCategory = 'AUTH' | 'DOCUMENT' | 'SYSTEM' | 'USER_MANAGEMENT' | 'SEGURANÇA' | 'CONSULTA_RAG' | 'CONFORMIDADE' | 'ADMINISTRAÇÃO' | 'BASE_LEGAL';

export interface AuditLog {
  id: string;
  userId: string;
  userName?: string;
  userSector?: string;
  action: string;
  category: AuditCategory;
  timestamp: any;
  details?: string;
}

export interface SearchLog {
  term: string;
  timestamp: string;
  userId: string;
}

export interface ChecklistItemTemplate {
  id: string;
  text?: string;
  requirement?: string;
  category?: string;
}

export interface ChecklistTemplate {
  id: string;
  title?: string;
  name?: string;
  icon?: string;
  items: ChecklistItemTemplate[];
  isMasterTemplate?: boolean;
}

export interface ComplianceReview {
  id: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type AppTab =
  // Sistema Master
  | 'dashboard' | 'admin' | 'audit'
  // Gestão
  | 'unit' | 'users' | 'reports' | 'security'
  // Conteúdo
  | 'trails' | 'videos' | 'knowledge' | 'comunicados'
  // Capacitação
  | 'training' | 'meu-progresso' | 'exames'
  | 'metas'
  | 'repositorio'
  | 'certificado'
  // Marketing
  | 'campanhas' | 'banners'
  // Plataforma
  | 'support' | 'tutorial' | 'terms' | 'privacy' | 'policy'
  // Legados (manter compatibilidade)
  | 'chat' | 'compliance' | 'checklists' | 'analytics'
  | 'revisar' | 'ia-analitica' | 'base' | 'seguranca' | 'security'
  | 'usuarios' | 'admin-cartorios' | 'atividades-master'
  | 'treinamento' | 'auditoria' | 'relatorios' | 'termos'
  | 'manual' | 'suporte' | 'colaboradores';

export interface AppState {
  user: User | null;
  activeTab: AppTab;
  knowledgeBase: Document[];
  isLoading: boolean;
  token: string | null;
  auditLogs: AuditLog[];
  chatHistory: ChatMessage[];
  complianceReviews: ComplianceReview[];
  checklistTemplates: ChecklistTemplate[];
  usersList: User[];
  tenants: Tenant[];
  searchLogs: SearchLog[];
}

export type AppAction =
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_TOKEN'; payload: string | null }
  | { type: 'SET_TAB'; payload: AppTab }
  | { type: 'SET_DOCS'; payload: Document[] }
  | { type: 'ADD_DOC'; payload: Document }
  | { type: 'REMOVE_DOC'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'ADD_LOG'; payload: AuditLog }
  | { type: 'SET_CHAT_HISTORY'; payload: ChatMessage[] }
  | { type: 'ADD_CHECKLIST_TEMPLATE'; payload: ChecklistTemplate }
  | { type: 'UPDATE_CHECKLIST_TEMPLATE'; payload: ChecklistTemplate }
  | { type: 'REMOVE_CHECKLIST_TEMPLATE'; payload: string }
  | { type: 'ADD_USER'; payload: User }
  | { type: 'UPDATE_USER'; payload: User }
  | { type: 'DELETE_USER'; payload: string }
  | { type: 'ADD_TENANT'; payload: Tenant }
  | { type: 'ADD_SEARCH_LOG'; payload: SearchLog };