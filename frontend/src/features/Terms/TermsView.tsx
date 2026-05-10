import React from 'react';

const TermsView: React.FC = () => {
  return (
    <div className="p-12 max-w-5xl mx-auto space-y-10 animate-in fade-in duration-700 pb-20">
      <header className="space-y-4">
        <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-500 border border-slate-200 shadow-xl">
          <i className="fa-solid fa-file-contract text-3xl"></i>
        </div>
        <h2 className="text-3xl font-black text-[#0A1628] italic uppercase tracking-tighter">Termos de Uso & Privacidade</h2>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">
          Políticas de Utilização do CartórioRAG PRO v3.0
        </p>
      </header>

      <div className="bg-white border border-slate-200 rounded-[40px] p-12 space-y-10 shadow-2xl">

        <div className="space-y-4">
          <h3 className="text-xl font-black text-blue-500 uppercase tracking-widest flex items-center gap-3">
            <i className="fa-solid fa-robot text-2xl"></i> 1. Uso de Inteligência Artificial
          </h3>
          <p className="text-slate-600 text-base leading-loose text-justify">
            O <strong>CartórioRAG PRO</strong> utiliza modelos de linguagem avançados (LLMs) para auxiliar na análise documental e consulta jurídica.
            É importante ressaltar que a IA atua como uma <em>ferramenta de apoio</em> e não substitui, em hipótese alguma, a análise técnica, a fé pública e a decisão final do Tabelião ou Oficial Registrador.
            O sistema pode apresentar imprecisões ("alucinações") e todas as sugestões devem ser validadas pelo operador humano competente.
          </p>
        </div>

        <div className="w-full h-px bg-slate-200"></div>

        <div className="space-y-4">
          <h3 className="text-xl font-black text-emerald-500 uppercase tracking-widest flex items-center gap-3">
            <i className="fa-solid fa-lock text-2xl"></i> 2. Privacidade e Proteção de Dados (LGPD)
          </h3>
          <p className="text-slate-600 text-base leading-loose text-justify">
            Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), este sistema implementa medidas de segurança robustas.
            Os dados inseridos na plataforma são processados em ambiente seguro. Documentos submetidos para análise via IA podem ser processados temporariamente por provedores de nuvem parceiros (ex: Google Cloud Platform), sob estritos acordos de confidencialidade Enterprise.
            É vedado o uso da plataforma para processar dados sensíveis fora do escopo necessário para a prática do ato notarial ou registral.
          </p>
        </div>

        <div className="w-full h-px bg-slate-200"></div>

        <div className="space-y-4">
          <h3 className="text-xl font-black text-purple-500 uppercase tracking-widest flex items-center gap-3">
            <i className="fa-solid fa-scale-balanced text-2xl"></i> 3. Conformidade com Provimentos CNJ
          </h3>
          <p className="text-slate-600 text-base leading-loose text-justify">
            A plataforma foi desenvolvida em observância aos Provimentos CNJ nº 212 e 213/2026, que estabelecem os padrões de tecnologia e segurança para os serviços notariais e de registro. 
            A MJ Consultoria atua como prestadora de serviços de suporte tecnológico e consultoria regulatória, auxiliando as serventias na adequação às normas vigentes do Conselho Nacional de Justiça.
          </p>
        </div>

        <div className="w-full h-px bg-slate-200"></div>

        <div className="space-y-4">
          <h3 className="text-xl font-black text-amber-500 uppercase tracking-widest flex items-center gap-3">
            <i className="fa-solid fa-triangle-exclamation text-2xl"></i> 4. Limitação de Responsabilidade
          </h3>
          <p className="text-slate-600 text-base leading-loose text-justify">
            Os desenvolvedores do CartórioRAG PRO não se responsabilizam por quaisquer danos diretos, indiretos, incidentais ou consequenciais resultantes do uso da plataforma.
            O sistema caracteriza-se estritamente como uma <strong>ferramenta tecnológica de suporte e otimização de serviços</strong>, não detendo fé pública.
            A responsabilidade jurídica final sobre a qualificação registral, lavratura de escrituras, atas e demais atos praticados permanece <strong>exclusiva da serventia</strong>, cabendo ao Tabelião ou Oficial titular a validação de todas as minutas e sugestões geradas pela inteligência artificial.
          </p>
        </div>

        <div className="w-full h-px bg-slate-200"></div>

        <div className="space-y-4">
          <h3 className="text-xl font-black text-red-500 uppercase tracking-widest flex items-center gap-3">
            <i className="fa-solid fa-shield-halved text-2xl"></i> 5. Segurança e Auditoria
          </h3>
          <p className="text-slate-600 text-base leading-loose text-justify">
            Todas as ações realizadas na plataforma são registradas em logs de auditoria com identificação do usuário, data, hora e natureza da operação.
            O acesso é controlado por perfis de permissão (SUPERADMIN, Gestor, Auditor, Atendente) e todas as senhas são armazenadas com hash criptográfico.
            A plataforma implementa bloqueio automático após tentativas consecutivas de acesso indevido.
          </p>
        </div>

        <div className="bg-blue-500/5 border border-blue-500/20 rounded-3xl p-8 mt-8 flex items-start gap-4">
          <i className="fa-solid fa-circle-info text-blue-400 text-xl mt-1 flex-shrink-0"></i>
          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            Ao utilizar este sistema, você concorda com todos os termos acima descritos. 
            Em caso de dúvidas, entre em contato com a MJ Consultoria pelo módulo de <strong className="text-blue-400">Suporte Técnico</strong>.
            <br /><span className="text-slate-600 text-xs mt-2 block">Última atualização: Fevereiro/2026 — CartórioRAG PRO v3.0</span>
          </p>
        </div>

      </div>
    </div>
  );
};

export default TermsView;