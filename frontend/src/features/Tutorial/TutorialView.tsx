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
    id: 'dashboard', icon: 'fa-border-all', title: 'Dashboard', subtitle: 'Painel operacional da sua serventia',
    steps: [
      { title: 'Acessando o Dashboard', desc: 'Clique em "Dashboard" no menu lateral, na seÃ§Ã£o GESTÃƒO. Esta tela exibe dados em tempo real exclusivos da sua serventia.' },
      { title: 'KPIs em tempo real', desc: 'Os cards no topo mostram mÃ©tricas como Documentos na Base, Protocolos Ativos, Treinamentos ConcluÃ­dos e AÃ§Ãµes Registradas. Todos atualizam automaticamente.' },
      { title: 'Atividade Recente', desc: 'O painel de atividade mostra as Ãºltimas aÃ§Ãµes realizadas na plataforma â€” tipo de evento, usuÃ¡rio responsÃ¡vel e horÃ¡rio.' },
      { title: 'Filtros de perÃ­odo', desc: 'Use os botÃµes de perÃ­odo (7, 30, 90 dias) para filtrar o histÃ³rico de dados exibido nos grÃ¡ficos e cards.' },
    ]
  },
  {
    id: 'collaborators', icon: 'fa-users-gear', title: 'Colaboradores', subtitle: 'Gerenciar usuÃ¡rios e permissÃµes',
    steps: [
      { title: 'Criando um colaborador', desc: 'Clique em "+ Novo Colaborador", preencha nome, e-mail e selecione o perfil de acesso. O colaborador deverÃ¡ trocar a senha no primeiro login.' },
      { title: 'Perfis disponÃ­veis', desc: 'Super Admin: acesso total. Gestor: acesso completo Ã  serventia. Admin: gerenciar colaboradores. Colaborador: acesso aos prÃ³prios dados e treinamentos.' },
      { title: 'Editando e desativando', desc: 'Clique no Ã­cone de ediÃ§Ã£o para alterar dados ou perfil. Ao desligar um colaborador, desative imediatamente para revogar o acesso Ã  plataforma.' },
      { title: 'Matriz de Acesso', desc: 'Na aba "Matriz de Acesso", visualize um mapa completo de quais recursos cada perfil pode acessar.' },
    ]
  },
  {
    id: 'reports', icon: 'fa-chart-column', title: 'RelatÃ³rios', subtitle: 'MÃ©tricas de treinamento e engajamento',
    steps: [
      { title: 'VisÃ£o Geral', desc: 'A primeira aba exibe a atividade mensal e distribuiÃ§Ã£o de notas da equipe. Acompanhe tendÃªncias de desempenho ao longo do tempo.' },
      { title: 'Por Colaborador', desc: 'Veja quantos treinamentos, exames e certificados cada colaborador concluiu. Identifique usuÃ¡rios engajados e os que precisam de atenÃ§Ã£o.' },
      { title: 'Por Trilha', desc: 'Acompanhe a taxa de conclusÃ£o e aprovaÃ§Ã£o por trilha de aprendizado. Ãštil para avaliar quais conteÃºdos tÃªm maior aderÃªncia.' },
      { title: 'ExportaÃ§Ã£o', desc: 'Use "Imprimir" para gerar relatÃ³rio em PDF ou "Exportar Excel" para anÃ¡lise em planilha. Filtre por perÃ­odo usando o seletor no topo.' },
    ]
  },
  {
    id: 'audit', icon: 'fa-clock-rotate-left', title: 'Auditoria', subtitle: 'HistÃ³rico completo de acessos e alteraÃ§Ãµes',
    steps: [
      { title: 'Log de Atividades', desc: 'Visualize todas as aÃ§Ãµes registradas na plataforma em ordem cronolÃ³gica. Filtre por tipo de evento, usuÃ¡rio e data.' },
      { title: 'Tipos de Evento', desc: 'Os eventos incluem: login/logout, criaÃ§Ã£o e ediÃ§Ã£o de usuÃ¡rios, acesso a mÃ³dulos, geraÃ§Ã£o de certificados, exportaÃ§Ãµes e alteraÃ§Ãµes de configuraÃ§Ã£o.' },
      { title: 'RetenÃ§Ã£o de logs', desc: 'Os logs sÃ£o retidos por no mÃ­nimo 5 anos conforme Provimento CNJ nÂº 149 e nÂº 213/2026, garantindo conformidade para inspeÃ§Ãµes da corregedoria.' },
      { title: 'ExportaÃ§Ã£o', desc: 'Exporte os registros em CSV ou PDF para auditorias externas ou inspeÃ§Ãµes regulatÃ³rias.' },
    ]
  },
  {
    id: 'security', icon: 'fa-lock', title: 'SeguranÃ§a', subtitle: 'Senhas, bloqueios e polÃ­ticas de acesso',
    steps: [
      { title: 'PolÃ­tica de senhas', desc: 'Configure comprimento mÃ­nimo, exigÃªncia de caracteres especiais e validade. Recomendamos no mÃ­nimo 10 caracteres com troca a cada 90 dias.' },
      { title: 'Bloqueio automÃ¡tico', desc: 'Defina o nÃºmero mÃ¡ximo de tentativas antes do bloqueio automÃ¡tico (padrÃ£o: 5). UsuÃ¡rios bloqueados precisam ser reativados pelo gestor.' },
      { title: 'Monitoramento de acessos', desc: 'Verifique regularmente a Auditoria para identificar acessos fora do horÃ¡rio comercial ou tentativas de login suspeitas.' },
    ]
  },
  {
    id: 'trails', icon: 'fa-road', title: 'Trilhas', subtitle: 'Trilhas de aprendizagem por perfil',
    steps: [
      { title: 'O que sÃ£o Trilhas?', desc: 'Trilhas sÃ£o sequÃªncias de conteÃºdos organizados por perfil profissional (atendente, escrevente, oficial substituto). Cada trilha guia o colaborador do bÃ¡sico ao avanÃ§ado.' },
      { title: 'Navegando em uma trilha', desc: 'Selecione uma trilha para ver os mÃ³dulos disponÃ­veis. Complete os mÃ³dulos em sequÃªncia para liberar o prÃ³ximo nÃ­vel.' },
      { title: 'Progresso', desc: 'O progresso de cada trilha Ã© salvo automaticamente. Acompanhe o avanÃ§o em "Meu Progresso" no menu CAPACITAÃ‡ÃƒO.' },
    ]
  },
  {
    id: 'repositorio', icon: 'fa-photo-film', title: 'RepositÃ³rio', subtitle: 'VÃ­deos, Ã¡udios e PDFs de capacitaÃ§Ã£o',
    steps: [
      { title: 'Tipos de conteÃºdo', desc: 'O repositÃ³rio centraliza todos os materiais de capacitaÃ§Ã£o: vÃ­deos, arquivos de Ã¡udio, PDFs, apresentaÃ§Ãµes e documentos normativos.' },
      { title: 'Buscando conteÃºdo', desc: 'Use a busca para localizar materiais por palavra-chave, tipo de arquivo ou categoria. Filtre por relevÃ¢ncia ou data de publicaÃ§Ã£o.' },
      { title: 'Materiais obrigatÃ³rios', desc: 'ConteÃºdos marcados como obrigatÃ³rios aparecem destacados. O gestor pode definir quais materiais sÃ£o de leitura/visualizaÃ§Ã£o obrigatÃ³ria.' },
    ]
  },
  {
    id: 'training', icon: 'fa-graduation-cap', title: 'Treinamento AI', subtitle: 'CapacitaÃ§Ã£o com IA, roteiros e quizzes',
    steps: [
      { title: 'IA de Treinamento', desc: 'Gere 3 opÃ§Ãµes de roteiro de treinamento com IA baseadas nos protocolos e documentos da sua serventia. Personalize o pedido para focar em um tema especÃ­fico.' },
      { title: 'Resumos Inteligentes', desc: 'Selecione um documento e o tipo de resumo (Executivo, TÃ©cnico, DidÃ¡tico ou Operacional) para que a IA gere um resumo otimizado para cada audiÃªncia.' },
      { title: 'Participantes', desc: 'Registre quais colaboradores participaram de cada treinamento, controle a presenÃ§a e acompanhe o status de conclusÃ£o.' },
      { title: 'QuestionÃ¡rios com IA', desc: 'Gere automaticamente questÃµes de mÃºltipla escolha baseadas no conteÃºdo dos treinamentos. Escolha entre 3, 5, 7 ou 10 questÃµes por avaliaÃ§Ã£o.' },
      { title: 'Dashboard de GestÃ£o', desc: 'A aba "Dashboard GestÃ£o" consolida o desempenho de todos os participantes com grÃ¡ficos de aprovaÃ§Ã£o, mÃ©dia de notas e evoluÃ§Ã£o ao longo do tempo.' },
    ]
  },
  {
    id: 'exames', icon: 'fa-file-pen', title: 'Exames', subtitle: 'AvaliaÃ§Ãµes com IA e Taxonomia de Bloom',
    steps: [
      { title: 'O que sÃ£o os Exames?', desc: 'Exames sÃ£o avaliaÃ§Ãµes formais geradas pela IA com base na Taxonomia de Bloom â€” garantindo questÃµes que vÃ£o do conhecimento bÃ¡sico Ã  anÃ¡lise e avaliaÃ§Ã£o crÃ­tica.' },
      { title: 'Realizando um exame', desc: 'Selecione o exame disponÃ­vel e responda as questÃµes no tempo determinado. As respostas sÃ£o corrigidas automaticamente com gabarito comentado.' },
      { title: 'Resultado e aprovaÃ§Ã£o', desc: 'A nota mÃ­nima de aprovaÃ§Ã£o Ã© 75%. Exames reprovados podem ser refeitos apÃ³s o perÃ­odo de quarentena definido pelo gestor.' },
      { title: 'HistÃ³rico de provas', desc: 'Consulte o histÃ³rico de todos os exames realizados, com data, nota e resultado. Gestores podem visualizar o desempenho de toda a equipe.' },
    ]
  },
  {
    id: 'metas', icon: 'fa-trophy', title: 'Metas & PremiaÃ§Ã£o', subtitle: 'Rankings, metas e desempate por Bloom Alto',
    steps: [
      { title: 'Sistema de Metas', desc: 'O mÃ³dulo de Metas define objetivos de desempenho por colaborador ou equipe â€” nÃºmero de treinamentos, taxa de aprovaÃ§Ã£o em exames e conclusÃ£o de trilhas.' },
      { title: 'Ranking', desc: 'O ranking consolida os colaboradores com melhor desempenho. Em caso de empate, o sistema utiliza o critÃ©rio de Bloom Alto (questÃµes de anÃ¡lise e avaliaÃ§Ã£o) para o desempate.' },
      { title: 'PremiaÃ§Ã£o', desc: 'Configure prÃªmios e reconhecimentos para os colaboradores que atingirem as metas. O histÃ³rico de premiaÃ§Ãµes fica registrado no perfil do colaborador.' },
    ]
  },
  {
    id: 'progresso', icon: 'fa-chart-line', title: 'Meu Progresso', subtitle: 'Trilhas, exames e certificados pessoais',
    steps: [
      { title: 'VisÃ£o pessoal', desc: 'Esta tela mostra exclusivamente o progresso do colaborador logado â€” trilhas iniciadas, exames realizados, certificados emitidos e pontuaÃ§Ã£o acumulada.' },
      { title: 'Trilhas em andamento', desc: 'Veja o percentual de conclusÃ£o de cada trilha que vocÃª iniciou. Clique para retomar de onde parou.' },
      { title: 'HistÃ³rico de notas', desc: 'Acompanhe a evoluÃ§Ã£o das suas notas ao longo do tempo. O grÃ¡fico mostra a tendÃªncia de desempenho por mÃ³dulo.' },
    ]
  },
  {
    id: 'certificado', icon: 'fa-certificate', title: 'Certificados', subtitle: 'Emitir e baixar certificados PDF',
    steps: [
      { title: 'Elegibilidade', desc: 'Certificados sÃ£o emitidos automaticamente quando o colaborador conclui uma trilha ou Ã© aprovado em um exame com nota mÃ­nima de 75%.' },
      { title: 'Emitindo o certificado', desc: 'Na tela de Certificados, localize o certificado disponÃ­vel e clique em "Emitir". O PDF Ã© gerado com dados da serventia, nome, data e carga horÃ¡ria.' },
      { title: 'Validade e autenticidade', desc: 'Cada certificado possui um cÃ³digo Ãºnico de verificaÃ§Ã£o. O gestor pode validar a autenticidade de qualquer certificado emitido pela plataforma.' },
    ]
  },
  {
    id: 'support', icon: 'fa-headset', title: 'Suporte TÃ©cnico', subtitle: 'Contato direto com a MJ Consultoria',
    steps: [
      { title: 'Abrindo um chamado', desc: 'Descreva o problema ou dÃºvida e clique em Enviar. A equipe MJ Consultoria responderÃ¡ em atÃ© 1 dia Ãºtil.' },
      { title: 'InformaÃ§Ãµes Ãºteis', desc: 'Inclua detalhes: qual mÃ³dulo estava usando, a aÃ§Ã£o realizada, mensagem de erro exibida e capturas de tela quando possÃ­vel.' },
      { title: 'UrgÃªncias', desc: 'Para problemas crÃ­ticos que impeÃ§am o funcionamento da serventia, indique "URGENTE" no inÃ­cio da mensagem para priorizaÃ§Ã£o do atendimento.' },
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
<title>Manual do UsuÃ¡rio â€” MJ Consultoria</title>
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
  <div class="cover-title">Manual do UsuÃ¡rio</div>
  <div class="cover-sub">Plataforma de Treinamento Corporativo</div>
  <div class="cover-date">MJ Consultoria &nbsp;Â·&nbsp; ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</div>
</div>
<div class="toc">
  <div class="toc-title">Ãndice</div>
  <div class="toc-grid">
    ${SECTIONS.map((s, i) => `<div class="toc-item"><b>${String(i+1).padStart(2,'0')}.</b>${s.title} â€” ${s.subtitle}</div>`).join('')}
  </div>
</div>
${allContent}
<div class="footer">
  MJ Consultoria Â· Plataforma de Treinamento Corporativo Â· Gerado em ${new Date().toLocaleDateString('pt-BR')}<br>
  Em conformidade com LGPD Lei nÂº 13.709/2018 Â· Provimento CNJ nÂº 149 Â· Provimento CNJ nÂº 213/2026
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
            MJ Consultoria â€” Guia Completo do UsuÃ¡rio
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
          Bem-vindo Ã  Plataforma MJ Consultoria. Selecione um mÃ³dulo para ver as instruÃ§Ãµes detalhadas,
          ou clique em <strong className="text-[#c9a84c]">Baixar PDF</strong> para salvar o manual completo.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Menu lateral */}
        <div className="bg-[#0f172a] rounded-3xl border border-[#c9a84c]/20 p-4 space-y-1 h-fit">
          <p className="text-xs font-black text-[#c9a84c]/60 uppercase tracking-widest px-3 py-2">MÃ³dulos</p>
          {SECTIONS.map(s => {
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

        {/* ConteÃºdo */}
        <div className="lg:col-span-3 space-y-4">

          {/* Header da seÃ§Ã£o */}
          <div className="bg-[#0f172a] rounded-2xl p-6 flex items-center gap-4 shadow-lg border border-[#c9a84c]/20">
            <div className="w-14 h-14 rounded-2xl bg-[#c9a84c]/15 flex items-center justify-center flex-shrink-0">
              <i className={`fa-solid ${current.icon} text-[#c9a84c] text-2xl`}></i>
            </div>
            <div>
              <p className="text-[#c9a84c]/60 text-xs font-black uppercase tracking-widest">
                MÃ³dulo {String(currentIdx + 1).padStart(2, '0')} de {SECTIONS.length}
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

          {/* NavegaÃ§Ã£o */}
          <div className="flex justify-between pt-2">
            {currentIdx > 0 ? (
              <button
                onClick={() => setActiveSection(SECTIONS[currentIdx - 1].id)}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-[#c9a84c]/30 hover:border-[#c9a84c]/60 text-[#7a5c1e] rounded-xl text-xs font-black uppercase transition-all"
              >
                <i className="fa-solid fa-arrow-left"></i> Anterior
              </button>
            ) : <div />}

            {currentIdx < SECTIONS.length - 1 ? (
              <button
                onClick={() => setActiveSection(SECTIONS[currentIdx + 1].id)}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#c9a84c] hover:brightness-110 text-[#0f172a] rounded-xl text-xs font-black uppercase transition-all"
              >
                PrÃ³ximo <i className="fa-solid fa-arrow-right"></i>
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
