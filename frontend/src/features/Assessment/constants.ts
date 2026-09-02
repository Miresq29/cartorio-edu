import { Dimensao, PrioridadeGap } from './types';

export const NIVEL_LABELS: Record<number, string> = {
  1: 'Nível 1 — Inicial',
  2: 'Nível 2 — Em desenvolvimento',
  3: 'Nível 3 — Definido',
  4: 'Nível 4 — Gerenciado',
  5: 'Nível 5 — Otimizado',
};

export const DIMENSOES: Dimensao[] = [
  {
    id: 'cap', nome: 'Capacitação da equipe',
    peso: 14, bloqueadora: true,
    ref: 'Provimento CNJ 149 Art. 6; Provimento CNJ 213 Art. 8',
    desc: 'Verifica se todos os colaboradores receberam treinamento obrigatório com evidência formal de conclusão.',
    indicadores: [
      { id: 'cap.1', tipo: 'sim_nao', peso: 2, texto: 'Todos os colaboradores ativos concluíram ao menos uma trilha de capacitação em LGPD nos últimos 12 meses?' },
      { id: 'cap.2', tipo: 'documento', peso: 3, texto: 'Há certificado individual ou registro formal de conclusão para cada colaborador?' },
      { id: 'cap.3', tipo: 'sim_nao', peso: 2, texto: 'Novos colaboradores são incluídos em treinamento de integração antes de acessar sistemas?' },
      { id: 'cap.4', tipo: 'sim_nao', peso: 2, texto: 'A equipe foi capacitada especificamente em segurança da informação (além de LGPD)?' },
      { id: 'cap.5', tipo: 'metrica', peso: 1, texto: 'Qual a taxa de conclusão das trilhas obrigatórias nos últimos 6 meses? (0–100%)' },
    ],
  },
  {
    id: 'lgpd', nome: 'Proteção de dados (LGPD)',
    peso: 14, bloqueadora: true,
    ref: 'LGPD Art. 37, 38; Provimento CNJ 213',
    desc: 'Verifica a existência e manutenção dos artefatos LGPD que a ANPD e a corregedoria podem solicitar.',
    indicadores: [
      { id: 'lgpd.1', tipo: 'documento', peso: 3, texto: 'Existe ROPA (Registro das Operações de Tratamento) atualizado?' },
      { id: 'lgpd.2', tipo: 'documento', peso: 3, texto: 'Existe RIPD/DPIA para operações de alto risco identificadas?' },
      { id: 'lgpd.3', tipo: 'documento', peso: 3, texto: 'Há procedimento formal para resposta a solicitações de titulares?' },
      { id: 'lgpd.4', tipo: 'documento', peso: 3, texto: 'Existe procedimento de notificação de incidentes à ANPD dentro do prazo legal?' },
    ],
  },
  {
    id: 'inc', nome: 'Gestão de incidentes',
    peso: 12, bloqueadora: false,
    ref: 'Provimento CNJ 213 Art. 16; LGPD Art. 48',
    desc: 'Verifica se há processo claro para identificar, registrar, conter e comunicar incidentes.',
    indicadores: [
      { id: 'inc.1', tipo: 'documento', peso: 3, texto: 'Existe procedimento escrito para resposta a incidentes de segurança?' },
      { id: 'inc.2', tipo: 'sim_nao', peso: 2, texto: 'Os colaboradores sabem a quem reportar um incidente suspeito?' },
      { id: 'inc.3', tipo: 'sim_nao', peso: 2, texto: 'Houve ao menos um exercício/simulacro de incidente nos últimos 12 meses?' },
      { id: 'inc.4', tipo: 'documento', peso: 3, texto: 'Incidentes passados foram registrados com causa raiz e ação corretiva?' },
    ],
  },
  {
    id: 'gov', nome: 'Governança e liderança',
    peso: 11, bloqueadora: false,
    ref: 'Provimento CNJ 213 Art. 4, 5',
    desc: 'Avalia se a alta direção assumiu formalmente a responsabilidade pela segurança da informação.',
    indicadores: [
      { id: 'gov.1', tipo: 'documento', peso: 3, texto: 'Existe Portaria/Resolução interna nomeando o Responsável pelo Tratamento e o DPO/encarregado?' },
      { id: 'gov.2', tipo: 'sim_nao', peso: 2, texto: 'A liderança participou de ao menos uma capacitação em LGPD ou segurança da informação nos últimos 12 meses?' },
      { id: 'gov.3', tipo: 'documento', peso: 3, texto: 'Existe Política de Segurança da Informação (PSI) aprovada e assinada pelo titular?' },
      { id: 'gov.4', tipo: 'sim_nao', peso: 2, texto: 'A PSI foi revisada ou revalidada nos últimos 12 meses?' },
    ],
  },
  {
    id: 'acc', nome: 'Controle de acesso',
    peso: 10, bloqueadora: false,
    ref: 'Provimento CNJ 213 Art. 10, 11',
    desc: 'Mede se o cartório controla quem acessa o quê.',
    indicadores: [
      { id: 'acc.1', tipo: 'documento', peso: 3, texto: 'Existe lista atualizada de colaboradores com seus níveis de acesso aos sistemas?' },
      { id: 'acc.2', tipo: 'sim_nao', peso: 2, texto: 'Acessos são revogados imediatamente após desligamento de colaborador?' },
      { id: 'acc.3', tipo: 'sim_nao', peso: 2, texto: 'Autenticação multifator (MFA) está habilitada nos sistemas críticos?' },
      { id: 'acc.4', tipo: 'documento', peso: 3, texto: 'Senhas seguem política formal (comprimento mínimo, rotatividade, não reutilização)?' },
    ],
  },
  {
    id: 'bkp', nome: 'Continuidade e backup',
    peso: 10, bloqueadora: false,
    ref: 'Provimento CNJ 213 Art. 14, 15',
    desc: 'Avalia se a serventia consegue se recuperar de um incidente sem perda de dados.',
    indicadores: [
      { id: 'bkp.1', tipo: 'documento', peso: 3, texto: 'Existe Plano de Continuidade de Negócios (PCN) documentado?' },
      { id: 'bkp.2', tipo: 'sim_nao', peso: 2, texto: 'Backups são realizados com frequência definida e testados periodicamente?' },
      { id: 'bkp.3', tipo: 'sim_nao', peso: 2, texto: 'O último teste de restauração de backup foi realizado há menos de 6 meses?' },
      { id: 'bkp.4', tipo: 'metrica', peso: 1, texto: 'Qual a frequência atual de backup dos dados críticos? (0=nunca, 100=diário)' },
    ],
  },
  {
    id: 'phi', nome: 'Simulação de phishing',
    peso: 10, bloqueadora: false,
    ref: 'Provimento CNJ 213 Art. 8; LGPD Art. 46',
    desc: 'Avalia o nível de resiliência humana contra engenharia social.',
    indicadores: [
      { id: 'phi.1', tipo: 'sim_nao', peso: 2, texto: 'A serventia realizou ao menos uma simulação de phishing nos últimos 12 meses?' },
      { id: 'phi.2', tipo: 'metrica', peso: 1, texto: 'A taxa de clique na última simulação foi inferior a 20%? (0=acima de 40%, 100=abaixo de 10%)' },
      { id: 'phi.3', tipo: 'sim_nao', peso: 2, texto: 'Colaboradores que clicaram receberam treinamento de reforço?' },
      { id: 'phi.4', tipo: 'metrica', peso: 1, texto: 'A evolução da taxa de clique entre simulações está sendo acompanhada? (0=nunca, 100=sempre)' },
    ],
  },
  {
    id: 'aud', nome: 'Auditoria e melhoria',
    peso: 9, bloqueadora: false,
    ref: 'Provimento CNJ 213 Art. 18, 19',
    desc: 'Verifica se a serventia revisa seu programa de segurança periodicamente.',
    indicadores: [
      { id: 'aud.1', tipo: 'documento', peso: 3, texto: 'Os logs de acesso aos sistemas são retidos por ao menos 5 anos?' },
      { id: 'aud.2', tipo: 'sim_nao', peso: 2, texto: 'Foi realizada uma revisão ou auditoria interna do programa de segurança nos últimos 12 meses?' },
      { id: 'aud.3', tipo: 'documento', peso: 3, texto: 'Resultados de auditorias anteriores geraram plano de ação com prazos?' },
      { id: 'aud.4', tipo: 'sim_nao', peso: 2, texto: 'O Dossiê de Conformidade foi gerado ou atualizado nos últimos 6 meses?' },
    ],
  },
  {
    id: 'com', nome: 'Comunicação com evidência',
    peso: 6, bloqueadora: false,
    ref: 'Provimento CNJ 149 Art. 6; Provimento CNJ 213 Art. 8',
    desc: 'Mede se comunicados críticos chegam a todos e geram prova de ciência.',
    indicadores: [
      { id: 'com.1', tipo: 'sim_nao', peso: 2, texto: 'Comunicados críticos exigem aceite formal ("li e concordo") dos colaboradores?' },
      { id: 'com.2', tipo: 'documento', peso: 3, texto: 'Há registro datado de envio e leitura para cada comunicado relevante?' },
      { id: 'com.3', tipo: 'sim_nao', peso: 2, texto: 'A serventia tem canal interno de reporte de dúvidas e suspeitas de segurança?' },
    ],
  },
  {
    id: 'fis', nome: 'Segurança física e dispositivos',
    peso: 4, bloqueadora: false,
    ref: 'Provimento CNJ 213 Art. 12, 13',
    desc: 'Avalia controles físicos e de endpoint.',
    indicadores: [
      { id: 'fis.1', tipo: 'sim_nao', peso: 2, texto: 'Há controle de acesso físico às áreas onde ficam servidores e arquivos sensíveis?' },
      { id: 'fis.2', tipo: 'sim_nao', peso: 2, texto: 'Todos os computadores têm antivírus/EDR ativo e atualizado?' },
      { id: 'fis.3', tipo: 'sim_nao', peso: 2, texto: 'Dispositivos móveis usados no trabalho seguem política de segurança?' },
      { id: 'fis.4', tipo: 'documento', peso: 3, texto: 'Existe inventário atualizado dos ativos de tecnologia da serventia?' },
    ],
  },
];

