// frontend/src/features/Users/UsersView.tsx
// Gestão de Colaboradores + Matriz de Permissões por Perfil

import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { termos } from '../../utils/terminologia';
import { useToast } from '../../context/ToastContext';
import { db, functions } from '../../services/firebase';
import { httpsCallable } from 'firebase/functions';
import { useSetoresTenant } from '../../hooks/useSetoresTenant';
import {
  collection, onSnapshot, query, orderBy, where,
  doc, updateDoc, deleteDoc, addDoc, serverTimestamp, writeBatch
} from 'firebase/firestore';
import { alfa } from '../../utils/tema';

const createCollaboratorFn = httpsCallable(functions, 'createCollaborator');
const resetTenantPasswordsFn = httpsCallable(functions, 'resetTenantPasswords');

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = 'SUPERADMIN' | 'gestor' | 'admin' | 'colaborador' | 'equipe_mj';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: Role;
  cargo?: string;
  setor?: string;
  cpf?: string;
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
  dashboard:    { SUPERADMIN: 'completo', equipe_mj: 'completo', gestor: 'completo', admin: 'completo',  colaborador: 'proprio' },
  trilhas:      { SUPERADMIN: 'completo', equipe_mj: 'completo', gestor: 'completo', admin: 'completo',  colaborador: 'leitura' },
  repositorio:  { SUPERADMIN: 'completo', equipe_mj: 'completo', gestor: 'completo', admin: 'completo',  colaborador: 'leitura' },
  treinamento:  { SUPERADMIN: 'completo', equipe_mj: 'completo', gestor: 'completo', admin: 'completo',  colaborador: 'proprio' },
  exames:       { SUPERADMIN: 'completo', equipe_mj: 'completo', gestor: 'completo', admin: 'completo',  colaborador: 'proprio' },
  metas:        { SUPERADMIN: 'completo', equipe_mj: 'leitura',  gestor: 'completo', admin: 'leitura',   colaborador: 'leitura' },
  certificados: { SUPERADMIN: 'completo', equipe_mj: 'completo', gestor: 'completo', admin: 'completo',  colaborador: 'proprio' },
  progresso:    { SUPERADMIN: 'completo', equipe_mj: 'leitura',  gestor: 'completo', admin: 'leitura',   colaborador: 'proprio' },
  relatorios:   { SUPERADMIN: 'completo', equipe_mj: 'leitura',  gestor: 'completo', admin: 'leitura',   colaborador: '-'       },
  auditoria:    { SUPERADMIN: 'completo', equipe_mj: 'leitura',  gestor: 'completo', admin: '-',         colaborador: '-'       },
  usuarios:     { SUPERADMIN: 'completo', equipe_mj: 'completo', gestor: 'completo', admin: 'completo',  colaborador: '-'       },
  seguranca:    { SUPERADMIN: 'completo', equipe_mj: '-',        gestor: 'completo', admin: '-',         colaborador: '-'       },
};

const NIVEL_CONFIG: Record<Nivel, { label: string; color: string; bg: string; icon: string }> = {
  completo: { label: 'Completo',   color: '#059669', bg: '#d1fae5', icon: 'fa-circle-check'  },
  leitura:  { label: 'Leitura',    color: '#4F46E5', bg: '#eef2ff', icon: 'fa-eye'            },
  proprio:  { label: 'Próprio',    color: '#D97706', bg: '#fef3c7', icon: 'fa-user'           },
  '-':      { label: 'Sem acesso', color: '#94a3b8', bg: '#f1f5f9', icon: 'fa-minus'          },
};

