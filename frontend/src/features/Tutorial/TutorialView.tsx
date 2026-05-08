import React, { useState } from 'react';

interface Section {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  steps: { title: string; desc: string }[];
}

const SECTIONS: Section[] = [
  {
    id: 'dashboard', icon: 'fa-border-all', title: 'Dashboard', subtitle: 'Visão geral da sua unidade',
    steps: [
      { title: 'Acessando o Dashboard', desc: 'Clique em "Dashboard" no menu lateral, na seção PRINCIPAL. Esta tela é exclusiva da sua serventia e exibe dados em tempo real apenas do seu cartório.' },
      { title: 'KPIs em tempo real', desc: 'Os 4 cards no topo mostram: Documentos na Base, Protocolos Ativos, Treinamentos Concluídos e Ações Registradas. Todos atualizam automaticamente.' },
      { title: 'Acervo da Serventia', desc: 'O painel esquerdo lista os documentos mais recentes inseridos na sua Base Legal. Clique em "Base Legal" para gerenciar esses documentos.' },
      { title: 'Atividade Recente', desc: 'O painel direito mostra as últimas ações realizadas na plataforma, com ícone por tipo de evento, usuário responsável e horário.' },
    ]
  },
  {
    id: 'chat', icon: 'fa-comment-dots', title: 'Consulta RAG', subtitle: 'Consultas inteligentes na base legal',
    steps: [
      { title: 'O que é a Consulta RAG?', desc: 'RAG significa "Retrieval-Augmented Generation". A IA responde suas perguntas baseando-se exclusivamente nos documentos que você indexou na Base Legal — não usa informações externas.' },
      { title: 'Como fazer uma consulta', desc: 'Digite sua dúvida jurídica ou operacional no campo de texto e pressione Enter. Exemplos: "Quais são os requisitos para lavratura de escritura de compra e venda?" ou "Como proceder em caso de retificação de registro?"' },
      { title: 'Interpretando a resposta', desc: 'A IA sempre indicará a fonte da informação (qual documento da sua base foi consultado). Se a informação não estiver na sua base, ela informará que não há documentos suficientes.' },
      { title: 'Boas práticas', desc: 'Quanto mais documentos indexados na Base Legal, mais precisa será a resposta. Mantenha sempre a base atualizada com os provimentos, normas e protocolos vigentes.' },
    ]
  },
  {
    id: 'compliance', icon: 'fa-shield-halved', title: 'Conformidade', subtitle: 'Auditoria de documentos contra protocolos CNJ',
    steps: [
      { title: 'Para que serve', desc: 'Este módulo permite auditar minutas, documentos e escrituras contra os protocolos e a base legal da sua serventia, verificando item por item a conformidade.' },
      { title: 'Subindo um documento', desc: 'Clique na área de upload e selecione o arquivo (PDF, Word, imagem). A IA extrairá automaticamente o texto do documento.' },
      { title: 'Escolhendo a referência', desc: 'Selecione "Protocolo" para comparar contra um checklist cadastrado, ou "Base Legal" para comparar contra documentos normativos indexados.' },
      { title: 'Iniciando a auditoria', desc: 'Clique em "Iniciar Auditoria RAG". A IA analisará cada requisito individualmente e retornará: Conforme ou Pendente, com comentário técnico e sugestão de correção.' },
      { title: 'Relatório de conformidade', desc: 'Ao final, você verá o índice de conformidade (%), a lista detalhada de cada item e o resumo executivo. Use "Imprimir Relatório" para salvar em PDF.' },
    ]
  },
  {
    id: 'checklists', icon: 'fa-list-check', title: 'Checklists', subtitle: 'Protocolos e roteiros de verificação',
    steps: [
      { title: 'Criando um protocolo', desc: 'Clique em "Novo Checklist", dê um nome ao protocolo (ex: "Escritura de Compra e Venda") e adicione os itens de verificação um a um.' },
      { title: 'Adicionando itens', desc: 'Cada item deve ser uma verificação específica e mensurável, como "Documento de identidade com foto apresentado" ou "CPF do vendedor conferido".' },
      { title: 'Usando o checklist', desc: 'Os checklists criados ficam disponíveis no módulo de Conformidade para auditoria de documentos. Mantenha os protocolos atualizados conforme os provimentos vigentes.' },
      { title: 'Gerenciando protocolos', desc: 'Você pode editar ou excluir protocolos existentes. Recomenda-se criar um protocolo separado para cada tipo de ato notarial ou registral.' },
    ]
  },
  {
    id: 'analytics', icon: 'fa-brain', title: 'IA Analítica', subtitle: 'Alertas, anomalias e gestão operacional',
    steps: [
      { title: 'Painel de Gestão', desc: 'A primeira aba mostra KPIs em tempo real: eventos hoje, documentos sem classificação, exclusões e usuários ativos. Alertas automáticos são disparados quando anomalias são detectadas.' },
      { title: 'Executando uma Análise IA', desc: 'Clique em "Iniciar Análise". A IA cruza todos os dados e gera um relatório executivo com alertas e recomendações operacionais.' },
      { title: 'Interpretando os alertas', desc: 'Alertas em vermelho são críticos e exigem ação imediata. Alertas em âmbar são de atenção. Verde indica operação normal.' },
      { title: 'Chat de Gestão', desc: 'Na aba "Consultar IA", faça perguntas específicas como "Quais são os principais riscos operacionais hoje?" A IA responde com base nos dados reais da plataforma.' },
    ]
  },
  {
    id: 'knowledge', icon: 'fa-scale-balanced', title: 'Base Legal', subtitle: 'Documentos indexados para consulta IA',
    steps: [
      { title: 'O que indexar', desc: 'Adicione aqui todos os documentos normativos: provimentos do CNJ, leis estaduais, normas da corregedoria, portarias, circulares e qualquer documento de referência para as atividades da serventia.' },
      { title: 'Inserindo documentos', desc: 'Clique em "Adicionar Documento", selecione o arquivo (PDF ou Word) e aguarde a extração do texto pela IA. O documento ficará disponível para consultas RAG e auditorias.' },
      { title: 'Organizando a base', desc: 'Mantenha a base atualizada removendo documentos revogados e adicionando versões atualizadas. Uma base bem organizada garante respostas mais precisas da IA.' },
      { title: 'Impacto nos outros módulos', desc: 'Quanto mais documentos indexados, melhor: a Consulta RAG fica mais precisa, a Conformidade tem mais referências e a IA Analítica tem mais contexto.' },
    ]
  },
  {
    id: 'reports', icon: 'fa-chart-column', title: 'Relatórios', subtitle: 'Uso por colaborador, documentos e treinamentos',
    steps: [
      { title: 'Aba Uso por Colaborador', desc: 'Visualize quantos acessos, documentos e consultas cada colaborador realizou no período selecionado. Útil para avaliar engajamento e identificar usuários inativos.' },
      { title: 'Aba Documentos Consultados', desc: 'Veja quais documentos da base foram mais acessados. Ajuda a identificar quais normas são mais consultadas e quais precisam de atualização.' },
      { title: 'Aba Treinamentos por Período', desc: 'Acompanhe a taxa de conclusão e aprovação nos treinamentos. Veja a média de notas e identifique quais colaboradores precisam de reforço.' },
      { title: 'Filtro e exportação', desc: 'Use os botões 7, 15, 30 ou 90 dias para filtrar. Exporte em CSV (para Excel) ou PDF (relatório formatado) usando os botões de exportação.' },
    ]
  },
  {
    id: 'audit', icon: 'fa-clock-rotate-left', title: 'Auditoria', subtitle: 'Histórico completo de ações e acessos',
    steps: [
      { title: 'Aba Todos os Logs', desc: 'Visualize todas as ações registradas na plataforma em ordem cronológica. Use os filtros por tipo de evento, usuário e data para encontrar registros específicos.' },
      { title: 'Aba Documentos', desc: 'Filtra apenas eventos relacionados a documentos: inserções, exclusões e consultas. Útil para rastrear movimentações de documentos específicos.' },
      { title: 'Aba Usuários e Acesso', desc: 'Mostra eventos de login, logout, criação de usuários e alterações de permissão. Use para verificar acessos suspeitos ou fora do horário.' },
      { title: 'Exportação e retenção', desc: 'Exporte os logs em CSV ou PDF para inspeções da corregedoria. Os logs são retidos por no mínimo 5 anos conforme Provimento CNJ 149 e 213/2026.' },
    ]
  },
  {
    id: 'training', icon: 'fa-graduation-cap', title: 'Treinamento AI', subtitle: 'Capacitação com IA, quizzes e certificados',
    steps: [
      { title: 'Aba IA de Treinamento', desc: 'Converse com a IA para criar roteiros de treinamento personalizados baseados nos protocolos e documentos da sua base. Clique em "Sugerir Treinamento" para uma sugestão automática.' },
      { title: 'Aba Participantes', desc: 'Cadastre os colaboradores que participarão dos treinamentos, registre a conclusão e acompanhe o status de cada um.' },
      { title: 'Gerando questionários com IA', desc: 'Na aba Questionários, selecione um treinamento, escolha o número de questões (3, 5, 7 ou 10) e clique em "Gerar com IA". As questões são criadas com base nos protocolos cadastrados.' },
      { title: 'Aplicando um questionário', desc: 'Clique em "Iniciar Quiz" e responda as questões. Ao finalizar, o gabarito comentado mostrará as respostas corretas e explicações para cada erro.' },
      { title: 'Certificados e Relatórios', desc: 'Na aba Relatórios, visualize o desempenho de cada participante. Use "Emitir Certificado" para gerar e imprimir o certificado de conclusão.' },
    ]
  },
  {
    id: 'users', icon: 'fa-users-gear', title: 'Usuários', subtitle: 'Gerenciar colaboradores e permissões',
    steps: [
      { title: 'Criando um usuário', desc: 'Clique em "Novo Usuário", preencha nome, e-mail e selecione o perfil de acesso. O usuário será obrigado a trocar a senha no primeiro login.' },
      { title: 'Perfis disponíveis', desc: 'Gestor: acesso completo. Expert: conformidade e base legal. Auditor: somente leitura de logs. Atendente: consultas básicas. Viewer: somente visualização.' },
      { title: 'Editando e desativando', desc: 'Clique no usuário para editar seu perfil ou status. Ao desligar um colaborador, desative o usuário imediatamente para revogar o acesso.' },
    ]
  },
  {
    id: 'security', icon: 'fa-lock', title: 'Segurança', subtitle: 'Senhas, bloqueios e políticas de acesso',
    steps: [
      { title: 'Política de senhas', desc: 'Configure os requisitos de senha: comprimento mínimo, exigência de caracteres especiais e validade. Recomendamos senhas com no mínimo 10 caracteres e troca a cada 90 dias.' },
      { title: 'Bloqueio de contas', desc: 'Defina o número de tentativas antes do bloqueio automático (padrão: 5). Usuários bloqueados precisam ser desbloqueados manualmente pelo administrador.' },
      { title: 'Monitoramento', desc: 'Verifique regularmente a aba de Auditoria para identificar acessos fora do horário comercial ou tentativas de login malsucedidas.' },
    ]
  },
  {
    id: 'support', icon: 'fa-headset', title: 'Suporte Técnico', subtitle: 'Chamados e contato com a MJ Consultoria',
    steps: [
      { title: 'Abrindo um chamado', desc: 'Descreva o problema ou dúvida no campo de texto e clique em Enviar. A equipe MJ Consultoria responderá em até 1 dia útil.' },
      { title: 'Informações para o chamado', desc: 'Inclua o máximo de detalhes: qual módulo estava usando, qual ação tentou realizar, mensagem de erro exibida e capturas de tela se possível.' },
      { title: 'Urgências', desc: 'Para problemas críticos que impeçam o funcionamento da serventia, indique "URGENTE" no início da mensagem para priorização do atendimento.' },
    ]
  },
];

