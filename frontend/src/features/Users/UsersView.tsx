// frontend/src/features/Users/UsersView.tsx
// Gestão de Colaboradores + Matriz de Permissões por Perfil

import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { db } from '../../services/firebase';
import { AuthService } from '../../services/authService';
import {
  collection, onSnapshot, query, orderBy,
  doc, updateDoc, deleteDoc, addDoc, serverTimestamp
} from 'firebase/firestore';

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = 'SUPERADMIN' | 'gestor' | 'admin' | 'colaborador';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: Role;
  cargo?: string;
  tenantId: string;
  ativo?: boolean;
  createdAt?: any;
}

// ─── Permissões por módulo e perfil ──────────────────────────────────────────

const MODULOS = [
  { id: 'dashboard',    label: 'Dashboard',          icon: 'fa-border-all'       },
  { id: 'trilhas',      label: 'Trilhas',            icon: 'fa-road'             },
  { id: 'repositorio',  label: 'Repositório',        icon: 'fa-photo-film'       },
  { id: 'treinamento',  label: 'Treinamento AI',     icon: 'fa-graduation-cap'   },
  { id: 'exames',       label: 'Exames',             icon: 'fa-file-pen'         },
  { id: 'metas',        label: 'Metas & Premiação',  icon: 'fa-trophy'           },
  { id: 'certificados', label: 'Certificados',       icon: 'fa-certificate'      },
  { id: 'progresso',    label: 'Meu Progresso',      icon: 'fa-chart-line'       },
  { id: 'relatorios',   label: 'Relatórios',         icon: 'fa-chart-column'     },
  { id: 'auditoria',    label: 'Auditoria',          icon: 'fa-clock-rotate-left'},
  { id: 'usuarios',     label: 'Colaboradores',      icon: 'fa-users-gear'       },
  { id: 'seguranca',    label: 'Segurança',          icon: 'fa-lock'             },
];

type Nivel = 'completo' | 'leitura' | 'proprio' | '-';

const PERMISSOES: Record<string, Record<Role, Nivel>> = {
  dashboard:    { SUPERADMIN: 'completo', gestor: 'completo', admin: 'completo',  colaborador: 'proprio' },
  trilhas:      { SUPERADMIN: 'completo', gestor: 'completo', admin: 'completo',  colaborador: 'leitura' },
  repositorio:  { SUPERADMIN: 'completo', gestor: 'completo', admin: 'completo',  colaborador: 'leitura' },
  treinamento:  { SUPERADMIN: 'completo', gestor: 'completo', admin: 'completo',  colaborador: 'proprio' },
  exames:       { SUPERADMIN: 'completo', gestor: 'completo', admin: 'completo',  colaborador: 'proprio' },
  metas:        { SUPERADMIN: 'completo', gestor: 'completo', admin: 'leitura',   colaborador: 'leitura' },
  certificados: { SUPERADMIN: 'completo', gestor: 'completo', admin: 'completo',  colaborador: 'proprio' },
  progresso:    { SUPERADMIN: 'completo', gestor: 'completo', admin: 'leitura',   colaborador: 'proprio' },
  relatorios:   { SUPERADMIN: 'completo', gestor: 'completo', admin: 'leitura',   colaborador: '-'       },
  auditoria:    { SUPERADMIN: 'completo', gestor: 'completo', admin: '-',         colaborador: '-'       },
  usuarios:     { SUPERADMIN: 'completo', gestor: 'completo', admin: 'completo',  colaborador: '-'       },
  seguranca:    { SUPERADMIN: 'completo', gestor: 'completo', admin: '-',         colaborador: '-'       },
};

const NIVEL_CONFIG: Record<Nivel, { label: string; color: string; bg: string; icon: string }> = {
  completo: { label: 'Completo',   color: '#059669', bg: '#d1fae5', icon: 'fa-circle-check'  },
  leitura:  { label: 'Leitura',    color: '#4F46E5', bg: '#eef2ff', icon: 'fa-eye'            },
  proprio:  { label: 'Próprio',    color: '#D97706', bg: '#fef3c7', icon: 'fa-user'           },
  '-':      { label: 'Sem acesso', color: '#94a3b8', bg: '#f1f5f9', icon: 'fa-minus'          },
};

const ROLES: { id: Role; label: string; color: string; desc: string }[] = [
  { id: 'SUPERADMIN', label: 'Super Admin',  color: '#059669', desc: 'Acesso total a todos os cartórios' },
  { id: 'gestor',     label: 'Gestor',       color: '#4F46E5', desc: 'Gestão completa do cartório'       },
  { id: 'admin',      label: 'Admin',        color: '#D97706', desc: 'Administração de colaboradores'    },
  { id: 'colaborador',label: 'Colaborador',  color: '#64748b', desc: 'Acesso aos próprios dados'         },
];

