import React from 'react';

const TermsView: React.FC = () => {
  return (
    <div className="p-12 max-w-5xl mx-auto space-y-10 animate-in fade-in duration-700 pb-20">
      <header className="space-y-4">
        <div className="w-16 h-16 bg-slate-800 rounded-3xl flex items-center justify-center text-slate-500 border border-slate-700 shadow-xl">
          <i className="fa-solid fa-file-contract text-3xl"></i>
        </div>
        <h2 className="text-3xl font-black text-[#0A1628] italic uppercase tracking-tighter">Termos de Uso & Privacidade</h2>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">
          PolÃ­ticas de UtilizaÃ§Ã£o do CartÃ³rioRAG PRO v3.0
        </p>
      </header>

      <div className="bg-[#0a0f1d] border border-slate-800 rounded-[40px] p-12 space-y-10 shadow-2xl">

        <div className="space-y-4">
          <h3 className="text-xl font-black text-blue-500 uppercase tracking-widest flex items-center gap-3">
            <i className="fa-solid fa-robot text-2xl"></i> 1. Uso de InteligÃªncia Artificial
          </h3>
          <p className="text-slate-600 text-base leading-loose text-justify">
            O <strong>CartÃ³rioRAG PRO</strong> utiliza modelos de linguagem avanÃ§ados (LLMs) para auxiliar na anÃ¡lise documental e consulta jurÃ­dica.
            Ã‰ importante ressaltar que a IA atua como uma <em>ferramenta de apoio</em> e nÃ£o substitui, em hipÃ³tese alguma, a anÃ¡lise tÃ©cnica, a fÃ© pÃºblica e a decisÃ£o final do TabeliÃ£o ou Oficial Registrador.
            O sistema pode apresentar imprecisÃµes ("alucinaÃ§Ãµes") e todas as sugestÃµes devem ser validadas pelo operador humano competente.
          </p>
        </div>

        <div className="w-full h-px bg-slate-800/50"></div>

        <div className="space-y-4">
          <h3 className="text-xl font-black text-emerald-500 uppercase tracking-widest flex items-center gap-3">
            <i className="fa-solid fa-lock text-2xl"></i> 2. Privacidade e ProteÃ§Ã£o de Dados (LGPD)
          </h3>
          <p className="text-slate-600 text-base leading-loose text-justify">
            Em conformidade com a Lei Geral de ProteÃ§Ã£o de Dados (Lei nÂº 13.709/2018), este sistema implementa medidas de seguranÃ§a robustas.
            Os dados inseridos na plataforma sÃ£o processados em ambiente seguro. Documentos submetidos para anÃ¡lise via IA podem ser processados temporariamente por provedores de nuvem parceiros (ex: Google Cloud Platform), sob estritos acordos de confidencialidade Enterprise.
            Ã‰ vedado o uso da plataforma para processar dados sensÃ­veis fora do escopo necessÃ¡rio para a prÃ¡tica do ato notarial ou registral.
          </p>
        </div>

        <div className="w-full h-px bg-slate-800/50"></div>

        <div className="space-y-4">
          <h3 className="text-xl font-black text-purple-500 uppercase tracking-widest flex items-center gap-3">
            <i className="fa-solid fa-scale-balanced text-2xl"></i> 3. Conformidade com Provimentos CNJ
          </h3>
          <p className="text-slate-600 text-base leading-loose text-justify">
            A plataforma foi desenvolvida em observÃ¢ncia aos Provimentos CNJ nÂº 212 e 213/2026, que estabelecem os padrÃµes de tecnologia e seguranÃ§a para os serviÃ§os notariais e de registro. 
            A MJ Consultoria atua como prestadora de serviÃ§os de suporte tecnolÃ³gico e consultoria regulatÃ³ria, auxiliando as serventias na adequaÃ§Ã£o Ã s normas vigentes do Conselho Nacional de JustiÃ§a.
          </p>
        </div>

        <div className="w-full h-px bg-slate-800/50"></div>

        <div className="space-y-4">
          <h3 className="text-xl font-black text-amber-500 uppercase tracking-widest flex items-center gap-3">
            <i className="fa-solid fa-triangle-exclamation text-2xl"></i> 4. LimitaÃ§Ã£o de Responsabilidade
          </h3>
          <p className="text-slate-600 text-base leading-loose text-justify">
            Os desenvolvedores do CartÃ³rioRAG PRO nÃ£o se responsabilizam por quaisquer danos diretos, indiretos, incidentais ou consequenciais resultantes do uso da plataforma.
            O sistema caracteriza-se estritamente como uma <strong>ferramenta tecnolÃ³gica de suporte e otimizaÃ§Ã£o de serviÃ§os</strong>, nÃ£o detendo fÃ© pÃºblica.
            A responsabilidade jurÃ­dica final sobre a qualificaÃ§Ã£o registral, lavratura de escrituras, atas e demais atos praticados permanece <strong>exclusiva da serventia</strong>, cabendo ao TabeliÃ£o ou Oficial titular a validaÃ§Ã£o de todas as minutas e sugestÃµes geradas pela inteligÃªncia artificial.
          </p>
        </div>

        <div className="w-full h-px bg-slate-800/50"></div>

        <div className="space-y-4">
          <h3 className="text-xl font-black text-red-500 uppercase tracking-widest flex items-center gap-3">
            <i className="fa-solid fa-shield-halved text-2xl"></i> 5. SeguranÃ§a e Auditoria
          </h3>
          <p className="text-slate-600 text-base leading-loose text-justify">
            Todas as aÃ§Ãµes realizadas na plataforma sÃ£o registradas em logs de auditoria com identificaÃ§Ã£o do usuÃ¡rio, data, hora e natureza da operaÃ§Ã£o.
            O acesso Ã© controlado por perfis de permissÃ£o (SUPERADMIN, Gestor, Auditor, Atendente) e todas as senhas sÃ£o armazenadas com hash criptogrÃ¡fico.
            A plataforma implementa bloqueio automÃ¡tico apÃ³s tentativas consecutivas de acesso indevido.
          </p>
        </div>

        <div className="bg-blue-500/5 border border-blue-500/20 rounded-3xl p-8 mt-8 flex items-start gap-4">
          <i className="fa-solid fa-circle-info text-blue-400 text-xl mt-1 flex-shrink-0"></i>
          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            Ao utilizar este sistema, vocÃª concorda com todos os termos acima descritos. 
            Em caso de dÃºvidas, entre em contato com a MJ Consultoria pelo mÃ³dulo de <strong className="text-blue-400">Suporte TÃ©cnico</strong>.
            <br /><span className="text-slate-600 text-xs mt-2 block">Ãšltima atualizaÃ§Ã£o: Fevereiro/2026 â€” CartÃ³rioRAG PRO v3.0</span>
          </p>
        </div>

      </div>
    </div>
  );
};

export default TermsView;
