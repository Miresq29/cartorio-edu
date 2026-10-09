// Escapa valores antes de injetá-los em HTML construído via template literal (document.write,
// certificados, relatórios impressos). Sem isso, qualquer campo de texto vindo do Firestore
// (nome de usuário, título de trilha, descrição, cargo etc.) que um gestor/curador/colaborador
// consiga editar vira um vetor de XSS armazenado nessas telas de impressão.
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