const CARGOS = [
  'Tabelião', 'Oficial de Registro', 'Escrevente Autorizado',
  'Escrevente', 'Auxiliar Administrativo', 'Responsável PLD', 'Outro',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(ts: any): string {
  if (!ts) return '–';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-BR');
}

// ─── Main View ────────────────────────────────────────────────────────────────

type Tab = 'colaboradores' | 'permissoes';

const UsersView: React.FC = () => {
  const { state } = useApp();
  const { showToast } = useToast();
  const user = state.user!;
  const tenantId = user.tenantId;
  const isGestor = ['SUPERADMIN', 'gestor'].includes(user.role);

  const [tab, setTab] = useState<Tab>('colaboradores');
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<UserData | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '', email: '', role: 'colaborador' as Role, cargo: '', tenantId,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('name'));
    const u = onSnapshot(q, snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserData)));
      setLoading(false);
    });
    return () => u();
  }, []);

  const setF = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const abrirForm = (u?: UserData) => {
    if (u) {
      setEditUser(u);
      setForm({ name: u.name, email: u.email, role: u.role, cargo: u.cargo || '', tenantId: u.tenantId });
    } else {
      setEditUser(null);
      setForm({ name: '', email: '', role: 'colaborador', cargo: '', tenantId });
    }
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.email) { showToast('Preencha nome e e-mail.', 'error'); return; }
    setSaving(true);
    try {
      if (editUser) {
        await updateDoc(doc(db, 'users', editUser.id), { ...form });
        showToast('Colaborador atualizado!', 'success');
      } else {
        await addDoc(collection(db, 'users'), { ...form, ativo: true, createdAt: serverTimestamp() });
        showToast('Colaborador adicionado!', 'success');
      }
      setShowForm(false);
    } catch { showToast('Erro ao salvar.', 'error'); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'users', id));
    showToast('Colaborador removido.', 'success');
    setDeleteId(null);
  };

  const handleToggleAtivo = async (u: UserData) => {
    await updateDoc(doc(db, 'users', u.id), { ativo: !u.ativo });
    showToast(u.ativo ? 'Acesso suspenso.' : 'Acesso reativado.', 'success');
  };

  const filtrados = users.filter(u => {
    if (!busca) return true;
    const b = busca.toLowerCase();
    return u.name?.toLowerCase().includes(b) || u.email?.toLowerCase().includes(b) || u.cargo?.toLowerCase().includes(b);
  });

  const roleLabel = (r: Role) => ROLES.find(x => x.id === r)?.label || r;
  const roleColor = (r: Role) => ROLES.find(x => x.id === r)?.color || '#64748b';

  return (
    <div className="min-h-screen bg-[#0D1B3E]">
      <div className="max-w-7xl mx-auto p-6 space-y-6">

        {/* Modal de delete */}
        {deleteId && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
              <h3 className="text-lg font-black text-[#0A1628] mb-2">Remover colaborador?</h3>
              <p className="text-sm text-slate-500 mb-5">Esta ação não pode ser desfeita.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-[#0D1B3E] transition-all">
                  Cancelar
                </button>
                <button onClick={() => handleDelete(deleteId)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-[#0A1628] text-sm font-bold transition-all">
                  Remover
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-[#0A1628]">Colaboradores & Permissões</h2>
            <p className="text-sm text-slate-500 mt-0.5">Gerencie usuários e controle de acesso</p>
          </div>
          {isGestor && (
            <button onClick={() => abrirForm()}
              className="flex items-center gap-2 bg-[#C9A84C] hover:bg-[#A8863C] text-[#0A1628] px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm">
              <i className="fa-solid fa-plus text-xs"></i>Novo Colaborador
            </button>
          )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {ROLES.map(r => {
            const count = users.filter(u => u.role === r.id).length;
            return (
              <div key={r.id} className="bg-white border border-slate-200 rounded-[14px] p-5 shadow-sm">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: r.color + '15' }}>
                  <i className="fa-solid fa-user" style={{ color: r.color }}></i>
                </div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{r.label}</p>
                <p className="text-3xl font-black text-[#0A1628]">{count}</p>
                <p className="text-[10px] text-slate-500 mt-1">{r.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Abas */}
        <div className="bg-white border border-slate-200 rounded-[16px] shadow-sm overflow-hidden">
          <div className="flex border-b border-slate-100">
            {[
              { id: 'colaboradores', label: 'Colaboradores',    icon: 'fa-users'         },
              { id: 'permissoes',    label: 'Matriz de Acesso', icon: 'fa-shield-halved' },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id as Tab)}
                className={`flex items-center gap-2 px-5 py-4 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
                  tab === t.id
                    ? 'border-[#C9A84C] text-[#C9A84C] bg-white/50'
                    : 'border-transparent text-slate-500 hover:text-slate-600'
                }`}>
                <i className={`fa-solid ${t.icon}`}></i>{t.label}
              </button>
            ))}
          </div>

          {/* ── COLABORADORES ─────────────────────────────────────────────── */}
          {tab === 'colaboradores' && (
            <div className="p-5 space-y-4">

              {/* Formulário inline */}
              {showForm && (
                <div className="bg-[#0D1B3E] border border-slate-200 rounded-[14px] p-5 space-y-4">
                  <h4 className="text-sm font-black text-indigo-700 uppercase tracking-widest">
                    {editUser ? 'Editar Colaborador' : 'Novo Colaborador'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nome *</label>
                      <input value={form.name} onChange={e => setF('name', e.target.value)}
                        placeholder="Nome completo"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-[#C9A84C]" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">E-mail *</label>
                      <input value={form.email} onChange={e => setF('email', e.target.value)}
                        placeholder="email@cartorio.com.br" type="email"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-[#C9A84C]" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Perfil de Acesso</label>
                      <select value={form.role} onChange={e => setF('role', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-[#C9A84C]">
                        {ROLES.filter(r => r.id !== 'SUPERADMIN').map(r => (
                          <option key={r.id} value={r.id}>{r.label} — {r.desc}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Senha Inicial</label>
                      <input value={(form as any).senhaInicial || ''} onChange={e => setF('senhaInicial', e.target.value)} placeholder="Ex: cartorio123" type="text" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-[#C9A84C]" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cargo</label>
                      <select value={form.cargo} onChange={e => setF('cargo', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-[#C9A84C]">
                        <option value="">Selecione...</option>
                        {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  {/* Info de permissões do perfil selecionado */}
                  <div className="bg-white border border-indigo-100 rounded-xl p-3">
                    <p className="text-[10px] font-black text-[#C9A84C] uppercase tracking-widest mb-2">
                      Permissões do perfil: {roleLabel(form.role as Role)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {MODULOS.map(m => {
                        const nivel = PERMISSOES[m.id]?.[form.role as Role] || '-';
                        const cfg = NIVEL_CONFIG[nivel];
                        if (nivel === '-') return null;
                        return (
                          <span key={m.id} className="text-[9px] font-black px-2 py-1 rounded-lg"
                            style={{ background: cfg.bg, color: cfg.color }}>
                            {m.label}: {cfg.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowForm(false)}
                      className="px-5 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-[#0D1B3E] transition-all">
                      Cancelar
                    </button>
                    <button onClick={handleSave} disabled={saving}
                      className="flex-1 bg-[#C9A84C] hover:bg-[#A8863C] disabled:opacity-50 text-[#0A1628] px-6 py-2 rounded-xl text-xs font-bold transition-all">
                      {saving ? <><i className="fa-solid fa-spinner animate-spin mr-2"></i>Salvando...</> : 'Salvar'}
                    </button>
                  </div>
                </div>
              )}

              {/* Busca */}
              <input value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por nome, e-mail ou cargo..."
                className="bg-[#0D1B3E] border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-[#C9A84C] w-72" />

              {/* Tabela */}
              {loading ? (
                <div className="flex items-center justify-center py-12 gap-3 text-slate-500">
                  <div className="w-5 h-5 border-2 border-[#C9A84C]/50 border-t-indigo-600 rounded-full animate-spin"></div>
                  <span className="text-sm">Carregando...</span>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-[14px]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#0D1B3E] border-b border-slate-200">
                        {['Colaborador', 'E-mail', 'Cargo', 'Perfil', 'Status', 'Desde', 'Ações'].map(h => (
                          <th key={h} className="text-left p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtrados.length === 0 && (
                        <tr><td colSpan={7} className="text-center p-8 text-slate-500">Nenhum colaborador encontrado.</td></tr>
                      )}
                      {filtrados.map(u => (
                        <tr key={u.id} className={`border-b border-slate-100 hover:bg-[#0D1B3E] transition-all ${u.ativo === false ? 'opacity-50' : ''}`}>
                          <td className="p-3 font-bold text-[#0A1628]">{u.name}</td>
                          <td className="p-3 text-slate-500">{u.email || '–'}</td>
                          <td className="p-3 text-slate-500">{u.cargo || '–'}</td>
                          <td className="p-3">
                            <span className="text-[10px] font-black px-2.5 py-1 rounded-lg"
                              style={{ background: roleColor(u.role) + '15', color: roleColor(u.role) }}>
                              {roleLabel(u.role)}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                              u.ativo !== false
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                : 'bg-white text-slate-500 border border-slate-200'
                            }`}>
                              {u.ativo !== false ? 'Ativo' : 'Suspenso'}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500">{formatDate(u.createdAt)}</td>
                          <td className="p-3">
                            {isGestor && u.id !== user.id && (
                              <div className="flex items-center gap-1.5">
                                <button onClick={() => abrirForm(u)}
                                  className="w-7 h-7 rounded-lg bg-white hover:bg-white text-slate-500 hover:text-[#C9A84C] flex items-center justify-center transition-all"
                                  title="Editar">
                                  <i className="fa-solid fa-pen text-[10px]"></i>
                                </button>
                                <button onClick={() => handleToggleAtivo(u)}
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                                    u.ativo !== false
                                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-500'
                                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                                  }`}
                                  title={u.ativo !== false ? 'Suspender acesso' : 'Reativar'}>
                                  <i className={`fa-solid ${u.ativo !== false ? 'fa-ban' : 'fa-circle-check'} text-[10px]`}></i>
                                </button>
                                <button onClick={() => setDeleteId(u.id)}
                                  className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 flex items-center justify-center transition-all"
                                  title="Remover">
                                  <i className="fa-solid fa-trash text-[10px]"></i>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── MATRIZ DE PERMISSÕES ──────────────────────────────────────── */}
          {tab === 'permissoes' && (
            <div className="p-5 space-y-5">
              <p className="text-xs text-slate-500">
                Matriz de controle de acesso por perfil. As permissões são aplicadas automaticamente ao perfil atribuído ao colaborador.
              </p>

              {/* Legenda */}
              <div className="flex flex-wrap gap-3">
                {Object.entries(NIVEL_CONFIG).map(([k, v]) => (
                  <span key={k} className="inline-flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-lg"
                    style={{ background: v.bg, color: v.color }}>
                    <i className={`fa-solid ${v.icon} text-[9px]`}></i>{v.label}
                  </span>
                ))}
              </div>

              {/* Tabela de permissões */}
              <div className="overflow-x-auto border border-slate-200 rounded-[14px]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#0D1B3E] border-b border-slate-200">
                      <th className="text-left p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest w-48">Módulo</th>
                      {ROLES.map(r => (
                        <th key={r.id} className="p-3 text-center">
                          <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: r.color }}>{r.label}</div>
                          <div className="text-[9px] text-slate-500 font-normal mt-0.5">{r.desc}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MODULOS.map((m, idx) => (
                      <tr key={m.id} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-[#0D1B3E]/50'}`}>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <i className={`fa-solid ${m.icon} text-slate-500 text-[11px] w-4 text-center`}></i>
                            <span className="font-bold text-slate-700">{m.label}</span>
                          </div>
                        </td>
                        {ROLES.map(r => {
                          const nivel = PERMISSOES[m.id]?.[r.id] || '-';
                          const cfg = NIVEL_CONFIG[nivel];
                          return (
                            <td key={r.id} className="p-3 text-center">
                              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1.5 rounded-lg"
                                style={{ background: cfg.bg, color: cfg.color }}>
                                <i className={`fa-solid ${cfg.icon} text-[9px]`}></i>
                                {cfg.label}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cards explicativos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {ROLES.map(r => (
                  <div key={r.id} className="bg-white border border-slate-200 rounded-[14px] p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ background: r.color + '15' }}>
                        <i className="fa-solid fa-user text-sm" style={{ color: r.color }}></i>
                      </div>
                      <div>
                        <p className="text-sm font-black text-[#0A1628]">{r.label}</p>
                        <p className="text-[10px] text-slate-500">{r.desc}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {MODULOS.map(m => {
                        const nivel = PERMISSOES[m.id]?.[r.id] || '-';
                        const cfg = NIVEL_CONFIG[nivel];
                        return (
                          <div key={m.id} className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                              <i className={`fa-solid ${m.icon} text-[9px] text-slate-500`}></i>
                              {m.label}
                            </span>
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-lg"
                              style={{ background: cfg.bg, color: cfg.color }}>
                              {cfg.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UsersView;
