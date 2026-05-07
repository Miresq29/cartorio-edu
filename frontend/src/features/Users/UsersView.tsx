// frontend/src/features/Users/UsersView.tsx
// Gestão de Colaboradores + Matriz de Permissões por Perfil

import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { db } from '../../services/firebase';
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
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
    setImportRows(raw.map(r => {
      const name = String(r['nome']||r['name']||r['Nome']||'').trim();
      const email = String(r['email']||r['Email']||'').trim().toLowerCase();
      const cargo = String(r['cargo']||r['Cargo']||'').trim();
      const rr = String(r['perfil']||r['role']||'colaborador').trim().toLowerCase();
      const role = (['gestor','admin','colaborador'].includes(rr)?rr:'colaborador') as Role;
      const valido = !!name && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      return { name, email, cargo, role, valido };
    }));
    setImportDone(false);
  };

  const handleImportSave = async () => {
    setImporting(true);
    for (const r of importRows.filter((x:any)=>x.valido)) {
      await addDoc(collection(db,'users'),{name:r.name,email:r.email,cargo:r.cargo,role:r.role,tenantId,ativo:true,createdAt:serverTimestamp()});
    }
    setImporting(false); setImportDone(true);
    showToast(importRows.filter((x:any)=>x.valido).length+' colaboradores importados!','success');
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([['nome','email','cargo','perfil'],['Ana Costa','ana@cartorio.com','Escrevente','colaborador']]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Colaboradores');
    XLSX.writeFile(wb,'modelo_colaboradores.xlsx');
  };

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
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">

        {showImport && (<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"><div className="flex items-center justify-between p-5 border-b border-slate-200"><div><h3 className="text-sm font-black text-slate-800">Importar Colaboradores via Excel</h3><p className="text-[10px] text-slate-400 mt-0.5">Colunas: nome, email, cargo, perfil</p></div><button onClick={()=>{setShowImport(false);setImportRows([]);setImportDone(false);}} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500"><i className="fa-solid fa-xmark text-xs"></i></button></div><div className="p-5 space-y-4 flex-1 overflow-y-auto">{!importDone?(<><div onClick={()=>fileRef.current?.click()} className="border-2 border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50 rounded-2xl p-8 text-center cursor-pointer"><i className="fa-solid fa-file-excel text-3xl text-indigo-400 mb-2 block"></i><p className="text-sm font-bold text-indigo-700">Clique para selecionar o arquivo Excel</p><p className="text-[10px] text-indigo-400 mt-1">.xlsx ou .xls</p><input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} /></div><button onClick={downloadTemplate} className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest"><i className="fa-solid fa-download"></i>Baixar modelo Excel</button>{importRows.length>0&&(<div className="space-y-2"><div className="flex gap-2"><span className="text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">{importRows.filter((r:any)=>r.valido).length} válidos</span>{importRows.filter((r:any)=>!r.valido).length>0&&<span className="text-[10px] font-black text-red-500 bg-red-50 border border-red-200 px-2 py-1 rounded-lg">{importRows.filter((r:any)=>!r.valido).length} com erro</span>}</div><div className="border border-slate-200 rounded-xl overflow-auto max-h-48"><table className="w-full text-xs"><thead><tr className="bg-slate-50">{['','Nome','E-mail','Cargo','Perfil'].map(h=><th key={h} className="text-left p-2 text-[9px] font-black text-slate-500 uppercase">{h}</th>)}</tr></thead><tbody>{importRows.slice(0,15).map((r:any,i:number)=>(<tr key={i} className={order-b border-slate-100 }><td className="p-2"><i className={a-solid  text-xs}></i></td><td className="p-2 font-bold text-slate-700">{r.name}</td><td className="p-2 text-slate-500">{r.email}</td><td className="p-2 text-slate-400">{r.cargo||'–'}</td><td className="p-2"><span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{r.role}</span></td></tr>))}</tbody></table></div></div>)}</>):(<div className="flex flex-col items-center py-12 space-y-3"><div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center"><i className="fa-solid fa-circle-check text-emerald-500 text-3xl"></i></div><p className="text-lg font-black text-slate-800">Importação concluída!</p><p className="text-sm text-slate-500">{importRows.filter((r:any)=>r.valido).length} colaboradores adicionados.</p></div>)}</div>{!importDone&&importRows.filter((r:any)=>r.valido).length>0&&(<div className="p-4 border-t border-slate-200 flex gap-3"><button onClick={()=>{setShowImport(false);setImportRows([]);}} className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold">Cancelar</button><button onClick={handleImportSave} disabled={importing} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2">{importing?<><i className="fa-solid fa-spinner animate-spin"></i>Importando...</>:<><i className="fa-solid fa-file-import"></i>Importar {importRows.filter((r:any)=>r.valido).length} colaboradores</>}</button></div>)}{importDone&&<div className="p-4 border-t border-slate-200"><button onClick={()=>{setShowImport(false);setImportRows([]);setImportDone(false);}} className="w-full bg-indigo-600 text-white py-2.5 rounded-xl text-xs font-bold">Fechar</button></div>}</div></div>)}

        {/* Modal de delete */}
        {deleteId && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
              <h3 className="text-lg font-black text-slate-800 mb-2">Remover colaborador?</h3>
              <p className="text-sm text-slate-500 mb-5">Esta ação não pode ser desfeita.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-all">
                  Cancelar
                </button>
                <button onClick={() => handleDelete(deleteId)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-all">
                  Remover
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-800">Colaboradores & Permissões</h2>
            <p className="text-sm text-slate-500 mt-0.5">Gerencie usuários e controle de acesso</p>
          </div>
          {isGestor && (
            <button onClick={() => abrirForm()}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm">
              <i className="fa-solid fa-plus text-xs"></i>Novo Colaborador</button><button onClick={() => setShowImport(true)} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm"><i className="fa-solid fa-file-excel text-xs"></i>Importar Excel
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
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{r.label}</p>
                <p className="text-3xl font-black text-slate-800">{count}</p>
                <p className="text-[10px] text-slate-400 mt-1">{r.desc}</p>
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
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
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
                <div className="bg-slate-50 border border-indigo-200 rounded-[14px] p-5 space-y-4">
                  <h4 className="text-sm font-black text-indigo-700 uppercase tracking-widest">
                    {editUser ? 'Editar Colaborador' : 'Novo Colaborador'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nome *</label>
                      <input value={form.name} onChange={e => setF('name', e.target.value)}
                        placeholder="Nome completo"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">E-mail *</label>
                      <input value={form.email} onChange={e => setF('email', e.target.value)}
                        placeholder="email@cartorio.com.br" type="email"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Perfil de Acesso</label>
                      <select value={form.role} onChange={e => setF('role', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-500">
                        {ROLES.filter(r => r.id !== 'SUPERADMIN').map(r => (
                          <option key={r.id} value={r.id}>{r.label} — {r.desc}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cargo</label>
                      <select value={form.cargo} onChange={e => setF('cargo', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-500">
                        <option value="">Selecione...</option>
                        {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  {/* Info de permissões do perfil selecionado */}
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2">
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
                      className="px-5 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all">
                      Cancelar
                    </button>
                    <button onClick={handleSave} disabled={saving}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2 rounded-xl text-xs font-bold transition-all">
                      {saving ? <><i className="fa-solid fa-spinner animate-spin mr-2"></i>Salvando...</> : 'Salvar'}
                    </button>
                  </div>
                </div>
              )}

              {/* Busca */}
              <input value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por nome, e-mail ou cargo..."
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-500 w-72" />

              {/* Tabela */}
              {loading ? (
                <div className="flex items-center justify-center py-12 gap-3 text-slate-400">
                  <div className="w-5 h-5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"></div>
                  <span className="text-sm">Carregando...</span>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-[14px]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {['Colaborador', 'E-mail', 'Cargo', 'Perfil', 'Status', 'Desde', 'Ações'].map(h => (
                          <th key={h} className="text-left p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtrados.length === 0 && (
                        <tr><td colSpan={7} className="text-center p-8 text-slate-400">Nenhum colaborador encontrado.</td></tr>
                      )}
                      {filtrados.map(u => (
                        <tr key={u.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-all ${u.ativo === false ? 'opacity-50' : ''}`}>
                          <td className="p-3 font-bold text-slate-800">{u.name}</td>
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
                                : 'bg-slate-100 text-slate-400 border border-slate-200'
                            }`}>
                              {u.ativo !== false ? 'Ativo' : 'Suspenso'}
                            </span>
                          </td>
                          <td className="p-3 text-slate-400">{formatDate(u.createdAt)}</td>
                          <td className="p-3">
                            {isGestor && u.id !== user.id && (
                              <div className="flex items-center gap-1.5">
                                <button onClick={() => abrirForm(u)}
                                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 flex items-center justify-center transition-all"
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
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest w-48">Módulo</th>
                      {ROLES.map(r => (
                        <th key={r.id} className="p-3 text-center">
                          <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: r.color }}>{r.label}</div>
                          <div className="text-[9px] text-slate-400 font-normal mt-0.5">{r.desc}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MODULOS.map((m, idx) => (
                      <tr key={m.id} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <i className={`fa-solid ${m.icon} text-slate-400 text-[11px] w-4 text-center`}></i>
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
                        <p className="text-sm font-black text-slate-800">{r.label}</p>
                        <p className="text-[10px] text-slate-400">{r.desc}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {MODULOS.map(m => {
                        const nivel = PERMISSOES[m.id]?.[r.id] || '-';
                        const cfg = NIVEL_CONFIG[nivel];
                        return (
                          <div key={m.id} className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                              <i className={`fa-solid ${m.icon} text-[9px] text-slate-400`}></i>
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
