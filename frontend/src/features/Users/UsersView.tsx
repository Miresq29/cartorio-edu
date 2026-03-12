import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { User, UserRole } from '../../types';
import { db } from '../../services/firebase';
import {
  collection, onSnapshot, query, orderBy,
  doc, updateDoc, deleteDoc, addDoc, serverTimestamp
} from 'firebase/firestore';

// helpers LGPD
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

const CARGOS = [
  'Tabelião', 'Oficial de Registro', 'Escrevente Autorizado',
  'Escrevente', 'Auxiliar Administrativo', 'Responsável PLD', 'Outro',
];

const UsersView: React.FC = () => {
  const { state } = useApp();
  const { showToast } = useToast();

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'atendente' as UserRole,
    tenantId: '',
    cpf: '',
    cargo: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('name'));
    const unsub = onSnapshot(q, snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;
    if (formData.cpf && formData.cpf.replace(/\D/g, '').length !== 11) {
      showToast('CPF inválido — informe os 11 dígitos ou deixe em branco.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      let cpfMask = '', cpfHash = '';
      if (formData.cpf) {
        cpfMask = maskCpf(formData.cpf);
        cpfHash = await hashCpf(formData.cpf);
      }
      await addDoc(collection(db, 'users'), {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        tenantId: formData.tenantId,
        cargo: formData.cargo,
        cpfMask,
        cpfHash,
        active: true,
        isFirstLogin: true,
        totalConsultas: 0,
        topicosConsultados: [],
        treinamentosConcluidos: [],
        trilhaAtual: '',
        scoreConformidade: 0,
        createdAt: serverTimestamp(),
        createdBy: state.user?.id
      });
      showToast(`Usuário ${formData.name} cadastrado!`, 'success');
      setFormData({ name: '', email: '', role: 'atendente', tenantId: '', cpf: '', cargo: '' });
    } catch (err: any) {
      showToast(err.message || 'Erro ao cadastrar.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (userId: string, currentActive: boolean, userName: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { active: !currentActive });
      showToast(`${userName} ${!currentActive ? 'ativado' : 'desativado'}.`, 'success');
    } catch {
      showToast('Erro ao atualizar status.', 'error');
    }
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (deleteConfirmId === userId) {
      try {
        await deleteDoc(doc(db, 'users', userId));
        showToast(`${userName} excluído.`, 'success');
      } catch {
        showToast('Erro ao excluir usuário.', 'error');
      }
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(userId);
      setTimeout(() => setDeleteConfirmId(null), 3000);
    }
  };

  const roleColors: Record<string, string> = {
    SUPERADMIN: 'text-amber-400 bg-amber-400/10',
    admin: 'text-blue-400 bg-blue-400/10',
    gestor: 'text-purple-400 bg-purple-400/10',
    auditor: 'text-emerald-400 bg-emerald-400/10',
    expert: 'text-cyan-400 bg-cyan-400/10',
    atendente: 'text-slate-400 bg-slate-400/10',
    viewer: 'text-slate-500 bg-slate-500/10',
  };

  return (
    <div className="p-10 space-y-8 bg-[#05080f] min-h-screen animate-in fade-in">
      <header>
        <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
          Gestão de <span className="text-blue-500">Acessos</span>
        </h2>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">
          MJ Consultoria // {users.length} operador(es) cadastrado(s)
        </p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Formulário — idêntico ao original + CPF e Cargo */}
        <form onSubmit={handleAddUser} className="xl:col-span-1 bg-[#0a111f] border border-slate-800 rounded-[30px] p-8 space-y-4 shadow-2xl">
          <h3 className="text-white font-bold text-sm uppercase mb-4 italic">Novo Operador</h3>

          <input
            type="text" placeholder="Nome Completo" required
            className="w-full bg-[#05080f] border border-slate-800 rounded-2xl p-4 text-white outline-none focus:border-blue-600"
            value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
          />

          <input
            type="email" placeholder="E-mail" required
            className="w-full bg-[#05080f] border border-slate-800 rounded-2xl p-4 text-white outline-none focus:border-blue-600"
            value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
          />

          {/* NOVO: CPF opcional, mascarado LGPD */}
          <input
            type="text" placeholder="CPF (só números — opcional)" maxLength={11}
            className="w-full bg-[#05080f] border border-slate-800 rounded-2xl p-4 text-white outline-none focus:border-blue-600 font-mono tracking-widest"
            value={formData.cpf}
            onChange={e => setFormData({ ...formData, cpf: e.target.value.replace(/\D/g, '').slice(0, 11) })}
          />

          <input
            type="text" placeholder="ID do Cartório (ex: cartorio-01)"
            className="w-full bg-[#05080f] border border-slate-800 rounded-2xl p-4 text-white outline-none focus:border-blue-600"
            value={formData.tenantId} onChange={e => setFormData({ ...formData, tenantId: e.target.value })}
          />

          {/* NOVO: Cargo */}
          <select
            className="w-full bg-[#05080f] border border-slate-800 rounded-2xl p-4 text-slate-300 outline-none"
            value={formData.cargo} onChange={e => setFormData({ ...formData, cargo: e.target.value })}
          >
            <option value="">Cargo (opcional)</option>
            {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            className="w-full bg-[#05080f] border border-slate-800 rounded-2xl p-4 text-slate-300 outline-none"
            value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
          >
            <option value="atendente">Atendente</option>
            <option value="gestor">Gestor</option>
            <option value="auditor">Auditor</option>
            <option value="expert">Expert</option>
            <option value="admin">Admin</option>
            <option value="SUPERADMIN">SuperAdmin MJ</option>
          </select>

          <p className="text-[9px] text-slate-600 italic">
            * CPF mascarado automaticamente (LGPD). O usuário receberá acesso e deverá criar sua senha no primeiro login.
          </p>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-blue-500 transition-all shadow-lg disabled:opacity-50"
          >
            {isSaving ? 'Cadastrando...' : 'Gerar Acesso'}
          </button>
        </form>

        {/* Tabela — idêntica ao original + coluna CPF/Cargo, Uso e linha expansível */}
        <div className="xl:col-span-2 bg-[#0a111f] border border-slate-800 rounded-[30px] p-8 overflow-hidden shadow-2xl">
          {loading ? (
            <p className="text-slate-600 text-xs text-center py-10 animate-pulse">Carregando usuários...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-800">
                    <th className="pb-6">Operador</th>
                    <th className="pb-6">CPF / Cargo</th>
                    <th className="pb-6">Cartório</th>
                    <th className="pb-6">Perfil</th>
                    <th className="pb-6">Uso</th>
                    <th className="pb-6">Status</th>
                    <th className="pb-6">Ações</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {users.map((user: any) => (
                    <React.Fragment key={user.id}>
                      {/* linha principal — clique expande detalhes */}
                      <tr
                        className="border-b border-slate-800/50 hover:bg-white/5 transition-all cursor-pointer"
                        onClick={() => setExpandedId(expandedId === user.id ? null : user.id)}
                      >
                        <td className="py-5">
                          <p className="text-white font-bold">{user.name}</p>
                          <p className="text-[10px] text-slate-500 lowercase">{user.email}</p>
                        </td>
                        {/* NOVO: CPF mascarado + cargo */}
                        <td className="py-5">
                          <p className="font-mono text-[10px] text-slate-400">{user.cpfMask || '—'}</p>
                          <p className="text-[10px] text-slate-500">{user.cargo || '—'}</p>
                        </td>
                        <td className="py-5 text-blue-400 font-mono text-[10px] uppercase">{user.tenantId || '—'}</td>
                        <td className="py-5">
                          <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${roleColors[user.role] || 'text-slate-400 bg-slate-800'}`}>
                            {user.role}
                          </span>
                        </td>
                        {/* NOVO: contadores de uso */}
                        <td className="py-5">
                          <p className="text-[10px] text-slate-400">
                            <span className="text-emerald-400 font-bold">{user.totalConsultas ?? 0}</span> consultas
                          </p>
                          <p className="text-[10px] text-slate-600">{user.treinamentosConcluidos?.length ?? 0} treinamentos</p>
                        </td>
                        <td className="py-5">
                          <button
                            onClick={e => { e.stopPropagation(); handleToggleActive(user.id, user.active, user.name); }}
                            className="flex items-center gap-2 group"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${user.active ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                            <span className={`font-bold uppercase text-[9px] group-hover:underline ${user.active ? 'text-slate-300' : 'text-red-400'}`}>
                              {user.active ? 'Ativo' : 'Inativo'}
                            </span>
                          </button>
                        </td>
                        <td className="py-5">
                          <button
                            onClick={e => { e.stopPropagation(); handleDelete(user.id, user.name); }}
                            disabled={user.id === state.user?.id}
                            className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all disabled:opacity-20 disabled:cursor-not-allowed ${
                              deleteConfirmId === user.id
                                ? 'bg-red-500 text-white'
                                : 'text-red-500/50 hover:text-red-500 hover:bg-red-500/10'
                            }`}
                            title={user.id === state.user?.id ? 'Não é possível excluir seu próprio usuário' : ''}
                          >
                            <i className={`fa-solid ${deleteConfirmId === user.id ? 'fa-check mr-1' : 'fa-trash-can mr-1'}`}></i>
                            {deleteConfirmId === user.id ? 'Confirmar' : 'Excluir'}
                          </button>
                        </td>
                      </tr>

                      {/* NOVO: linha expansível com detalhes de uso */}
                      {expandedId === user.id && (
                        <tr className="bg-slate-900/40">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                              <div className="bg-[#05080f] border border-slate-800 rounded-xl p-3">
                                <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Consultas RAG</p>
                                <p className="text-xl font-black text-emerald-400">{user.totalConsultas ?? 0}</p>
                              </div>
                              <div className="bg-[#05080f] border border-slate-800 rounded-xl p-3">
                                <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Treinamentos</p>
                                <p className="text-xl font-black text-blue-400">{user.treinamentosConcluidos?.length ?? 0}</p>
                              </div>
                              <div className="bg-[#05080f] border border-slate-800 rounded-xl p-3">
                                <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Score Conformidade</p>
                                <p className="text-xl font-black text-purple-400">{user.scoreConformidade ?? 0}%</p>
                              </div>
                              <div className="bg-[#05080f] border border-slate-800 rounded-xl p-3">
                                <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Trilha Atual</p>
                                <p className="text-sm font-bold text-slate-300 truncate">{user.trilhaAtual || '—'}</p>
                              </div>
                            </div>
                            {user.topicosConsultados?.length > 0 && (
                              <div>
                                <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-2">Tópicos consultados</p>
                                <div className="flex flex-wrap gap-2">
                                  {user.topicosConsultados.slice(0, 8).map((t: string, i: number) => (
                                    <span key={i} className="text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-1 rounded font-bold uppercase tracking-wide">{t}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-600 text-xs">Nenhum usuário cadastrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UsersView;