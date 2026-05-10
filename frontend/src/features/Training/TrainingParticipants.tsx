import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import {
  collection, onSnapshot, query, orderBy,
  addDoc, serverTimestamp, deleteDoc, doc
} from 'firebase/firestore';

interface Participant {
  id: string;
  nomeColaborador: string;
  cargo: string;
  treinamento: string;
  dataConclusao: string;
  status: 'concluído' | 'pendente' | 'vencido';
  observacao?: string;
  createdAt?: any;
}

interface Checklist {
  id: string;
  title: string;
  items?: any[];
}

const STATUS_CONFIG = {
  'concluído': { color: 'emerald', icon: 'fa-circle-check', label: 'Concluído' },
  'pendente':  { color: 'amber',   icon: 'fa-clock',        label: 'Pendente'  },
  'vencido':   { color: 'red',     icon: 'fa-circle-xmark', label: 'Vencido'   },
};

const TrainingParticipants: React.FC = () => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterTreinamento, setFilterTreinamento] = useState<string>('todos');
  const [isLoading, setIsLoading] = useState(false);

  const [form, setForm] = useState({
    nomeColaborador: '',
    cargo: '',
    treinamento: '',
    dataConclusao: '',
    status: 'concluído' as Participant['status'],
    observacao: '',
  });

  // Carrega participantes do Firestore
  useEffect(() => {
    const q = query(collection(db, 'treinamentosParticipantes'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap =>
      setParticipants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Participant)))
    );
    return () => unsub();
  }, []);

  // Carrega checklists (treinamentos mapeados)
  useEffect(() => {
    const q = query(collection(db, 'checklists'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap =>
      setChecklists(snap.docs.map(d => ({ id: d.id, ...d.data() } as Checklist)))
    );
    return () => unsub();
  }, []);

  const handleSubmit = async () => {
    if (!form.nomeColaborador || !form.treinamento || !form.dataConclusao) return;
    setIsLoading(true);
    try {
      await addDoc(collection(db, 'treinamentosParticipantes'), {
        ...form,
        createdAt: serverTimestamp(),
      });
      setForm({ nomeColaborador: '', cargo: '', treinamento: '', dataConclusao: '', status: 'concluído', observacao: '' });
      setShowForm(false);
    } catch (e) {
      console.error('Erro ao salvar participante', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remover este registro?')) return;
    await deleteDoc(doc(db, 'treinamentosParticipantes', id));
  };

  // Filtragem
  const filtered = participants.filter(p => {
    const matchStatus = filterStatus === 'todos' || p.status === filterStatus;
    const matchTreinamento = filterTreinamento === 'todos' || p.treinamento === filterTreinamento;
    return matchStatus && matchTreinamento;
  });

  // Stats
  const total = participants.length;
  const concluidos = participants.filter(p => p.status === 'concluído').length;
  const pendentes = participants.filter(p => p.status === 'pendente').length;
  const vencidos = participants.filter(p => p.status === 'vencido').length;

  // Treinamentos únicos registrados
  const treinamentosUnicos = [...new Set(participants.map(p => p.treinamento))];

  return (
    <div className="space-y-6">

      {/* Header da seção */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[#0A1628] font-black uppercase italic text-sm tracking-wider">
            Histórico de <span className="text-blue-500">Participantes</span>
          </h3>
          <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">
            Registro de colaboradores por treinamento
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
        >
          <i className={`fa-solid ${showForm ? 'fa-xmark' : 'fa-plus'}`}></i>
          {showForm ? 'Cancelar' : 'Registrar Participante'}
        </button>
      </div>

      {/* Cards de stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Registros', value: total, icon: 'fa-users', color: 'blue' },
          { label: 'Concluídos', value: concluidos, icon: 'fa-circle-check', color: 'emerald' },
          { label: 'Pendentes', value: pendentes, icon: 'fa-clock', color: 'amber' },
          { label: 'Vencidos', value: vencidos, icon: 'fa-circle-xmark', color: 'red' },
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
            <i className={`fa-solid ${stat.icon} text-${stat.color}-500 text-lg`}></i>
            <p className="text-2xl font-black text-[#0A1628]">{stat.value}</p>
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Formulário de registro */}
      {showForm && (
        <div className="bg-white border border-blue-500/30 rounded-2xl p-6 space-y-4">
          <h4 className="text-xs font-black text-blue-400 uppercase tracking-widest">Novo Registro</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Nome do Colaborador *</label>
              <input
                value={form.nomeColaborador}
                onChange={e => setForm(f => ({ ...f, nomeColaborador: e.target.value }))}
                placeholder="Ex: João Silva"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#0A1628] outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Cargo / Função</label>
              <input
                value={form.cargo}
                onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))}
                placeholder="Ex: Escrevente Técnico"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#0A1628] outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Treinamento *</label>
              <select
                value={form.treinamento}
                onChange={e => setForm(f => ({ ...f, treinamento: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#0A1628] outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">Selecione um treinamento...</option>
                {checklists.map(c => (
                  <option key={c.id} value={c.title}>{c.title}</option>
                ))}
                <option value="outro">Outro (digitar)</option>
              </select>
            </div>

            {form.treinamento === 'outro' && (
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Nome do Treinamento *</label>
                <input
                  onChange={e => setForm(f => ({ ...f, treinamento: e.target.value }))}
                  placeholder="Digite o nome do treinamento"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#0A1628] outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Data de Conclusão *</label>
              <input
                type="date"
                value={form.dataConclusao}
                onChange={e => setForm(f => ({ ...f, dataConclusao: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#0A1628] outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as Participant['status'] }))}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#0A1628] outline-none focus:border-blue-500 transition-colors"
              >
                <option value="concluído">✅ Concluído</option>
                <option value="pendente">⏳ Pendente</option>
                <option value="vencido">❌ Vencido</option>
              </select>
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Observação</label>
              <input
                value={form.observacao}
                onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
                placeholder="Observações adicionais..."
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#0A1628] outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowForm(false)}
              className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-[#0A1628] border border-slate-200 hover:border-slate-600 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading || !form.nomeColaborador || !form.treinamento || !form.dataConclusao}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-floppy-disk"></i>}
              Salvar Registro
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-2">
          {['todos', 'concluído', 'pendente', 'vencido'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                filterStatus === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-900 text-slate-500 hover:text-[#0A1628] border border-slate-200'
              }`}
            >
              {s === 'todos' ? 'Todos' : STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.label}
            </button>
          ))}
        </div>

        {treinamentosUnicos.length > 0 && (
          <select
            value={filterTreinamento}
            onChange={e => setFilterTreinamento(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] text-slate-500 outline-none focus:border-blue-500"
          >
            <option value="todos">Todos os Treinamentos</option>
            {treinamentosUnicos.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}
      </div>

      {/* Lista de participantes */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
            <i className="fa-solid fa-users text-4xl text-slate-700 mb-3 block"></i>
            <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">
              {participants.length === 0
                ? 'Nenhum participante registrado ainda'
                : 'Nenhum resultado para os filtros selecionados'}
            </p>
          </div>
        ) : (
          filtered.map(p => {
            const sc = STATUS_CONFIG[p.status as keyof typeof STATUS_CONFIG]
              ?? { color: 'slate', icon: 'fa-circle-question', label: p.status || 'Desconhecido' };
            return (
              <div
                key={p.id}
                className="bg-white border border-slate-200 hover:border-slate-200 rounded-2xl p-4 flex items-center gap-4 transition-all group"
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-black text-[#0A1628]">
                    {p.nomeColaborador.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-[#0A1628]">{p.nomeColaborador}</span>
                    {p.cargo && (
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-slate-900 px-2 py-0.5 rounded-md">
                        {p.cargo}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-slate-500">
                      <i className="fa-solid fa-graduation-cap text-blue-500 mr-1.5"></i>
                      {p.treinamento}
                    </span>
                    <span className="text-xs text-slate-500">
                      <i className="fa-solid fa-calendar mr-1.5"></i>
                      {new Date(p.dataConclusao + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </span>
                    {p.observacao && (
                      <span className="text-xs text-slate-600 italic truncate max-w-[200px]">
                        {p.observacao}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status badge */}
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-${sc.color}-500/10 border border-${sc.color}-500/20 flex-shrink-0`}>
                  <i className={`fa-solid ${sc.icon} text-${sc.color}-400 text-xs`}></i>
                  <span className={`text-[9px] font-black uppercase tracking-widest text-${sc.color}-400`}>
                    {sc.label}
                  </span>
                </div>

                {/* Deletar */}
                <button
                  onClick={() => handleDelete(p.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all p-1"
                >
                  <i className="fa-solid fa-trash text-xs"></i>
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TrainingParticipants;