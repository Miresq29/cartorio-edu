import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { GeminiService } from '../../services/geminiService';

type Platform = 'linkedin' | 'instagram' | 'whatsapp' | 'email';
type Tone = 'formal' | 'informativo' | 'motivacional' | 'educativo' | 'comemorativo';

interface PlatformConfig {
  id: Platform;
  label: string;
  icon: string;
  color: string;
  charLimit: string;
}

interface ToneConfig {
  id: Tone;
  label: string;
  desc: string;
}

const PLATFORMS: PlatformConfig[] = [
  { id: 'linkedin',  label: 'LinkedIn',   icon: 'fa-linkedin',    color: 'blue',   charLimit: 'até 1300 chars' },
  { id: 'instagram', label: 'Instagram',  icon: 'fa-instagram',   color: 'pink',   charLimit: 'até 300 chars'  },
  { id: 'whatsapp',  label: 'WhatsApp',   icon: 'fa-whatsapp',    color: 'emerald', charLimit: 'mensagem curta' },
  { id: 'email',     label: 'E-mail',     icon: 'fa-envelope',    color: 'amber',  charLimit: 'assunto + corpo' },
];

const TONES: ToneConfig[] = [
  { id: 'formal',       label: 'Formal',       desc: 'Linguagem institucional e técnica'           },
  { id: 'informativo',  label: 'Informativo',   desc: 'Claro, direto e objetivo'                   },
  { id: 'motivacional', label: 'Motivacional',  desc: 'Engajador, inspira ação'                    },
  { id: 'educativo',    label: 'Educativo',     desc: 'Ensina, esclarece dúvidas comuns'           },
  { id: 'comemorativo', label: 'Comemorativo',  desc: 'Celebra conquistas e datas especiais'       },
];

const TOPIC_SUGGESTIONS = [
  'Novo provimento CNJ em vigor',
  'Prazo para registro de imóveis',
  'Autenticação de documentos digitais',
  'Escritura pública de divórcio consensual',
  'Dicas de segurança jurídica em negócios',
  'Abertura de novo horário de atendimento',
  'Certificação digital para cartórios',
  'Inventário extrajudicial: quando usar',
];

