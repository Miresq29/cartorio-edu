// frontend/src/features/Backup/BackupView.tsx
// Backup por cartório — exporta apenas os dados do próprio tenantId em JSON
// Cada cartório vê e faz backup SOMENTE dos seus próprios dados

import React, { useState } from 'react';
import {
  collection, query, where, getDocs, orderBy
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';

// ─── Coleções que fazem parte do backup por tenant ────────────────────────────

const COLECOES_TENANT = [
  { id: 'users',                   label: 'Colaboradores',        icon: 'fa-users'             },
  { id: 'trilhas',                 label: 'Trilhas',              icon: 'fa-road'              },
  { id: 'trilhasProgresso',        label: 'Progresso nas Trilhas',icon: 'fa-chart-line'        },
  { id: 'treinamentosQuizResults', label: 'Resultados de Quizzes',icon: 'fa-clipboard-check'   },
  { id: 'examesResultados',        label: 'Resultados de Exames', icon: 'fa-file-pen'          },
  { id: 'certificados',            label: 'Certificados',         icon: 'fa-certificate'       },
  { id: 'metas',                   label: 'Metas & Premiação',    icon: 'fa-trophy'            },
  { id: 'metasDesempate',          label: 'Desempates',           icon: 'fa-gavel'             },
  { id: 'repositorio',             label: 'Repositório',          icon: 'fa-photo-film'        },
  { id: 'repositorioProgresso',    label: 'Progresso Repositório',icon: 'fa-eye'               },
  { id: 'comunicados',             label: 'Comunicados',          icon: 'fa-bell'              },
  { id: 'auditLogs',               label: 'Trilha de Auditoria',  icon: 'fa-clock-rotate-left' },
  { id: 'checklists',              label: 'Checklists',           icon: 'fa-list-check'        },
  { id: 'knowledgeBase',           label: 'Base de Conhecimento', icon: 'fa-book-open'         },
];

interface BackupStatus {
  colecao: string;
  registros: number;
  status: 'pendente' | 'ok' | 'erro' | 'vazio';
  erro?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function downloadJSON(data: any, filename: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return json.length;
}

// ─── Main View ────────────────────────────────────────────────────────────────

const BackupView: React.FC = () => {
  const { state } = useApp();
  const { showToast } = useToast();
  const user = state.user!;
  const tenantId = user.tenantId;
  const isGestor = ['SUPERADMIN', 'gestor', 'admin'].includes(user.role);

  const [rodando, setRodando] = useState(false);
  const [progresso, setProgresso] = useState<BackupStatus[]>([]);
  const [concluido, setConcluido] = useState(false);
  const [tamanhoTotal, setTamanhoTotal] = useState(0);
  const [ultimoBackup, setUltimoBackup] = useState<string | null>(
    localStorage.getItem(`backup_${tenantId}_ultima`)
  );

  const executarBackup = async () => {
    if (!isGestor) {
      showToast('Apenas gestores podem executar backups.', 'error');
      return;
    }

    setRodando(true);
    setConcluido(false);
    setProgresso([]);
    setTamanhoTotal(0);

    const backupData: Record<string, any[]> = {};
    const statusList: BackupStatus[] = [];
    let totalBytes = 0;

    for (const col of COLECOES_TENANT) {
      // Atualizar status visual
      setProgresso(prev => [...prev, { colecao: col.id, registros: 0, status: 'pendente' }]);

      try {
        // Busca filtrada por tenantId — NUNCA acessa dados de outros cartórios
        const q = query(
          collection(db, col.id),
          where('tenantId', '==', tenantId)
        );
        const snap = await getDocs(q);
        const docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));

        // Serializar timestamps
        const serializados = docs.map(d => {
          const obj: any = { ...d };
          Object.keys(obj).forEach(k => {
            const v = obj[k];
            if (v && typeof v.toDate === 'function') {
              obj[k] = v.toDate().toISOString();
            }
          });
          return obj;
        });

        backupData[col.id] = serializados;
        const status: BackupStatus = {
          colecao: col.id,
          registros: serializados.length,
          status: serializados.length === 0 ? 'vazio' : 'ok',
        };
        statusList.push(status);
        setProgresso(prev => prev.map(p => p.colecao === col.id ? status : p));

      } catch (e: any) {
        const status: BackupStatus = {
          colecao: col.id, registros: 0, status: 'erro', erro: e?.message || 'Erro desconhecido'
        };
        statusList.push(status);
        setProgresso(prev => prev.map(p => p.colecao === col.id ? status : p));
      }
    }

    // Montar arquivo final
    const arquivo = {
      _meta: {
        tenantId,
        cartorio: tenantId,
        geradoEm: new Date().toISOString(),
        geradoPor: user.name,
        versao: '2.0',
        colecoes: Object.keys(backupData).length,
        totalRegistros: Object.values(backupData).reduce((a, b) => a + b.length, 0),
      },
      ...backupData,
    };

    const dataStr = new Date().toISOString().slice(0, 10);
    const filename = `backup_${tenantId}_${dataStr}.json`;
    const bytes = downloadJSON(arquivo, filename);
    totalBytes = bytes;
    setTamanhoTotal(bytes);

    const agora = new Date().toLocaleString('pt-BR');
    localStorage.setItem(`backup_${tenantId}_ultima`, agora);
    setUltimoBackup(agora);

    setRodando(false);
    setConcluido(true);
    showToast(`Backup concluído — ${filename}`, 'success');
  };

  // Backup somente de uma coleção específica
  const backupColecao = async (colId: string, colLabel: string) => {
    try {
      const q = query(collection(db, colId), where('tenantId', '==', tenantId));
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => {
        const obj: any = { _id: d.id, ...d.data() };
        Object.keys(obj).forEach(k => {
          if (obj[k] && typeof obj[k].toDate === 'function') {
            obj[k] = obj[k].toDate().toISOString();
          }
        });
        return obj;
      });
      const dataStr = new Date().toISOString().slice(0, 10);
      downloadJSON({ _meta: { tenantId, colecao: colId, geradoEm: new Date().toISOString() }, dados: docs },
        `backup_${tenantId}_${colId}_${dataStr}.json`);
      showToast(`${colLabel}: ${docs.length} registros exportados`, 'success');
    } catch (e: any) {
      showToast(`Erro ao exportar ${colLabel}: ${e?.message}`, 'error');
    }
  };

  const totalRegistros = progresso.reduce((a, p) => a + p.registros, 0);
  const colOk = progresso.filter(p => p.status === 'ok').length;
  const colErro = progresso.filter(p => p.status === 'erro').length;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-black text-white">Backup de Dados</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Exportação segura dos dados do cartório <strong className="text-slate-700">{tenantId}</strong>
            </p>
          </div>
          {ultimoBackup && (
            <div className="text-right">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Último backup</p>
              <p className="text-xs text-slate-600 font-bold">{ultimoBackup}</p>
            </div>
          )}
        </div>

        {/* Aviso de isolamento */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-[14px] p-4 flex items-start gap-3">
          <i className="fa-solid fa-shield-halved text-emerald-500 text-lg mt-0.5 flex-shrink-0"></i>
          <div>
            <p className="text-sm font-black text-emerald-700">Backup isolado por cartório</p>
            <p className="text-xs text-emerald-600 mt-0.5 leading-relaxed">
              Este backup exporta <strong>exclusivamente</strong> os dados do cartório <strong>{tenantId}</strong>.
              Nenhum dado de outros cartórios é acessado ou incluído — o isolamento é garantido pelo filtro
              de <code className="bg-emerald-100 px-1 rounded">tenantId</code> em todas as consultas.
            </p>
          </div>
        </div>

        {/* Botão principal */}
        {isGestor && (
          <div className="bg-white border border-slate-200 rounded-[16px] p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-[#0A1628]">Backup Completo</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Exporta todas as {COLECOES_TENANT.length} coleções em um único arquivo JSON
                </p>
              </div>
              <button
                onClick={executarBackup}
                disabled={rodando}
                className="flex items-center gap-2 bg-[#C9A84C] hover:bg-[#A8863C] disabled:bg-slate-300 text-[#0A1628] px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-sm">
                {rodando
                  ? <><i className="fa-solid fa-spinner animate-spin"></i>Exportando...</>
                  : <><i className="fa-solid fa-download"></i>Exportar Backup</>
                }
              </button>
            </div>

            {/* Barra de progresso */}
            {(rodando || concluido) && progresso.length > 0 && (
              <div className="space-y-3">
                <div className="w-full bg-white rounded-full h-2">
                  <div className="bg-[#C9A84C] h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(progresso.length / COLECOES_TENANT.length) * 100}%` }} />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Processadas',  value: progresso.length,  color: 'indigo' },
                    { label: 'Com dados',    value: colOk,             color: 'emerald'},
                    { label: 'Erros',        value: colErro,           color: 'red'    },
                    { label: 'Registros',    value: totalRegistros,    color: 'slate'  },
                  ].map((s, i) => (
                    <div key={i} className={`bg-${s.color}-50 border border-${s.color}-200 rounded-xl p-3 text-center`}>
                      <p className={`text-xl font-black text-${s.color}-700`}>{s.value}</p>
                      <p className={`text-[10px] font-black text-${s.color}-500 uppercase tracking-widest`}>{s.label}</p>
                    </div>
                  ))}
                </div>

                {concluido && tamanhoTotal > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3">
                    <i className="fa-solid fa-circle-check text-emerald-500 text-lg"></i>
                    <div>
                      <p className="text-sm font-black text-emerald-700">Backup concluído com sucesso!</p>
                      <p className="text-xs text-emerald-600">
                        {totalRegistros} registros · {formatBytes(tamanhoTotal)} · {new Date().toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Backup por coleção */}
        <div className="bg-white border border-slate-200 rounded-[16px] shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="text-sm font-black text-[#0A1628]">Backup por Coleção</h3>
            <p className="text-xs text-slate-500 mt-0.5">Exporte uma coleção específica de forma individual</p>
          </div>
          <div className="divide-y divide-slate-100">
            {COLECOES_TENANT.map(col => {
              const status = progresso.find(p => p.colecao === col.id);
              return (
                <div key={col.id} className="flex items-center justify-between p-4 hover:bg-[#0D1B3E] transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center flex-shrink-0">
                      <i className={`fa-solid ${col.icon} text-slate-500 text-sm`}></i>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700">{col.label}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{col.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {status && (
                      <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${
                        status.status === 'ok'    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                        status.status === 'erro'  ? 'bg-red-50 text-red-500 border border-red-200' :
                        status.status === 'vazio' ? 'bg-white text-slate-500 border border-slate-200' :
                                                    'bg-amber-50 text-amber-600 border border-amber-200'
                      }`}>
                        {status.status === 'ok'    ? `${status.registros} registros` :
                         status.status === 'erro'  ? 'Erro' :
                         status.status === 'vazio' ? 'Vazio' : 'Aguardando'}
                      </span>
                    )}
                    {isGestor && (
                      <button
                        onClick={() => backupColecao(col.id, col.label)}
                        disabled={rodando}
                        className="flex items-center gap-1.5 bg-white border border-slate-200 hover:border-indigo-400 hover:text-[#C9A84C] text-slate-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40">
                        <i className="fa-solid fa-download text-[9px]"></i>JSON
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Nota de segurança */}
        <div className="bg-blue-50 border border-blue-200 rounded-[14px] p-4 flex items-start gap-3">
          <i className="fa-solid fa-circle-info text-blue-500 text-base mt-0.5 flex-shrink-0"></i>
          <div className="space-y-1">
            <p className="text-xs font-black text-blue-700 uppercase tracking-widest">Sobre os backups</p>
            <p className="text-xs text-blue-600 leading-relaxed">
              Os arquivos JSON exportados contêm todos os dados do cartório e devem ser armazenados com segurança.
              Recomendamos salvar em local seguro e criptografado. O backup automático é executado 2x ao dia via GitHub Actions.
              Para restaurar dados entre em contato com a MJ Consultoria.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackupView;
