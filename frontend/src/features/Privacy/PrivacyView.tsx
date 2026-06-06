
import React from 'react';

const PrivacyView: React.FC = () => {
  return (
    <div className="p-12 max-w-5xl mx-auto space-y-10 animate-in fade-in duration-700 pb-20">
      <header className="space-y-4">
        <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 rounded-3xl flex items-center justify-center">
          <i className="fa-solid fa-shield-heart text-blue-400 text-3xl"></i>
        </div>
        <h2 className="text-3xl font-black text-[#0A1628] italic uppercase tracking-tighter">
          PolÃ­tica de <span className="text-blue-500">Privacidade</span>
        </h2>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">
          Tratamento e ProteÃ§Ã£o de Dados Pessoais â€” CartÃ³rioRAG PRO v3.0
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[9px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg uppercase tracking-widest">LGPD â€” Lei nÂº 13.709/2018</span>
          <span className="text-[9px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1.5 rounded-lg uppercase tracking-widest">Provimento CNJ nÂº 149</span>
          <span className="text-[9px] font-black bg-purple-500/10 text-purple-400 border border-purple-500/20 px-3 py-1.5 rounded-lg uppercase tracking-widest">Provimento CNJ nÂº 213/2026</span>
          <span className="text-[9px] font-black bg-slate-700/50 text-slate-500 border border-slate-200 px-3 py-1.5 rounded-lg uppercase tracking-widest">Ãšltima atualizaÃ§Ã£o: Fev/2026</span>
        </div>
      </header>

      <div className="bg-[#0D1B3E] border border-slate-200 rounded-[40px] p-12 space-y-10 shadow-2xl">

        {/* 1 */}
        <div className="space-y-4">
          <h3 className="text-lg font-black text-blue-500 uppercase tracking-widest flex items-center gap-3">
            <i className="fa-solid fa-circle-info"></i> 1. Sobre Esta PolÃ­tica
          </h3>
          <p className="text-slate-700 text-sm leading-loose text-justify">
            Esta PolÃ­tica de Privacidade descreve como o <strong>CartÃ³rioRAG PRO</strong>, desenvolvido e mantido pela <strong>MJ Consultoria</strong>, coleta, utiliza, armazena e protege os dados dos colaboradores e das serventias contratantes. O tratamento de dados Ã© realizado em conformidade com a Lei Geral de ProteÃ§Ã£o de Dados Pessoais (LGPD â€” Lei nÂº 13.709/2018), o Provimento CNJ nÂº 149 e o Provimento CNJ nÂº 213/2026.
          </p>
        </div>

        <div className="w-full h-px bg-slate-800/50"></div>

        {/* 2 - Base Legal */}
        <div className="space-y-4">
          <h3 className="text-lg font-black text-emerald-500 uppercase tracking-widest flex items-center gap-3">
            <i className="fa-solid fa-scale-balanced"></i> 2. Base Legal do Tratamento
          </h3>
          <p className="text-slate-700 text-sm leading-loose text-justify">
            O tratamento dos dados pessoais dos colaboradores nesta plataforma tem como base legal o <strong>Art. 7Âº, inciso V da LGPD â€” ExecuÃ§Ã£o de Contrato</strong>. O uso da plataforma Ã© determinado pela prÃ³pria serventia como ferramenta de gestÃ£o e execuÃ§Ã£o das atividades notariais e registrais, nÃ£o sendo baseado em consentimento individual dos colaboradores.
          </p>
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 flex items-start gap-3">
            <i className="fa-solid fa-gavel text-emerald-400 text-lg mt-0.5 flex-shrink-0"></i>
            <div>
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Fundamento: Art. 7Âº, V â€” LGPD</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                "O tratamento de dados pessoais somente poderÃ¡ ser realizado quando necessÃ¡rio para a <strong className="text-[#0A1628]">execuÃ§Ã£o de contrato</strong> ou de procedimentos preliminares relacionados a contrato do qual seja parte o titular, a pedido do titular dos dados."
              </p>
            </div>
          </div>
        </div>

        <div className="w-full h-px bg-slate-800/50"></div>

        {/* 3 */}
        <div className="space-y-4">
          <h3 className="text-lg font-black text-blue-500 uppercase tracking-widest flex items-center gap-3">
            <i className="fa-solid fa-database"></i> 3. Dados Coletados
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { title: 'Dados de IdentificaÃ§Ã£o',  desc: 'Nome, e-mail, cargo e vÃ­nculo institucional dos colaboradores cadastrados na plataforma pela serventia.', icon: 'fa-id-card',    color: 'blue'    },
              { title: 'Dados de Acesso',          desc: 'Registros de login, logout, horÃ¡rios de acesso e aÃ§Ãµes realizadas no sistema para fins de auditoria.',   icon: 'fa-key',        color: 'amber'   },
              { title: 'Documentos Processuais',   desc: 'Textos e metadados de documentos submetidos para anÃ¡lise, indexaÃ§Ã£o e auditoria de conformidade.',        icon: 'fa-file-lines', color: 'purple'  },
              { title: 'Dados Operacionais',       desc: 'Logs de auditoria, mÃ©tricas de uso, consultas realizadas Ã  base legal e resultados de treinamentos.',     icon: 'fa-chart-line', color: 'emerald' },
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
          <h3 className="text-lg font-black text-purple-500 uppercase tracking-widest flex items-center gap-3">
            <i className="fa-solid fa-bullseye"></i> 4. Finalidade do Tratamento
          </h3>
          <div className="space-y-2">
            {[
              { num: '01', text: 'PrestaÃ§Ã£o dos serviÃ§os de consultoria e suporte tecnolÃ³gico Ã s serventias notariais e de registro.' },
              { num: '02', text: 'AnÃ¡lise de conformidade documental com base nos protocolos e na legislaÃ§Ã£o vigente (CNJ, LGPD, provimentos).' },
              { num: '03', text: 'GeraÃ§Ã£o de relatÃ³rios operacionais e mÃ©tricas de desempenho para gestÃ£o interna da serventia.' },
              { num: '04', text: 'Controle de acesso, autenticaÃ§Ã£o e registro de auditoria para fins de seguranÃ§a e rastreabilidade.' },
              { num: '05', text: 'CapacitaÃ§Ã£o dos colaboradores por meio do mÃ³dulo de treinamento com inteligÃªncia artificial.' },
              { num: '06', text: 'Cumprimento de obrigaÃ§Ãµes legais e regulatÃ³rias impostas pelo CNJ, Provimento 149 e Provimento 213/2026.' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-4 p-4 bg-[#0D1B3E] border border-slate-200 rounded-xl">
                <span className="text-[10px] font-black text-slate-600 bg-slate-900 border border-slate-200 px-2 py-1 rounded-lg flex-shrink-0">{item.num}</span>
                <p className="text-xs text-slate-700 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full h-px bg-slate-800/50"></div>

        {/* 5 */}
        <div className="space-y-4">
          <h3 className="text-lg font-black text-amber-500 uppercase tracking-widest flex items-center gap-3">
            <i className="fa-solid fa-share-nodes"></i> 5. Compartilhamento de Dados
          </h3>
          <p className="text-slate-700 text-sm leading-loose text-justify">
            Os dados tratados na plataforma <strong>nÃ£o sÃ£o vendidos, alugados ou cedidos a terceiros</strong> para fins comerciais. O compartilhamento ocorre exclusivamente nas seguintes hipÃ³teses:
          </p>
          <div className="space-y-2">
            {[
              { label: 'Provedores de IA',        desc: 'Documentos submetidos para anÃ¡lise podem ser processados temporariamente por APIs de inteligÃªncia artificial (Google Gemini, Anthropic Claude) sob acordos de confidencialidade Enterprise, sem armazenamento permanente pelos provedores.' },
              { label: 'Infraestrutura em nuvem', desc: 'Dados sÃ£o armazenados no Google Firebase (Firestore e Storage), sob certificaÃ§Ã£o SOC 2 e ISO 27001, com criptografia em repouso e em trÃ¢nsito.' },
              { label: 'ObrigaÃ§Ã£o legal',          desc: 'Mediante determinaÃ§Ã£o judicial, requisiÃ§Ã£o do CNJ ou de autoridade competente, os dados poderÃ£o ser fornecidos nos estritos termos legais.' },
            ].map((item, i) => (
              <div key={i} className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">{item.label}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full h-px bg-slate-800/50"></div>

        {/* 6 */}
        <div className="space-y-4">
          <h3 className="text-lg font-black text-emerald-500 uppercase tracking-widest flex items-center gap-3">
            <i className="fa-solid fa-user-shield"></i> 6. Direitos do Titular
          </h3>
          <p className="text-slate-700 text-sm leading-loose">
            Em conformidade com o Art. 18 da LGPD, o titular dos dados tem direito a:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: 'fa-eye',         label: 'ConfirmaÃ§Ã£o e Acesso', desc: 'Saber se seus dados sÃ£o tratados e acessÃ¡-los'              },
              { icon: 'fa-pen',         label: 'CorreÃ§Ã£o',             desc: 'Solicitar correÃ§Ã£o de dados incompletos ou desatualizados'  },
              { icon: 'fa-trash',       label: 'EliminaÃ§Ã£o',           desc: 'Solicitar exclusÃ£o dos dados desnecessÃ¡rios ao tratamento'  },
              { icon: 'fa-circle-info', label: 'InformaÃ§Ã£o',           desc: 'Ser informado sobre compartilhamentos realizados'           },
            ].map((item, i) => (
              <div key={i} className="bg-[#0D1B3E] border border-slate-200 rounded-xl p-4 space-y-2 text-center">
                <i className={`fa-solid ${item.icon} text-emerald-400 text-lg`}></i>
                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">{item.label}</p>
                <p className="text-[9px] text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="bg-slate-900/50 border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 italic">
              <i className="fa-solid fa-circle-info text-slate-600 mr-2"></i>
              Como o tratamento tem base em <strong className="text-slate-500">execuÃ§Ã£o de contrato</strong> (Art. 7Âº, V â€” LGPD), nÃ£o se aplica o direito de revogaÃ§Ã£o de consentimento nem portabilidade de dados, pois o uso da plataforma Ã© determinado pela prÃ³pria serventia no exercÃ­cio de suas atividades.
            </p>
          </div>
          <p className="text-xs text-slate-500 italic">Para exercer seus direitos, entre em contato via mÃ³dulo de Suporte TÃ©cnico.</p>
        </div>

        <div className="w-full h-px bg-slate-800/50"></div>

        {/* 7 */}
        <div className="space-y-4">
          <h3 className="text-lg font-black text-red-500 uppercase tracking-widest flex items-center gap-3">
            <i className="fa-solid fa-clock"></i> 7. RetenÃ§Ã£o e ExclusÃ£o de Dados
          </h3>
          <p className="text-slate-700 text-sm leading-loose text-justify">
            Os dados sÃ£o retidos pelo perÃ­odo necessÃ¡rio para a prestaÃ§Ã£o dos serviÃ§os contratados e cumprimento de obrigaÃ§Ãµes legais. Logs de auditoria sÃ£o mantidos por no mÃ­nimo <strong>5 anos</strong> conforme exigÃªncia do CNJ (Provimento 149 e Provimento 213/2026). ApÃ³s o tÃ©rmino do contrato, os dados sÃ£o excluÃ­dos ou anonimizados em atÃ© 30 dias, salvo obrigaÃ§Ã£o legal em contrÃ¡rio.
          </p>
        </div>

        <div className="bg-blue-500/5 border border-blue-500/20 rounded-3xl p-8 flex items-start gap-4">
          <i className="fa-solid fa-envelope text-blue-400 text-xl mt-1 flex-shrink-0"></i>
          <div>
            <p className="text-sm font-black text-[#0A1628] mb-1">Encarregado de Dados (DPO) â€” MJ Consultoria</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Para dÃºvidas, solicitaÃ§Ãµes ou incidentes relacionados ao tratamento de dados pessoais, utilize o mÃ³dulo de <strong className="text-blue-400">Suporte TÃ©cnico</strong> ou entre em contato diretamente com a equipe MJ Consultoria.
            </p>
            <p className="text-[9px] text-slate-600 mt-3">
              Ãšltima atualizaÃ§Ã£o: Fevereiro/2026 â€” Em conformidade com LGPD Lei nÂº 13.709/2018, Provimento CNJ nÂº 149 e Provimento CNJ nÂº 213/2026
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PrivacyView;
