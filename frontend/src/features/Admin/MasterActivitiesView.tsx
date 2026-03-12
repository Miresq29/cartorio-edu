
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';

const MasterActivitiesView: React.FC = () => {
  // CORREÇÃO: Removido dispatch do contexto simplificado
  const { state } = useApp();
  const { showToast } = useToast();
  const [name, setName] = useState('');

  // Estado local para refletir as mudanças na interface sem o dispatch
  const [localTemplates, setLocalTemplates] = useState<any[]>([]);

  // CORREÇÃO: Acesso seguro e unificado aos templates de checklist
  const allTemplates = [...((state as any).checklistTemplates || []), ...localTemplates];

  const handleCreateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    
    // CORREÇÃO: Ajuste dos campos para bater com o tipo ChecklistTemplate (title e items)
    const newTemplate = {
      id: `tmpl-${Date.now()}`,
      title: name,
      items: []
    };

    setLocalTemplates(prev => [...prev, newTemplate]);
    showToast(`Modelo "${name}" criado no catálogo local!`, "success");
    setName('');
  };

  return (
    <div className="p-12 min-h-full bg-[#05080f] animate-in fade-in space-y-12">
      <header>
        <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">
          Atividades <span className="text-emerald-500">Master</span>
        </h2>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2">
          Definição de Padrões de Conformidade // MJ Consultoria
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <form onSubmit={handleCreateTemplate} className="bg-[#0a111f] border border-slate-800 rounded-[40px] p-12 space-y-6 shadow-2xl">
          <h3 className="text-white font-bold uppercase text-sm italic">Criar Modelo de Checklist</h3>
          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome do Protocolo Notarial</label>
            <input 
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Ex: Provimento 161/2024"
              className="w-full bg-[#05080f] border border-slate-800 rounded-3xl p-5 text-white outline-none focus:border-emerald-600 transition-all font-bold" required 
            />
          </div>
          <button type="submit" className="w-full bg-emerald-600 text-white font-black py-6 rounded-3xl uppercase text-[11px] tracking-widest shadow-xl hover:bg-emerald-500 transition-all active:scale-[0.98]">
            Salvar no Catálogo Master
          </button>
        </form>

        <div className="bg-[#0a111f] border border-slate-800 rounded-[40px] p-10 space-y-6 shadow-lg">
          <h3 className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em] px-2">Catálogo de Padrões</h3>
          <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
            {allTemplates.length === 0 && (
              <p className="text-slate-700 text-xs font-bold uppercase text-center py-10 italic">Nenhum modelo padrão definido.</p>
            )}
            {allTemplates.map((ct: any) => (
              <div key={ct.id} className="p-5 bg-[#05080f] border border-slate-800 rounded-2xl flex items-center gap-4 group hover:border-emerald-500/30 transition-all">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-500">
                   <i className="fa-solid fa-list-check"></i>
                </div>
                <span className="text-white font-bold italic uppercase text-sm truncate">{ct.title || ct.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MasterActivitiesView;