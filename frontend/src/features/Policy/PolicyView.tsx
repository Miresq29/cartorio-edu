
import React from 'react';

const PolicyView: React.FC = () => {
  return (
    <div className="p-12 max-w-5xl mx-auto space-y-10 animate-in fade-in duration-700 pb-20">
      <header className="space-y-4">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-center">
          <i className="fa-solid fa-file-shield text-red-400 text-3xl"></i>
        </div>
        <h2 className="text-3xl font-black text-[#0A1628] italic uppercase tracking-tighter">
          PolÃ­tica de <span className="text-red-500">SeguranÃ§a</span>
        </h2>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">
          Controles, ProteÃ§Ãµes e Responsabilidades â€” CartÃ³rioRAG PRO v3.0
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[9px] font-black bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg uppercase tracking-widest">ISO 27001</span>
          <span className="text-[9px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-lg uppercase tracking-widest">Provimento CNJ 212/2026</span>
          <span className="text-[9px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1.5 rounded-lg uppercase tracking-widest">Ãšltima atualizaÃ§Ã£o: Fevereiro/2026</span>
        </div>
      </header>

      <div className="bg-[#0D1B3E] border border-slate-200 rounded-[40px] p-12 space-y-10 shadow-2xl">

        {/* 1 */}
        <div className="space-y-4">
          <h3 className="text-lg font-black text-red-500 uppercase tracking-widest flex items-center gap-3">
            <i className="fa-solid fa-bullseye"></i> 1. Objetivo e Escopo
          </h3>
          <p className="text-slate-700 text-sm leading-loose text-justify">
            Esta PolÃ­tica de SeguranÃ§a estabelece os princÃ­pios, controles e responsabilidades para proteÃ§Ã£o dos sistemas, dados e infraestrutura do <strong>CartÃ³rioRAG PRO</strong>. Aplica-se a todos os usuÃ¡rios, colaboradores das serventias contratantes e Ã  equipe da <strong>MJ Consultoria</strong>, em conformidade com o Provimento CNJ nÂº 212/2026 e as melhores prÃ¡ticas de seguranÃ§a da informaÃ§Ã£o.
          </p>
        </div>

        <div className="w-full h-px bg-slate-800/50"></div>

        {/* 2 */}
        <div className="space-y-4">
          <h3 className="text-lg font-black text-amber-500 uppercase tracking-widest flex items-center gap-3">
            <i className="fa-solid fa-key"></i> 2. Controle de Acesso
          </h3>
          <div className="space-y-3">
            {[
              { icon: 'fa-users-gear', color: 'blue', title: 'Perfis de Acesso', desc: 'O sistema implementa controle de acesso baseado em funÃ§Ãµes (RBAC). Os perfis disponÃ­veis sÃ£o: SUPERADMIN, Gestor, Expert, Auditor, Atendente e Viewer â€” cada um com permissÃµes especÃ­ficas e mÃ­nimas necessÃ¡rias para execuÃ§Ã£o de suas funÃ§Ãµes.' },
              { icon: 'fa-lock', color: 'amber', title: 'PolÃ­tica de Senhas', desc: 'Senhas devem ter no mÃ­nimo 8 caracteres com combinaÃ§Ã£o de letras maiÃºsculas, minÃºsculas, nÃºmeros e sÃ­mbolos. Senhas sÃ£o armazenadas exclusivamente com hash criptogrÃ¡fico (bcrypt). A troca de senha Ã© obrigatÃ³ria no primeiro acesso.' },
              { icon: 'fa-ban', color: 'red', title: 'Bloqueio AutomÃ¡tico', desc: 'ApÃ³s 5 tentativas consecutivas de acesso com credenciais incorretas, a conta Ã© automaticamente bloqueada. O desbloqueio deve ser solicitado ao administrador do sistema.' },
              { icon: 'fa-clock-rotate-left', color: 'purple', title: 'SessÃµes e Timeout', desc: 'As sessÃµes sÃ£o encerradas automaticamente apÃ³s perÃ­odo de inatividade. Todos os acessos sÃ£o registrados em log de auditoria com identificaÃ§Ã£o do usuÃ¡rio, IP, data e hora.' },
            ].map((item, i) => (
              <div key={i} className={`p-5 bg-${item.color}-500/5 border border-${item.color}-500/20 rounded-2xl space-y-2`}>
                <div className="flex items-center gap-2">
                  <i className={`fa-solid ${item.icon} text-${item.color}-400`}></i>
                  <p className={`text-[10px] font-black text-${item.color}-400 uppercase tracking-widest`}>{item.title}</p>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full h-px bg-slate-800/50"></div>

        {/* 3 */}
        <div className="space-y-4">
          <h3 className="text-lg font-black text-blue-500 uppercase tracking-widest flex items-center gap-3">
            <i className="fa-solid fa-shield-halved"></i> 3. ProteÃ§Ã£o de Dados em TrÃ¢nsito e Repouso
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { icon: 'fa-lock', title: 'Criptografia TLS/HTTPS', desc: 'Toda comunicaÃ§Ã£o entre o cliente e os servidores Ã© criptografada via TLS 1.3. O acesso via HTTP Ã© automaticamente redirecionado para HTTPS.', color: 'emerald' },
              { icon: 'fa-database', title: 'Criptografia em Repouso', desc: 'Dados armazenados no Firebase Firestore e Storage sÃ£o criptografados em repouso usando AES-256, padrÃ£o Google Cloud Platform.', color: 'blue' },
              { icon: 'fa-cloud', title: 'Infraestrutura Certificada', desc: 'A plataforma utiliza Google Firebase com certificaÃ§Ã£o SOC 2 Type II e ISO/IEC 27001, garantindo controles rigorosos de seguranÃ§a.', color: 'purple' },
              { icon: 'fa-copy', title: 'Backups AutomÃ¡ticos', desc: 'O Firestore realiza backups automÃ¡ticos com retenÃ§Ã£o configurÃ¡vel. Dados crÃ­ticos sÃ£o replicados em mÃºltiplas regiÃµes geogrÃ¡ficas.', color: 'amber' },
            ].map((item, i) => (
              <div key={i} className={`bg-${item.color}-500/5 border border-${item.color}-500/20 rounded-2xl p-5 space-y-2`}>
                <div className="flex items-center gap-2">
                  <i className={`fa-solid ${item.icon} text-${item.color}-400`}></i>
                  <p className={`text-[10px] font-black text-${item.color}-400 uppercase tracking-widest`}>{item.title}</p>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full h-px bg-slate-800/50"></div>

        {/* 4 */}
        <div className="space-y-4">
          <h3 className="text-lg font-black text-emerald-500 uppercase tracking-widest flex items-center gap-3">
            <i className="fa-solid fa-scroll"></i> 4. Auditoria e Rastreabilidade
          </h3>
          <p className="text-slate-700 text-sm leading-loose text-justify">
            Todas as aÃ§Ãµes realizadas na plataforma sÃ£o registradas em logs imutÃ¡veis de auditoria, incluindo:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: 'fa-right-to-bracket', label: 'Login / Logout',       color: 'emerald' },
              { icon: 'fa-file-circle-plus', label: 'InserÃ§Ã£o de Docs',     color: 'blue'    },
              { icon: 'fa-file-circle-xmark',label: 'ExclusÃ£o de Docs',     color: 'red'     },
              { icon: 'fa-user-pen',         label: 'AlteraÃ§Ã£o de UsuÃ¡rio', color: 'amber'   },
              { icon: 'fa-shield-halved',    label: 'MudanÃ§a de PermissÃ£o', color: 'purple'  },
              { icon: 'fa-magnifying-glass', label: 'Consultas IA',         color: 'blue'    },
              { icon: 'fa-graduation-cap',   label: 'Atividades Treino',    color: 'emerald' },
              { icon: 'fa-triangle-exclamation', label: 'Tentativas Falhas', color: 'red'    },
            ].map((item, i) => (
              <div key={i} className="bg-[#0D1B3E] border border-slate-200 rounded-xl p-3 text-center space-y-2">
                <i className={`fa-solid ${item.icon} text-${item.color}-400`}></i>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-tight">{item.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 italic">Logs sÃ£o retidos por no mÃ­nimo 5 anos conforme exigÃªncia do CNJ e nÃ£o podem ser excluÃ­dos por usuÃ¡rios comuns.</p>
        </div>

        <div className="w-full h-px bg-slate-800/50"></div>

        {/* 5 */}
        <div className="space-y-4">
          <h3 className="text-lg font-black text-purple-500 uppercase tracking-widest flex items-center gap-3">
            <i className="fa-solid fa-user-tie"></i> 5. Responsabilidades dos UsuÃ¡rios
          </h3>
          <div className="space-y-2">
            {[
              'Manter as credenciais de acesso em sigilo, nÃ£o compartilhando login e senha com terceiros.',
              'Reportar imediatamente ao administrador qualquer suspeita de acesso nÃ£o autorizado ou comprometimento de credenciais.',
              'Utilizar a plataforma exclusivamente para finalidades relacionadas Ã s atividades notariais e registrais da serventia.',
              'NÃ£o tentar acessar mÃ³dulos ou dados para os quais nÃ£o possui permissÃ£o atribuÃ­da.',
              'NÃ£o inserir dados falsos, manipulados ou que possam comprometer a integridade dos registros de auditoria.',
              'Encerrar a sessÃ£o ao tÃ©rmino do uso, especialmente em computadores compartilhados.',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-[#0D1B3E] border border-slate-200 rounded-xl">
                <i className="fa-solid fa-circle-check text-purple-400 text-xs mt-1 flex-shrink-0"></i>
                <p className="text-xs text-slate-700 leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full h-px bg-slate-800/50"></div>

        {/* 6 */}
        <div className="space-y-4">
          <h3 className="text-lg font-black text-red-500 uppercase tracking-widest flex items-center gap-3">
            <i className="fa-solid fa-triangle-exclamation"></i> 6. Incidentes de SeguranÃ§a
          </h3>
          <p className="text-slate-700 text-sm leading-loose text-justify">
            Em caso de incidente de seguranÃ§a (vazamento de dados, acesso nÃ£o autorizado, perda de credenciais), a MJ Consultoria seguirÃ¡ o protocolo:
          </p>
          <div className="space-y-2">
            {[
              { step: '01', label: 'ContenÃ§Ã£o', desc: 'Isolamento imediato do acesso comprometido e suspensÃ£o preventiva das contas afetadas.' },
              { step: '02', label: 'InvestigaÃ§Ã£o', desc: 'AnÃ¡lise dos logs de auditoria para identificar a extensÃ£o e origem do incidente.' },
              { step: '03', label: 'NotificaÃ§Ã£o', desc: 'ComunicaÃ§Ã£o Ã  serventia afetada em atÃ© 72h e, quando exigido pela LGPD, notificaÃ§Ã£o Ã  ANPD.' },
              { step: '04', label: 'RemediaÃ§Ã£o', desc: 'ImplementaÃ§Ã£o das correÃ§Ãµes necessÃ¡rias e revisÃ£o dos controles de seguranÃ§a.' },
              { step: '05', label: 'RelatÃ³rio', desc: 'ElaboraÃ§Ã£o de relatÃ³rio pÃ³s-incidente com recomendaÃ§Ãµes de melhoria.' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-4 p-4 bg-red-500/5 border border-red-500/10 rounded-xl">
                <span className="text-[10px] font-black text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-lg flex-shrink-0">{item.step}</span>
                <div>
                  <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-200 rounded-3xl p-8 flex items-start gap-4">
          <i className="fa-solid fa-circle-info text-slate-500 text-xl mt-1 flex-shrink-0"></i>
          <div>
            <p className="text-sm font-black text-[#0A1628] mb-1">DÃºvidas sobre SeguranÃ§a?</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Para reportar vulnerabilidades, incidentes ou dÃºvidas sobre esta polÃ­tica, utilize o mÃ³dulo de <strong className="text-blue-400">Suporte TÃ©cnico</strong> da plataforma.
              <br /><span className="text-slate-600 text-[9px] mt-2 block">Ãšltima atualizaÃ§Ã£o: Fevereiro/2026 â€” CartÃ³rioRAG PRO v3.0 â€” Conforme Provimento CNJ nÂº 212/2026</span>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PolicyView;
