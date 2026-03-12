import { z } from 'zod';

// Schemas de Validação

export const LoginSchema = z.object({
  email: z.string()
    .email('E-mail inválido')
    .max(100, 'E-mail muito longo'),
  password: z.string()
    .min(8, 'Senha deve ter no mínimo 8 caracteres')
    .max(100, 'Senha muito longa')
});

export const ChatMessageSchema = z.object({
  message: z.string()
    .min(1, 'Mensagem vazia')
    .max(5000, 'Mensagem muito longa (máx 5000 caracteres)')
    .refine(
      (val) => !/[\x00-\x1F\x7F]/.test(val),
      'Caracteres de controle não permitidos'
    ),
  context: z.string().max(50000).optional()
});

export const CreateUserSchema = z.object({
  email: z.string().email('E-mail inválido'),
  name: z.string()
    .min(3, 'Nome deve ter no mínimo 3 caracteres')
    .max(100, 'Nome muito longo')
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, 'Nome deve conter apenas letras'),
  role: z.enum(['SUPERADMIN', 'TENANT_ADMIN', 'gestor', 'atendente', 'auditor']),
  sector: z.string().min(2).max(50),
  tenantId: z.string().regex(/^[A-Z0-9_]+$/, 'TenantId inválido')
});

export const PasswordSchema = z.string()
  .min(12, 'Senha deve ter no mínimo 12 caracteres')
  .max(100, 'Senha muito longa')
  .regex(/[A-Z]/, 'Senha deve conter maiúsculas')
  .regex(/[a-z]/, 'Senha deve conter minúsculas')
  .regex(/[0-9]/, 'Senha deve conter números')
  .regex(/[^A-Za-z0-9]/, 'Senha deve conter símbolos');

export const DocumentUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  category: z.string().min(1).max(100),
  fileSize: z.number().max(10 * 1024 * 1024, 'Arquivo muito grande (máx 10MB)')
});

export const ChecklistItemSchema = z.object({
  requirement: z.string().min(5, 'Requisito muito curto').max(500, 'Requisito muito longo')
});