const TutorialView: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('dashboard');

  const currentIdx = SECTIONS.findIndex(s => s.id === activeSection);
  const current = SECTIONS[currentIdx] ?? SECTIONS[0];

  const exportPDF = () => {
    const win = window.open('', '_blank');
    if (!win) return;

    const allContent = SECTIONS.map((s, si) => `
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
<title>Manual do Usuário — CartórioRAG PRO v3.0</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: Arial, sans-serif; color:#1e293b; background:white; padding:40px; font-size:12px; }
.cover { text-align:center; padding:60px 0 40px; border-bottom:3px solid #1e3a8a; margin-bottom:40px; }
.cover-logo { font-size:44px; font-weight:900; color:#1e3a8a; letter-spacing:-2px; }
.cover-logo span { color:#3b82f6; }
.cover-title { font-size:26px; font-weight:900; color:#1e293b; margin-top:16px; text-transform:uppercase; letter-spacing:2px; }
.cover-sub { font-size:12px; color:#64748b; margin-top:8px; text-transform:uppercase; letter-spacing:3px; }
.cover-date { font-size:11px; color:#94a3b8; margin-top:24px; }
.toc { margin-bottom:40px; padding:24px; background:#f8fafc; border-radius:12px; border:1px solid #e2e8f0; }
.toc-title { font-size:13px; font-weight:900; color:#1e3a8a; text-transform:uppercase; letter-spacing:2px; margin-bottom:16px; }
.toc-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
.toc-item { font-size:11px; color:#475569; padding:3px 0; }
.toc-item b { color:#1e3a8a; margin-right:6px; }
.section { margin-bottom:32px; page-break-inside:avoid; }
.section-header { background:#1e3a8a; color:white; padding:14px 20px; border-radius:10px 10px 0 0; display:flex; align-items:center; gap:16px; }
.section-num { font-size:22px; font-weight:900; opacity:0.4; }
.section-title { font-size:16px; font-weight:900; text-transform:uppercase; letter-spacing:1px; }
.section-subtitle { font-size:10px; opacity:0.7; margin-top:2px; text-transform:uppercase; letter-spacing:1px; }
.step { display:flex; gap:14px; padding:14px 20px; background:#f8fafc; border:1px solid #e2e8f0; border-top:none; }
.step:last-child { border-radius:0 0 10px 10px; }
.step-number { min-width:26px; height:26px; background:#1e3a8a; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:900; flex-shrink:0; margin-top:2px; }
.step-title { font-size:12px; font-weight:700; color:#1e293b; margin-bottom:5px; }
.step-desc { font-size:11px; color:#475569; line-height:1.7; }
.footer { text-align:center; margin-top:60px; padding-top:20px; border-top:1px solid #e2e8f0; font-size:10px; color:#94a3b8; }
@media print { body { padding:20px; } .section { page-break-inside:avoid; } }
</style>
</head>
<body>
<div class="cover">
  <div class="cover-logo">Cartório<span>RAG</span></div>
  <div class="cover-title">Manual do Usuário</div>
  <div class="cover-sub">Guia Completo da Plataforma — PRO v3.0</div>
  <div class="cover-date">MJ Consultoria &nbsp;·&nbsp; Fevereiro/2026</div>
</div>
<div class="toc">
  <div class="toc-title">Índice</div>
  <div class="toc-grid">
    ${SECTIONS.map((s, i) => `<div class="toc-item"><b>${String(i+1).padStart(2,'0')}.</b>${s.title} — ${s.subtitle}</div>`).join('')}
  </div>
</div>
${allContent}
<div class="footer">
  CartórioRAG PRO v3.0 · Manual do Usuário · MJ Consultoria · Gerado em ${new Date().toLocaleDateString('pt-BR')}<br>
  Em conformidade com LGPD Lei nº 13.709/2018, Provimento CNJ nº 149 e Provimento CNJ nº 213/2026
</div>
</body>
</html>`);

    win.document.close();
    setTimeout(() => win.print(), 600);
  };

  return (
    <div className="p-8 space-y-6 min-h-screen" style={{ background: '#05080f' }}>

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-black text-[#0A1628] italic uppercase tracking-tighter">
            Tutorial da <span className="text-blue-500">Plataforma</span>
          </h2>
          <p className="text-slate-500 text-xs font-black uppercase tracking-widest mt-1">CartórioRAG PRO v3.0 — Guia Completo do Usuário</p>
        </div>
        <button
          onClick={exportPDF}
          className="bg-blue-600 hover:bg-blue-500 text-[#0A1628] px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg"
        >
          <i className="fa-solid fa-file-pdf"></i> Baixar PDF
        </button>
      </div>

      {/* Info */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-5 flex items-start gap-3">
        <i className="fa-solid fa-circle-info text-blue-400 text-lg mt-0.5 flex-shrink-0"></i>
        <p className="text-sm text-slate-600 leading-relaxed">
          Bem-vindo ao CartórioRAG PRO. Selecione um módulo no menu para ver as instruções detalhadas,
          ou clique em <strong className="text-blue-400">Baixar PDF</strong> para salvar o manual completo com capa e índice.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Menu lateral */}
        <div className="rounded-3xl border border-slate-800 p-4 space-y-1 h-fit" style={{ background: '#0a111f' }}>
          <p className="text-xs font-black text-slate-600 uppercase tracking-widest px-3 py-2">Módulos</p>
          {SECTIONS.map(s => {
            const isActive = activeSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-left ${
                  isActive
                    ? 'bg-blue-600 shadow-lg shadow-blue-900/20'
                    : 'hover:bg-slate-800/60'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-white/20' : 'bg-slate-800'}`}>
                  <i className={`fa-solid ${s.icon} text-xs ${isActive ? 'text-[#0A1628]' : 'text-slate-500'}`}></i>
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-black truncate ${isActive ? 'text-[#0A1628]' : 'text-slate-500'}`}>{s.title}</p>
                  <p className={`text-xs truncate leading-tight ${isActive ? 'text-blue-200' : 'text-slate-600'}`} style={{ fontSize: '9px' }}>{s.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Conteúdo */}
        <div className="lg:col-span-3 space-y-4">

          {/* Header da seção */}
          <div className="bg-blue-600 rounded-2xl p-6 flex items-center gap-4 shadow-lg shadow-blue-900/20">
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <i className={`fa-solid ${current.icon} text-[#0A1628] text-2xl`}></i>
            </div>
            <div>
              <p className="text-blue-200 text-xs font-black uppercase tracking-widest">Módulo {String(currentIdx + 1).padStart(2, '0')} de {SECTIONS.length}</p>
              <h3 className="text-xl font-black text-[#0A1628] uppercase italic mt-1">{current.title}</h3>
              <p className="text-blue-200 text-sm mt-1">{current.subtitle}</p>
            </div>
          </div>

          {/* Passos */}
          <div className="space-y-3">
            {current.steps.map((step, i) => (
              <div
                key={i}
                className="border border-slate-800 rounded-2xl p-5 flex gap-4 hover:border-slate-700 transition-all"
                style={{ background: '#0a111f' }}
              >
                <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-lg shadow-blue-900/30">
                  <span className="text-xs font-black text-[#0A1628]">{i + 1}</span>
                </div>
                <div>
                  <p className="text-sm font-black text-blue-400 mb-2">{step.title}</p>
                  <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Navegação */}
          <div className="flex justify-between pt-2">
            {currentIdx > 0 ? (
              <button
                onClick={() => setActiveSection(SECTIONS[currentIdx - 1].id)}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-600 rounded-xl text-xs font-black uppercase transition-all"
              >
                <i className="fa-solid fa-arrow-left"></i> Anterior
              </button>
            ) : <div />}

            {currentIdx < SECTIONS.length - 1 ? (
              <button
                onClick={() => setActiveSection(SECTIONS[currentIdx + 1].id)}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-[#0A1628] rounded-xl text-xs font-black uppercase transition-all"
              >
                Próximo <i className="fa-solid fa-arrow-right"></i>
              </button>
            ) : (
              <button
                onClick={exportPDF}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-[#0A1628] rounded-xl text-xs font-black uppercase transition-all"
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