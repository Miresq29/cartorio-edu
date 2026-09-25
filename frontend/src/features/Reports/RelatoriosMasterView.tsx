// frontend/src/features/Reports/RelatoriosMasterView.tsx
// Relatório consolidado por cartório — visão da Equipe MJ/SUPERADMIN sem precisar
// "entrar" (Acessar) em cada cartório individualmente para ver seus números.

import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useApp } from '../../context/AppContext';

interface Tenant { id: string; name: string; active: boolean; }
interface QuizResult { tenantId?: string; aprovado: boolean; nota: number; }
interface TrilhaProg { tenantId: string; concluida: boolean; }
interface Certificado { tenantId: string; }
interface UserData { id: string; tenantId: string; role: string; }

function pct(a: number, b: number) { return b === 0 ? 0 : Math.round((a / b) * 100); }

const RelatoriosMasterView: React.FC = () => {
  const { setActiveTenant, setActiveTab } = useApp();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [usuarios, setUsuarios] = useState<UserData[]>([]);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [progresso, setProgresso] = useState<TrilhaProg[]>([]);
  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubs = [
      onSnapshot(query(collection(db, 'tenants'), orderBy('name')), s => {
        setTenants(s.docs.map(d => ({ id: d.id, ...d.data() } as Tenant)));
        setLoading(false);
      }),
      onSnapshot(collection(db, 'users'), s => setUsuarios(s.docs.map(d => ({ id: d.id, ...d.data() } as UserData)))),
      onSnapshot(collection(db, 'treinamentosQuizResults'), s => setQuizResults(s.docs.map(d => d.data() as QuizResult))),
      onSnapshot(collection(db, 'trilhasProgresso'), s => setProgresso(s.docs.map(d => d.data() as TrilhaProg))),
      onSnapshot(collection(db, 'certificados'), s => setCertificados(s.docs.map(d => d.data() as Certificado))),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  const linhas = useMemo(() => {
    return tenants
      .filter(t => !busca || t.name.toLowerCase().includes(busca.toLowerCase()) || t.id.toLowerCase().includes(busca.toLowerCase()))
      .map(t => {
        const colab = usuarios.filter(u => u.tenantId === t.id && !['SUPERADMIN', 'gestor', 'equipe_mj'].includes(u.role));
        const testes = quizResults.filter(r => r.tenantId === t.id);
        const aprovados = testes.filter(r => r.aprovado).length;
        const media = testes.length ? Math.round(testes.reduce((a, r) => a + r.nota, 0) / testes.length) : 0;
        const trilhasConcluidas = progresso.filter(p => p.tenantId === t.id && p.concluida).length;
        const certs = certificados.filter(c => c.tenantId === t.id).length;
        return {
          tenant: t,
          colaboradores: colab.length,
          testes: testes.length,
          taxa: pct(aprovados, testes.length),
          media,
          trilhasConcluidas,
          certificados: certs,
        };
      })
      .sort((a, b) => b.colaboradores - a.colaboradores);
  }, [tenants, usuarios, quizResults, progresso, certificados, busca]);

  const abrirCartorio = (id: string, name: string) => {
    setActiveTenant(id, name);
    setActiveTab('reports');
  };

  return (
    <div className="p-8 space-y-6 bg-slate-50 min-h-screen animate-in fade-in">
      <header>
        <h2 className="text-3xl font-black text-navy italic uppercase tracking-tighter">
          Relatório <span className="text-blue-500">por Cartório</span>
        </h2>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">
          Números reais de cada cartório, sem precisar acessar um por um
        </p>
      </header>

      <div className="flex items-center gap-3">
        <input value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar cartório..."
          className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-navy outline-none focus:border-blue-500 w-64" />
        <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
          {linhas.length} cartório{linhas.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="bg-white border border-slate-200 rounded-[20px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Cartório', 'Colaboradores', 'Testes', 'Taxa de Aprovação', 'Média', 'Trilhas Concluídas', 'Certificados', ''].map(h => (
                  <th key={h} className="text-left p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="text-center p-10 text-slate-500">Carregando...</td></tr>
              )}
              {!loading && linhas.length === 0 && (
                <tr><td colSpan={8} className="text-center p-10 text-slate-500">Nenhum cartório encontrado.</td></tr>
              )}
              {!loading && linhas.map(l => (
                <tr key={l.tenant.id} className="border-b border-slate-100 hover:bg-slate-50 transition-all">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${l.tenant.active ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                      <div>
                        <p className="font-black text-navy">{l.tenant.name}</p>
                        <p className="text-[9px] font-mono text-slate-400">{l.tenant.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 font-bold text-slate-700">{l.colaboradores}</td>
                  <td className="p-3 text-slate-700">{l.testes}</td>
                  <td className="p-3">
                    {l.testes === 0 ? <span className="text-slate-400">–</span> : (
                      <div className="flex items-center gap-2">
                        <div className="w-14 bg-slate-200 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full" style={{
                            width: `${l.taxa}%`,
                            background: l.taxa >= 75 ? '#059669' : l.taxa >= 50 ? '#D97706' : '#DC2626',
                          }}></div>
                        </div>
                        <span className={`font-black ${l.taxa >= 75 ? 'text-emerald-600' : l.taxa >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{l.taxa}%</span>
                      </div>
                    )}
                  </td>
                  <td className="p-3 font-bold text-slate-700">{l.testes === 0 ? '–' : `${l.media}%`}</td>
                  <td className="p-3 text-slate-700">{l.trilhasConcluidas}</td>
                  <td className="p-3 text-slate-700">{l.certificados}</td>
                  <td className="p-3">
                    <button onClick={() => abrirCartorio(l.tenant.id, l.tenant.name)}
                      className="flex items-center gap-1.5 text-[9px] bg-white border border-slate-200 hover:border-blue-400 text-slate-600 hover:text-blue-600 px-3 py-1.5 rounded-lg font-black uppercase tracking-widest transition-all whitespace-nowrap">
                      <i className="fa-solid fa-magnifying-glass-chart"></i>Ver detalhes
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-slate-400">
        "Trilhas Concluídas" conta registros de trilha finalizada, mesmo quando o colaborador não fez nenhum teste formal registrado —
        por isso pode ser diferente do número de "Testes".
      </p>
    </div>
  );
};

export default RelatoriosMasterView;
