
import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, onSnapshot, query, orderBy, getCountFromServer } from 'firebase/firestore';

interface Tenant {
  id: string;
  name: string;
  active: boolean;
  createdAt: any;
}

const DashboardMasterView: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalDocs, setTotalDocs] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'tenants'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setTenants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant)));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const loadCounts = async () => {
      try {
        const [usersSnap, docsSnap] = await Promise.all([
          getCountFromServer(collection(db, 'users')),
          getCountFromServer(collection(db, 'knowledgeBase')),
        ]);
        setTotalUsers(usersSnap.data().count);
        setTotalDocs(docsSnap.data().count);
      } catch { /* silencioso */ }
    };
    loadCounts();
  }, []);

  const ativos = tenants.filter(t => t.active).length;

  return (
    <div className="p-10 space-y-10 bg-slate-50 min-h-screen animate-in fade-in">
      <header>
        <h2 className="text-4xl font-black text-[#0A1628] italic uppercase tracking-tighter">
          Console <span className="text-blue-500">Master</span>
        </h2>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2">
          MJ Consultoria // Gestão Global de Instâncias
        </p>
      </header>

      {/* KPIs Consolidados */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white border border-slate-200 p-8 rounded-[40px] shadow-xl hover:border-blue-500/30 transition-all group">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-blue-500">Cartórios Ativos</p>
          <p className="text-5xl font-black text-[#0A1628] mt-2 tracking-tighter">
            {loading ? <span className="animate-pulse text-slate-300">—</span> : ativos}
          </p>
        </div>
        <div className="bg-white border border-slate-200 p-8 rounded-[40px] shadow-xl hover:border-emerald-500/30 transition-all group">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-emerald-500">Documentos Totais</p>
          <p className="text-5xl font-black text-[#0A1628] mt-2 tracking-tighter">{totalDocs}</p>
        </div>
        <div className="bg-white border border-slate-200 p-8 rounded-[40px] shadow-xl hover:border-purple-500/30 transition-all group">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-purple-500">Usuários na Plataforma</p>
          <p className="text-5xl font-black text-[#0A1628] mt-2 tracking-tighter">{totalUsers}</p>
        </div>
      </div>

      {/* Lista de Instâncias */}
      <div className="bg-white border border-slate-200 rounded-[40px] p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <i className="fa-solid fa-server text-9xl"></i>
        </div>

        <h3 className="text-[#0A1628] font-bold italic uppercase text-sm mb-6 flex items-center gap-2">
          <i className="fa-solid fa-network-wired text-blue-500"></i> Instâncias Recentes
        </h3>

        <div className="space-y-4 relative z-10">
          {loading && (
            <div className="flex items-center justify-center py-10 gap-3 text-slate-500">
              <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-600 rounded-full animate-spin"></div>
              <span className="text-xs font-bold uppercase">Carregando...</span>
            </div>
          )}

          {!loading && tenants.map(t => (
            <div key={t.id} className="p-5 bg-white border border-slate-200 rounded-2xl flex justify-between items-center group hover:bg-slate-50 transition-all">
              <div className="flex items-center gap-4">
                <div className={`w-2 h-2 rounded-full ${t.active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
                <span className="text-[#0A1628] font-bold italic uppercase text-sm">{t.name}</span>
              </div>
              <div className="flex items-center gap-6">
                <span className="text-[10px] font-mono text-blue-500 bg-blue-500/5 px-3 py-1 rounded-md border border-blue-500/10">ID: {t.id}</span>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg uppercase ${t.active ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                  {t.active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
          ))}

          {!loading && tenants.length === 0 && (
            <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-3xl">
              <p className="text-slate-600 italic text-sm font-bold uppercase tracking-widest">Aguardando ativação do primeiro cartório...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardMasterView;
