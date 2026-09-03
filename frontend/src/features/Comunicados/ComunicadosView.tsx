import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { db } from '../../services/firebase';
import { collection, onSnapshot, query, orderBy, where, addDoc, updateDoc, doc, serverTimestamp, setDoc, getDoc } from 'firebase/firestore';
import VisibilidadeCartorioPicker from '../../components/VisibilidadeCartorioPicker';

interface Comunicado {
  id: string;
  titulo: string;
  corpo: string;
  prazo: string;
  anexoUrl: string;
  prioridade: 'normal' | 'urgente' | 'informativo';
  publicadoPorNome: string;
  tenantIds: string[];
  ativo: boolean;
  fixado: boolean;
  exigeAceite: boolean;
  notificarEmail?: boolean;
  criadoEm: any;
}

const PRIORIDADE_CONFIG = {
  urgente:     { label: 'Urgente',     color: 'red',    icon: 'fa-circle-exclamation' },
  normal:      { label: 'Normal',      color: 'blue',   icon: 'fa-bell'               },
  informativo: { label: 'Informativo', color: 'emerald', icon: 'fa-circle-info'       },
};

const ComunicadosView: React.FC = () => {
  const { state, tenantId } = useApp();
  const { showToast } = useToast();
  const isGestor = ['SUPERADMIN', 'gestor', 'admin'].includes(state.user?.role || '');
  const isSuperAdmin = state.user?.role === 'SUPERADMIN';
  const [tenantIdsForm, setTenantIdsForm] = useState<string[]>([tenantId]);

  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [lidos, setLidos] = useState<Set<string>>(new Set());
  const [modo, setModo] = useState<'mural' | 'gestao'>('mural');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [form, setForm] = useState({ titulo: '', corpo: '', prazo: '', anexoUrl: '', prioridade: 'normal' as const, fixado: false, exigeAceite: false, notificarEmail: false });
  const [leiturasGestao, setLeiturasGestao] = useState<Record<string, { userNome: string; userEmail: string; aceiteEm: any }[]>>({});

  useEffect(() => {
    const q = query(collection(db, 'comunicados'), where('tenantIds', 'array-contains-any', [tenantId, 'GLOBAL']), orderBy('criadoEm', 'desc'));
    return onSnapshot(q, s => setComunicados(s.docs.map(d => ({ id: d.id, ...d.data() } as Comunicado)).filter(c => c.ativo !== false)));
  }, [tenantId]);

  useEffect(() => {
    if (!state.user?.id) return;
    const q = query(collection(db, 'comunicadosLeituras'), where('tenantId', '==', tenantId));
    return onSnapshot(q, s => {
      const ids = new Set<string>();
      s.docs.forEach(d => { if (d.data().userId === state.user!.id) ids.add(d.data().comunicadoId); });
      setLidos(ids);
    });
  }, [state.user?.id, tenantId]);

  useEffect(() => {
    if (modo !== 'gestao') return;
    const q = query(collection(db, 'comunicadosLeituras'), where('tenantId', '==', tenantId));
    return onSnapshot(q, s => {
      const grouped: Record<string, { userNome: string; userEmail: string; aceiteEm: any }[]> = {};
      s.docs.forEach(d => {
        const data = d.data();
        if (!data.aceite) return;
        (grouped[data.comunicadoId] ||= []).push({ userNome: data.userNome || '', userEmail: data.userEmail || '', aceiteEm: data.aceiteEm });
      });
      setLeiturasGestao(grouped);
    });
  }, [modo, tenantId]);

  const marcarLido = async (id: string) => {
    if (!state.user?.id || lidos.has(id)) return;
    const key = `${state.user.id}_${id}`;
    await setDoc(doc(db, 'comunicadosLeituras', key), {
      userId: state.user.id, comunicadoId: id, tenantId, lidoEm: serverTimestamp(),
      userNome: state.user.name || '', userEmail: state.user.email || '',
    });
  };

  const confirmarAceite = async (id: string) => {
    if (!state.user?.id || lidos.has(id)) return;
    const key = `${state.user.id}_${id}`;
    await setDoc(doc(db, 'comunicadosLeituras', key), {
      userId: state.user.id, comunicadoId: id, tenantId, lidoEm: serverTimestamp(),
      aceite: true, aceiteEm: serverTimestamp(),
      userNome: state.user.name || '', userEmail: state.user.email || '',
    });
    showToast('Confirmação de leitura registrada.', 'success');
  };

  const salvar = async () => {
    if (!form.titulo.trim() || !form.corpo.trim()) { showToast('Título e corpo são obrigatórios.', 'error'); return; }
    setLoading(true);
    try {
      await addDoc(collection(db, 'comunicados'), {
        ...form, ativo: true, tenantIds: isSuperAdmin ? tenantIdsForm : [tenantId],
        publicadoPor: state.user?.id || '', publicadoPorNome: state.user?.name || '',
        criadoEm: serverTimestamp(),
      });
      showToast(form.notificarEmail ? 'Comunicado publicado e e-mail enviado aos colaboradores!' : 'Comunicado publicado no mural (sem envio de e-mail).', 'success');
      setForm({ titulo: '', corpo: '', prazo: '', anexoUrl: '', prioridade: 'normal', fixado: false, exigeAceite: false, notificarEmail: false });
      setShowForm(false);
    } catch { showToast('Erro ao publicar comunicado.', 'error'); } finally { setLoading(false); }
  };

  const arquivar = async (id: string) => {
    await updateDoc(doc(db, 'comunicados', id), { ativo: false });
    showToast('Comunicado arquivado.', 'success');
  };

  const naoLidos = comunicados.filter(c => !lidos.has(c.id)).length;
  const ordenados = [...comunicados].sort((a, b) => (b.fixado ? 1 : 0) - (a.fixado ? 1 : 0));

  return (
    <div className="p-8 space-y-6 bg-slate-50 min-h-screen animate-in fade-in">
      <header className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-black text-navy italic uppercase tracking-tighter">
            Mural de <span className="text-amber-500">Comunicados</span>
          </h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Avisos e informações da empresa</p>
        </div>
        <div className="flex gap-2">
          {isGestor && (
            <>
              <button onClick={() => setModo(modo === 'mural' ? 'gestao' : 'mural')}
                className="bg-slate-200 hover:bg-slate-700 text-slate-700 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                <i className={`fa-solid ${modo === 'mural' ? 'fa-cog' : 'fa-eye'} mr-2`}></i>
                {modo === 'mural' ? 'Gestão' : 'Mural'}
              </button>
              <button onClick={() => setShowForm(!showForm)}
                className="bg-amber-600 hover:bg-amber-500 text-navy px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                <i className="fa-solid fa-plus mr-2"></i>Publicar
              </button>
            </>
          )}
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total',     value: comunicados.length,            icon: 'fa-bell',            color: 'blue'    },
          { label: 'Não lidos', value: naoLidos,                      icon: 'fa-envelope',        color: 'amber'   },
          { label: 'Urgentes',  value: comunicados.filter(c => c.prioridade === 'urgente').length, icon: 'fa-circle-exclamation', color: 'red' },
          { label: 'Fixados',   value: comunicados.filter(c => c.fixado).length,                  icon: 'fa-thumbtack', color: 'purple' },
        ].map((k, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-[20px] p-5 space-y-2">
            <i className={`fa-solid ${k.icon} text-${k.color}-500`}></i>
            <p className="text-2xl font-black text-navy">{k.value}</p>
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Formulário */}
      {showForm && isGestor && (
        <div className="bg-white border border-amber-500/30 rounded-[24px] p-6 space-y-4">
          <h3 className="text-navy font-black uppercase text-sm">Novo Comunicado</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Título *</label>
              <input value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                placeholder="Ex: Reunião de equipe - Semana de 14/04"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-navy outline-none focus:border-amber-500" />
            </div>
            <div className="md:col-span-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Mensagem *</label>
              <textarea value={form.corpo} onChange={e => setForm(p => ({ ...p, corpo: e.target.value }))} rows={4}
                placeholder="Digite o comunicado completo aqui..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-navy outline-none focus:border-amber-500 resize-none" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Prioridade</label>
              <select value={form.prioridade} onChange={e => setForm(p => ({ ...p, prioridade: e.target.value as any }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-navy outline-none focus:border-amber-500">
                <option value="informativo">Informativo</option>
                <option value="normal">Normal</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Prazo (opcional)</label>
              <input type="date" value={form.prazo} onChange={e => setForm(p => ({ ...p, prazo: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-navy outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Link de Anexo (opcional)</label>
              <input value={form.anexoUrl} onChange={e => setForm(p => ({ ...p, anexoUrl: e.target.value }))}
                placeholder="https://drive.google.com/..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-navy outline-none focus:border-amber-500" />
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="fixado" checked={form.fixado} onChange={e => setForm(p => ({ ...p, fixado: e.target.checked }))}
                className="w-4 h-4 accent-amber-500" />
              <label htmlFor="fixado" className="text-sm text-slate-700 font-bold cursor-pointer">Fixar comunicado no topo</label>
            </div>
            <div className="flex items-center gap-3 md:col-span-2">
              <input type="checkbox" id="exigeAceite" checked={form.exigeAceite} onChange={e => setForm(p => ({ ...p, exigeAceite: e.target.checked }))}
                className="w-4 h-4 accent-amber-500" />
              <label htmlFor="exigeAceite" className="text-sm text-slate-700 font-bold cursor-pointer">
                Exigir confirmação formal de leitura ("Li e concordo") — gera evidência com nome, e-mail e data/hora
              </label>
            </div>
            <div className="flex items-center gap-3 md:col-span-2 bg-blue-50 border border-blue-200 rounded-xl p-3">
              <input type="checkbox" id="notificarEmail" checked={form.notificarEmail} onChange={e => setForm(p => ({ ...p, notificarEmail: e.target.checked }))}
                className="w-4 h-4 accent-blue-600" />
              <label htmlFor="notificarEmail" className="text-sm text-slate-700 font-bold cursor-pointer">
                <i className="fa-solid fa-envelope mr-1 text-blue-500"></i>
                Notificar colaboradores por e-mail sobre este comunicado
                <span className="block text-[10px] font-normal text-slate-500 mt-0.5">
                  Por padrão, o comunicado fica só no mural. Marque esta opção apenas para avisos que realmente precisam chegar por e-mail.
                </span>
              </label>
            </div>
          </div>

          {isSuperAdmin && (
            <VisibilidadeCartorioPicker
              isSuperAdmin={isSuperAdmin}
              ownTenantId={tenantId}
              value={tenantIdsForm}
              onChange={setTenantIdsForm}
            />
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={salvar} disabled={loading}
              className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-navy px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
              {loading ? <><i className="fa-solid fa-circle-notch animate-spin mr-2"></i>Publicando...</> : <><i className="fa-solid fa-bullhorn mr-2"></i>Publicar</>}
            </button>
            <button onClick={() => setShowForm(false)} className="bg-slate-200 hover:bg-slate-700 text-slate-700 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="space-y-3">
        {ordenados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-30">
            <i className="fa-solid fa-bell-slash text-5xl text-slate-600 mb-4"></i>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Nenhum comunicado publicado</p>
          </div>
        ) : ordenados.map(c => {
          const prio = PRIORIDADE_CONFIG[c.prioridade] || PRIORIDADE_CONFIG.normal;
          const lido = lidos.has(c.id);
          const aberto = expandido === c.id;
          return (
            <div key={c.id} className={`bg-white border rounded-[20px] overflow-hidden transition-all ${
              c.prioridade === 'urgente' ? 'border-red-500/40' : lido ? 'border-slate-200' : 'border-amber-500/30'
            }`}>
              <div className="p-5 flex items-start gap-4 cursor-pointer" onClick={() => { setExpandido(aberto ? null : c.id); if (!c.exigeAceite) marcarLido(c.id); }}>
                <div className={`w-10 h-10 rounded-xl bg-${prio.color}-500/20 flex items-center justify-center flex-shrink-0`}>
                  <i className={`fa-solid ${prio.icon} text-${prio.color}-400`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {c.fixado && <i className="fa-solid fa-thumbtack text-amber-400 text-xs"></i>}
                    <h3 className={`text-sm font-black ${lido ? 'text-slate-700' : 'text-navy'} truncate`}>{c.titulo}</h3>
                    {!lido && <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0"></span>}
                    <span className={`text-[9px] font-black text-${prio.color}-400 uppercase tracking-widest bg-${prio.color}-500/10 px-2 py-0.5 rounded-lg`}>
                      {prio.label}
                    </span>
                    {c.notificarEmail && (
                      <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded-lg" title="E-mail enviado aos colaboradores">
                        <i className="fa-solid fa-envelope mr-1"></i>E-mail
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {c.publicadoPorNome} · {c.criadoEm?.toDate?.()?.toLocaleDateString('pt-BR') || 'agora'}
                    {c.prazo && <span className="ml-2 text-amber-400"><i className="fa-solid fa-clock mr-1"></i>Prazo: {new Date(c.prazo + 'T12:00').toLocaleDateString('pt-BR')}</span>}
                  </p>
                </div>
                <i className={`fa-solid fa-chevron-down text-slate-600 transition-transform ${aberto ? 'rotate-180' : ''}`}></i>
              </div>
              {aberto && (
                <div className="px-5 pb-5 border-t border-slate-200/50 pt-4 space-y-3">
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{c.corpo}</p>
                  {c.anexoUrl && (
                    <a href={c.anexoUrl} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-2 text-[10px] bg-slate-200 hover:bg-slate-700 text-slate-700 px-4 py-2 rounded-xl font-black uppercase tracking-widest transition-all">
                      <i className="fa-solid fa-paperclip"></i>Ver Anexo
                    </a>
                  )}
                  {c.exigeAceite && !lido && (
                    <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-2">
                      <p className="text-xs text-amber-800 font-bold">
                        <i className="fa-solid fa-signature mr-1"></i>Este comunicado exige confirmação formal de leitura.
                      </p>
                      <button onClick={() => confirmarAceite(c.id)}
                        className="text-[9px] bg-amber-600 hover:bg-amber-500 text-navy px-4 py-2 rounded-xl font-black uppercase tracking-widest transition-all">
                        <i className="fa-solid fa-signature mr-1"></i>Li e concordo
                      </button>
                    </div>
                  )}
                  {c.exigeAceite && lido && (
                    <p className="text-[10px] text-emerald-600 font-bold">
                      <i className="fa-solid fa-circle-check mr-1"></i>Confirmação de leitura registrada.
                    </p>
                  )}

                  <div className="flex gap-2 pt-1">
                    {!c.exigeAceite && !lido && (
                      <button onClick={() => marcarLido(c.id)}
                        className="text-[9px] bg-emerald-600 hover:bg-emerald-500 text-navy px-4 py-2 rounded-xl font-black uppercase tracking-widest transition-all">
                        <i className="fa-solid fa-check mr-1"></i>Marcar como lido
                      </button>
                    )}
                    {isGestor && modo === 'gestao' && (
                      <button onClick={() => arquivar(c.id)}
                        className="text-[9px] bg-slate-200 hover:bg-red-500/20 text-slate-500 hover:text-red-400 px-4 py-2 rounded-xl font-black uppercase tracking-widest transition-all">
                        <i className="fa-solid fa-archive mr-1"></i>Arquivar
                      </button>
                    )}
                  </div>

                  {isGestor && modo === 'gestao' && c.exigeAceite && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                        Confirmações registradas ({(leiturasGestao[c.id] || []).length})
                      </p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {(leiturasGestao[c.id] || []).length === 0 ? (
                          <p className="text-[11px] text-slate-400">Nenhuma confirmação ainda.</p>
                        ) : (leiturasGestao[c.id] || []).map((l, i) => (
                          <p key={i} className="text-[11px] text-slate-600">
                            <i className="fa-solid fa-circle-check text-emerald-500 mr-1"></i>
                            {l.userNome} <span className="text-slate-400">({l.userEmail})</span>
                            {l.aceiteEm?.toDate && <span className="text-slate-400"> — {l.aceiteEm.toDate().toLocaleString('pt-BR')}</span>}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ComunicadosView;
