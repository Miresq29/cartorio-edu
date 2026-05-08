
import React from 'react';

const PolicyView: React.FC = () => {
  return (
    <div className="p-12 max-w-5xl mx-auto space-y-10 animate-in fade-in duration-700 pb-20">
      <header className="space-y-4">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-center">
          <i className="fa-solid fa-file-shield text-red-400 text-3xl"></i>
        </div>
        <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
          Política de <span className="text-red-500">Segurança</span>
        </h2>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">
          Controles, Proteções e Responsabilidades — CartórioRAG PRO v3.0
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[9px] font-black bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg uppercase tracking-widest">ISO 27001</span>
          <span className="text-[9px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-lg uppercase tracking-widest">Provimento CNJ 212/2026</span>
          <span className="text-[9px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1.5 rounded-lg uppercase tracking-widest">Última atualização: Fevereiro/2026</span>
        </div>
      </header>

      <div className="bg-[#0D1B3E] border border-[#C9A84C]/30 rounded-[40px] p-12 space-y-10 shadow-2xl">

        {/* 1 */}
        <div className="space-y-4">
          <h3 className="text-lg font-black text-red-500 uppercase tracking-widest flex items-center gap-3">
            <i className="fa-solid fa-bullseye"></i> 1. Objetivo e Escopo
          </h3>
          <p className="text-slate-200 text-sm leading-loose text-justify">
            Esta Política de Segurança estabelece os princípios, controles e responsabilidades para proteção dos sistemas, dados e infraestrutura do <strong>CartórioRAG PRO</strong>. Aplica-se a todos os usuários, colaboradores das serventias contratantes e à equipe da <strong>MJ Consultoria</strong>, em conformidade com o Provimento CNJ nº 212/2026 e as melhores práticas de segurança da informação.
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
              { icon: 'fa-users-gear', color: 'blue', title: 'Perfis de Acesso', desc: 'O sistema implementa controle de acesso baseado em funções (RBAC). Os perfis disponíveis são: SUPERADMIN, Gestor, Expert, Auditor, Atendente e Viewer — cada um com permissões específicas e mínimas necessárias para execução de suas funções.' },
              { icon: 'fa-lock', color: 'amber', title: 'Política de Senhas', desc: 'Senhas devem ter no mínimo 8 caracteres com combinação de letras maiúsculas, minúsculas, números e símbolos. Senhas são armazenadas exclusivamente com hash criptográfico (bcrypt). A troca de senha é obrigatória no primeiro acesso.' },
              { icon: 'fa-ban', color: 'red', title: 'Bloqueio Automático', desc: 'Após 5 tentativas consecutivas de acesso com credenciais incorretas, a conta é automaticamente bloqueada. O desbloqueio deve ser solicitado ao administrador do sistema.' },
              { icon: 'fa-clock-rotate-left', color: 'purple', title: 'Sessões e Timeout', desc: 'As sessões são encerradas automaticamente após período de inatividade. Todos os acessos são registrados em log de auditoria com identificação do usuário, IP, data e hora.' },
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
            <i className="fa-solid fa-shield-halved"></i> 3. Proteção de Dados em Trânsito e Repouso
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { icon: 'fa-lock', title: 'Criptografia TLS/HTTPS', desc: 'Toda comunicação entre o cliente e os servidores é criptografada via TLS 1.3. O acesso via HTTP é automaticamente redirecionado para HTTPS.', color: 'emerald' },
              { icon: 'fa-database', title: 'Criptografia em Repouso', desc: 'Dados armazenados no Firebase Firestore e Storage são criptografados em repouso usando AES-256, padrão Google Cloud Platform.', color: 'blue' },
              { icon: 'fa-cloud', title: 'Infraestrutura Certificada', desc: 'A plataforma utiliza Google Firebase com certificação SOC 2 Type II e ISO/IEC 27001, garantindo controles rigorosos de segurança.', color: 'purple' },
              { icon: 'fa-copy', title: 'Backups Automáticos', desc: 'O Firestore realiza backups automáticos com retenção configurável. Dados críticos são replicados em múltiplas regiões geográficas.', color: 'amber' },
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
          <p className="text-slate-200 text-sm leading-loose text-justify">
            Todas as ações realizadas na plataforma são registradas em logs imutáveis de auditoria, incluindo:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: 'fa-right-to-bracket', label: 'Login / Logout',       color: 'emerald' },
              { icon: 'fa-file-circle-plus', label: 'Inserção de Docs',     color: 'blue'    },
              { icon: 'fa-file-circle-xmark',label: 'Exclusão de Docs',     color: 'red'     },
              { icon: 'fa-user-pen',         label: 'Alteração de Usuário', color: 'amber'   },
              { icon: 'fa-shield-halved',    label: 'Mudança de Permissão', color: 'purple'  },
              { icon: 'fa-magnifying-glass', label: 'Consultas IA',         color: 'blue'    },
              { icon: 'fa-graduation-cap',   label: 'Atividades Treino',    color: 'emerald' },
              { icon: 'fa-triangle-exclamation', label: 'Tentativas Falhas', color: 'red'    },
            ].map((item, i) => (
              <div key={i} className="bg-[#0D1B3E] border border-[#C9A84C]/30 rounded-xl p-3 text-center space-y-2">
                <i className={`fa-solid ${item.icon} text-${item.color}-400`}></i>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-tight">{item.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 italic">Logs são retidos por no mínimo 5 anos conforme exigência do CNJ e não podem ser excluídos por usuários comuns.</p>
        </div>

        <div className="w-full h-px bg-slate-800/50"></div>

        {/* 5 */}
        <div className="space-y-4">
          <h3 className="text-lg font-black text-purple-500 uppercase tracking-widest flex items-center gap-3">
            <i className="fa-solid fa-user-tie"></i> 5. Responsabilidades dos Usuários
          </h3>
          <div className="space-y-2">
            {[
              'Manter as credenciais de acesso em sigilo, não compartilhando login e senha com terceiros.',
              'Reportar imediatamente ao administrador qualquer suspeita de acesso não autorizado ou comprometimento de credenciais.',
              'Utilizar a plataforma exclusivamente para finalidades relacionadas às atividades notariais e registrais da serventia.',
              'Não tentar acessar módulos ou dados para os quais não possui permissão atribuída.',
              'Não inserir dados falsos, manipulados ou que possam comprometer a integridade dos registros de auditoria.',
              'Encerrar a sessão ao término do uso, especialmente em computadores compartilhados.',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-[#0D1B3E] border border-[#C9A84C]/30 rounded-xl">
                <i className="fa-solid fa-circle-check text-purple-400 text-xs mt-1 flex-shrink-0"></i>
                <p className="text-xs text-slate-200 leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full h-px bg-slate-800/50"></div>

        {/* 6 */}
        <div className="space-y-4">
          <h3 className="text-lg font-black text-red-500 uppercase tracking-widest flex items-center gap-3">
            <i className="fa-solid fa-triangle-exclamation"></i> 6. Incidentes de Segurança
          </h3>
          <p className="text-slate-200 text-sm leading-loose text-justify">
            Em caso de incidente de segurança (vazamento de dados, acesso não autorizado, perda de credenciais), a MJ Consultoria seguirá o protocolo:
          </p>
          <div className="space-y-2">
            {[
              { step: '01', label: 'Contenção', desc: 'Isolamento imediato do acesso comprometido e suspensão preventiva das contas afetadas.' },
              { step: '02', label: 'Investigação', desc: 'Análise dos logs de auditoria para identificar a extensão e origem do incidente.' },
              { step: '03', label: 'Notificação', desc: 'Comunicação à serventia afetada em até 72h e, quando exigido pela LGPD, notificação à ANPD.' },
              { step: '04', label: 'Remediação', desc: 'Implementação das correções necessárias e revisão dos controles de segurança.' },
              { step: '05', label: 'Relatório', desc: 'Elaboração de relatório pós-incidente com recomendações de melhoria.' },
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

        <div className="bg-slate-900/50 border border-[#C9A84C]/30 rounded-3xl p-8 flex items-start gap-4">
          <i className="fa-solid fa-circle-info text-slate-500 text-xl mt-1 flex-shrink-0"></i>
          <div>
            <p className="text-sm font-black text-white mb-1">Dúvidas sobre Segurança?</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Para reportar vulnerabilidades, incidentes ou dúvidas sobre esta política, utilize o módulo de <strong className="text-blue-400">Suporte Técnico</strong> da plataforma.
              <br /><span className="text-slate-300 text-[9px] mt-2 block">Última atualização: Fevereiro/2026 — CartórioRAG PRO v3.0 — Conforme Provimento CNJ nº 212/2026</span>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PolicyView;