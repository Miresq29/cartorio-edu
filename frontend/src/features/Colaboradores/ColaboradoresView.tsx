// frontend/src/features/Colaboradores/ColaboradoresView.tsx
// Cole este conteúdo no arquivo que você criou

import React, { useState, useEffect } from 'react';
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useApp } from '../../context/AppContext';
import type { Colaborador, ColaboradorRole, ColaboradorCargo, ColaboradorCreatePayload } from '../../types/colaborador';

// ── helpers ──────────────────────────────────────────────────

function maskCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return `***.***.${d.slice(6, 9)}-${d.slice(9)}`;
}

async function hashCpf(cpf: string): Promise<string> {
  const clean = cpf.replace(/\D/g, '');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(clean));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── constantes ───────────────────────────────────────────────

const ROLES: { value: ColaboradorRole; label: string }[] = [
  { value: 'gestor',    label: 'Gestor' },
  { value: 'atendente', label: 'Atendente' },
  { value: 'auditor',   label: 'Auditor' },
  { value: 'viewer',    label: 'Visualizador' },
];

const CARGOS: string[] = [
  'Tabelião', 'Oficial de Registro', 'Escrevente Autorizado',
  'Escrevente', 'Auxiliar Administrativo', 'Responsável PLD', 'Outro',
];

const ROLE_COLORS: Record<ColaboradorRole, string> = {
  gestor:    'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  atendente: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  auditor:   'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  viewer:    'bg-[#F5F4EF]0/20 text-slate-400 border border-slate-500/30',
};

const emptyForm = {
  nome: '', cpf: '', cargo: '', email: '', role: 'atendente' as ColaboradorRole,
};

// ── componente ───────────────────────────────────────────────