const ROLES: { id: Role; label: string; color: string; desc: string }[] = [
  { id: 'SUPERADMIN', label: 'Super Admin',  color: '#059669', desc: 'Acesso total a todos os clientes' },
  { id: 'equipe_mj',  label: 'Equipe MJ',    color: '#0891B2', desc: 'Suporte MJ Consultoria — ajuda em todos os clientes' },
  { id: 'gestor',     label: 'Gestor',       color: '#4F46E5', desc: 'Gestão completa da empresa'       },
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
  const { state, tenantId, tipoOrganizacao } = useApp();
  const t = termos(tipoOrganizacao);
  const { showToast } = useToast();
  const user = state.user!;
  const isGestor = ['SUPERADMIN', 'equipe_mj', 'gestor', 'admin'].includes(user.role);

  const isSuperAdmin = user.role === 'SUPERADMIN';
  // Equipe MJ (staff interno, sem cartório) enxerga todos os cartórios igual ao SUPERADMIN,
  // mas só o SUPERADMIN de verdade pode criar outra conta de equipe_mj (evita autorreplicação).
  const isPlatformStaff = isSuperAdmin || user.role === 'equipe_mj';
  // SUPERADMIN só enxerga todos os cartórios no modo global (fora de um cartório ativo); ao
  // "entrar" em um cartório (state.activeTenantId), deve ver apenas os colaboradores dele.
  const superAdminGlobal = isPlatformStaff && !state.activeTenantId;
  // Equipe MJ tem "acesso amplo" só DEPOIS de entrar num cartório especifico (preview, igual ao
  // SUPERADMIN) — sem isso, nao pode listar colaboradores de todos os clientes de uma vez (isso
  // vazava nome/e-mail de colaboradores de outros cartorios so por logar). Só o SUPERADMIN de
  // verdade mantém a listagem global irrestrita.
  const verTodasEmpresas = isSuperAdmin && !state.activeTenantId;
  const equipeMjSemCartorioSelecionado = user.role === 'equipe_mj' && !state.activeTenantId;

  const [tab, setTab] = useState<Tab>('colaboradores');
  const [users, setUsers] = useState<UserData[]>([]);
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroCartorio, setFiltroCartorio] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<UserData | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showReset, setShowReset] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  // Cartório concretamente "em foco" agora: o filtro escolhido na listagem global, ou o
  // próprio cartório quando já não se está na visão global (dentro de um preview/tenant fixo).
  const tenantEmFoco = filtroCartorio || (!superAdminGlobal ? tenantId : '');

  const [form, setForm] = useState({
    name: '', email: '', role: 'colaborador' as Role, cargo: '', setor: '', cpf: '', tenantId: superAdminGlobal ? '' : tenantId,
  });
  const [saving, setSaving] = useState(false);

  // Edição em lote: perfil (só SUPERADMIN — a regra do Firestore não deixa gestor trocar role)
  // e cargo (qualquer gestor). Contas de plataforma (SUPERADMIN/Equipe MJ) e o próprio usuário
  // ficam fora da seleção.
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [loteRole, setLoteRole] = useState('');
  const [loteCargo, setLoteCargo] = useState('');
  const [loteSetor, setLoteSetor] = useState('');
  const [aplicandoLote, setAplicandoLote] = useState(false);

  // Setores do cliente em foco (lista/lote/painel) e do cliente escolhido no formulário.
  const { setores: setoresFoco, salvarSetores } = useSetoresTenant(tenantEmFoco || undefined);
  const { setores: setoresForm } = useSetoresTenant(form.tenantId || undefined);
  const [showSetores, setShowSetores] = useState(false);
  const [novoSetor, setNovoSetor] = useState('');
  const adicionarSetor = async () => {
    const nome = novoSetor.trim();
    if (!nome) return;
    if (setoresFoco.some(s => s.toLowerCase() === nome.toLowerCase())) { showToast('Esse setor já existe.', 'info'); return; }
    try { await salvarSetores([...setoresFoco, nome]); setNovoSetor(''); }
    catch { showToast('Não foi possível salvar o setor.', 'error'); }
  };
  const removerSetor = async (nome: string) => {
    const emUso = users.filter(u => u.tenantId === tenantEmFoco && u.setor === nome).length;
    if (!confirm(emUso ? `${emUso} colaborador(es) estão no setor "${nome}". Remover da lista mesmo assim? (o cadastro deles não muda)` : `Remover o setor "${nome}"?`)) return;
    try { await salvarSetores(setoresFoco.filter(s => s !== nome)); }
    catch { showToast('Não foi possível remover o setor.', 'error'); }
  };

  useEffect(() => {
    if (equipeMjSemCartorioSelecionado) { setUsers([]); setLoading(false); return; }
    const q = verTodasEmpresas
      ? query(collection(db, 'users'), orderBy('name'))
      : query(collection(db, 'users'), where('tenantId', '==', tenantId), orderBy('name'));
    const u = onSnapshot(q, snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserData)));
      setLoading(false);
    }, err => {
      console.error('Erro ao carregar colaboradores:', err);
      showToast('Erro ao carregar colaboradores. Tente recarregar a página.', 'error');
      setLoading(false);
    });
    return () => u();
  }, [tenantId, verTodasEmpresas, equipeMjSemCartorioSelecionado]);

  useEffect(() => {
    if (!isPlatformStaff) return;
    const q = query(collection(db, 'tenants'), orderBy('name'));
    return onSnapshot(q, snap => {
      setTenants(snap.docs.map(d => ({ id: d.id, name: (d.data() as any).name || d.id })));
    });
  }, [isPlatformStaff]);

  const setF = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const abrirForm = (u?: UserData) => {
    if (u) {
      setEditUser(u);
      setForm({ name: u.name, email: u.email, role: u.role, cargo: u.cargo || '', setor: u.setor || '', cpf: u.cpf || '', tenantId: u.tenantId });
    } else {
      setEditUser(null);
      setForm({ name: '', email: '', role: 'colaborador', cargo: '', setor: '', cpf: '', tenantId: superAdminGlobal ? '' : tenantId });
    }
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.email) { showToast('Preencha nome e e-mail.', 'error'); return; }
    if (!/^\S{2,}(\s+\S{2,})+$/.test(form.name.trim())) { showToast('Informe nome e sobrenome completos.', 'error'); return; }
    if (superAdminGlobal && form.role !== 'equipe_mj' && form.role !== 'SUPERADMIN' && !form.tenantId) { showToast('Selecione o cliente para este colaborador.', 'error'); return; }
    setSaving(true);
    try {
      if (editUser) {
        await updateDoc(doc(db, 'users', editUser.id), { ...form });
        showToast('Colaborador atualizado!', 'success');
      } else {
        const tempPassword = 'Acesso@' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
        const result: any = await createCollaboratorFn({ ...form, password: tempPassword });
        if (form.setor && result.data?.uid) {
          await updateDoc(doc(db, 'users', result.data.uid), { setor: form.setor }).catch(() => {});
        }
        await addDoc(collection(db, 'auditLogs'), {
          tipo: 'USER_CREATED', descricao: 'Usuario criado pelo gestor', usuario: form.email,
          usuarioId: user.id, tenantId: form.tenantId, severity: 'INFO', createdAt: serverTimestamp(),
        }).catch(() => {});
        const msg = result.data?.reused
          ? `Colaborador ${form.name} vinculado! A conta de acesso já existia e o perfil foi completado.\n\nSenha temporária: ${tempPassword}\n\nComunique ao colaborador — ele deverá alterá-la no primeiro acesso.`
          : `Colaborador ${form.name} adicionado!\n\nSenha temporária: ${tempPassword}\n\nComunique ao colaborador — ele deverá alterá-la no primeiro acesso.`;
        alert(msg);
      }
      setShowForm(false);
    } catch (err: any) {
      const msg = err.code === 'functions/permission-denied'
        ? 'Você não tem permissão para criar este colaborador.'
        : err.message || 'Erro ao salvar.';
      showToast(msg, 'error');
    }
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

  const handleResetTenantPasswords = async () => {
    if (!tenantEmFoco) return;
    setResetting(true);
    try {
      const result: any = await resetTenantPasswordsFn({ tenantId: tenantEmFoco, password: resetPassword });
      const { total, updated, failed } = result.data || {};
      if (failed?.length) {
        showToast(`Senha redefinida para ${updated}/${total} colaboradores. Falhou para: ${failed.join(', ')}`, 'error');
      } else {
        showToast(`Senha redefinida para ${updated} colaborador(es). Todos precisarão trocá-la no próximo login.`, 'success');
      }
      setShowReset(false);
      setResetPassword('');
    } catch (err: any) {
      showToast(err.message || 'Erro ao redefinir senhas.', 'error');
    }
    setResetting(false);
  };

  const filtrados = users.filter(u => {
    if (filtroCartorio && u.tenantId !== filtroCartorio) return false;
    if (!busca) return true;
    const b = busca.toLowerCase();
    return u.name?.toLowerCase().includes(b) || u.email?.toLowerCase().includes(b) || u.cargo?.toLowerCase().includes(b);
  });

  const selecionavel = (u: UserData) => isGestor && u.id !== user.id && u.role !== 'SUPERADMIN' && u.role !== 'equipe_mj';
  const filtradosSelecionaveis = filtrados.filter(selecionavel);
  const todosMarcados = filtradosSelecionaveis.length > 0 && filtradosSelecionaveis.every(u => selecionados.has(u.id));
  const alternarSelecao = (id: string) => setSelecionados(s => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const alternarTodos = () => setSelecionados(todosMarcados ? new Set() : new Set(filtradosSelecionaveis.map(u => u.id)));

  const aplicarLote = async () => {
    const alvos = users.filter(u => selecionados.has(u.id) && selecionavel(u));
    const mudanca: Record<string, string> = {};
    if (loteRole && isSuperAdmin) mudanca.role = loteRole;
    if (loteCargo) mudanca.cargo = loteCargo;
    if (loteSetor) mudanca.setor = loteSetor === '__nenhum__' ? '' : loteSetor;
    if (!alvos.length || !Object.keys(mudanca).length) return;
    setAplicandoLote(true);
    try {
      for (let i = 0; i < alvos.length; i += 400) {
        const batch = writeBatch(db);
        alvos.slice(i, i + 400).forEach(u => batch.update(doc(db, 'users', u.id), mudanca));
        await batch.commit();
      }
      await addDoc(collection(db, 'auditLogs'), {
        tipo: 'USERS_BULK_UPDATE',
        descricao: `Alteração em lote de ${alvos.length} colaborador(es): ${Object.entries(mudanca).map(([k, v]) => `${k} → ${v}`).join(', ')}`,
        usuario: user.name || user.email, usuarioId: user.id, tenantId: tenantEmFoco || tenantId || '',
        metadata: { ids: alvos.map(u => u.id), ...mudanca }, severity: 'INFO', createdAt: serverTimestamp(),
      }).catch(() => {});
      showToast(`${alvos.length} colaborador(es) atualizado(s).`, 'success');
      setSelecionados(new Set()); setLoteRole(''); setLoteCargo(''); setLoteSetor('');
    } catch (err: any) {
      showToast(err.code === 'permission-denied'
        ? 'Sem permissão para alterar um ou mais desses colaboradores — nada foi alterado.'
        : (err.message || 'Erro ao aplicar a alteração em lote.'), 'error');
    }
    setAplicandoLote(false);
  };

  const roleLabel = (r: Role) => ROLES.find(x => x.id === r)?.label || r;
  const roleColor = (r: Role) => ROLES.find(x => x.id === r)?.color || '#64748b';

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">

        {/* Modal de delete */}
        {deleteId && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
              <h3 className="text-lg font-black text-navy mb-2">Remover colaborador?</h3>
              <p className="text-sm text-slate-500 mb-5">Esta ação não pode ser desfeita.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-white transition-all">
                  Cancelar
                </button>
                <button onClick={() => handleDelete(deleteId)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-navy text-sm font-bold transition-all">
                  Remover
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de redefinição de senha em massa */}
        {showReset && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl space-y-4">
              <div>
                <h3 className="text-lg font-black text-navy mb-1">Redefinir senha de todos os colaboradores</h3>
                <p className="text-sm text-slate-500">
                  Cliente: <span className="font-mono text-blue-600">{tenantEmFoco}</span>. Todos os colaboradores desse cliente
                  passarão a usar a senha abaixo e serão obrigados a trocá-la no próximo login.
                </p>
              </div>
              <input type="text" value={resetPassword} onChange={e => setResetPassword(e.target.value)}
                placeholder="Senha temporária (mín. 12 caracteres, maiúscula, minúscula, número e símbolo)"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-gold" />
              <div className="flex gap-3">
                <button onClick={() => { setShowReset(false); setResetPassword(''); }}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-white transition-all">
                  Cancelar
                </button>
                <button onClick={handleResetTenantPasswords} disabled={resetting || !resetPassword}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold transition-all">
                  {resetting ? <><i className="fa-solid fa-circle-notch animate-spin mr-2"></i>Redefinindo...</> : 'Redefinir para todos'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-navy">Colaboradores & Permissões</h2>
            <p className="text-sm text-slate-500 mt-0.5">Gerencie usuários e controle de acesso</p>
          </div>
          <div className="flex items-center gap-2">
            {isPlatformStaff && tenantEmFoco && (
              <button onClick={() => setShowReset(true)}
                className="flex items-center gap-2 bg-white border border-red-200 hover:bg-red-50 text-red-500 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm">
                <i className="fa-solid fa-key text-xs"></i>Redefinir senha de todos
              </button>
            )}
            {isGestor && (
              <button onClick={() => abrirForm()}
                className="flex items-center gap-2 bg-gold hover:bg-[#A8863C] text-navy px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm">
                <i className="fa-solid fa-plus text-xs"></i>Novo Colaborador
              </button>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {ROLES.map(r => {
            const count = users.filter(u => u.role === r.id).length;
            return (
              <div key={r.id} className="bg-white border border-slate-200 rounded-[14px] p-5 shadow-sm">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: alfa(r.color, '15') }}>
                  <i className="fa-solid fa-user" style={{ color: r.color }}></i>
                </div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{r.label}</p>
                <p className="text-3xl font-black text-navy">{count}</p>
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
                    ? 'border-gold text-gold bg-white/50'
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
                <div className="bg-white border border-slate-200 rounded-[14px] p-5 space-y-4">
                  <h4 className="text-sm font-black text-indigo-700 uppercase tracking-widest">
                    {editUser ? 'Editar Colaborador' : 'Novo Colaborador'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nome *</label>
                      <input value={form.name} onChange={e => setF('name', e.target.value)}
                        placeholder="Nome completo"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-gold" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">E-mail *</label>
                      <input value={form.email} onChange={e => setF('email', e.target.value)}
                        placeholder="email@suaempresa.com.br" type="email"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-gold" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Perfil de Acesso</label>
                      <select value={form.role} onChange={e => {
                          const novoRole = e.target.value as Role;
                          setForm(f => ({ ...f, role: novoRole, tenantId: (novoRole === 'equipe_mj' || novoRole === 'SUPERADMIN') ? '' : f.tenantId }));
                        }}
                        title="Perfil de acesso"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-gold">
                        {ROLES.filter(r =>
                          (r.id !== 'SUPERADMIN' || (isSuperAdmin && !!editUser))
                          && (r.id !== 'equipe_mj' || isSuperAdmin)
                        ).map(r => (
                          <option key={r.id} value={r.id}>{r.label} — {r.desc}</option>
                        ))}
                      </select>
                      {isSuperAdmin && !editUser && (
                        <p className="text-[9px] text-slate-400 mt-1">
                          Para promover alguém a Super Admin, crie primeiro como Equipe MJ/Gestor e depois edite o perfil.
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Senha Inicial</label>
                      <input value={(form as any).senhaInicial || ''} onChange={e => setF('senhaInicial', e.target.value)} placeholder="Ex: empresa123" type="text" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-gold" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cargo</label>
                      <select value={form.cargo} onChange={e => setF('cargo', e.target.value)}
                        title="Cargo do colaborador"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-gold">
                        <option value="">Selecione...</option>
                        {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Setor</label>
                      <select value={form.setor} onChange={e => setF('setor', e.target.value)}
                        title="Setor do colaborador" disabled={setoresForm.length === 0}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-gold disabled:bg-slate-50 disabled:text-slate-400">
                        <option value="">{setoresForm.length === 0 ? 'Cadastre os setores do cliente em "Setores"' : 'Sem setor'}</option>
                        {setoresForm.map(s => <option key={s} value={s}>{s}</option>)}
                        {form.setor && !setoresForm.includes(form.setor) && <option value={form.setor}>{form.setor} (removido da lista)</option>}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">CPF (opcional)</label>
                      <input value={form.cpf} onChange={e => setF('cpf', e.target.value)}
                        placeholder="000.000.000-00"
                        title="Usado apenas no hash de integridade do certificado — nunca exibido no PDF"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-gold" />
                    </div>
                    {isPlatformStaff && (form.role === 'equipe_mj' || form.role === 'SUPERADMIN') && (
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cliente</label>
                        <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-400 italic">
                          {form.role === 'SUPERADMIN'
                            ? 'Não se aplica — Super Admin tem acesso total a todos os clientes'
                            : 'Não se aplica — Equipe MJ atende todos os clientes'}
                        </div>
                      </div>
                    )}
                    {/* No modo de visualização de um cliente a lista de clientes não aparece (pode estar sendo
                        apresentada): o cadastro fica no cliente visualizado. */}
                    {isPlatformStaff && !state.activeTenantId && form.role !== 'equipe_mj' && form.role !== 'SUPERADMIN' && (
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          Cliente <span className="text-red-400">*</span>
                        </label>
                        <select value={form.tenantId} onChange={e => setF('tenantId', e.target.value)}
                          title="Cliente do colaborador"
                          className="w-full bg-white border border-gold/60 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-gold">
                          <option value="">Selecione o cliente...</option>
                          {tenants.map(t => (
                            <option key={t.id} value={t.id}>{t.name} — {t.id}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  {/* Info de permissões do perfil selecionado */}
                  <div className="bg-white border border-indigo-100 rounded-xl p-3">
                    <p className="text-[10px] font-black text-gold uppercase tracking-widest mb-2">
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
                      className="px-5 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-white transition-all">
                      Cancelar
                    </button>
                    <button onClick={handleSave} disabled={saving}
                      className="flex-1 bg-gold hover:bg-[#A8863C] disabled:opacity-50 text-navy px-6 py-2 rounded-xl text-xs font-bold transition-all">
                      {saving ? <><i className="fa-solid fa-spinner animate-spin mr-2"></i>Salvando...</> : 'Salvar'}
                    </button>
                  </div>
                </div>
              )}

              {/* Busca + filtro por cartório (visível apenas na listagem global) */}
              <div className="flex flex-wrap gap-3">
                <input value={busca} onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar por nome, e-mail ou cargo..."
                  className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-gold w-72" />
                {isGestor && tenantEmFoco && (
                  <button onClick={() => setShowSetores(v => !v)}
                    className="flex items-center gap-2 bg-white border border-slate-200 hover:border-gold text-slate-600 px-4 py-2.5 rounded-xl text-sm font-bold transition-all">
                    <i className="fa-solid fa-sitemap text-xs text-gold"></i>Setores ({setoresFoco.length})
                  </button>
                )}
                {verTodasEmpresas && (
                  <select value={filtroCartorio} onChange={e => setFiltroCartorio(e.target.value)}
                    title="Filtrar por cliente"
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-gold">
                    <option value="">Todos os clientes</option>
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>{t.name} — {t.id}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Setores do cliente */}
              {showSetores && isGestor && tenantEmFoco && (
                <div className="bg-white border border-slate-200 rounded-[14px] p-4 space-y-3">
                  <div>
                    <p className="text-xs font-black text-navy uppercase tracking-widest">Setores do cliente</p>
                    <p className="text-[11px] text-slate-500">Usados no cadastro do colaborador, no público das trilhas e no relatório de erros por setor.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {setoresFoco.length === 0 && <span className="text-xs text-slate-400 italic">Nenhum setor cadastrado ainda.</span>}
                    {setoresFoco.map(s => (
                      <span key={s} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700">
                        {s}
                        <span className="text-[10px] text-slate-400 font-normal">{users.filter(u => u.tenantId === tenantEmFoco && u.setor === s).length}</span>
                        <button onClick={() => removerSetor(s)} title={`Remover ${s}`} className="text-slate-400 hover:text-red-500">
                          <i className="fa-solid fa-xmark text-[10px]"></i>
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={novoSetor} onChange={e => setNovoSetor(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') adicionarSetor(); }}
                      placeholder="Novo setor (ex.: Atendimento, Financeiro, TI)" maxLength={60}
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-700 outline-none focus:border-gold" />
                    <button onClick={adicionarSetor} disabled={!novoSetor.trim()}
                      className="bg-gold hover:bg-[#A8863C] disabled:opacity-50 text-navy px-4 py-2 rounded-xl text-xs font-bold transition-all">
                      Adicionar
                    </button>
                  </div>
                </div>
              )}

              {/* Barra de alteração em lote */}
              {selecionados.size > 0 && (
                <div className="flex flex-wrap items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-[14px] px-4 py-3">
                  <span className="text-xs font-black text-indigo-700">{selecionados.size} selecionado(s)</span>
                  {isSuperAdmin && (
                    <select value={loteRole} onChange={e => setLoteRole(e.target.value)} title="Novo perfil"
                      className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:border-gold">
                      <option value="">Perfil: manter</option>
                      {ROLES.filter(r => r.id !== 'SUPERADMIN' && r.id !== 'equipe_mj').map(r => (
                        <option key={r.id} value={r.id}>Perfil → {r.label}</option>
                      ))}
                    </select>
                  )}
                  <select value={loteCargo} onChange={e => setLoteCargo(e.target.value)} title="Novo cargo"
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:border-gold">
                    <option value="">Cargo: manter</option>
                    {CARGOS.map(c => <option key={c} value={c}>Cargo → {c}</option>)}
                  </select>
                  {setoresFoco.length > 0 && (
                    <select value={loteSetor} onChange={e => setLoteSetor(e.target.value)} title="Novo setor"
                      className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:border-gold">
                      <option value="">Setor: manter</option>
                      {setoresFoco.map(s => <option key={s} value={s}>Setor → {s}</option>)}
                      <option value="__nenhum__">Setor → (sem setor)</option>
                    </select>
                  )}
                  <button onClick={aplicarLote} disabled={aplicandoLote || (!loteCargo && !loteSetor && !(isSuperAdmin && loteRole))}
                    className="bg-gold hover:bg-[#A8863C] disabled:opacity-50 text-navy px-4 py-2 rounded-xl text-xs font-bold transition-all">
                    {aplicandoLote ? <><i className="fa-solid fa-spinner animate-spin mr-2"></i>Aplicando...</> : `Aplicar a ${selecionados.size}`}
                  </button>
                  <button onClick={() => setSelecionados(new Set())}
                    className="text-xs font-bold text-slate-500 hover:text-slate-700">Limpar seleção</button>
                </div>
              )}

              {/* Tabela */}
              {equipeMjSemCartorioSelecionado ? (
                <div className="flex flex-col items-center justify-center gap-3 py-14 text-center bg-white border border-slate-200 rounded-[14px]">
                  <i className="fa-solid fa-building-circle-arrow-right text-2xl text-slate-300"></i>
                  <p className="text-sm font-bold text-slate-600">Selecione um cliente para ver os colaboradores dele</p>
                  <p className="text-xs text-slate-400 max-w-md">
                    Para ver e gerenciar os colaboradores de um cliente específico, acesse "Gestão de Empresas" e clique em "Acessar" no cliente desejado.
                  </p>
                </div>
              ) : loading ? (
                <div className="flex items-center justify-center py-12 gap-3 text-slate-500">
                  <div className="w-5 h-5 border-2 border-gold/50 border-t-indigo-600 rounded-full animate-spin"></div>
                  <span className="text-sm">Carregando...</span>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-[14px]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-white border-b border-slate-200">
                        {isGestor && (
                          <th className="p-3 w-8">
                            <input type="checkbox" checked={todosMarcados} onChange={alternarTodos}
                              disabled={filtradosSelecionaveis.length === 0}
                              title="Selecionar todos os colaboradores listados" className="accent-indigo-600 cursor-pointer" />
                          </th>
                        )}
                        {['Colaborador', 'E-mail', 'Cargo', 'Setor', ...(isPlatformStaff ? ['Cliente'] : []), 'Perfil', 'Status', 'Desde', 'Ações'].map(h => (
                          <th key={h} className="text-left p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtrados.length === 0 && (
                        <tr><td colSpan={(isPlatformStaff ? 9 : 8) + (isGestor ? 1 : 0)} className="text-center p-8 text-slate-500">Nenhum colaborador encontrado.</td></tr>
                      )}
                      {filtrados.map(u => (
                        <tr key={u.id} className={`border-b border-slate-100 hover:bg-white transition-all ${u.ativo === false ? 'opacity-50' : ''}`}>
                          {isGestor && (
                            <td className="p-3">
                              {selecionavel(u) && (
                                <input type="checkbox" checked={selecionados.has(u.id)} onChange={() => alternarSelecao(u.id)}
                                  title={`Selecionar ${u.name}`} className="accent-indigo-600 cursor-pointer" />
                              )}
                            </td>
                          )}
                          <td className="p-3 font-bold text-navy">{u.name}</td>
                          <td className="p-3 text-slate-500">{u.email || '–'}</td>
                          <td className="p-3 text-slate-500">{u.cargo || '–'}</td>
                          <td className="p-3 text-slate-500">{u.setor || '–'}</td>
                          {isPlatformStaff && (
                            <td className="p-3">
                              <span className="text-[10px] font-mono bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-lg">
                                {u.tenantId || '–'}
                              </span>
                            </td>
                          )}
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
                                  className="w-7 h-7 rounded-lg bg-white hover:bg-white text-slate-500 hover:text-gold flex items-center justify-center transition-all"
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
                    <tr className="bg-white border-b border-slate-200">
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
                      <tr key={m.id} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-white/50'}`}>
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
                        style={{ background: alfa(r.color, '15') }}>
                        <i className="fa-solid fa-user text-sm" style={{ color: r.color }}></i>
                      </div>
                      <div>
                        <p className="text-sm font-black text-navy">{r.label}</p>
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
