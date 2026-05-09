
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';

const TenantsView: React.FC = () => {
  // CORREÇÃO: Removido dispatch, usando estado local para demonstração imediata
  const { state } = useApp();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  // Estado local para refletir as mudanças na interface sem o dispatch
  const [localTenants, setLocalTenants] = useState<any[]>([]);

  // CORREÇÃO: Acesso seguro à lista de tenants do estado global
  const allTenants = [...((state as any).tenants || []), ...localTenants];

  const handleCreateTenant = (e: React.FormEvent) => {
    e.preventDefault();
    const tenantId = slug.toLowerCase().trim().replace(/\s+/g, '-');
    
    const newTenant = {
      id: tenantId,
      name: name,
      active: true,
      createdAt: new Date() // Sincronizado para objeto Date
    };

    setLocalTenants(prev => [...prev, newTenant]);
    showToast(`Cartório "${name}" ativado com sucesso!`, "success");
    setName(''); 
    setSlug('');
  };

  return (
    <div className="p-12 min-h-full bg-[#0D1B3E] animate-in fade-in space-y-12">
      <header>
        <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">
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
              className="w-full bg-[#0D1B3E] border border-slate-200 rounded-3xl p-5 text-[#0A1628] outline-none focus:border-blue-600 transition-all" required 
            />
            <input 
              type="text" value={slug} onChange={e => setSlug(e.target.value)}
              placeholder="ID do Sistema (Ex: cartorio-bh-01)"
              className="w-full bg-[#0D1B3E] border border-slate-200 rounded-3xl p-5 text-blue-400 font-mono outline-none focus:border-blue-600 transition-all" required 
            />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-[#0A1628] font-black py-6 rounded-3xl uppercase text-[11px] tracking-widest shadow-xl hover:bg-blue-500 transition-all">
            Criar Ambiente Isolado
          </button>
        </form>

        <div className="bg-white border border-slate-200 rounded-[40px] p-10 space-y-6 shadow-lg">
          <h3 className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em] px-2">Instâncias Ativas</h3>
          <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
            {allTenants.length === 0 && (
              <p className="text-slate-700 text-xs font-bold uppercase text-center py-10 italic">Nenhum cartório remoto carregado</p>
            )}
            {allTenants.map((t: any) => (
              <div key={t.id} className="p-5 bg-[#0D1B3E] border border-slate-200 rounded-2xl flex justify-between items-center group hover:border-blue-500/30 transition-all">
                <span className="text-[#0A1628] font-bold italic uppercase text-sm">{t.name}</span>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-3 py-1 rounded-md">{t.id}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantsView;