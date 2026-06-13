
import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { db } from '../../services/firebase';
import {
  collection, onSnapshot, query, orderBy,
  setDoc, doc, serverTimestamp
} from 'firebase/firestore';

interface Tenant {
  id: string;
  name: string;
  active: boolean;
  createdAt: any;
}

const TenantsView: React.FC = () => {
  const { state } = useApp();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'tenants'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setTenants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant)));
      setLoading(false);
    });
  }, []);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    const tenantId = slug.toLowerCase().trim().replace(/\s+/g, '-');
    if (!tenantId || !name.trim()) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'tenants', tenantId), {
        name: name.trim(),
        active: true,
        createdAt: serverTimestamp(),
        createdBy: state.user?.id || '',
      });
      showToast(`Cartório "${name.trim()}" ativado com sucesso!`, 'success');
      setName('');
      setSlug('');
    } catch (err: any) {
      showToast(err.message || 'Erro ao criar cartório.', 'error');
    }
    setSaving(false);
  };

  return (
    <div className="p-12 min-h-full bg-slate-50 animate-in fade-in space-y-12">
      <header>
        <h2 className="text-4xl font-black text-[#0A1628] italic uppercase tracking-tighter">
          Gestão de <span className="text-blue-500">Cartórios</span>
        </h2>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2">
          Ativação de Novas Instâncias // MJ Consultoria Master
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <form onSubmit={handleCreateTenant} className="bg-white border border-slate-200 rounded-[40px] p-12 space-y-6 shadow-2xl">
          <h3 className="text-[#0A1628] font-bold uppercase text-sm italic">Ativar Novo Cartório Cliente</h3>
          <div className="space-y-4">
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Nome da Serventia (Ex: 1º Ofício de Notas)"
              className="w-full bg-white border border-slate-200 rounded-3xl p-5 text-[#0A1628] outline-none focus:border-blue-600 transition-all" required
            />
            <input
              type="text" value={slug} onChange={e => setSlug(e.target.value)}
              placeholder="ID do Sistema (Ex: cartorio-bh-01)"
              className="w-full bg-white border border-slate-200 rounded-3xl p-5 text-blue-400 font-mono outline-none focus:border-blue-600 transition-all" required
            />
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest px-1">
              O ID será usado como <code className="bg-slate-100 px-1 rounded">tenantId</code> de todos os usuários deste cartório.
            </p>
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-blue-600 disabled:opacity-50 text-[#0A1628] font-black py-6 rounded-3xl uppercase text-[11px] tracking-widest shadow-xl hover:bg-blue-500 transition-all">
            {saving ? <><i className="fa-solid fa-circle-notch animate-spin mr-2"></i>Criando...</> : 'Criar Ambiente Isolado'}
          </button>
        </form>

        <div className="bg-white border border-slate-200 rounded-[40px] p-10 space-y-6 shadow-lg">
          <div className="flex items-center justify-between">
            <h3 className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em] px-2">Instâncias Ativas</h3>
            <span className="text-[10px] font-black text-blue-500 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
              {loading ? '...' : `${tenants.filter(t => t.active).length} cartório${tenants.filter(t => t.active).length !== 1 ? 's' : ''}`}
            </span>
          </div>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {loading && (
              <p className="text-slate-500 text-xs font-bold uppercase text-center py-10 animate-pulse">Carregando...</p>
            )}
            {!loading && tenants.length === 0 && (
              <p className="text-slate-700 text-xs font-bold uppercase text-center py-10 italic">Nenhum cartório cadastrado</p>
            )}
            {tenants.map(t => (
              <div key={t.id} className="p-5 bg-white border border-slate-200 rounded-2xl flex justify-between items-center group hover:border-blue-500/30 transition-all">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${t.active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
                  <span className="text-[#0A1628] font-bold italic uppercase text-sm">{t.name}</span>
                </div>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-50 px-3 py-1 rounded-md">{t.id}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantsView;
