import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

interface Section {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  steps: { title: string; desc: string }[];
  // Quando definido, restringe a seção a esses perfis — usado para não expor a
  // colaboradores o funcionamento da simulação de phishing, que depende do
  // fator surpresa para ser eficaz.
  roles?: string[];
}

const SECTIONS: Section[] = [
  {
    id: 'dashboard', icon: 'fa-border-all', title: 'Dashboard', subtitle: 'Painel operacional da sua serventia',
    steps: [
      { title: 'Acessando o Dashboard', desc: 'Clique em "Dashboard" no menu lateral, na seção GESTÃO. Esta tela exibe dados em tempo real exclusivos da sua serventia.' },
      { title: 'KPIs em tempo real', desc: 'Os cards no topo mostram métricas como Documentos na Base, Protocolos Ativos, Treinamentos Concluídos e Ações Registradas. Todos atualizam automaticamente.' },
      { title: 'Atividade Recente', desc: 'O painel de atividade mostra as últimas ações realizadas na plataforma — tipo de evento, usuário responsável e horário.' },
      { title: 'Filtros de período', desc: 'Use os botões de período (7, 30, 90 dias) para filtrar o histórico de dados exibido nos gráficos e cards.' },
    ]
  },
  {
    id: 'collaborators', icon: 'fa-users-gear', title: 'Colaboradores', subtitle: 'Gerenciar usuários e permissões',
    steps: [
      { title: 'Criando um colaborador', desc: 'Clique em "+ Novo Colaborador", preencha nome, e-mail e selecione o perfil de acesso. O colaborador deverá trocar a senha no primeiro login.' },
      { title: 'Perfis disponíveis', desc: 'Super Admin: acesso total. Gestor: acesso completo à serventia. Admin: gerenciar colaboradores. Colaborador: acesso aos próprios dados e treinamentos.' },
      { title: 'Editando e desativando', desc: 'Clique no ícone de edição para alterar dados ou perfil. Ao desligar um colaborador, desative imediatamente para revogar o acesso à plataforma.' },
      { title: 'Matriz de Acesso', desc: 'Na aba "Matriz de Acesso", visualize um mapa completo de quais recursos cada perfil pode acessar.' },
    ]
  },
  {
    id: 'reports', icon: 'fa-chart-column', title: 'Relatórios', subtitle: 'Métricas de treinamento, engajamento e risco',
    steps: [
      { title: 'Visão Geral', desc: 'A primeira aba exibe a atividade mensal e distribuição de notas da equipe. Acompanhe tendências de desempenho ao longo do tempo.' },
      { title: 'Por Colaborador', desc: 'Veja quantos treinamentos, exames e certificados cada colaborador concluiu. Identifique usuários engajados e os que precisam de atenção.' },
      { title: 'Por Trilha', desc: 'Acompanhe a taxa de conclusão e aprovação por trilha de aprendizado. Útil para avaliar quais conteúdos têm maior aderência.' },
      { title: 'Evidências de Trilhas', desc: 'Lista, um registro por colaborador × trilha, o percentual concluído, status e data da última atualização — evidência direta de quem concluiu o quê e quando, exportável em CSV para fiscalizações.' },
      { title: 'Ficha de Capacitação individual', desc: 'Na aba "Colaboradores", clique em "Gerar" na coluna Ficha para baixar um PDF individual com trilhas, testes, exames e certificados daquele colaborador — pronto para apresentar em inspeção.' },
      { title: 'Risco', desc: 'Aba com um índice de risco/maturidade por colaborador, combinando média de notas, atividade recente e validade de certificados — destaca quem precisa de atenção prioritária.' },
      { title: 'Exportação', desc: 'Use "Imprimir" para gerar relatório em PDF ou "Exportar Excel" para análise em planilha. Filtre por período usando o seletor no topo.' },
    ]
  },
  {
    id: 'audit', icon: 'fa-clock-rotate-left', title: 'Auditoria', subtitle: 'Histórico completo de acessos e alterações',
    steps: [
      { title: 'Log de Atividades', desc: 'Visualize todas as ações registradas na plataforma em ordem cronológica. Filtre por tipo de evento, usuário e data.' },
      { title: 'Tipos de Evento', desc: 'Os eventos incluem: login/logout, criação e edição de usuários, acesso a módulos, geração de certificados, exportações, alterações de configuração e envio/erro de e-mail.' },
      { title: 'Evidência de comunicação', desc: 'O filtro "E-mails" mostra cada notificação enviada pela plataforma (comunicados, trilhas, expiração de certificado, reforço de treinamento) com data, destinatário e status de entrega.' },
      { title: 'Evidência de segurança', desc: 'O filtro "Segurança" registra cliques em simulações de phishing — quem clicou, quando e em qual simulação, para uso em ações de conscientização.' },
      { title: 'Retenção de logs', desc: 'Os logs são retidos por no mínimo 5 anos conforme Provimento CNJ nº 149 e nº 213/2026, garantindo conformidade para inspeções da corregedoria.' },
      { title: 'Exportação', desc: 'Exporte os registros em CSV ou PDF para auditorias externas ou inspeções regulatórias.' },
    ]
  },
  {
    id: 'security', icon: 'fa-lock', title: 'Segurança', subtitle: 'Senhas, bloqueios e políticas de acesso',
    steps: [
      { title: 'Política de senhas', desc: 'Configure comprimento mínimo, exigência de caracteres especiais e validade. Recomendamos no mínimo 10 caracteres com troca a cada 90 dias.' },
      { title: 'Bloqueio automático', desc: 'Defina o número máximo de tentativas antes do bloqueio automático (padrão: 5). Usuários bloqueados precisam ser reativados pelo gestor.' },
      { title: 'Monitoramento de acessos', desc: 'Verifique regularmente a Auditoria para identificar acessos fora do horário comercial ou tentativas de login suspeitas.' },
    ]
  },
  {
    id: 'analytics', icon: 'fa-chart-pie', title: 'IA Analítica', subtitle: 'Análise inteligente de auditoria e base legal',
    steps: [
      { title: 'O que é a IA Analítica', desc: 'Usa IA generativa para analisar os dados de auditoria e a Base Legal da sua serventia, identificando padrões e riscos que não são óbvios em uma leitura manual dos logs.' },
      { title: 'Análises automáticas', desc: 'Clique em "Executar Análise" para que a IA gere um resumo executivo sobre volume de acessos, tendências de uso e possíveis inconsistências no período selecionado.' },
      { title: 'Chat com a base legal', desc: 'Pergunte diretamente sobre os provimentos e normas cadastrados na Base Legal — a IA responde com base nos documentos reais da sua serventia.' },
    ]
  },
  {
    id: 'phishing', icon: 'fa-shield-halved', title: 'Simulação de Phishing', subtitle: 'Recurso opcional — teste de conscientização em segurança',
    roles: ['SUPERADMIN', 'gestor', 'admin'],
    steps: [
      { title: 'Recurso opcional', desc: 'Precisa ser habilitado pela MJ Consultoria para o seu cartório em "Gestão de Cartórios". Quando habilitado, o item aparece no menu Gestão dos perfis Gestor/Admin/SUPERADMIN.' },
      { title: 'Criando um teste por tema', desc: 'Ao criar uma simulação, escolha um tema (Engenharia Social Financeira, Falsa Autoridade/Urgência, Atualização Cadastral, Documentos e Assinatura Eletrônica, Convites e Calendário, Curiosidade/Recompensa) e, se quiser, aplique um modelo pronto de e-mail para aquele tema.' },
      { title: 'Link individual e rastreável', desc: 'Cada colaborador recebe um e-mail com um link único. Se clicar, vê uma página educativa explicando que era um teste — nenhuma senha ou dado sensível é coletado.' },
      { title: 'Análises', desc: 'A aba "Análises & Plano de Ação" mostra a taxa de clique por tema, por cargo, a evolução entre simulações e o ranking dos colaboradores que mais clicaram.' },
      { title: 'Plano de ação com IA', desc: 'O botão "Gerar plano de ação com IA" analisa os dados acima e sugere, em português, um diagnóstico e até 5 ações prioritárias de treinamento — com evidência salva para consulta posterior.' },
    ]
  },
  {
    id: 'dossie', icon: 'fa-file-shield', title: 'Dossiê de Conformidade', subtitle: 'Evidências consolidadas para inspeção CNJ e LGPD',
    steps: [
      { title: 'O que reúne o dossiê', desc: 'Consolida, para o período escolhido, colaboradores ativos, aprovação em testes, conclusão de trilhas, certificados válidos/vencidos, confirmações de comunicados críticos e resultado de simulações de phishing.' },
      { title: 'Resumo executivo com IA', desc: 'O botão "Gerar resumo executivo com IA" redige um parágrafo formal citando os Provimentos CNJ 149 e 213/2026, com base apenas nos números reais do período — cada geração fica salva como evidência no histórico.' },
      { title: 'Exportando o PDF', desc: '"Exportar PDF" gera um documento com capa, indicadores, tabela de confirmações de comunicados e o resumo executivo — pronto para apresentar em inspeções ou auditorias externas.' },
    ]
  },
  {
    id: 'trails', icon: 'fa-road', title: 'Trilhas', subtitle: 'Trilhas de aprendizagem por perfil',
    steps: [
      { title: 'O que são Trilhas?', desc: 'Trilhas são sequências de conteúdos organizados por perfil profissional (atendente, escrevente, oficial substituto). Cada trilha guia o colaborador do básico ao avançado.' },
      { title: 'Navegando em uma trilha', desc: 'Selecione uma trilha para ver os módulos disponíveis. Complete os módulos em sequência para liberar o próximo nível.' },
      { title: 'Progresso', desc: 'O progresso de cada trilha é salvo automaticamente. Acompanhe o avanço em "Meu Progresso" no menu CAPACITAÇÃO.' },
      { title: 'Trilhas modelo MJ Consultoria', desc: 'SUPERADMIN pode marcar uma trilha como "modelo oficial MJ Consultoria" (badge dourado) e distribuí-la para todos os cartórios ou para uma lista específica de clientes.' },
      { title: 'Trilhas de segurança inclusas', desc: 'Toda a base de clientes já recebe 4 trilhas oficiais de cyber-higiene: Senhas e Autenticação, Engenharia Social e Phishing, Dispositivos Móveis e Trabalho Remoto, e LGPD no Dia a Dia — disponíveis para todos os perfis.' },
      { title: 'Visibilidade', desc: 'Toda trilha pode ser publicada para "este cartório", "todos os cartórios" ou uma lista de "cartórios específicos" escolhida pelo SUPERADMIN.' },
    ]
  },
  {
    id: 'knowledge', icon: 'fa-scale-balanced', title: 'Base Legal', subtitle: 'Documentos normativos indexados',
    steps: [
      { title: 'O que é a Base Legal', desc: 'Repositório de provimentos, leis e normas relevantes para a serventia (LGPD, Provimentos CNJ, normas internas), indexado para consulta e para alimentar as IAs de treinamento e análise.' },
      { title: 'Cadastrando documentos', desc: 'Envie o PDF ou cole o texto do documento normativo. O conteúdo é extraído e indexado automaticamente para uso em roteiros de treinamento, exames e no chat da IA Analítica.' },
      { title: 'Visibilidade', desc: 'SUPERADMIN pode publicar um documento para "todos os cartórios" ou para "cartórios específicos" — útil para normas que a MJ Consultoria mantém atualizadas centralmente.' },
    ]
  },
  {
    id: 'repositorio', icon: 'fa-photo-film', title: 'Repositório', subtitle: 'Áudios e PDFs de capacitação',
    steps: [
      { title: 'Tipos de conteúdo', desc: 'O repositório centraliza materiais de capacitação: arquivos de áudio, PDFs, apresentações e documentos complementares.' },
      { title: 'Buscando conteúdo', desc: 'Use a busca para localizar materiais por palavra-chave, tipo de arquivo ou categoria.' },
      { title: 'Materiais obrigatórios', desc: 'Conteúdos marcados como obrigatórios aparecem destacados. O gestor pode definir quais materiais são de leitura/visualização obrigatória.' },
    ]
  },
  {
    id: 'videos', icon: 'fa-video', title: 'Vídeos', subtitle: 'Vídeos de treinamento (YouTube)',
    steps: [
      { title: 'Cadastrando um vídeo', desc: 'Cole o link do YouTube, defina título, descrição e o(s) perfil(is) que devem assistir.' },
      { title: 'Acompanhamento', desc: 'O sistema registra quais colaboradores já assistiram a cada vídeo, permitindo cobrar a conclusão de conteúdos obrigatórios.' },
    ]
  },
  {
    id: 'comunicados', icon: 'fa-bullhorn', title: 'Comunicados', subtitle: 'Mural de avisos com evidência de leitura',
    steps: [
      { title: 'Publicando um comunicado', desc: 'Defina título, mensagem e prioridade (informativo, normal, urgente). Fixe no topo do mural quando necessário.' },
      { title: 'Aceite formal (opcional)', desc: 'Marque "Exigir confirmação formal de leitura" para comunicados críticos — o colaborador precisa clicar em "Li e concordo" antes de o comunicado ser considerado lido, gerando evidência com nome, e-mail e data/hora.' },
      { title: 'Acompanhando confirmações', desc: 'No modo Gestão, veja quantos colaboradores já confirmaram a leitura de cada comunicado com aceite obrigatório — útil para dossiês de auditoria CNJ.' },
      { title: 'Notificação por e-mail é opcional', desc: 'Por padrão, o comunicado fica só no mural — marque "Notificar colaboradores por e-mail" apenas para avisos que realmente precisam interromper a caixa de entrada de todo mundo. Um selo azul "E-mail" identifica quais comunicados dispararam notificação.' },
    ]
  },
  {
    id: 'checklists', icon: 'fa-list-check', title: 'Checklists', subtitle: 'Roteiros e protocolos operacionais',
    steps: [
      { title: 'Criando um roteiro', desc: 'Cadastre manualmente os itens do protocolo ou envie um documento (PDF/texto) para que a IA extraia os itens automaticamente.' },
      { title: 'Executando um checklist', desc: 'No modo "Executar", marque item a item durante a conferência de um protocolo real e registre observações quando necessário.' },
      { title: 'Análise com IA', desc: 'Envie um documento para análise comparativa contra o roteiro cadastrado — a IA aponta divergências e itens não atendidos (útil para conferência de compliance).' },
      { title: 'Visibilidade', desc: 'Assim como outros conteúdos, checklists podem ser publicados para este cartório, todos os cartórios ou uma lista de cartórios específicos.' },
    ]
  },
  {
    id: 'banners', icon: 'fa-images', title: 'Banners', subtitle: 'Materiais visuais de divulgação interna',
    steps: [
      { title: 'Publicando um banner', desc: 'Envie uma imagem ou link de campanha visual para divulgação interna (campanhas de segurança, datas comemorativas, avisos visuais).' },
      { title: 'Visibilidade', desc: 'Assim como outros conteúdos, banners podem ser publicados para este cartório, todos os cartórios ou uma lista de cartórios específicos.' },
    ]
  },
  {
    id: 'training', icon: 'fa-graduation-cap', title: 'Treinamento AI', subtitle: 'Capacitação com IA, roteiros e quizzes',
    steps: [
      { title: 'IA de Treinamento', desc: 'Gere 3 opções de roteiro de treinamento com IA baseadas nos protocolos e documentos da sua serventia. Personalize o pedido para focar em um tema específico.' },
      { title: 'Salvando o roteiro', desc: 'Depois de expandir o roteiro escolhido, clique em "Salvar como treinamento" — ele passa a ficar disponível como fonte de conteúdo para gerar Exames.' },
      { title: 'Resumos Inteligentes', desc: 'Selecione um documento e o tipo de resumo (Executivo, Técnico, Didático ou Operacional) para que a IA gere um resumo otimizado para cada audiência.' },
      { title: 'Participantes', desc: 'Registre quais colaboradores participaram de cada treinamento, controle a presença e acompanhe o status de conclusão.' },
      { title: 'Questionários com IA', desc: 'Gere automaticamente questões de múltipla escolha baseadas no conteúdo dos treinamentos. Escolha entre 3, 5, 7 ou 10 questões por avaliação.' },
      { title: 'Reforço automático', desc: 'Ao reprovar duas vezes seguidas no mesmo questionário, o colaborador recebe automaticamente um e-mail recomendando revisar o material antes de tentar novamente.' },
      { title: 'Dashboard de Gestão', desc: 'A aba "Dashboard Gestão" consolida o desempenho de todos os participantes com gráficos de aprovação, média de notas e evolução ao longo do tempo.' },
    ]
  },
  {
    id: 'exames', icon: 'fa-file-pen', title: 'Exames', subtitle: 'Avaliações com IA e Taxonomia de Bloom',
    steps: [
      { title: 'O que são os Exames?', desc: 'Exames são avaliações formais geradas pela IA com base na Taxonomia de Bloom — garantindo questões que vão do conhecimento básico à análise e avaliação crítica.' },
      { title: 'Realizando um exame', desc: 'Selecione o exame disponível e responda as questões no tempo determinado. As respostas são corrigidas automaticamente com gabarito comentado.' },
      { title: 'Resultado e aprovação', desc: 'A nota mínima de aprovação é 75%. Exames reprovados podem ser refeitos após o período de quarentena definido pelo gestor.' },
      { title: 'Histórico de provas', desc: 'Consulte o histórico de todos os exames realizados, com data, nota e resultado. Gestores podem visualizar o desempenho de toda a equipe.' },
    ]
  },
  {
    id: 'metas', icon: 'fa-trophy', title: 'Metas & Premiação', subtitle: 'Rankings, metas e desempate por Bloom Alto',
    steps: [
      { title: 'Sistema de Metas', desc: 'O módulo de Metas define objetivos de desempenho por colaborador ou equipe — número de treinamentos, taxa de aprovação em exames e conclusão de trilhas.' },
      { title: 'Ranking', desc: 'O ranking consolida os colaboradores com melhor desempenho. Em caso de empate, o sistema utiliza o critério de Bloom Alto (questões de análise e avaliação) para o desempate.' },
      { title: 'Premiação', desc: 'Configure prêmios e reconhecimentos para os colaboradores que atingirem as metas. O histórico de premiações fica registrado no perfil do colaborador.' },
    ]
  },
  {
    id: 'campanhas', icon: 'fa-rocket', title: 'Campanhas', subtitle: 'Campanhas motivacionais com IA',
    steps: [
      { title: 'Gerando uma campanha', desc: 'Descreva o objetivo (ex: incentivar a conclusão de uma trilha) e a IA gera sugestões de posts motivacionais para divulgação interna.' },
      { title: 'Uso recomendado', desc: 'Combine campanhas com Metas & Premiação para reforçar o engajamento da equipe em períodos de baixa adesão aos treinamentos.' },
    ]
  },
  {
    id: 'progresso', icon: 'fa-chart-line', title: 'Meu Progresso', subtitle: 'Trilhas, exames e certificados pessoais',
    steps: [
      { title: 'Visão pessoal', desc: 'Esta tela mostra exclusivamente o progresso do colaborador logado — trilhas iniciadas, exames realizados, certificados emitidos e pontuação acumulada.' },
      { title: 'Trilhas em andamento', desc: 'Veja o percentual de conclusão de cada trilha que você iniciou. Clique para retomar de onde parou.' },
      { title: 'Histórico de notas', desc: 'Acompanhe a evolução das suas notas ao longo do tempo. O gráfico mostra a tendência de desempenho por módulo.' },
    ]
  },
  {
    id: 'certificado', icon: 'fa-certificate', title: 'Certificados', subtitle: 'Emitir e baixar certificados PDF',
    steps: [
      { title: 'Elegibilidade', desc: 'Certificados são emitidos automaticamente quando o colaborador conclui uma trilha ou é aprovado em um exame com nota mínima de 75%.' },
      { title: 'Emitindo o certificado', desc: 'Na tela de Certificados, localize o certificado disponível e clique em "Emitir". O PDF é gerado com dados da serventia, nome, data e carga horária.' },
      { title: 'Validade e autenticidade', desc: 'Cada certificado possui um código único de verificação e validade de 1 ano a partir da emissão. O gestor pode validar a autenticidade de qualquer certificado emitido pela plataforma.' },
      { title: 'Aviso de expiração', desc: 'Sete dias antes do vencimento, o colaborador recebe automaticamente um e-mail de aviso para providenciar a renovação.' },
    ]
  },
  {
    id: 'backup', icon: 'fa-database', title: 'Backup', subtitle: 'Exportação de dados do cartório',
    steps: [
      { title: 'O que é exportado', desc: 'Gera uma exportação dos dados do seu cartório — colaboradores, trilhas, resultados de exames, certificados e comunicados — em formato para arquivamento externo.' },
      { title: 'Quando usar', desc: 'Recomendado antes de auditorias externas, migrações ou como cópia de segurança periódica independente do Firebase.' },
    ]
  },
  {
    id: 'support', icon: 'fa-headset', title: 'Suporte Técnico', subtitle: 'Contato direto com a MJ Consultoria',
    steps: [
      { title: 'Abrindo um chamado', desc: 'Descreva o problema ou dúvida e clique em Enviar. A equipe MJ Consultoria responderá em até 1 dia útil.' },
      { title: 'Informações úteis', desc: 'Inclua detalhes: qual módulo estava usando, a ação realizada, mensagem de erro exibida e capturas de tela quando possível.' },
      { title: 'Urgências', desc: 'Para problemas críticos que impeçam o funcionamento da serventia, indique "URGENTE" no início da mensagem para priorização do atendimento.' },
    ]
  },
];

