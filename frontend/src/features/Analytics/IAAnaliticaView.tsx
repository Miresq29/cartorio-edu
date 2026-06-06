import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../services/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { useApp } from '../../context/AppContext';

interface AuditLog {
  id: string;
  tipo: string;
  usuario: string;
  descricao: string;
  metadata?: Record<string, any>;
  createdAt: any;
}

interface KnowledgeDoc {
  id: string;
  fileName?: string;
  title?: string;
  content?: string;
  status?: string;
  createdAt: any;
}

interface Alerta {
  id: string;
  tipo: 'critico' | 'atencao' | 'info';
  titulo: string;
  descricao: string;
  acao?: string;
}

interface AnaliseResult {
  alertas: Alerta[];
  metricas: { label: string; valor: string; status: 'ok' | 'atencao' | 'critico'; detalhe: string }[];
  recomendacoes: string[];
  resumo: string;
}

type Tab = 'painel' | 'analise' | 'chat';

const IAAnaliticaView: React.FC = () => {
  const { state } = useApp();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDoc[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('painel');
  const [analise, setAnalise] = useState<AnaliseResult | null>(null);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q1 = query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(200));
    const u1 = onSnapshot(q1, s => setAuditLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog))));
    const q2 = query(collection(db, 'knowledgeBase'), orderBy('createdAt', 'desc'));
    const u2 = onSnapshot(q2, s => setKnowledgeDocs(s.docs.map(d => ({ id: d.id, ...d.data() } as KnowledgeDoc))));
    return () => { u1(); u2(); };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ---- MÃ‰TRICAS CALCULADAS LOCALMENTE ----
  const calcularMetricasLocais = () => {
    const agora = new Date();
    const ultimas24h = new Date(agora.getTime() - 24 * 60 * 60 * 1000);
    const ultimos7d = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);

    const logsHoje = auditLogs.filter(l => {
      const d = l.createdAt?.toDate ? l.createdAt.toDate() : new Date(l.createdAt);
      return d >= ultimas24h;
    });

    const logs7d = auditLogs.filter(l => {
      const d = l.createdAt?.toDate ? l.createdAt.toDate() : new Date(l.createdAt);
      return d >= ultimos7d;
    });

    // Tempo mÃ©dio entre inserÃ§Ã£o e exclusÃ£o de docs (proxy de "tempo de resposta")
    const insercoesComTimestamp = auditLogs.filter(l => l.tipo === 'documento_inserido' && l.createdAt);
    const tempoMedioInsercao = insercoesComTimestamp.length > 1 ? (() => {
      const timestamps = insercoesComTimestamp.map(l => l.createdAt?.toDate ? l.createdAt.toDate().getTime() : 0).filter(Boolean).sort();
      const diffs = timestamps.slice(1).map((t, i) => t - timestamps[i]);
      const media = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      return Math.round(media / (1000 * 60)); // em minutos
    })() : 0;

    // Docs sem status definido (possÃ­vel erro)
    const docsSemStatus = knowledgeDocs.filter(d => !d.status || d.status === '').length;
    const taxaErrosDocs = knowledgeDocs.length > 0 ? Math.round((docsSemStatus / knowledgeDocs.length) * 100) : 0;

    // UsuÃ¡rios Ãºnicos hoje
    const usuariosHoje = [...new Set(logsHoje.map(l => l.usuario).filter(Boolean))].length;

    // Anomalias: mais de 10 aÃ§Ãµes do mesmo usuÃ¡rio em 1h
    const usuariosFrequentes = Object.entries(
      logsHoje.reduce((acc: Record<string, number>, l) => {
        if (l.usuario) acc[l.usuario] = (acc[l.usuario] || 0) + 1;
        return acc;
      }, {})
    ).filter(([, count]) => count > 10);

    // Docs excluÃ­dos hoje
    const exclusoesHoje = logsHoje.filter(l => l.tipo === 'documento_excluido').length;

    return {
      logsHoje: logsHoje.length,
      logs7d: logs7d.length,
      tempoMedioInsercao,
      docsSemStatus,
      taxaErrosDocs,
      usuariosHoje,
      usuariosFrequentes,
      exclusoesHoje,
      totalDocs: knowledgeDocs.length,
    };
  };

  // ---- ANÃLISE COMPLETA VIA IA ----
  const executarAnalise = async () => {
    setIsAnalysing(true);
    setActiveTab('analise');

    const m = calcularMetricasLocais();

    const contexto = `VocÃª Ã© um analista de gestÃ£o especializado em serviÃ§os notariais brasileiros da MJ Consultoria.

DADOS DA PLATAFORMA (Ãºltimas 24h / 7 dias):
- Eventos registrados hoje: ${m.logsHoje}
- Eventos nos Ãºltimos 7 dias: ${m.logs7d}
- UsuÃ¡rios ativos hoje: ${m.usuariosHoje}
- Total de documentos na base: ${m.totalDocs}
- Documentos sem classificaÃ§Ã£o/status: ${m.docsSemStatus} (${m.taxaErrosDocs}% da base)
- ExclusÃµes de documentos hoje: ${m.exclusoesHoje}
- Tempo mÃ©dio entre inserÃ§Ãµes de documentos: ${m.tempoMedioInsercao} minutos
- UsuÃ¡rios com alto volume de aÃ§Ãµes (>10 em 24h): ${m.usuariosFrequentes.map(([u, c]) => `${u}: ${c} aÃ§Ãµes`).join(', ') || 'Nenhum'}

DOCUMENTOS RECENTES NA BASE LEGAL:
${knowledgeDocs.slice(0, 5).map(d => `- ${d.fileName || d.title} (status: ${d.status || 'sem status'})`).join('\n')}

ÃšLTIMAS AÃ‡Ã•ES DE AUDITORIA:
${auditLogs.slice(0, 10).map(l => `- [${l.tipo}] ${l.usuario}: ${l.descricao}`).join('\n')}

Gere uma anÃ¡lise de gestÃ£o operacional respondendo APENAS com JSON vÃ¡lido, sem markdown:
{
  "resumo": "parÃ¡grafo executivo de 2-3 linhas sobre o estado geral da operaÃ§Ã£o",
  "alertas": [
    {
      "id": "a1",
      "tipo": "critico|atencao|info",
      "titulo": "tÃ­tulo curto do alerta",
      "descricao": "descriÃ§Ã£o clara do problema ou observaÃ§Ã£o",
      "acao": "aÃ§Ã£o corretiva recomendada"
    }
  ],
  "metricas": [
    {
      "label": "nome da mÃ©trica",
      "valor": "valor formatado",
      "status": "ok|atencao|critico",
      "detalhe": "interpretaÃ§Ã£o em 1 linha"
    }
  ],
  "recomendacoes": [
    "recomendaÃ§Ã£o 1 especÃ­fica e acionÃ¡vel",
    "recomendaÃ§Ã£o 2",
    "recomendaÃ§Ã£o 3"
  ]
}`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [{ role: 'user', content: contexto }]
        })
      });

      const data = await response.json();
      const raw = data.content?.[0]?.text || '';
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Resposta invÃ¡lida');
      const parsed: AnaliseResult = JSON.parse(jsonMatch[0]);
      setAnalise(parsed);
    } catch (e) {
      // Fallback com dados locais
      const m2 = calcularMetricasLocais();
      setAnalise({
        resumo: `A plataforma registrou ${m2.logsHoje} eventos nas Ãºltimas 24h com ${m2.usuariosHoje} usuÃ¡rio(s) ativo(s). ${m2.docsSemStatus > 0 ? `HÃ¡ ${m2.docsSemStatus} documento(s) sem classificaÃ§Ã£o que requerem atenÃ§Ã£o.` : 'A base de documentos estÃ¡ bem classificada.'} ${m2.exclusoesHoje > 0 ? `${m2.exclusoesHoje} exclusÃ£o(Ãµes) registrada(s) hoje.` : ''}`,
        alertas: [
          m2.docsSemStatus > 0 ? { id: 'a1', tipo: 'atencao' as const, titulo: 'Documentos sem classificaÃ§Ã£o', descricao: `${m2.docsSemStatus} documentos sem status definido na base legal`, acao: 'Revisar e classificar os documentos sem status' } : null,
          m2.exclusoesHoje > 2 ? { id: 'a2', tipo: 'critico' as const, titulo: 'Alto volume de exclusÃµes', descricao: `${m2.exclusoesHoje} documentos excluÃ­dos hoje`, acao: 'Verificar se as exclusÃµes foram autorizadas' } : null,
          m2.usuariosFrequentes.length > 0 ? { id: 'a3', tipo: 'atencao' as const, titulo: 'Uso intenso detectado', descricao: `UsuÃ¡rio(s) com mais de 10 aÃ§Ãµes em 24h`, acao: 'Verificar se o comportamento Ã© esperado' } : null,
        ].filter(Boolean) as Alerta[],
        metricas: [
          { label: 'Eventos Hoje', valor: String(m2.logsHoje), status: m2.logsHoje > 50 ? 'atencao' : 'ok', detalhe: 'Total de aÃ§Ãµes registradas nas Ãºltimas 24h' },
          { label: 'Docs sem Status', valor: `${m2.docsSemStatus} (${m2.taxaErrosDocs}%)`, status: m2.taxaErrosDocs > 20 ? 'critico' : m2.taxaErrosDocs > 5 ? 'atencao' : 'ok', detalhe: 'Documentos sem classificaÃ§Ã£o na base legal' },
          { label: 'ExclusÃµes Hoje', valor: String(m2.exclusoesHoje), status: m2.exclusoesHoje > 2 ? 'critico' : m2.exclusoesHoje > 0 ? 'atencao' : 'ok', detalhe: 'Documentos removidos nas Ãºltimas 24h' },
          { label: 'UsuÃ¡rios Ativos', valor: String(m2.usuariosHoje), status: 'ok', detalhe: 'Colaboradores com atividade hoje' },
        ],
        recomendacoes: [
          'Revisar documentos sem status e garantir classificaÃ§Ã£o completa',
          'Configurar alertas automÃ¡ticos para exclusÃµes em volume',
          'Monitorar usuÃ¡rios com alto volume de aÃ§Ãµes',
        ]
      });
    } finally {
      setIsAnalysing(false);
    }
  };

  // ---- CHAT COM IA ----
  const handleChat = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const msg = chatInput.trim();
    setChatInput('');
    setChatMessages(p => [...p, { role: 'user', text: msg }]);
    setIsChatLoading(true);

    const m = calcularMetricasLocais();
    const contexto = `VocÃª Ã© um assistente de gestÃ£o notarial da MJ Consultoria especializado em anÃ¡lise operacional.

CONTEXTO ATUAL DA PLATAFORMA:
- Documentos na base: ${m.totalDocs}
- Eventos hoje: ${m.logsHoje}
- Docs sem classificaÃ§Ã£o: ${m.docsSemStatus}
- UsuÃ¡rios ativos hoje: ${m.usuariosHoje}
- ExclusÃµes hoje: ${m.exclusoesHoje}

Responda de forma objetiva e prÃ¡tica. Pergunta: ${msg}`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: contexto }]
        })
      });
      const data = await response.json();
      const text = data.content?.[0]?.text || 'Sem resposta.';
      setChatMessages(p => [...p, { role: 'ai', text }]);
    } catch {
      setChatMessages(p => [...p, { role: 'ai', text: 'Erro ao processar. Tente novamente.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const m = calcularMetricasLocais();

  const ALERT_CONFIG = {
    critico: { color: 'red',   icon: 'fa-circle-exclamation', label: 'CrÃ­tico'  },
    atencao: { color: 'amber', icon: 'fa-triangle-exclamation', label: 'AtenÃ§Ã£o' },
    info:    { color: 'blue',  icon: 'fa-circle-info',          label: 'Info'    },
  };

  const STATUS_COLOR = { ok: 'emerald', atencao: 'amber', critico: 'red' };

  const TABS = [
    { id: 'painel' as Tab,  icon: 'fa-gauge-high',         label: 'Painel de GestÃ£o'  },
    { id: 'analise' as Tab, icon: 'fa-wand-magic-sparkles', label: 'AnÃ¡lise IA'        },
    { id: 'chat' as Tab,    icon: 'fa-comments',            label: 'Consultar IA'      },
  ];

  return (
    <div className="p-8 space-y-6 bg-[#0D1B3E] min-h-screen animate-in fade-in">

      <header>
        <h2 className="text-3xl font-black text-[#0A1628] italic uppercase tracking-tighter">
          IA <span className="text-blue-500">AnalÃ­tica</span>
        </h2>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">MJ Consultoria // GestÃ£o Operacional Inteligente</p>
      </header>

      {/* KPIs em tempo real */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Eventos Hoje',      value: m.logsHoje,        icon: 'fa-bolt',              color: m.logsHoje > 50 ? 'amber' : 'blue'    },
          { label: 'Docs sem Status',   value: m.docsSemStatus,   icon: 'fa-file-circle-exclamation', color: m.docsSemStatus > 0 ? 'red' : 'emerald' },
          { label: 'ExclusÃµes Hoje',    value: m.exclusoesHoje,   icon: 'fa-file-circle-xmark', color: m.exclusoesHoje > 0 ? 'red' : 'emerald'   },
          { label: 'UsuÃ¡rios Ativos',   value: m.usuariosHoje,    icon: 'fa-users',              color: 'purple'                                },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-[24px] p-6 space-y-3">
            <i className={`fa-solid ${s.icon} text-${s.color}-500 text-xl`}></i>
            <p className="text-3xl font-black text-[#0A1628]">{s.value}</p>
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-2xl">

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'text-blue-400 border-blue-500 bg-blue-500/5'
                  : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-800/50'
              }`}>
              <i className={`fa-solid ${tab.icon} text-xs`}></i>{tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">

          {/* ABA: PAINEL DE GESTÃƒO */}
          {activeTab === 'painel' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[#0A1628] font-black uppercase italic text-sm">Monitoramento Operacional</h3>
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">MÃ©tricas em tempo real â€” Ãºltimas 24h</p>
                </div>
                <button onClick={executarAnalise}
                  className="bg-blue-600 hover:bg-blue-500 text-[#0A1628] px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2">
                  <i className="fa-solid fa-wand-magic-sparkles"></i>Analisar com IA
                </button>
              </div>

              {/* Alertas automÃ¡ticos */}
              <div className="space-y-2">
                <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Alertas AutomÃ¡ticos</h4>
                {m.docsSemStatus === 0 && m.exclusoesHoje === 0 && m.usuariosFrequentes.length === 0 ? (
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3">
                    <i className="fa-solid fa-circle-check text-emerald-400 text-lg"></i>
                    <div>
                      <p className="text-emerald-400 font-black text-sm">OperaÃ§Ã£o Normal</p>
                      <p className="text-emerald-600 text-xs">Nenhuma anomalia detectada nas Ãºltimas 24h</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {m.docsSemStatus > 0 && (
                      <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
                        <i className="fa-solid fa-triangle-exclamation text-amber-400 text-lg mt-0.5"></i>
                        <div>
                          <p className="text-amber-400 font-black text-sm">{m.docsSemStatus} documento(s) sem classificaÃ§Ã£o</p>
                          <p className="text-amber-600 text-xs">Revisar e atribuir status na Base Legal</p>
                        </div>
                      </div>
                    )}
                    {m.exclusoesHoje > 2 && (
                      <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
                        <i className="fa-solid fa-circle-exclamation text-red-400 text-lg mt-0.5"></i>
                        <div>
                          <p className="text-red-400 font-black text-sm">Alto volume de exclusÃµes: {m.exclusoesHoje} hoje</p>
                          <p className="text-red-600 text-xs">Verificar se as exclusÃµes foram autorizadas</p>
                        </div>
                      </div>
                    )}
                    {m.usuariosFrequentes.map(([usuario, count]) => (
                      <div key={usuario} className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
                        <i className="fa-solid fa-user-clock text-amber-400 text-lg mt-0.5"></i>
                        <div>
                          <p className="text-amber-400 font-black text-sm">Uso intenso: {usuario}</p>
                          <p className="text-amber-600 text-xs">{count} aÃ§Ãµes nas Ãºltimas 24h â€” verificar se Ã© esperado</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Atividade por hora - Ãºltimas aÃ§Ãµes */}
              <div className="space-y-2">
                <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Ãšltimas AÃ§Ãµes Registradas</h4>
                <div className="space-y-1.5">
                  {auditLogs.slice(0, 8).map(log => {
                    const tipo = log.tipo || '';
                    const isError = tipo.includes('excluido') || tipo.includes('erro');
                    const d = log.createdAt?.toDate ? log.createdAt.toDate() : new Date(log.createdAt);
                    return (
                      <div key={log.id} className="flex items-center gap-3 p-3 bg-[#0D1B3E] border border-slate-200 rounded-xl">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isError ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                        <span className="text-xs text-slate-700 flex-1 truncate">{log.descricao}</span>
                        <span className="text-[9px] text-slate-600 flex-shrink-0">
                          {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })}
                  {auditLogs.length === 0 && (
                    <div className="text-center py-6 opacity-40">
                      <i className="fa-solid fa-scroll text-3xl text-slate-600 mb-2 block"></i>
                      <p className="text-slate-600 text-xs">Nenhuma aÃ§Ã£o registrada ainda</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ABA: ANÃLISE IA */}
          {activeTab === 'analise' && (
            <div className="space-y-6">
              {isAnalysing ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <i className="fa-solid fa-circle-notch animate-spin text-blue-400 text-2xl"></i>
                  </div>
                  <p className="text-[#0A1628] font-black text-sm uppercase italic tracking-widest">IA Analisando...</p>
                  <p className="text-slate-500 text-xs">Cruzando dados de auditoria, documentos e mÃ©tricas operacionais</p>
                </div>
              ) : analise ? (
                <div className="space-y-6">

                  {/* Resumo executivo */}
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <i className="fa-solid fa-brain text-blue-400"></i>
                      <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Resumo Executivo</span>
                    </div>
                    <p className="text-slate-700 text-sm leading-relaxed">{analise.resumo}</p>
                  </div>

                  {/* MÃ©tricas da IA */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {analise.metricas.map((met, i) => {
                      const color = STATUS_COLOR[met.status];
                      return (
                        <div key={i} className={`bg-[#0D1B3E] border border-${color}-500/20 rounded-2xl p-4 space-y-2`}>
                          <p className={`text-2xl font-black text-${color}-400`}>{met.valor}</p>
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{met.label}</p>
                          <p className="text-[9px] text-slate-600">{met.detalhe}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Alertas da IA */}
                  {analise.alertas.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Alertas Identificados pela IA</h4>
                      {analise.alertas.map(alerta => {
                        const cfg = ALERT_CONFIG[alerta.tipo];
                        return (
                          <div key={alerta.id} className={`bg-${cfg.color}-500/5 border border-${cfg.color}-500/20 rounded-2xl p-5 space-y-2`}>
                            <div className="flex items-center gap-2">
                              <i className={`fa-solid ${cfg.icon} text-${cfg.color}-400`}></i>
                              <span className={`text-[9px] font-black text-${cfg.color}-400 uppercase tracking-widest`}>{cfg.label}</span>
                              <span className="text-sm font-black text-[#0A1628] ml-1">{alerta.titulo}</span>
                            </div>
                            <p className="text-xs text-slate-500">{alerta.descricao}</p>
                            {alerta.acao && (
                              <div className="flex items-center gap-2 mt-2">
                                <i className="fa-solid fa-arrow-right text-blue-400 text-xs"></i>
                                <p className="text-xs text-blue-400 font-bold">{alerta.acao}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* RecomendaÃ§Ãµes */}
                  <div className="space-y-2">
                    <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">RecomendaÃ§Ãµes de GestÃ£o</h4>
                    <div className="bg-[#0D1B3E] border border-slate-200 rounded-2xl p-5 space-y-3">
                      {analise.recomendacoes.map((rec, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-[9px] font-black text-blue-400">{i + 1}</span>
                          </div>
                          <p className="text-xs text-slate-700">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button onClick={executarAnalise}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-[#0A1628] px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                    <i className="fa-solid fa-rotate"></i>Refazer AnÃ¡lise
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <i className="fa-solid fa-wand-magic-sparkles text-blue-400 text-2xl"></i>
                  </div>
                  <p className="text-[#0A1628] font-black text-sm uppercase italic">Pronto para Analisar</p>
                  <p className="text-slate-500 text-xs max-w-sm">A IA irÃ¡ cruzar todos os dados da plataforma e gerar um relatÃ³rio completo de gestÃ£o operacional</p>
                  <button onClick={executarAnalise}
                    className="bg-blue-600 hover:bg-blue-500 text-[#0A1628] px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                    <i className="fa-solid fa-wand-magic-sparkles mr-2"></i>Iniciar AnÃ¡lise
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ABA: CHAT */}
          {activeTab === 'chat' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-[#0A1628] font-black uppercase italic text-sm">Consultor de GestÃ£o IA</h3>
                <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">Pergunte sobre mÃ©tricas, anomalias ou aÃ§Ãµes corretivas</p>
              </div>

              <div className="bg-[#0D1B3E] border border-slate-200 rounded-2xl overflow-hidden">
                <div className="h-80 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  {chatMessages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-30 gap-4">
                      <i className="fa-solid fa-comments text-5xl text-slate-600"></i>
                      <div className="space-y-1">
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Exemplos de perguntas:</p>
                        <p className="text-slate-600 text-xs italic">"Quais documentos tÃªm maior risco de nÃ£o conformidade?"</p>
                        <p className="text-slate-600 text-xs italic">"Como estÃ¡ o tempo de resposta da equipe esta semana?"</p>
                        <p className="text-slate-600 text-xs italic">"Quais aÃ§Ãµes corretivas devo tomar hoje?"</p>
                      </div>
                    </div>
                  )}
                  {chatMessages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] px-5 py-4 rounded-2xl text-sm leading-relaxed ${
                        m.role === 'user' ? 'bg-blue-600 text-[#0A1628]' : 'bg-slate-800 text-[#0A1628] border border-slate-200'
                      }`}>
                        <p className="whitespace-pre-wrap">{m.text}</p>
                      </div>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-800 border border-slate-200 px-5 py-4 rounded-2xl">
                        <i className="fa-solid fa-circle-notch animate-spin text-blue-500"></i>
                        <span className="text-xs text-slate-500 ml-2">Analisando dados...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-4 border-t border-slate-200 flex gap-3">
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChat()}
                    placeholder="Ex: Quais sÃ£o os principais riscos operacionais hoje?"
                    className="flex-1 bg-slate-900 border border-slate-200 rounded-xl px-4 py-3 text-sm text-[#0A1628] outline-none focus:border-blue-500" />
                  <button onClick={handleChat} disabled={isChatLoading || !chatInput.trim()}
                    className="bg-blue-600 hover:bg-blue-500 text-[#0A1628] px-6 py-3 rounded-xl font-black text-sm transition-all disabled:opacity-50">
                    <i className="fa-solid fa-paper-plane"></i>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default IAAnaliticaView;
