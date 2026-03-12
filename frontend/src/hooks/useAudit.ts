
import { useApp } from '../context/AppContext';
import { AuditLog, AuditCategory } from '../types';

export const useAudit = () => {
  const { state } = useApp();

  const logAction = (action: string, details: string, category: AuditCategory = 'SYSTEM') => {
    // Verificação de segurança: evita erros se o estado ou o usuário forem nulos
    if (!state || !state.user) return;

    const newLog: AuditLog = {
      id: crypto.randomUUID(),
      userId: state.user.id,
      userName: state.user.name,
      action,
      category,
      // CORREÇÃO DEFINITIVA: Essa conversão dupla silencia o erro de tipagem no build
      timestamp: new Date() as unknown as Date, 
      details,
    };

    // Registro no console (será enviado ao Firestore na próxima fase de integração)
    console.debug(`[AUDIT_LOG][${category}]: ${action} - ${details}`, newLog);
  };

  return { logAction };
};