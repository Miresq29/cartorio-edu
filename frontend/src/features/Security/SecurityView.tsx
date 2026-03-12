
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
      app: 'CartórioRAG PRO',
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
    logAction('SECURITY_BACKUP', 'Exportação completa da base de dados realizada.');
  };

  return (
    <div className="p-12 min-h-full bg-[#05080f] text-slate-200 animate-in fade-in duration-500">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Como usar */}
        <div className="bg-blue-600/5 border border-blue-500/10 rounded-2xl p-8 flex items-start gap-5">
           <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500 mt-1">
             <i className="fa-solid fa-lock text-2xl"></i>
           </div>
           <div>
             <h4 className="text-xl font-black text-blue-500 uppercase tracking-widest">Segurança & Backup</h4>
             <p className="text-lg text-slate-400 mt-3 leading-relaxed font-medium">
               Central de controle crítico. Exporte snapshots JSON de todos os dados (Auditoria, Docs, Usuários) para custódia externa e visualize as políticas de senha ativas.
             </p>
           </div>
        </div>

        <header className="flex items-center gap-8">
          <div className="w-28 h-28 bg-blue-600/10 border border-blue-500/20 rounded-[32px] flex items-center justify-center text-blue-500 shadow-2xl">
            <i className="fa-solid fa-shield-halved text-5xl"></i>
          </div>
          <div>
            <h2 className="text-5xl font-black tracking-tight mb-3">Segurança e Manutenção</h2>
            <p className="text-slate-500 font-medium text-xl">Controles de integridade, backups e gestão de acesso mestre.</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Card Backup */}
          <div className="lg:col-span-2 bg-[#0a0f1d] border border-slate-800 rounded-[40px] p-12 flex flex-col space-y-12 transition-all hover:border-slate-700 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-5">
               <i className="fa-solid fa-database text-[10rem]"></i>
            </div>
            
            <div>
              <h3 className="text-base font-black uppercase tracking-[0.3em] text-blue-500 mb-5">Snapshot de Governança</h3>
              <p className="text-slate-400 text-lg max-w-xl leading-relaxed">Realize backups periódicos para garantir a conformidade com as normas de custódia de dados do cartório.</p>
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

          {/* Status do Admin Mestre */}
          <div className="bg-[#0a0f1d] border border-slate-800 rounded-[40px] p-12 flex flex-col space-y-10 shadow-2xl">
            <h3 className="text-base font-black uppercase tracking-[0.3em] text-amber-500">Perfil de Manutenção</h3>
            
            <div className="bg-slate-950 rounded-3xl p-8 border border-slate-800 space-y-6">
              <div className="flex justify-between items-center">
                <span className="text-sm font-black text-slate-600 uppercase">E-mail Mestre:</span>
                <span className="text-sm font-bold text-slate-300">admin@cartorio.pro</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-black text-slate-600 uppercase">Status:</span>
                <span className={`text-xs font-black px-4 py-1.5 rounded ${masterUser?.active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                  {masterUser?.active ? 'ATIVO' : 'INATIVO'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-black text-slate-600 uppercase">Tentativas:</span>
                <span className="text-sm font-bold text-slate-300">{masterUser?.failedAttempts || 0} / 5</span>
              </div>
            </div>

            <div className="pt-2 space-y-5">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest text-center leading-relaxed">
                Este perfil é utilizado para manutenção crítica e auditoria de TI.
              </p>
              <button 
                onClick={() => showToast('A redefinição da Master Key exige verificação física.', 'warning')}
                className="w-full py-6 rounded-3xl bg-amber-500/5 border border-amber-500/20 text-amber-500 font-black text-xs uppercase tracking-widest hover:bg-amber-500/10 transition-all"
              >
                Solicitar Reset de Senha Mestre
              </button>
            </div>
          </div>
        </div>

        {/* Políticas de Acesso */}
        <div className="bg-[#0a0f1d] border border-slate-800 rounded-[40px] p-12 space-y-12 shadow-2xl">
           <div className="flex items-center gap-5">
             <i className="fa-solid fa-list-check text-blue-500 text-3xl"></i>
             <h3 className="text-lg font-black uppercase tracking-[0.3em] text-slate-400">Políticas Ativas de Segurança</h3>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { title: 'Bloqueio de Brute Force', status: 'Ativo', desc: '5 tentativas máx. / 5 min pausa' },
                { title: 'Histórico de Senhas', status: 'Ativo', desc: 'Reciclagem proibida (últimas 3)' },
                { title: 'Complexidade Exigida', status: 'Ativo', desc: 'Alfa-numérico + Símbolos (8+)' }
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