const ColaboradoresView: React.FC = () => {
  const { state } = useApp();
  const currentUser = state.user!;

  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading]             = useState(true);
  const [showForm, setShowForm]           = useState(false);
  const [editTarget, setEditTarget]       = useState<Colaborador | null>(null);
  const [form, setForm]                   = useState(emptyForm);
  const [saving, setSaving]               = useState(false);
  const [search, setSearch]               = useState('');
  const [filterRole, setFilterRole]       = useState<ColaboradorRole | ''>('');
  const [error, setError]                 = useState('');

  const canEdit = ['admin', 'SUPERADMIN', 'TENANT_ADMIN', 'gestor'].includes(currentUser.role);

  // realtime listener
  useEffect(() => {
    if (!currentUser.tenantId) return;
    const q = query(
      collection(db, 'colaboradores'),
      where('tenantId', '==', currentUser.tenantId)
    );
    const unsub = onSnapshot(q, snap => {
      setColaboradores(snap.docs.map(d => ({ id: d.id, ...d.data() } as Colaborador)));
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser.tenantId]);

  const filtered = colaboradores.filter(c => {
    const matchSearch = !search ||
      c.nome.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.cargo.toLowerCase().includes(search.toLowerCase());
    const matchRole = !filterRole || c.role === filterRole;
    return matchSearch && matchRole;
  });

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  }

  function openEdit(c: Colaborador) {
    setEditTarget(c);
    setForm({ nome: c.nome, cpf: '', cargo: c.cargo, email: c.email, role: c.role });
    setError('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditTarget(null);
    setForm(emptyForm);
    setError('');
  }

  async function handleSave() {
    setError('');
    if (!form.nome.trim() || !form.email.trim() || !form.cargo) {
      setError('Preencha nome, e-mail e cargo.');
      return;
    }
    if (!editTarget && form.cpf.replace(/\D/g, '').length !== 11) {
      setError('CPF inválido — informe os 11 dígitos.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('E-mail inválido.');
      return;
    }
    setSaving(true);
    try {
      if (editTarget) {
        await updateDoc(doc(db, 'colaboradores', editTarget.id), {
          nome: form.nome.trim(),
          cargo: form.cargo,
          role: form.role,
          atualizadoEm: serverTimestamp(),
        });
      } else {
        const cpfHash = await hashCpf(form.cpf);
        const cpfMask = maskCpf(form.cpf);
        const payload: ColaboradorCreatePayload = {
          tenantId: currentUser.tenantId,
          nome: form.nome.trim(),
          cpfMask,
          cpfHash,
          cargo: form.cargo,
          email: form.email.trim().toLowerCase(),
          role: form.role,
          ativo: true,
          conviteEnviado: false,
          criadoPor: currentUser.id,
        };
        await addDoc(collection(db, 'colaboradores'), {
          ...payload,
          criadoEm: serverTimestamp(),
        });
      }
      closeForm();
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleAtivo(c: Colaborador) {
    await updateDoc(doc(db, 'colaboradores', c.id), {
      ativo: !c.ativo,
      atualizadoEm: serverTimestamp(),
    });
  }

  async function handleDelete(c: Colaborador) {
    if (!window.confirm(`Remover ${c.nome} permanentemente?`)) return;
    await deleteDoc(doc(db, 'colaboradores', c.id));
  }

  // ── render ────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">

      {/* cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-100 uppercase tracking-widest">
            Colaboradores
          </h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest">
            {colaboradores.filter(c => c.ativo).length} ativos ·{' '}
            {colaboradores.length} cadastrados
          </p>
        </div>
        {canEdit && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold px-4 py-2 rounded-lg transition-all uppercase tracking-widest"
          >
            + Novo colaborador
          </button>
        )}
      </div>

      {/* filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Buscar por nome, e-mail ou cargo…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
        />
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value as ColaboradorRole | '')}
          className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-2 text-sm text-slate-300 focus:outline-none focus:border-emerald-500/50"
        >
          <option value="">Todos os perfis</option>
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {/* tabela */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm italic">
          Iniciando Protocolos MJ...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm italic">
          {search || filterRole ? 'Nenhum resultado.' : 'Nenhum colaborador cadastrado.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-800/30">
          <table className="min-w-full divide-y divide-slate-700/50 text-sm">
            <thead>
              <tr className="bg-slate-900/50">
                {['Nome', 'CPF', 'Cargo', 'E-mail', 'Perfil', 'Status', ...(canEdit ? ['Ações'] : [])].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {filtered.map(c => (
                <tr key={c.id} className={`transition-colors hover:bg-slate-700/20 ${!c.ativo ? 'opacity-40' : ''}`}>
                  <td className="px-4 py-3 font-bold text-slate-200">{c.nome}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.cpfMask}</td>
                  <td className="px-4 py-3 text-slate-400">{c.cargo}</td>
                  <td className="px-4 py-3 text-slate-400">{c.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${ROLE_COLORS[c.role] ?? ROLE_COLORS.viewer}`}>
                      {ROLES.find(r => r.value === c.role)?.label ?? c.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${c.ativo ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                      {c.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <button onClick={() => openEdit(c)} className="text-[10px] font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300 transition-colors">Editar</button>
                        <button onClick={() => toggleAtivo(c)} className="text-[10px] font-bold uppercase tracking-wider text-yellow-400 hover:text-yellow-300 transition-colors">{c.ativo ? 'Desativar' : 'Ativar'}</button>
                        <button onClick={() => handleDelete(c)} className="text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 transition-colors">Excluir</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0a0f1d] border border-slate-700/50 rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
              <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest">
                {editTarget ? 'Editar colaborador' : 'Novo colaborador'}
              </h3>
              <button onClick={closeForm} className="text-slate-500 hover:text-slate-300 text-xl leading-none transition-colors">×</button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              {[
                { label: 'Nome completo *', key: 'nome', type: 'text', placeholder: 'Ex: Maria da Silva' },
                ...(!editTarget ? [{ label: 'CPF * (só números)', key: 'cpf', type: 'text', placeholder: '12345678900' }] : []),
                { label: 'E-mail *', key: 'email', type: 'email', placeholder: 'colaborador@cartorio.com', disabled: !!editTarget },
              ].map(({ label, key, type, placeholder, disabled }) => (
                <label key={key} className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
                  <input
                    type={type}
                    value={(form as any)[key]}
                    onChange={e => {
                      const val = key === 'cpf' ? e.target.value.replace(/\D/g, '').slice(0, 11) : e.target.value;
                      setForm(f => ({ ...f, [key]: val }));
                    }}
                    disabled={disabled}
                    placeholder={placeholder}
                    className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-40"
                  />
                </label>
              ))}

              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cargo *</span>
                <select
                  value={form.cargo}
                  onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="">Selecione…</option>
                  {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Perfil de acesso *</span>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value as ColaboradorRole }))}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
                >
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </label>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700/50">
              <button
                onClick={closeForm}
                disabled={saving}
                className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200 uppercase tracking-widest font-bold transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-black uppercase tracking-widest rounded-lg transition-all disabled:opacity-50"
              >
                {saving ? 'Salvando…' : editTarget ? 'Salvar' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ColaboradoresView;