
import React from 'react';

const PrivacyView: React.FC = () => {
  return (
    <div className="p-12 max-w-5xl mx-auto space-y-10 animate-in fade-in duration-700 pb-20">
      <header className="space-y-4">
        <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 rounded-3xl flex items-center justify-center">
          <i className="fa-solid fa-shield-heart text-blue-400 text-3xl"></i>
        </div>
        <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
          Política de <span className="text-blue-500">Privacidade</span>
        </h2>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">
          Tratamento e Proteção de Dados Pessoais — CartórioRAG PRO v3.0
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[9px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg uppercase tracking-widest">LGPD — Lei nº 13.709/2018</span>
          <span className="text-[9px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1.5 rounded-lg uppercase tracking-widest">Provimento CNJ nº 149</span>
          <span className="text-[9px] font-black bg-purple-500/10 text-purple-400 border border-purple-500/20 px-3 py-1.5 rounded-lg uppercase tracking-widest">Provimento CNJ nº 213/2026</span>
          <span className="text-[9px] font-black bg-slate-700/50 text-slate-500 border border-[#C9A84C]/20 px-3 py-1.5 rounded-lg uppercase tracking-widest">Última atualização: Fev/2026</span>
        </div>
      </header>

      <div className="bg-[#0D1B3E] border border-[#C9A84C]/30 rounded-[40px] p-12 space-y-10 shadow-2xl">

        {/* 1 */}
        <div className="space-y-4">
          <h3 className="text-lg font-black text-blue-500 uppercase tracking-widest flex items-center gap-3">
            <i className="fa-solid fa-circle-info"></i> 1. Sobre Esta Política
          </h3>
          <p className="text-slate-200 text-sm leading-loose text-justify">
            Esta Política de Privacidade descreve como o <strong>CartórioRAG PRO</strong>, desenvolvido e mantido pela <strong>MJ Consultoria</strong>, coleta, utiliza, armazena e protege os dados dos colaboradores e das serventias contratantes. O tratamento de dados é realizado em conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD — Lei nº 13.709/2018), o Provimento CNJ nº 149 e o Provimento CNJ nº 213/2026.
          </p>
        </div>

        <div className="w-full h-px bg-slate-800/50"></div>

        {/* 2 - Base Legal */}
        <div className="space-y-4">
          <h3 className="text-lg font-black text-emerald-500 uppercase tracking-widest flex items-center gap-3">
            <i className="fa-solid fa-scale-balanced"></i> 2. Base Legal do Tratamento
          </h3>
          <p className="text-slate-200 text-sm leading-loose text-justify">
            O tratamento dos dados pessoais dos colaboradores nesta plataforma tem como base legal o <strong>Art. 7º, inciso V da LGPD — Execução de Contrato</strong>. O uso da plataforma é determinado pela própria serventia como ferramenta de gestão e execução das atividades notariais e registrais, não sendo baseado em consentimento individual dos colaboradores.
          </p>
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 flex items-start gap-3">
            <i className="fa-solid fa-gavel text-emerald-400 text-lg mt-0.5 flex-shrink-0"></i>
            <div>
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Fundamento: Art. 7º, V — LGPD</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                "O tratamento de dados pessoais somente poderá ser realizado quando necessário para a <strong className="text-white">execução de contrato</strong> ou de procedimentos preliminares relacionados a contrato do qual seja parte o titular, a pedido do titular dos dados."
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
              { title: 'Dados de Identificação',  desc: 'Nome, e-mail, cargo e vínculo institucional dos colaboradores cadastrados na plataforma pela serventia.', icon: 'fa-id-card',    color: 'blue'    },
              { title: 'Dados de Acesso',          desc: 'Registros de login, logout, horários de acesso e ações realizadas no sistema para fins de auditoria.',   icon: 'fa-key',        color: 'amber'   },
              { title: 'Documentos Processuais',   desc: 'Textos e metadados de documentos submetidos para análise, indexação e auditoria de conformidade.',        icon: 'fa-file-lines', color: 'purple'  },
              { title: 'Dados Operacionais',       desc: 'Logs de auditoria, métricas de uso, consultas realizadas à base legal e resultados de treinamentos.',     icon: 'fa-chart-line', color: 'emerald' },
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
              { num: '01', text: 'Prestação dos serviços de consultoria e suporte tecnológico às serventias notariais e de registro.' },
              { num: '02', text: 'Análise de conformidade documental com base nos protocolos e na legislação vigente (CNJ, LGPD, provimentos).' },
              { num: '03', text: 'Geração de relatórios operacionais e métricas de desempenho para gestão interna da serventia.' },
              { num: '04', text: 'Controle de acesso, autenticação e registro de auditoria para fins de segurança e rastreabilidade.' },
              { num: '05', text: 'Capacitação dos colaboradores por meio do módulo de treinamento com inteligência artificial.' },
              { num: '06', text: 'Cumprimento de obrigações legais e regulatórias impostas pelo CNJ, Provimento 149 e Provimento 213/2026.' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-4 p-4 bg-[#0D1B3E] border border-[#C9A84C]/30 rounded-xl">
                <span className="text-[10px] font-black text-slate-300 bg-slate-900 border border-[#C9A84C]/30 px-2 py-1 rounded-lg flex-shrink-0">{item.num}</span>
                <p className="text-xs text-slate-200 leading-relaxed">{item.text}</p>
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
          <p className="text-slate-200 text-sm leading-loose text-justify">
            Os dados tratados na plataforma <strong>não são vendidos, alugados ou cedidos a terceiros</strong> para fins comerciais. O compartilhamento ocorre exclusivamente nas seguintes hipóteses:
          </p>
          <div className="space-y-2">
            {[
              { label: 'Provedores de IA',        desc: 'Documentos submetidos para análise podem ser processados temporariamente por APIs de inteligência artificial (Google Gemini, Anthropic Claude) sob acordos de confidencialidade Enterprise, sem armazenamento permanente pelos provedores.' },
              { label: 'Infraestrutura em nuvem', desc: 'Dados são armazenados no Google Firebase (Firestore e Storage), sob certificação SOC 2 e ISO 27001, com criptografia em repouso e em trânsito.' },
              { label: 'Obrigação legal',          desc: 'Mediante determinação judicial, requisição do CNJ ou de autoridade competente, os dados poderão ser fornecidos nos estritos termos legais.' },
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
          <p className="text-slate-200 text-sm leading-loose">
            Em conformidade com o Art. 18 da LGPD, o titular dos dados tem direito a:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: 'fa-eye',         label: 'Confirmação e Acesso', desc: 'Saber se seus dados são tratados e acessá-los'              },
              { icon: 'fa-pen',         label: 'Correção',             desc: 'Solicitar correção de dados incompletos ou desatualizados'  },
              { icon: 'fa-trash',       label: 'Eliminação',           desc: 'Solicitar exclusão dos dados desnecessários ao tratamento'  },
              { icon: 'fa-circle-info', label: 'Informação',           desc: 'Ser informado sobre compartilhamentos realizados'           },
            ].map((item, i) => (
              <div key={i} className="bg-[#0D1B3E] border border-[#C9A84C]/30 rounded-xl p-4 space-y-2 text-center">
                <i className={`fa-solid ${item.icon} text-emerald-400 text-lg`}></i>
                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">{item.label}</p>
                <p className="text-[9px] text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="bg-slate-900/50 border border-[#C9A84C]/30 rounded-xl p-4">
            <p className="text-xs text-slate-400 italic">
              <i className="fa-solid fa-circle-info text-slate-300 mr-2"></i>
              Como o tratamento tem base em <strong className="text-slate-500">execução de contrato</strong> (Art. 7º, V — LGPD), não se aplica o direito de revogação de consentimento nem portabilidade de dados, pois o uso da plataforma é determinado pela própria serventia no exercício de suas atividades.
            </p>
          </div>
          <p className="text-xs text-slate-400 italic">Para exercer seus direitos, entre em contato via módulo de Suporte Técnico.</p>
        </div>

        <div className="w-full h-px bg-slate-800/50"></div>

        {/* 7 */}
        <div className="space-y-4">
          <h3 className="text-lg font-black text-red-500 uppercase tracking-widest flex items-center gap-3">
            <i className="fa-solid fa-clock"></i> 7. Retenção e Exclusão de Dados
          </h3>
          <p className="text-slate-200 text-sm leading-loose text-justify">
            Os dados são retidos pelo período necessário para a prestação dos serviços contratados e cumprimento de obrigações legais. Logs de auditoria são mantidos por no mínimo <strong>5 anos</strong> conforme exigência do CNJ (Provimento 149 e Provimento 213/2026). Após o término do contrato, os dados são excluídos ou anonimizados em até 30 dias, salvo obrigação legal em contrário.
          </p>
        </div>

        <div className="bg-blue-500/5 border border-blue-500/20 rounded-3xl p-8 flex items-start gap-4">
          <i className="fa-solid fa-envelope text-blue-400 text-xl mt-1 flex-shrink-0"></i>
          <div>
            <p className="text-sm font-black text-white mb-1">Encarregado de Dados (DPO) — MJ Consultoria</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Para dúvidas, solicitações ou incidentes relacionados ao tratamento de dados pessoais, utilize o módulo de <strong className="text-blue-400">Suporte Técnico</strong> ou entre em contato diretamente com a equipe MJ Consultoria.
            </p>
            <p className="text-[9px] text-slate-300 mt-3">
              Última atualização: Fevereiro/2026 — Em conformidade com LGPD Lei nº 13.709/2018, Provimento CNJ nº 149 e Provimento CNJ nº 213/2026
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PrivacyView;