
import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { useAudit } from '../../hooks/useAudit';
import { User } from '../../types';

const SecurityView: React.FC = () => {
  const { showToast } = useToast();
  const { logAction } = useAudit();
  const [masterUser, setMasterUser] = useState<User | null>(null);

  useEffect(() => {
    const users: User[] = JSON.parse(localStorage.getItem('cartorio_users_list') || '[]');
    const master = users.find(u => u.email === "admin@cartorio.pro");
    if (master) setMasterUser(master);
  }, []);

  const handleExport = () => {
    const users = localStorage.getItem('cartorio_users_list');
    const docs = localStorage.getItem('cartorio_docs');
    const logs = localStorage.getItem('cartorio_logs');

    const data = {
      timestamp: new Date().toISOString(),
      app: 'CartÃ³rioRAG PRO',
      data: {
        users: users ? JSON.parse(users) : [],
        documents: docs ? JSON.parse(docs) : [],
        audit: logs ? JSON.parse(logs) : []
      }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `full_backup_cartorio_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    showToast('Snapshot completo do sistema exportado.', 'success');
    logAction('SECURITY_BACKUP', 'ExportaÃ§Ã£o completa da base de dados realizada.');
  };

  return (
    <div className="p-8 min-h-full bg-slate-50 text-slate-800">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Como usar */}
        <div className="bg-blue-600/5 border border-blue-500/10 rounded-2xl p-8 flex items-start gap-5">
           <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500 mt-1">
             <i className="fa-solid fa-lock text-2xl"></i>
           </div>
           <div>
             <h4 className="text-xl font-black text-blue-500 uppercase tracking-widest">SeguranÃ§a & Backup</h4>
             <p className="text-lg text-slate-400 mt-3 leading-relaxed font-medium">
               Central de controle crÃ­tico. Exporte snapshots JSON de todos os dados (Auditoria, Docs, UsuÃ¡rios) para custÃ³dia externa e visualize as polÃ­ticas de senha ativas.
             </p>
           </div>
        </div>

        <header className="flex items-center gap-8">
          <div className="w-28 h-28 bg-blue-600/10 border border-blue-500/20 rounded-[32px] flex items-center justify-center text-blue-500 shadow-2xl">
            <i className="fa-solid fa-shield-halved text-5xl"></i>
          </div>
          <div>
            <h2 className="text-5xl font-black tracking-tight mb-3">SeguranÃ§a e ManutenÃ§Ã£o</h2>
            <p className="text-slate-500 font-medium text-xl">Controles de integridade, backups e gestÃ£o de acesso mestre.</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Card Backup */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-[40px] p-12 flex flex-col space-y-12 transition-all hover:border-slate-700 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-5">
               <i className="fa-solid fa-database text-[10rem]"></i>
            </div>
            
            <div>
              <h3 className="text-base font-black uppercase tracking-[0.3em] text-blue-500 mb-5">Snapshot de GovernanÃ§a</h3>
              <p className="text-slate-400 text-lg max-w-xl leading-relaxed">Realize backups periÃ³dicos para garantir a conformidade com as normas de custÃ³dia de dados do cartÃ³rio.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <button 
                 onClick={handleExport}
                 className="bg-slate-900 border border-slate-800 hover:bg-slate-800 py-10 rounded-3xl flex items-center justify-center gap-5 font-bold text-base transition-all active:scale-95 uppercase tracking-widest"
               >
                 <i className="fa-solid fa-download text-blue-500 text-2xl"></i> Exportar Dados Completos
               </button>
               <button className="bg-slate-900/50 border border-slate-800/50 cursor-not-allowed py-10 rounded-3xl flex items-center justify-center gap-5 font-bold text-base text-slate-600 transition-all uppercase tracking-widest">
                 <i className="fa-solid fa-upload text-2xl"></i> Importar (Acesso Gestor)
               </button>
            </div>
          </div>

        </div>

        {/* PolÃ­ticas de Acesso */}
        <div className="bg-white border border-slate-200 rounded-[24px] p-8 space-y-8 shadow-sm">
           <div className="flex items-center gap-5">
             <i className="fa-solid fa-list-check text-blue-500 text-3xl"></i>
             <h3 className="text-lg font-black uppercase tracking-[0.3em] text-slate-400">PolÃ­ticas Ativas de SeguranÃ§a</h3>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { title: 'Bloqueio de Brute Force', status: 'Ativo', desc: '5 tentativas mÃ¡x. / 5 min pausa' },
                { title: 'HistÃ³rico de Senhas', status: 'Ativo', desc: 'Reciclagem proibida (Ãºltimas 3)' },
                { title: 'Complexidade Exigida', status: 'Ativo', desc: 'Alfa-numÃ©rico + SÃ­mbolos (8+)' }
              ].map((p, i) => (
                <div key={i} className="p-8 rounded-3xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-black text-white italic tracking-tighter uppercase">{p.title}</span>
                    <span className="text-xs font-black text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded uppercase">On</span>
                  </div>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">{p.desc}</p>
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityView;