const CampanhasView: React.FC = () => {
  const { state } = useApp();
  const { showToast } = useToast();

  const [topic, setTopic] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['linkedin', 'whatsapp']);
  const [selectedTone, setSelectedTone] = useState<Tone>('informativo');
  const [additionalContext, setAdditionalContext] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [posts, setPosts] = useState<Record<string, string>>({});
  const [activePlatformTab, setActivePlatformTab] = useState<Platform | null>(null);
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null);

  const togglePlatform = (platform: Platform) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const generatePosts = async () => {
    if (!topic.trim()) { showToast('Informe o tema da campanha.', 'error'); return; }
    if (selectedPlatforms.length === 0) { showToast('Selecione ao menos uma plataforma.', 'error'); return; }

    setIsLoading(true);
    setPosts({});
    setActivePlatformTab(null);

    const context = `Cartório: ${state.user?.tenantId || 'MJ Consultoria'} | Operador: ${state.user?.name || 'Usuário'}`;
    try {
      const result = await GeminiService.generateCampaignPosts(
        topic,
        selectedPlatforms,
        selectedTone,
        additionalContext ? `${context} | ${additionalContext}` : context
      );
      if (Object.keys(result).length > 0) {
        setPosts(result);
        setActivePlatformTab(selectedPlatforms[0]);
        showToast('Posts gerados com sucesso!', 'success');
      } else {
        showToast('Não foi possível gerar os posts. Tente novamente.', 'error');
      }
    } catch (e: any) {
      showToast(e?.message || 'Erro ao gerar posts.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const copyPost = (platform: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPlatform(platform);
    showToast('Post copiado!', 'success');
    setTimeout(() => setCopiedPlatform(null), 2000);
  };

  const regenerate = () => {
    setPosts({});
    setActivePlatformTab(null);
    generatePosts();
  };

  const activePlatformConfig = PLATFORMS.find(p => p.id === activePlatformTab);

  return (
    <div className="p-8 space-y-6 bg-[#0D1B3E] min-h-screen animate-in fade-in">

      <header>
        <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
          Campanhas de <span className="text-pink-500">Comunicação</span>
        </h2>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">
          MJ Consultoria // Posts e Conteúdo para Redes Sociais com IA
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Painel de Configuração */}
        <div className="space-y-5">

          {/* Tema */}
          <div className="bg-[#1A2A52] border border-[#C9A84C]/30 rounded-[24px] p-5 space-y-3">
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              1. Tema da campanha
            </h4>
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="Ex: Novo prazo para registro de imóveis..."
              className="w-full bg-slate-900 border border-[#C9A84C]/30 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-pink-500 transition-colors"
            />
            {/* Sugestões rápidas */}
            <div className="space-y-1">
              <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">Sugestões:</p>
              <div className="flex flex-wrap gap-2">
                {TOPIC_SUGGESTIONS.map((s, i) => (
                  <button type="button" key={i} onClick={() => setTopic(s)}
                    className="text-[9px] bg-slate-900 hover:bg-slate-800 text-slate-500 hover:text-white px-3 py-1.5 rounded-lg font-bold transition-all border border-[#C9A84C]/30 hover:border-slate-600">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Plataformas */}
          <div className="bg-[#1A2A52] border border-[#C9A84C]/30 rounded-[24px] p-5 space-y-3">
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              2. Plataformas de destino
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {PLATFORMS.map(p => {
                const selected = selectedPlatforms.includes(p.id);
                return (
                  <button type="button" key={p.id} onClick={() => togglePlatform(p.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      selected
                        ? `border-${p.color}-500 bg-${p.color}-500/10`
                        : 'border-[#C9A84C]/30 hover:border-slate-600'
                    }`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      selected ? `bg-${p.color}-500/20` : 'bg-slate-800'
                    }`}>
                      <i className={`fa-brands ${p.icon} text-sm ${selected ? `text-${p.color}-400` : 'text-slate-400'}`}></i>
                    </div>
                    <div className="text-left">
                      <p className={`text-xs font-black ${selected ? `text-${p.color}-300` : 'text-slate-500'}`}>{p.label}</p>
                      <p className="text-[8px] text-slate-300">{p.charLimit}</p>
                    </div>
                    {selected && (
                      <div className={`ml-auto w-4 h-4 rounded-full bg-${p.color}-500 flex items-center justify-center flex-shrink-0`}>
                        <i className="fa-solid fa-check text-white text-[8px]"></i>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tom */}
          <div className="bg-[#1A2A52] border border-[#C9A84C]/30 rounded-[24px] p-5 space-y-3">
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              3. Tom da comunicação
            </h4>
            <div className="space-y-2">
              {TONES.map(t => (
                <button type="button" key={t.id} onClick={() => setSelectedTone(t.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    selectedTone === t.id
                      ? 'border-pink-500 bg-pink-500/10'
                      : 'border-[#C9A84C]/30 hover:border-slate-600'
                  }`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${selectedTone === t.id ? 'bg-pink-500' : 'bg-slate-700'}`}></div>
                  <div className="text-left">
                    <span className={`text-xs font-black ${selectedTone === t.id ? 'text-pink-300' : 'text-slate-200'}`}>{t.label}</span>
                    <span className="text-[9px] text-slate-400 ml-2">{t.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Contexto adicional */}
          <div className="bg-[#1A2A52] border border-[#C9A84C]/30 rounded-[24px] p-5 space-y-3">
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              4. Contexto adicional (opcional)
            </h4>
            <textarea
              value={additionalContext}
              onChange={e => setAdditionalContext(e.target.value)}
              placeholder="Ex: campanha do mês do consumidor, novo endereço, promoção de prazo..."
              rows={3}
              className="w-full bg-slate-900 border border-[#C9A84C]/30 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-pink-500 resize-none transition-colors"
            />
          </div>

          {/* Botão gerar */}
          <button type="button" onClick={generatePosts} disabled={isLoading || !topic.trim() || selectedPlatforms.length === 0}
            className="w-full bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3">
            {isLoading
              ? <><i className="fa-solid fa-circle-notch animate-spin"></i>Gerando posts...</>
              : <><i className="fa-solid fa-wand-magic-sparkles"></i>Gerar Posts com IA</>
            }
          </button>
        </div>

        {/* Resultado */}
        <div className="bg-[#1A2A52] border border-[#C9A84C]/30 rounded-[24px] overflow-hidden flex flex-col min-h-[600px]">

          {/* Tabs dos resultados */}
          {Object.keys(posts).length > 0 && (
            <div className="flex border-b border-[#C9A84C]/30 overflow-x-auto">
              {selectedPlatforms.filter(p => posts[p]).map(platformId => {
                const platformConf = PLATFORMS.find(p => p.id === platformId)!;
                return (
                  <button type="button" key={platformId} onClick={() => setActivePlatformTab(platformId)}
                    className={`flex items-center gap-2 px-5 py-3 text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border-b-2 ${
                      activePlatformTab === platformId
                        ? `text-${platformConf.color}-400 border-${platformConf.color}-500 bg-${platformConf.color}-500/5`
                        : 'text-slate-400 border-transparent hover:text-slate-200'
                    }`}>
                    <i className={`fa-brands ${platformConf.icon} text-xs`}></i>
                    {platformConf.label}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex-1 p-6 flex flex-col">
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="relative w-16 h-16 mx-auto">
                    <i className="fa-solid fa-circle-notch animate-spin text-pink-500 text-4xl"></i>
                  </div>
                  <p className="text-sm text-slate-500 font-bold">Criando posts personalizados...</p>
                  <p className="text-[10px] text-slate-300 uppercase tracking-widest">
                    {selectedPlatforms.length} plataforma{selectedPlatforms.length > 1 ? 's' : ''} selecionada{selectedPlatforms.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            ) : Object.keys(posts).length > 0 && activePlatformTab && posts[activePlatformTab] ? (
              <div className="flex-1 flex flex-col gap-4">
                {/* Header do resultado */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <i className={`fa-brands ${activePlatformConfig?.icon} text-${activePlatformConfig?.color}-400`}></i>
                    <span className="text-xs font-black text-white">{activePlatformConfig?.label}</span>
                    <span className="text-[9px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-lg">
                      {posts[activePlatformTab].length} chars
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={regenerate} disabled={isLoading}
                      className="text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg font-black uppercase tracking-widest transition-all">
                      <i className="fa-solid fa-rotate mr-1"></i>Regenerar
                    </button>
                    <button type="button" onClick={() => copyPost(activePlatformTab, posts[activePlatformTab])}
                      className={`text-[9px] px-3 py-1.5 rounded-lg font-black uppercase tracking-widest transition-all ${
                        copiedPlatform === activePlatformTab
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      }`}>
                      <i className={`fa-solid ${copiedPlatform === activePlatformTab ? 'fa-check' : 'fa-copy'} mr-1`}></i>
                      {copiedPlatform === activePlatformTab ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>

                {/* Conteúdo do post */}
                <div className="flex-1 bg-slate-900/50 border border-[#C9A84C]/30 rounded-2xl p-5 overflow-y-auto custom-scrollbar">
                  <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{posts[activePlatformTab]}</p>
                </div>

                {/* Copiar todos */}
                {Object.keys(posts).length > 1 && (
                  <div className="flex flex-wrap gap-2">
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest w-full">Copiar por plataforma:</p>
                    {selectedPlatforms.filter(p => posts[p]).map(platformId => {
                      const pConf = PLATFORMS.find(p => p.id === platformId)!;
                      return (
                        <button type="button" key={platformId}
                          onClick={() => copyPost(platformId, posts[platformId])}
                          className={`flex items-center gap-1.5 text-[9px] px-3 py-1.5 rounded-lg font-black uppercase tracking-widest transition-all border ${
                            copiedPlatform === platformId
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : `border-${pConf.color}-500/30 text-${pConf.color}-400 hover:bg-${pConf.color}-500/10`
                          }`}>
                          <i className={`fa-brands ${pConf.icon} text-[10px]`}></i>
                          {copiedPlatform === platformId ? 'Copiado!' : pConf.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30 space-y-4">
                <i className="fa-solid fa-bullhorn text-6xl text-slate-300"></i>
                <div>
                  <p className="text-slate-500 text-sm font-black uppercase tracking-widest">Seus posts aparecerão aqui</p>
                  <p className="text-slate-300 text-[10px] mt-1">Configure o tema, plataformas e tom ao lado</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampanhasView;
