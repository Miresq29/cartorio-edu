import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { db } from '../../services/firebase';
import { collection, onSnapshot, query, orderBy, where, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import VisibilidadeCartorioPicker from '../../components/VisibilidadeCartorioPicker';
import { GeminiService } from '../../services/geminiService';

interface Simulacao {
  id: string;
  titulo: string;
  tema: string;
  assuntoEmail: string;
  corpoEmail: string;
  tenantIds: string[];
  publicadoPorNome: string;
  criadoEm: any;
}

interface Clique {
  id: string;
  simId: string;
  clicado: boolean;
  clicadoEm: any;
  nome: string;
  email: string;
  cargo?: string;
  tema?: string;
}

interface PlanoAcao {
  id: string;
  texto: string;
  resumo: string;
  geradoPorNome: string;
  criadoEm: any;
}

const TEMAS = [
  'Engenharia Social Financeira',
  'Falsa Autoridade / Urgência',
  'Atualização Cadastral',
  'Documentos e Assinatura Eletrônica',
  'Convites e Calendário',
  'Curiosidade / Recompensa',
];

const TEMPLATES = [
  {
    label: 'Pendência de assinatura eletrônica',
    tema: 'Documentos e Assinatura Eletrônica',
    assuntoEmail: 'Ação necessária: documento pendente de assinatura eletrônica',
    corpoEmail: 'Olá {{NOME}},\n\nHá um documento pendente de assinatura eletrônica vinculado ao seu cadastro. Para regularizar, acesse o link a seguir e confirme sua identidade:\n\n{{LINK}}\n\nO prazo para regularização é de 24 horas.',
  },
  {
    label: 'Atualização cadastral urgente',
    tema: 'Atualização Cadastral',
    assuntoEmail: 'Seu cadastro precisa ser atualizado',
    corpoEmail: 'Olá {{NOME}},\n\nIdentificamos uma inconsistência no seu cadastro corporativo. Clique no link abaixo para atualizar seus dados e evitar o bloqueio do seu acesso:\n\n{{LINK}}',
  },
  {
    label: 'Convite para reunião (calendário)',
    tema: 'Convites e Calendário',
    assuntoEmail: 'Convite: reunião de alinhamento — confirme presença',
    corpoEmail: 'Olá {{NOME}},\n\nVocê foi convidado para uma reunião de alinhamento. Confirme sua presença clicando no link abaixo:\n\n{{LINK}}',
  },
  {
    label: 'Cobrança financeira falsa',
    tema: 'Engenharia Social Financeira',
    assuntoEmail: 'Fatura pendente — regularização necessária',
    corpoEmail: 'Olá {{NOME}},\n\nHá uma fatura vinculada ao seu setor com pagamento pendente. Para evitar cobrança de juros, acesse o link abaixo e confirme os dados:\n\n{{LINK}}',
  },
  {
    label: 'Ordem urgente da direção',
    tema: 'Falsa Autoridade / Urgência',
    assuntoEmail: 'Solicitação urgente da diretoria',
    corpoEmail: 'Olá {{NOME}},\n\nA diretoria solicita que você acesse o documento abaixo com urgência e responda ainda hoje:\n\n{{LINK}}',
  },
  {
    label: 'Prêmio ou sorteio',
    tema: 'Curiosidade / Recompensa',
    assuntoEmail: 'Você foi selecionado(a) para um reconhecimento interno',
    corpoEmail: 'Olá {{NOME}},\n\nVocê foi selecionado(a) para um reconhecimento especial. Confira os detalhes e confirme o recebimento no link abaixo:\n\n{{LINK}}',
  },
];

function pct(a: number, b: number) { return b === 0 ? 0 : Math.round((a / b) * 100); }

function getMonth(ts: any): string {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

const COLORS = ['#D97706', '#DC2626', '#4F46E5', '#059669', '#7C3AED', '#0891B2'];

const SimulacaoPhishingView: React.FC = () => {
  const { state, tenantId } = useApp();
  const { showToast } = useToast();
  const isSuperAdmin = state.user?.role === 'SUPERADMIN';
  const [tenantIdsForm, setTenantIdsForm] = useState<string[]>([tenantId]);

  const [tab, setTab] = useState<'simulacoes' | 'analises'>('simulacoes');
  const [simulacoes, setSimulacoes] = useState<Simulacao[]>([]);
  const [cliques, setCliques] = useState<Clique[]>([]);
  const [planos, setPlanos] = useState<PlanoAcao[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gerandoPlano, setGerandoPlano] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [form, setForm] = useState({ titulo: '', tema: TEMAS[0], assuntoEmail: '', corpoEmail: '' });
  const [phishingHabilitado, setPhishingHabilitado] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    return onSnapshot(doc(db, 'tenants', tenantId), snap => setPhishingHabilitado(!!snap.data()?.phishingHabilitado));
  }, [tenantId]);

  useEffect(() => {
    const q = query(collection(db, 'simulacoesPhishing'), where('tenantIds', 'array-contains-any', [tenantId, 'GLOBAL']), orderBy('criadoEm', 'desc'));
    return onSnapshot(q, s => setSimulacoes(s.docs.map(d => ({ id: d.id, ...d.data() } as Simulacao))));
  }, [tenantId]);

  useEffect(() => {
    const q = query(collection(db, 'simulacoesPhishingCliques'), where('tenantId', '==', tenantId));
    return onSnapshot(q, s => setCliques(s.docs.map(d => ({ id: d.id, ...d.data() } as Clique))));
  }, [tenantId]);

  useEffect(() => {
    const q = query(collection(db, 'planosAcaoPhishing'), where('tenantId', '==', tenantId), orderBy('criadoEm', 'desc'));
    return onSnapshot(q, s => setPlanos(s.docs.map(d => ({ id: d.id, ...d.data() } as PlanoAcao))));
  }, [tenantId]);

  const aplicarTemplate = (i: number) => {
    const t = TEMPLATES[i];
    setForm({ titulo: t.label, tema: t.tema, assuntoEmail: t.assuntoEmail, corpoEmail: t.corpoEmail });
  };

  const salvar = async () => {
    if (!isSuperAdmin && !phishingHabilitado) {
      showToast('Este recurso opcional não está habilitado para o seu cartório. Solicite a ativação à MJ Consultoria.', 'error'); return;
    }
    if (!form.titulo.trim() || !form.assuntoEmail.trim() || !form.corpoEmail.trim()) {
      showToast('Título, assunto e corpo do e-mail são obrigatórios.', 'error'); return;
    }
    if (!form.corpoEmail.includes('{{LINK}}')) {
      showToast('O corpo do e-mail precisa conter o marcador {{LINK}} — é onde o link rastreável será inserido.', 'error'); return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'simulacoesPhishing'), {
        ...form, tenantIds: isSuperAdmin ? tenantIdsForm : [tenantId],
        publicadoPor: state.user?.id || '', publicadoPorNome: state.user?.name || '',
        criadoEm: serverTimestamp(),
      });
      showToast('Simulação disparada! Os e-mails serão enviados em instantes.', 'success');
      setForm({ titulo: '', tema: TEMAS[0], assuntoEmail: '', corpoEmail: '' });
      setShowForm(false);
    } catch { showToast('Erro ao criar simulação.', 'error'); } finally { setLoading(false); }
  };

  const statsFor = (simId: string) => {
    const doc = cliques.filter(c => c.simId === simId);
    const enviados = doc.length;
    const clicados = doc.filter(c => c.clicado).length;
    const taxa = enviados ? Math.round((clicados / enviados) * 100) : 0;
    return { enviados, clicados, taxa, lista: doc.filter(c => c.clicado) };
  };

  // ─── Análises agregadas ────────────────────────────────────────────────────

  const porTema = useMemo(() => {
    const map: Record<string, { enviados: number; clicados: number }> = {};
    cliques.forEach(c => {
      const t = c.tema || 'Sem tema';
      if (!map[t]) map[t] = { enviados: 0, clicados: 0 };
      map[t].enviados++;
      if (c.clicado) map[t].clicados++;
    });
    return Object.entries(map).map(([tema, v]) => ({
      tema: tema.length > 22 ? tema.slice(0, 20) + '…' : tema,
      'Taxa de clique (%)': pct(v.clicados, v.enviados),
      enviados: v.enviados,
    })).sort((a, b) => b['Taxa de clique (%)'] - a['Taxa de clique (%)']);
  }, [cliques]);

  const porCargo = useMemo(() => {
    const map: Record<string, { enviados: number; clicados: number }> = {};
    cliques.forEach(c => {
      const cg = c.cargo || 'Não informado';
      if (!map[cg]) map[cg] = { enviados: 0, clicados: 0 };
      map[cg].enviados++;
      if (c.clicado) map[cg].clicados++;
    });
    return Object.entries(map).map(([cargo, v]) => ({
      cargo: cargo.length > 18 ? cargo.slice(0, 16) + '…' : cargo,
      'Taxa de clique (%)': pct(v.clicados, v.enviados),
      enviados: v.enviados,
    })).sort((a, b) => b['Taxa de clique (%)'] - a['Taxa de clique (%)']);
  }, [cliques]);

  const porMes = useMemo(() => {
    // Agrupa pela data de criação da simulação (mais estável que a data do clique, que pode nunca ocorrer)
    const bySim: Record<string, { mes: string; enviados: number; clicados: number }> = {};
    simulacoes.forEach(s => {
      const mes = getMonth(s.criadoEm);
      if (!mes) return;
      const st = statsFor(s.id);
      if (!bySim[mes]) bySim[mes] = { mes, enviados: 0, clicados: 0 };
      bySim[mes].enviados += st.enviados;
      bySim[mes].clicados += st.clicados;
    });
    return Object.values(bySim).slice(-6).map(v => ({
      mes: v.mes, 'Taxa de clique (%)': pct(v.clicados, v.enviados),
    }));
  }, [simulacoes, cliques]);

  const rankingRisco = useMemo(() => {
    const map: Record<string, { nome: string; email: string; cargo: string; cliques: number; envios: number }> = {};
    cliques.forEach(c => {
      const key = c.email;
      if (!map[key]) map[key] = { nome: c.nome, email: c.email, cargo: c.cargo || '–', cliques: 0, envios: 0 };
      map[key].envios++;
      if (c.clicado) map[key].cliques++;
    });
    return Object.values(map).filter(u => u.cliques > 0).sort((a, b) => b.cliques - a.cliques).slice(0, 15);
  }, [cliques]);

  const totalEnviados = cliques.length;
  const totalClicados = cliques.filter(c => c.clicado).length;
  const taxaGeral = pct(totalClicados, totalEnviados);

  const gerarPlanoDeAcao = async () => {
    if (totalEnviados === 0) { showToast('Ainda não há dados suficientes de simulações para gerar um plano de ação.', 'error'); return; }
    setGerandoPlano(true);
    try {
      const resumo = `Taxa geral de clique: ${taxaGeral}% (${totalClicados}/${totalEnviados}).
Por tema: ${porTema.map(t => `${t.tema}: ${t['Taxa de clique (%)']}%`).join('; ')}.
Por cargo: ${porCargo.map(c => `${c.cargo}: ${c['Taxa de clique (%)']}%`).join('; ')}.
Colaboradores com mais cliques: ${rankingRisco.slice(0, 5).map(r => `${r.nome} (${r.cliques}x)`).join(', ') || 'nenhum'}.`;

      const prompt = `Você é um analista de segurança da informação de um cartório notarial brasileiro. Com base nestes dados de simulações internas de phishing, escreva um plano de ação objetivo em português, em tópicos curtos, com: 1) diagnóstico resumido, 2) até 5 ações prioritárias de treinamento/reforço (mencionando temas ou cargos mais vulneráveis quando fizer sentido), 3) uma recomendação de frequência para novas simulações. Seja direto, sem introduções genéricas.\n\nDados:\n${resumo}`;

      const texto = await GeminiService.getGeminiResponse(prompt);
      if (!texto || texto.startsWith('Erro ')) {
        showToast(texto || 'Erro ao gerar o plano de ação. Tente novamente.', 'error');
        return;
      }
      await addDoc(collection(db, 'planosAcaoPhishing'), {
        texto, resumo, tenantId, geradoPor: state.user?.id || '', geradoPorNome: state.user?.name || '',
        criadoEm: serverTimestamp(),
      });
      showToast('Plano de ação gerado com sucesso.', 'success');
    } catch {
      showToast('Erro ao gerar o plano de ação. Tente novamente.', 'error');
    } finally {
      setGerandoPlano(false);
    }
  };

  const podeUsar = isSuperAdmin || phishingHabilitado;

  return (
    <div className="p-8 space-y-6 bg-slate-50 min-h-screen animate-in fade-in">
      <header className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-black text-navy italic uppercase tracking-tighter">
            Simulação de <span className="text-amber-500">Phishing</span>
          </h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">
            Teste de conscientização em segurança — mede quem clica em e-mails simulados
          </p>
        </div>
        {tab === 'simulacoes' && podeUsar && (
          <button onClick={() => setShowForm(!showForm)}
            className="bg-amber-600 hover:bg-amber-500 text-navy px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
            <i className="fa-solid fa-plus mr-2"></i>Nova Simulação
          </button>
        )}
      </header>

      {!podeUsar ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-sm text-amber-800 space-y-2">
          <p className="font-black uppercase text-xs tracking-widest">
            <i className="fa-solid fa-lock mr-2"></i>Recurso opcional não habilitado
          </p>
          <p>Este é um módulo opcional — sua ativação para o cartório precisa ser feita pela MJ Consultoria. Fale com o suporte para habilitar a simulação de phishing.</p>
        </div>
      ) : (
        <>
          <div className="flex border-b border-slate-200">
            {[
              { id: 'simulacoes' as const, label: 'Simulações', icon: 'fa-paper-plane' },
              { id: 'analises' as const, label: 'Análises & Plano de Ação', icon: 'fa-chart-line' },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
                  tab === t.id ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-600'
                }`}>
                <i className={`fa-solid ${t.icon}`}></i>{t.label}
              </button>
            ))}
          </div>

          {tab === 'simulacoes' && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-800">
                <i className="fa-solid fa-circle-info mr-2"></i>
                Cada colaborador recebe um link individual e rastreável. Ao clicar, ele é redirecionado para uma página educativa
                explicando que se tratava de um teste — o clique é registrado aqui como evidência de risco, sem coletar senha ou dado sensível.
              </div>

              {showForm && (
                <div className="bg-white border border-amber-500/30 rounded-[24px] p-6 space-y-4">
                  <h3 className="text-navy font-black uppercase text-sm">Nova Simulação</h3>

                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Modelo pronto (opcional)</label>
                    <div className="flex flex-wrap gap-2">
                      {TEMPLATES.map((t, i) => (
                        <button key={i} type="button" onClick={() => aplicarTemplate(i)}
                          className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl font-bold transition-all">
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Nome interno da simulação *</label>
                      <input value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                        placeholder="Ex: Simulação Q3 - pendência de assinatura"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-navy outline-none focus:border-amber-500" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Tema / assunto *</label>
                      <select value={form.tema} onChange={e => setForm(p => ({ ...p, tema: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-navy outline-none focus:border-amber-500">
                        {TEMAS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <p className="text-[10px] text-slate-400 mt-1">O tema é usado nas análises para identificar que tipo de isca gera mais risco.</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Assunto do e-mail *</label>
                      <input value={form.assuntoEmail} onChange={e => setForm(p => ({ ...p, assuntoEmail: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-navy outline-none focus:border-amber-500" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                        Corpo do e-mail * — use <code className="bg-slate-100 px-1 rounded">{'{{NOME}}'}</code> e <code className="bg-slate-100 px-1 rounded">{'{{LINK}}'}</code>
                      </label>
                      <textarea value={form.corpoEmail} onChange={e => setForm(p => ({ ...p, corpoEmail: e.target.value }))} rows={6}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-navy outline-none focus:border-amber-500 resize-none" />
                    </div>
                  </div>

                  {isSuperAdmin && (
                    <VisibilidadeCartorioPicker isSuperAdmin={isSuperAdmin} ownTenantId={tenantId} value={tenantIdsForm} onChange={setTenantIdsForm} />
                  )}

                  <div className="flex items-center gap-3">
                    <button onClick={salvar} disabled={loading}
                      className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-navy px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                      {loading ? <><i className="fa-solid fa-circle-notch animate-spin mr-2"></i>Disparando...</> : <><i className="fa-solid fa-paper-plane mr-2"></i>Disparar</>}
                    </button>
                    <button onClick={() => setShowForm(false)} className="bg-slate-200 hover:bg-slate-700 text-slate-700 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {simulacoes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 opacity-30">
                    <i className="fa-solid fa-shield-halved text-5xl text-slate-600 mb-4"></i>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Nenhuma simulação disparada</p>
                  </div>
                ) : simulacoes.map(s => {
                  const st = statsFor(s.id);
                  const aberto = expandido === s.id;
                  return (
                    <div key={s.id} className="bg-white border border-slate-200 rounded-[20px] overflow-hidden">
                      <div className="p-5 flex items-center gap-4 cursor-pointer" onClick={() => setExpandido(aberto ? null : s.id)}>
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                          <i className="fa-solid fa-shield-halved text-amber-500"></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-black text-navy truncate">{s.titulo}</h3>
                            {s.tema && (
                              <span className="text-[9px] font-black text-amber-700 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded-lg">
                                {s.tema}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {s.publicadoPorNome} · {s.criadoEm?.toDate?.()?.toLocaleDateString('pt-BR') || 'agora'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-black ${st.taxa >= 30 ? 'text-red-500' : st.taxa > 0 ? 'text-amber-500' : 'text-emerald-600'}`}>{st.taxa}%</p>
                          <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{st.clicados}/{st.enviados} clicaram</p>
                        </div>
                        <i className={`fa-solid fa-chevron-down text-slate-600 transition-transform ${aberto ? 'rotate-180' : ''}`}></i>
                      </div>
                      {aberto && (
                        <div className="px-5 pb-5 border-t border-slate-200/50 pt-4 space-y-3">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Assunto</p>
                          <p className="text-sm text-slate-700">{s.assuntoEmail}</p>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Quem clicou</p>
                          {st.lista.length === 0 ? (
                            <p className="text-[11px] text-slate-400">Nenhum clique registrado até o momento.</p>
                          ) : (
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {st.lista.map((c, i) => (
                                <p key={i} className="text-[11px] text-slate-600">
                                  <i className="fa-solid fa-triangle-exclamation text-red-500 mr-1"></i>
                                  {c.nome} <span className="text-slate-400">({c.email}{c.cargo ? ` · ${c.cargo}` : ''})</span>
                                  {c.clicadoEm?.toDate && <span className="text-slate-400"> — {c.clicadoEm.toDate().toLocaleString('pt-BR')}</span>}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {tab === 'analises' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'E-mails enviados', value: totalEnviados, icon: 'fa-paper-plane', color: '#4F46E5' },
                  { label: 'Cliques registrados', value: totalClicados, icon: 'fa-triangle-exclamation', color: '#DC2626' },
                  { label: 'Taxa geral de clique', value: `${taxaGeral}%`, icon: 'fa-percent', color: '#D97706' },
                  { label: 'Simulações realizadas', value: simulacoes.length, icon: 'fa-shield-halved', color: '#059669' },
                ].map((k, i) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-[20px] p-5 space-y-2">
                    <i className={`fa-solid ${k.icon}`} style={{ color: k.color }}></i>
                    <p className="text-2xl font-black text-navy">{k.value}</p>
                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{k.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-[20px] p-5 space-y-3">
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Taxa de clique por tema</p>
                  {porTema.length === 0 ? (
                    <div className="h-40 flex items-center justify-center text-slate-400 text-sm">Sem dados ainda</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={porTema} margin={{ top: 5, right: 10, left: -20, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="tema" tick={{ fontSize: 9, fill: '#94a3b8' }} angle={-20} textAnchor="end" />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <Tooltip />
                        <Bar dataKey="Taxa de clique (%)" radius={[4, 4, 0, 0]}>
                          {porTema.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="bg-white border border-slate-200 rounded-[20px] p-5 space-y-3">
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Taxa de clique por cargo</p>
                  {porCargo.length === 0 ? (
                    <div className="h-40 flex items-center justify-center text-slate-400 text-sm">Sem dados ainda</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={porCargo} margin={{ top: 5, right: 10, left: -20, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="cargo" tick={{ fontSize: 9, fill: '#94a3b8' }} angle={-20} textAnchor="end" />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <Tooltip />
                        <Bar dataKey="Taxa de clique (%)" radius={[4, 4, 0, 0]} fill="#7C3AED" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="bg-white border border-slate-200 rounded-[20px] p-5 space-y-3 lg:col-span-2">
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Evolução da taxa de clique (últimas simulações)</p>
                  {porMes.length === 0 ? (
                    <div className="h-40 flex items-center justify-center text-slate-400 text-sm">Sem dados ainda</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={porMes} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="Taxa de clique (%)" stroke="#DC2626" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-[20px] p-5 space-y-3">
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Colaboradores com mais cliques (maior risco)</p>
                {rankingRisco.length === 0 ? (
                  <p className="text-[11px] text-slate-400">Nenhum clique registrado até o momento — ótimo sinal.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200">
                          {['Colaborador', 'Cargo', 'E-mail', 'Cliques'].map(h => (
                            <th key={h} className="text-left p-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rankingRisco.map((r, i) => (
                          <tr key={i} className="border-b border-slate-100">
                            <td className="p-2 font-bold text-navy">{r.nome}</td>
                            <td className="p-2 text-slate-500">{r.cargo}</td>
                            <td className="p-2 text-slate-500">{r.email}</td>
                            <td className="p-2"><span className="bg-red-50 text-red-600 border border-red-200 text-[10px] font-black px-2 py-0.5 rounded-lg">{r.cliques}x</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-white border border-amber-500/30 rounded-[20px] p-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Plano de ação com IA</p>
                  <button onClick={gerarPlanoDeAcao} disabled={gerandoPlano}
                    className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-navy px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                    {gerandoPlano ? <><i className="fa-solid fa-circle-notch animate-spin mr-2"></i>Gerando...</> : <><i className="fa-solid fa-wand-magic-sparkles mr-2"></i>Gerar plano de ação com IA</>}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  A IA analisa a taxa de clique por tema, por cargo e o ranking de risco acima para sugerir ações de treinamento prioritárias.
                </p>

                {planos.length === 0 ? (
                  <p className="text-[11px] text-slate-400">Nenhum plano de ação gerado ainda.</p>
                ) : (
                  <div className="space-y-3">
                    {planos.map(p => (
                      <div key={p.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                        <p className="text-[10px] text-slate-500">
                          {p.geradoPorNome} · {p.criadoEm?.toDate?.()?.toLocaleString('pt-BR') || 'agora'}
                        </p>
                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{p.texto}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SimulacaoPhishingView;