interface TrilhaGap {
  trilha: string;
  prioridade: PrioridadeGap;
  prazo: string;
}

export const GAP_TRILHAS: Record<string, TrilhaGap[]> = {
  'cap.1': [{ trilha: 'LGPD no Dia a Dia do Cartório (trilha oficial)', prioridade: 'urgente', prazo: '7 dias' }],
  'cap.3': [{ trilha: 'Integração segura (gerada por IA)', prioridade: 'urgente', prazo: '3 dias' }],
  'lgpd.1': [{ trilha: 'LGPD aplicada ao cartório — ROPA e RIPD (IA)', prioridade: 'urgente', prazo: '15 dias' }],
  'lgpd.3': [{ trilha: 'Direitos dos titulares — fluxo de resposta (IA)', prioridade: 'alta', prazo: '30 dias' }],
  'lgpd.4': [{ trilha: 'Resposta a incidentes para serventias (IA)', prioridade: 'urgente', prazo: '15 dias' }],
  'inc.1': [{ trilha: 'Resposta a incidentes para serventias (IA)', prioridade: 'alta', prazo: '21 dias' }],
  'inc.2': [{ trilha: 'Engenharia Social e Phishing (trilha oficial)', prioridade: 'alta', prazo: '14 dias' }],
  'gov.3': [{ trilha: 'Governança e SI para titulares (IA)', prioridade: 'alta', prazo: '21 dias' }],
  'acc.3': [{ trilha: 'Segurança de Senhas e Autenticação (trilha oficial)', prioridade: 'alta', prazo: '7 dias' }],
  'acc.4': [{ trilha: 'Segurança de Senhas e Autenticação (trilha oficial)', prioridade: 'alta', prazo: '30 dias' }],
  'bkp.1': [{ trilha: 'Continuidade de negócios para cartórios (IA)', prioridade: 'alta', prazo: '45 dias' }],
  'bkp.2': [{ trilha: 'Backup e recuperação — boas práticas (IA)', prioridade: 'alta', prazo: '30 dias' }],
  'phi.1': [{ trilha: 'Engenharia Social e Phishing (trilha oficial)', prioridade: 'alta', prazo: '14 dias' }],
  'fis.3': [{ trilha: 'Segurança em Dispositivos Móveis e Trabalho Remoto (trilha oficial)', prioridade: 'baixa', prazo: '60 dias' }],
  'aud.4': [{ trilha: 'Gerar Dossiê de Conformidade pela plataforma (ação direta)', prioridade: 'urgente', prazo: 'Imediato' }],

  'cap.2': [{ trilha: 'LGPD no Dia a Dia do Cartório (trilha oficial)', prioridade: 'alta', prazo: '15 dias' }],
  'cap.4': [{ trilha: 'Fundamentos de Segurança da Informação para colaboradores (IA)', prioridade: 'alta', prazo: '30 dias' }],
  'cap.5': [{ trilha: 'LGPD no Dia a Dia do Cartório (trilha oficial)', prioridade: 'urgente', prazo: '15 dias' }],

  'lgpd.2': [{ trilha: 'LGPD aplicada ao cartório — ROPA e RIPD (IA)', prioridade: 'alta', prazo: '30 dias' }],

  'inc.3': [{ trilha: 'Resposta a incidentes para serventias (IA)', prioridade: 'alta', prazo: '30 dias' }],
  'inc.4': [{ trilha: 'Resposta a incidentes para serventias (IA)', prioridade: 'alta', prazo: '30 dias' }],

  'gov.1': [{ trilha: 'Governança e SI para titulares (IA)', prioridade: 'urgente', prazo: '15 dias' }],
  'gov.2': [{ trilha: 'LGPD no Dia a Dia do Cartório (trilha oficial)', prioridade: 'alta', prazo: '30 dias' }],
  'gov.4': [{ trilha: 'Governança e SI para titulares (IA)', prioridade: 'alta', prazo: '60 dias' }],

  'acc.1': [{ trilha: 'Controle de acesso e gestão de credenciais (IA)', prioridade: 'alta', prazo: '21 dias' }],
  'acc.2': [{ trilha: 'Controle de acesso e gestão de credenciais (IA)', prioridade: 'urgente', prazo: '7 dias' }],

  'bkp.3': [{ trilha: 'Backup e recuperação — boas práticas (IA)', prioridade: 'alta', prazo: '30 dias' }],
  'bkp.4': [{ trilha: 'Backup e recuperação — boas práticas (IA)', prioridade: 'alta', prazo: '30 dias' }],

  'phi.2': [{ trilha: 'Engenharia Social e Phishing (trilha oficial)', prioridade: 'urgente', prazo: '14 dias' }],
  'phi.3': [{ trilha: 'Engenharia Social e Phishing (trilha oficial)', prioridade: 'alta', prazo: '14 dias' }],
  'phi.4': [{ trilha: 'Ação direta: acompanhar evolução pelo módulo de Simulação de Phishing', prioridade: 'baixa', prazo: '30 dias' }],

  'aud.1': [{ trilha: 'Auditoria e retenção de logs para cartórios (IA)', prioridade: 'alta', prazo: '45 dias' }],
  'aud.2': [{ trilha: 'Auditoria e retenção de logs para cartórios (IA)', prioridade: 'alta', prazo: '60 dias' }],
  'aud.3': [{ trilha: 'Auditoria e retenção de logs para cartórios (IA)', prioridade: 'alta', prazo: '45 dias' }],

  'com.1': [{ trilha: 'Ação direta: ativar "Exigir aceite" nos comunicados críticos pela plataforma', prioridade: 'alta', prazo: '21 dias' }],
  'com.2': [{ trilha: 'Ação direta: usar o módulo de Comunicados com confirmação de leitura', prioridade: 'alta', prazo: '21 dias' }],
  'com.3': [{ trilha: 'Canal de reporte de incidentes e suspeitas (IA)', prioridade: 'alta', prazo: '30 dias' }],

  'fis.1': [{ trilha: 'Segurança física e controle de acesso a instalações (IA)', prioridade: 'baixa', prazo: '45 dias' }],
  'fis.2': [{ trilha: 'Segurança em Dispositivos Móveis e Trabalho Remoto (trilha oficial)', prioridade: 'alta', prazo: '14 dias' }],
  'fis.4': [{ trilha: 'Segurança física e controle de acesso a instalações (IA)', prioridade: 'baixa', prazo: '45 dias' }],
};