const TutorialView: React.FC = () => {
  const { state } = useApp();
  const role = state.user?.role || '';
  const visibleSections = SECTIONS.filter(s => !s.roles || s.roles.includes(role));

  const [activeSection, setActiveSection] = useState<string>('dashboard');

  const currentIdx = visibleSections.findIndex(s => s.id === activeSection);
  const current = visibleSections[currentIdx] ?? visibleSections[0];

  const exportPDF = () => {
    const win = window.open('', '_blank');
    if (!win) return;

    const allContent = visibleSections.map((s, si) => `
      <div class="section">
        <div class="section-header">
          <span class="section-num">${String(si + 1).padStart(2, '0')}</span>
          <div>
            <div class="section-title">${s.title}</div>
            <div class="section-subtitle">${s.subtitle}</div>
          </div>
        </div>
        ${s.steps.map((step, i) => `
          <div class="step">
            <div class="step-number">${i + 1}</div>
            <div class="step-content">
              <div class="step-title">${step.title}</div>
              <div class="step-desc">${step.desc}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('');

    win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Manual do Usuário — MJ Consultoria</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: Arial, sans-serif; color:#1e293b; background:white; padding:40px; font-size:12px; }
.cover { text-align:center; padding:60px 0 40px; border-bottom:3px solid #c9a84c; margin-bottom:40px; }
.cover-logo { font-size:44px; font-weight:900; color:#0f172a; letter-spacing:-2px; }
.cover-logo span { color:#c9a84c; }
.cover-title { font-size:26px; font-weight:900; color:#1e293b; margin-top:16px; text-transform:uppercase; letter-spacing:2px; }
.cover-sub { font-size:12px; color:#8a6e2f; margin-top:8px; text-transform:uppercase; letter-spacing:3px; }
.cover-date { font-size:11px; color:#a8882f; margin-top:24px; }
.toc { margin-bottom:40px; padding:24px; background:#fdfbf5; border-radius:12px; border:1px solid #e8d9a0; }
.toc-title { font-size:13px; font-weight:900; color:#7a5c1e; text-transform:uppercase; letter-spacing:2px; margin-bottom:16px; }
.toc-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
.toc-item { font-size:11px; color:#7a5c1e; padding:3px 0; }
.toc-item b { color:#c9a84c; margin-right:6px; }
.section { margin-bottom:32px; page-break-inside:avoid; }
.section-header { background:#0f172a; color:white; padding:14px 20px; border-radius:10px 10px 0 0; display:flex; align-items:center; gap:16px; border-left:4px solid #c9a84c; }
.section-num { font-size:22px; font-weight:900; color:#c9a84c; }
.section-title { font-size:16px; font-weight:900; text-transform:uppercase; letter-spacing:1px; }
.section-subtitle { font-size:10px; color:#c9a84c; margin-top:2px; text-transform:uppercase; letter-spacing:1px; }
.step { display:flex; gap:14px; padding:14px 20px; background:#fdfbf5; border:1px solid #e8d9a0; border-top:none; }
.step:last-child { border-radius:0 0 10px 10px; }
.step-number { min-width:26px; height:26px; background:#c9a84c; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:900; flex-shrink:0; margin-top:2px; }
.step-title { font-size:12px; font-weight:700; color:#7a5c1e; margin-bottom:5px; }
.step-desc { font-size:11px; color:#4a3a1a; line-height:1.7; }
.footer { text-align:center; margin-top:60px; padding-top:20px; border-top:1px solid #e8d9a0; font-size:10px; color:#a8882f; }
@media print { body { padding:20px; } .section { page-break-inside:avoid; } }
</style>
</head>
<body>
<div class="cover">
  <div class="cover-logo">MJ <span>Consultoria</span></div>
  <div class="cover-title">Manual do Usuário</div>
  <div class="cover-sub">Plataforma de Treinamento Corporativo</div>
  <div class="cover-date">MJ Consultoria &nbsp;·&nbsp; ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</div>
</div>
<div class="toc">
  <div class="toc-title">Índice</div>
  <div class="toc-grid">
    ${visibleSections.map((s, i) => `<div class="toc-item"><b>${String(i+1).padStart(2,'0')}.</b>${s.title} — ${s.subtitle}</div>`).join('')}
  </div>
</div>
${allContent}
<div class="footer">
  MJ Consultoria · Plataforma de Treinamento Corporativo · Gerado em ${new Date().toLocaleDateString('pt-BR')}<br>
  Em conformidade com LGPD Lei nº 13.709/2018 · Provimento CNJ nº 149 · Provimento CNJ nº 213/2026
</div>
</body>
</html>`);

    win.document.close();
    setTimeout(() => win.print(), 600);
  };

  return (
    <div className="p-8 space-y-6 min-h-screen bg-slate-50">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-black text-[#0A1628] italic uppercase tracking-tighter">
            Tutorial da <span className="text-[#c9a84c]">Plataforma</span>
          </h2>
          <p className="text-[#8a6e2f] text-xs font-black uppercase tracking-widest mt-1">
            MJ Consultoria — Guia Completo do Usuário
          </p>
        </div>
        <button
          onClick={exportPDF}
          className="bg-[#c9a84c] hover:brightness-110 text-[#0f172a] px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg"
        >
          <i className="fa-solid fa-file-pdf"></i> Baixar PDF
        </button>
      </div>

      {/* Info */}
      <div className="bg-[#c9a84c]/8 border border-[#c9a84c]/25 rounded-2xl p-5 flex items-start gap-3">
        <i className="fa-solid fa-circle-info text-[#c9a84c] text-lg mt-0.5 flex-shrink-0"></i>
        <p className="text-sm text-[#7a5c1e] leading-relaxed">
          Bem-vindo à Plataforma MJ Consultoria. Selecione um módulo para ver as instruções detalhadas,
          ou clique em <strong className="text-[#c9a84c]">Baixar PDF</strong> para salvar o manual completo.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Menu lateral */}
        <div className="bg-[#0f172a] rounded-3xl border border-[#c9a84c]/20 p-4 space-y-1 h-fit">
          <p className="text-xs font-black text-[#c9a84c]/60 uppercase tracking-widest px-3 py-2">Módulos</p>
          {visibleSections.map(s => {
            const isActive = activeSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
                  isActive
                    ? 'bg-[#c9a84c] shadow-lg'
                    : 'hover:bg-white/5'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isActive ? 'bg-black/15' : 'bg-white/5'
                }`}>
                  <i className={`fa-solid ${s.icon} text-xs ${isActive ? 'text-[#0f172a]' : 'text-[#c9a84c]/60'}`}></i>
                </div>
                <p className={`text-xs font-bold truncate ${isActive ? 'text-[#0f172a]' : 'text-[#c9a84c]/80'}`}>
                  {s.title}
                </p>
              </button>
            );
          })}
        </div>

        {/* Conteúdo */}
        <div className="lg:col-span-3 space-y-4">

          {/* Header da seção */}
          <div className="bg-[#0f172a] rounded-2xl p-6 flex items-center gap-4 shadow-lg border border-[#c9a84c]/20">
            <div className="w-14 h-14 rounded-2xl bg-[#c9a84c]/15 flex items-center justify-center flex-shrink-0">
              <i className={`fa-solid ${current.icon} text-[#c9a84c] text-2xl`}></i>
            </div>
            <div>
              <p className="text-[#c9a84c]/60 text-xs font-black uppercase tracking-widest">
                Módulo {String(currentIdx + 1).padStart(2, '0')} de {visibleSections.length}
              </p>
              <h3 className="text-xl font-black text-white uppercase italic mt-1">{current.title}</h3>
              <p className="text-[#c9a84c] text-sm mt-1">{current.subtitle}</p>
            </div>
          </div>

          {/* Passos */}
          <div className="space-y-3">
            {current.steps.map((step, i) => (
              <div
                key={i}
                className="bg-white border border-[#c9a84c]/20 rounded-2xl p-5 flex gap-4 hover:border-[#c9a84c]/40 hover:shadow-sm transition-all"
              >
                <div className="w-8 h-8 rounded-xl bg-[#c9a84c] flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                  <span className="text-xs font-black text-[#0f172a]">{i + 1}</span>
                </div>
                <div>
                  <p className="text-sm font-black text-[#7a5c1e] mb-1.5">{step.title}</p>
                  <p className="text-sm text-[#8a6e2f] leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Navegação */}
          <div className="flex justify-between pt-2">
            {currentIdx > 0 ? (
              <button
                onClick={() => setActiveSection(visibleSections[currentIdx - 1].id)}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-[#c9a84c]/30 hover:border-[#c9a84c]/60 text-[#7a5c1e] rounded-xl text-xs font-black uppercase transition-all"
              >
                <i className="fa-solid fa-arrow-left"></i> Anterior
              </button>
            ) : <div />}

            {currentIdx < visibleSections.length - 1 ? (
              <button
                onClick={() => setActiveSection(visibleSections[currentIdx + 1].id)}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#c9a84c] hover:brightness-110 text-[#0f172a] rounded-xl text-xs font-black uppercase transition-all"
              >
                Próximo <i className="fa-solid fa-arrow-right"></i>
              </button>
            ) : (
              <button
                onClick={exportPDF}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#c9a84c] hover:brightness-110 text-[#0f172a] rounded-xl text-xs font-black uppercase transition-all"
              >
                <i className="fa-solid fa-file-pdf"></i> Baixar Manual PDF
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default TutorialView;
