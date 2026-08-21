import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { db } from '../../services/firebase';
import { collection, onSnapshot, query, orderBy, where, addDoc, serverTimestamp } from 'firebase/firestore';
import VisibilidadeCartorioPicker from '../../components/VisibilidadeCartorioPicker';

interface Simulacao {
  id: string;
  titulo: string;
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
}

const TEMPLATES = [
  {
    label: 'Pendência de assinatura eletrônica',
    assuntoEmail: 'Ação necessária: documento pendente de assinatura eletrônica',
    corpoEmail: 'Olá {{NOME}},\n\nHá um documento pendente de assinatura eletrônica vinculado ao seu cadastro. Para regularizar, acesse o link a seguir e confirme sua identidade:\n\n{{LINK}}\n\nO prazo para regularização é de 24 horas.',
  },
  {
    label: 'Atualização cadastral urgente',
    assuntoEmail: 'Seu cadastro precisa ser atualizado',
    corpoEmail: 'Olá {{NOME}},\n\nIdentificamos uma inconsistência no seu cadastro corporativo. Clique no link abaixo para atualizar seus dados e evitar o bloqueio do seu acesso:\n\n{{LINK}}',
  },
  {
    label: 'Convite para reunião (calendário)',
    assuntoEmail: 'Convite: reunião de alinhamento — confirme presença',
    corpoEmail: 'Olá {{NOME}},\n\nVocê foi convidado para uma reunião de alinhamento. Confirme sua presença clicando no link abaixo:\n\n{{LINK}}',
  },
];

const SimulacaoPhishingView: React.FC = () => {
  const { state, tenantId } = useApp();
  const { showToast } = useToast();
  const isSuperAdmin = state.user?.role === 'SUPERADMIN';
  const [tenantIdsForm, setTenantIdsForm] = useState<string[]>([tenantId]);

  const [simulacoes, setSimulacoes] = useState<Simulacao[]>([]);
  const [cliques, setCliques] = useState<Clique[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [form, setForm] = useState({ titulo: '', assuntoEmail: '', corpoEmail: '' });

  useEffect(() => {
    const q = query(collection(db, 'simulacoesPhishing'), where('tenantIds', 'array-contains-any', [tenantId, 'GLOBAL']), orderBy('criadoEm', 'desc'));
    return onSnapshot(q, s => setSimulacoes(s.docs.map(d => ({ id: d.id, ...d.data() } as Simulacao))));
  }, [tenantId]);

  useEffect(() => {
    const q = query(collection(db, 'simulacoesPhishingCliques'), where('tenantId', '==', tenantId));
    return onSnapshot(q, s => setCliques(s.docs.map(d => ({ id: d.id, ...d.data() } as Clique))));
  }, [tenantId]);

  const aplicarTemplate = (i: number) => {
    const t = TEMPLATES[i];
    setForm({ titulo: t.label, assuntoEmail: t.assuntoEmail, corpoEmail: t.corpoEmail });
  };

  const salvar = async () => {
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
      setForm({ titulo: '', assuntoEmail: '', corpoEmail: '' });
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

  return (
    <div className="p-8 space-y-6 bg-slate-50 min-h-screen animate-in fade-in">
      <header className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-black text-[#0A1628] italic uppercase tracking-tighter">
            Simulação de <span className="text-amber-500">Phishing</span>
          </h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">
            Teste de conscientização em segurança — mede quem clica em e-mails simulados
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-amber-600 hover:bg-amber-500 text-[#0A1628] px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
          <i className="fa-solid fa-plus mr-2"></i>Nova Simulação
        </button>
      </header>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-800">
        <i className="fa-solid fa-circle-info mr-2"></i>
        Cada colaborador recebe um link individual e rastreável. Ao clicar, ele é redirecionado para uma página educativa
        explicando que se tratava de um teste — o clique é registrado aqui como evidência de risco, sem coletar senha ou dado sensível.
      </div>

      {showForm && (
        <div className="bg-white border border-amber-500/30 rounded-[24px] p-6 space-y-4">
          <h3 className="text-[#0A1628] font-black uppercase text-sm">Nova Simulação</h3>

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

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Nome interno da simulação *</label>
              <input value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                placeholder="Ex: Simulação Q3 - pendência de assinatura"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-[#0A1628] outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Assunto do e-mail *</label>
              <input value={form.assuntoEmail} onChange={e => setForm(p => ({ ...p, assuntoEmail: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-[#0A1628] outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                Corpo do e-mail * — use <code className="bg-slate-100 px-1 rounded">{'{{NOME}}'}</code> e <code className="bg-slate-100 px-1 rounded">{'{{LINK}}'}</code>
              </label>
              <textarea value={form.corpoEmail} onChange={e => setForm(p => ({ ...p, corpoEmail: e.target.value }))} rows={6}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-[#0A1628] outline-none focus:border-amber-500 resize-none" />
            </div>
          </div>

          {isSuperAdmin && (
            <VisibilidadeCartorioPicker isSuperAdmin={isSuperAdmin} ownTenantId={tenantId} value={tenantIdsForm} onChange={setTenantIdsForm} />
          )}

          <div className="flex items-center gap-3">
            <button onClick={salvar} disabled={loading}
              className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-[#0A1628] px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
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
                  <h3 className="text-sm font-black text-[#0A1628] truncate">{s.titulo}</h3>
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
                          {c.nome} <span className="text-slate-400">({c.email})</span>
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
    </div>
  );
};

export default SimulacaoPhishingView;
