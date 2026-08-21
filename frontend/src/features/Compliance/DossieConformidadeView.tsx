import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { db } from '../../services/firebase';
import {
  collection, onSnapshot, query, where, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { GeminiService } from '../../services/geminiService';

interface Historico {
  id: string;
  periodoLabel: string;
  resumoExecutivo: string;
  geradoPorNome: string;
  criadoEm: any;
}

function pct(a: number, b: number) { return b === 0 ? 0 : Math.round((a / b) * 100); }

function tsToDate(ts: any): Date | null {
  if (!ts) return null;
  return ts?.toDate ? ts.toDate() : new Date(ts);
}

const PERIODOS = [
  { id: '30', label: 'Últimos 30 dias' },
  { id: '90', label: 'Últimos 90 dias' },
  { id: '365', label: 'Último ano' },
  { id: '9999', label: 'Todo o período' },
];

const DossieConformidadeView: React.FC = () => {
  const { state, tenantId } = useApp();
  const { showToast } = useToast();
  const isGestor = ['SUPERADMIN', 'gestor', 'admin'].includes(state.user?.role || '');

  const [periodo, setPeriodo] = useState('90');
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [quizResults, setQuizResults] = useState<any[]>([]);
  const [progresso, setProgresso] = useState<any[]>([]);
  const [certificados, setCertificados] = useState<any[]>([]);
  const [comunicados, setComunicados] = useState<any[]>([]);
  const [leituras, setLeituras] = useState<any[]>([]);
  const [simulacoes, setSimulacoes] = useState<any[]>([]);
  const [cliques, setCliques] = useState<any[]>([]);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [historico, setHistorico] = useState<Historico[]>([]);
  const [gerandoResumo, setGerandoResumo] = useState(false);
  const [resumoAtual, setResumoAtual] = useState('');

  useEffect(() => {
    const unsubs = [
      onSnapshot(query(collection(db, 'users'), where('tenantId', '==', tenantId)), s => setUsuarios(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(query(collection(db, 'treinamentosQuizResults'), where('tenantId', '==', tenantId)), s => setQuizResults(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(query(collection(db, 'trilhasProgresso'), where('tenantId', '==', tenantId)), s => setProgresso(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(query(collection(db, 'certificados'), where('tenantId', '==', tenantId)), s => setCertificados(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(query(collection(db, 'comunicados'), where('tenantIds', 'array-contains', tenantId)), s => setComunicados(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(query(collection(db, 'comunicadosLeituras'), where('tenantId', '==', tenantId)), s => setLeituras(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(query(collection(db, 'simulacoesPhishing'), where('tenantIds', 'array-contains', tenantId)), s => setSimulacoes(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(query(collection(db, 'simulacoesPhishingCliques'), where('tenantId', '==', tenantId)), s => setCliques(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(query(collection(db, 'auditLogs'), where('tenantId', '==', tenantId)), s => setEmailLogs(s.docs.map(d => ({ id: d.id, ...d.data() })).filter(l => l.tipo === 'email_enviado' || l.tipo === 'email_erro'))),
      onSnapshot(query(collection(db, 'dossiesConformidade'), where('tenantId', '==', tenantId)), s => {
        const docs = s.docs.map(d => ({ id: d.id, ...d.data() } as Historico));
        docs.sort((a, b) => (tsToDate(b.criadoEm)?.getTime() || 0) - (tsToDate(a.criadoEm)?.getTime() || 0));
        setHistorico(docs);
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, [tenantId]);

  const cutoff = Date.now() - Number(periodo) * 24 * 60 * 60 * 1000;
  const noPeriodo = (ts: any) => (tsToDate(ts)?.getTime() || 0) >= cutoff;

  const colaboradoresAtivos = useMemo(() => usuarios.filter(u => u.ativo !== false), [usuarios]);

  const dados = useMemo(() => {
    const quizzesPeriodo = quizResults.filter(r => noPeriodo(r.createdAt));
    const aprovados = quizzesPeriodo.filter(r => r.aprovado).length;
    const taxaAprovacao = pct(aprovados, quizzesPeriodo.length);

    const trilhasConcluidas = progresso.filter(p => p.concluida).length;
    const taxaConclusaoTrilhas = pct(trilhasConcluidas, progresso.length);

    const certsValidos = certificados.filter(c => !c.validoAte || new Date(c.validoAte).getTime() >= Date.now());
    const certsVencidos = certificados.length - certsValidos.length;

    const comunicadosAceite = comunicados.filter(c => c.exigeAceite);
    const confirmacoesPorComunicado = comunicadosAceite.map(c => {
      const confirmados = leituras.filter(l => l.comunicadoId === c.id && l.aceite).length;
      return { titulo: c.titulo, confirmados, total: colaboradoresAtivos.length, taxa: pct(confirmados, colaboradoresAtivos.length) };
    });

    const simulacoesPeriodo = simulacoes.filter(s => noPeriodo(s.criadoEm));
    const cliquesRelevantes = cliques.filter(c => simulacoesPeriodo.some(s => s.id === c.simId));
    const totalEnviadosPhishing = cliquesRelevantes.length;
    const totalClicadosPhishing = cliquesRelevantes.filter(c => c.clicado).length;
    const taxaCliquePhishing = pct(totalClicadosPhishing, totalEnviadosPhishing);

    const emailsPeriodo = emailLogs.filter(l => noPeriodo(l.createdAt));
    const emailsOk = emailsPeriodo.filter(l => l.tipo === 'email_enviado').length;
    const emailsErro = emailsPeriodo.filter(l => l.tipo === 'email_erro').length;

    return {
      totalColaboradores: colaboradoresAtivos.length,
      quizzesPeriodo: quizzesPeriodo.length, taxaAprovacao,
      trilhasConcluidas, totalProgressos: progresso.length, taxaConclusaoTrilhas,
      totalCertificados: certificados.length, certsValidos: certsValidos.length, certsVencidos,
      confirmacoesPorComunicado,
      simulacoesRealizadas: simulacoesPeriodo.length, totalEnviadosPhishing, totalClicadosPhishing, taxaCliquePhishing,
      emailsOk, emailsErro,
    };
  }, [quizResults, progresso, certificados, comunicados, leituras, simulacoes, cliques, emailLogs, colaboradoresAtivos, cutoff]);

  const gerarResumoExecutivo = async () => {
    setGerandoResumo(true);
    try {
      const resumoDados = `Colaboradores ativos: ${dados.totalColaboradores}.
Testes/quizzes no período: ${dados.quizzesPeriodo} (${dados.taxaAprovacao}% de aprovação).
Trilhas concluídas: ${dados.trilhasConcluidas} de ${dados.totalProgressos} (${dados.taxaConclusaoTrilhas}%).
Certificados: ${dados.totalCertificados} emitidos, ${dados.certsValidos} válidos, ${dados.certsVencidos} vencidos.
Comunicados com aceite obrigatório: ${dados.confirmacoesPorComunicado.map(c => `"${c.titulo}" (${c.confirmados}/${c.total} confirmaram, ${c.taxa}%)`).join('; ') || 'nenhum no período'}.
Simulações de phishing no período: ${dados.simulacoesRealizadas}, taxa de clique ${dados.taxaCliquePhishing}% (${dados.totalClicadosPhishing}/${dados.totalEnviadosPhishing}).
E-mails de notificação: ${dados.emailsOk} entregues, ${dados.emailsErro} com falha.`;

      const prompt = `Você é um analista de compliance de um cartório notarial brasileiro, redigindo a seção de resumo executivo de um dossiê de conformidade para apresentação à corregedoria (Provimentos CNJ 149 e 213/2026) e para fins de LGPD. Com base nos dados abaixo, escreva um parágrafo objetivo (6 a 10 linhas), em português formal, destacando o nível de conformidade do cartório em capacitação e segurança da informação, e citando pontos de atenção quando houver (ex.: baixa taxa de aceite, alta taxa de clique em phishing, certificados vencidos). Não invente números além dos fornecidos.\n\nDados do período (${PERIODOS.find(p => p.id === periodo)?.label}):\n${resumoDados}`;

      const texto = await GeminiService.getGeminiResponse(prompt);
      if (!texto || texto.startsWith('Erro ')) {
        showToast(texto || 'Erro ao gerar o resumo executivo.', 'error');
        return;
      }
      setResumoAtual(texto);
      await addDoc(collection(db, 'dossiesConformidade'), {
        tenantId, periodoLabel: PERIODOS.find(p => p.id === periodo)?.label || periodo,
        resumoExecutivo: texto, metricas: resumoDados,
        geradoPor: state.user?.id || '', geradoPorNome: state.user?.name || '',
        criadoEm: serverTimestamp(),
      });
      showToast('Resumo executivo gerado e salvo como evidência.', 'success');
    } catch {
      showToast('Erro ao gerar o resumo executivo.', 'error');
    } finally {
      setGerandoResumo(false);
    }
  };

  const gerarPDF = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const periodoLabel = PERIODOS.find(p => p.id === periodo)?.label || '';
    const dataGeracao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    const linhasComunicados = dados.confirmacoesPorComunicado.length
      ? dados.confirmacoesPorComunicado.map(c => `<tr><td>${c.titulo}</td><td>${c.confirmados}/${c.total}</td><td>${c.taxa}%</td></tr>`).join('')
      : '<tr><td colspan="3">Nenhum comunicado com aceite obrigatório no período.</td></tr>';

    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Dossiê de Conformidade</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: Arial, sans-serif; color:#1e293b; background:white; padding:40px; font-size:12px; }
.cover { text-align:center; padding:60px 0 40px; border-bottom:3px solid #c9a84c; margin-bottom:40px; }
.cover-logo { font-size:40px; font-weight:900; color:#0f172a; letter-spacing:-2px; }
.cover-logo span { color:#c9a84c; }
.cover-title { font-size:22px; font-weight:900; color:#1e293b; margin-top:16px; text-transform:uppercase; letter-spacing:2px; }
.cover-sub { font-size:12px; color:#8a6e2f; margin-top:8px; text-transform:uppercase; letter-spacing:3px; }
.cover-date { font-size:11px; color:#a8882f; margin-top:24px; }
.section { margin-bottom:28px; page-break-inside:avoid; }
.section-title { background:#0f172a; color:white; padding:10px 16px; border-radius:8px 8px 0 0; font-size:13px; font-weight:900; text-transform:uppercase; letter-spacing:1px; border-left:4px solid #c9a84c; }
.section-body { background:#fdfbf5; border:1px solid #e8d9a0; border-top:none; border-radius:0 0 8px 8px; padding:16px; }
.kpis { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; }
.kpi { background:white; border:1px solid #e8d9a0; border-radius:8px; padding:12px; text-align:center; }
.kpi b { display:block; font-size:20px; color:#0f172a; }
.kpi span { font-size:9px; color:#7a5c1e; text-transform:uppercase; letter-spacing:0.5px; }
table { width:100%; border-collapse:collapse; font-size:11px; }
th, td { text-align:left; padding:6px 8px; border-bottom:1px solid #e8d9a0; }
th { color:#7a5c1e; text-transform:uppercase; font-size:9px; letter-spacing:1px; }
.resumo { font-size:12px; line-height:1.8; color:#334155; white-space:pre-wrap; }
.footer { text-align:center; margin-top:50px; padding-top:16px; border-top:1px solid #e8d9a0; font-size:9px; color:#a8882f; }
@media print { body { padding:20px; } .section { page-break-inside:avoid; } }
</style></head><body>
<div class="cover">
  <div class="cover-logo">MJ <span>Consultoria</span></div>
  <div class="cover-title">Dossiê de Conformidade</div>
  <div class="cover-sub">${state.activeTenantName || tenantId} — ${periodoLabel}</div>
  <div class="cover-date">Gerado em ${dataGeracao} por ${state.user?.name || ''}</div>
</div>

<div class="section">
  <div class="section-title">Indicadores do Período</div>
  <div class="section-body">
    <div class="kpis">
      <div class="kpi"><b>${dados.totalColaboradores}</b><span>Colaboradores ativos</span></div>
      <div class="kpi"><b>${dados.taxaAprovacao}%</b><span>Aprovação em testes</span></div>
      <div class="kpi"><b>${dados.taxaConclusaoTrilhas}%</b><span>Conclusão de trilhas</span></div>
      <div class="kpi"><b>${dados.totalCertificados}</b><span>Certificados emitidos</span></div>
      <div class="kpi"><b>${dados.certsVencidos}</b><span>Certificados vencidos</span></div>
      <div class="kpi"><b>${dados.taxaCliquePhishing}%</b><span>Cliques em phishing simulado</span></div>
    </div>
  </div>
</div>

${resumoAtual ? `<div class="section">
  <div class="section-title">Resumo Executivo</div>
  <div class="section-body"><p class="resumo">${resumoAtual}</p></div>
</div>` : ''}

<div class="section">
  <div class="section-title">Comunicados com Confirmação de Leitura Obrigatória</div>
  <div class="section-body">
    <table><thead><tr><th>Comunicado</th><th>Confirmações</th><th>Taxa</th></tr></thead>
    <tbody>${linhasComunicados}</tbody></table>
  </div>
</div>

<div class="section">
  <div class="section-title">Evidências de Notificação por E-mail</div>
  <div class="section-body">
    <p>${dados.emailsOk} e-mails entregues com sucesso e ${dados.emailsErro} falhas registradas no período — evidência completa disponível na tela de Auditoria (filtro "E-mails").</p>
  </div>
</div>

<div class="footer">
  MJ Consultoria · Dossiê gerado automaticamente pela plataforma de treinamento<br>
  Em conformidade com LGPD Lei nº 13.709/2018 · Provimento CNJ nº 149 · Provimento CNJ nº 213/2026
</div>
</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 600);
  };

  if (!isGestor) {
    return (
      <div className="p-8 bg-slate-50 min-h-screen flex items-center justify-center">
        <p className="text-slate-500 text-sm">Você não tem permissão para acessar esta tela.</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 bg-slate-50 min-h-screen animate-in fade-in">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-black text-[#0A1628] italic uppercase tracking-tighter">
            Dossiê de <span className="text-[#C9A84C]">Conformidade</span>
          </h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">
            Evidências consolidadas para inspeção CNJ e LGPD
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select value={periodo} onChange={e => setPeriodo(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#C9A84C] shadow-sm">
            {PERIODOS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <button onClick={gerarPDF}
            className="flex items-center gap-2 bg-[#C9A84C] hover:brightness-110 text-[#0A1628] px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all shadow-sm">
            <i className="fa-solid fa-file-pdf"></i>Exportar PDF
          </button>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Colaboradores ativos', value: dados.totalColaboradores, icon: 'fa-users', color: '#4F46E5' },
          { label: 'Aprovação em testes', value: `${dados.taxaAprovacao}%`, icon: 'fa-circle-check', color: '#059669' },
          { label: 'Conclusão de trilhas', value: `${dados.taxaConclusaoTrilhas}%`, icon: 'fa-road', color: '#D97706' },
          { label: 'Certificados emitidos', value: dados.totalCertificados, icon: 'fa-certificate', color: '#7C3AED' },
          { label: 'Certificados vencidos', value: dados.certsVencidos, icon: 'fa-triangle-exclamation', color: '#DC2626' },
          { label: 'Cliques em phishing', value: `${dados.taxaCliquePhishing}%`, icon: 'fa-shield-halved', color: '#DC2626' },
        ].map((k, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-[16px] p-4 space-y-1.5">
            <i className={`fa-solid ${k.icon}`} style={{ color: k.color }}></i>
            <p className="text-xl font-black text-[#0A1628]">{k.value}</p>
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest leading-tight">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Comunicados com aceite */}
      <div className="bg-white border border-slate-200 rounded-[20px] p-5 space-y-3">
        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Comunicados com confirmação de leitura obrigatória</p>
        {dados.confirmacoesPorComunicado.length === 0 ? (
          <p className="text-[11px] text-slate-400">Nenhum comunicado com aceite obrigatório encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  {['Comunicado', 'Confirmações', 'Taxa'].map(h => (
                    <th key={h} className="text-left p-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dados.confirmacoesPorComunicado.map((c, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="p-2 font-bold text-[#0A1628]">{c.titulo}</td>
                    <td className="p-2 text-slate-600">{c.confirmados}/{c.total}</td>
                    <td className="p-2"><span className={`font-black ${c.taxa >= 75 ? 'text-emerald-600' : c.taxa >= 40 ? 'text-amber-600' : 'text-red-500'}`}>{c.taxa}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Resumo executivo com IA */}
      <div className="bg-white border border-[#C9A84C]/30 rounded-[20px] p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Resumo executivo com IA</p>
          <button onClick={gerarResumoExecutivo} disabled={gerandoResumo}
            className="bg-[#C9A84C] hover:brightness-110 disabled:opacity-50 text-[#0A1628] px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
            {gerandoResumo ? <><i className="fa-solid fa-circle-notch animate-spin mr-2"></i>Gerando...</> : <><i className="fa-solid fa-wand-magic-sparkles mr-2"></i>Gerar resumo executivo</>}
          </button>
        </div>
        <p className="text-[11px] text-slate-400">
          Redige um parágrafo formal com base nos indicadores acima, citando os Provimentos CNJ 149 e 213/2026 — incluído automaticamente no PDF exportado.
        </p>
        {resumoAtual && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{resumoAtual}</p>
          </div>
        )}

        {historico.length > 0 && (
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Histórico de resumos gerados</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {historico.map(h => (
                <button key={h.id} onClick={() => setResumoAtual(h.resumoExecutivo)}
                  className="w-full text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl p-3 transition-all">
                  <p className="text-[10px] text-slate-500">
                    {h.periodoLabel} · {h.geradoPorNome} · {tsToDate(h.criadoEm)?.toLocaleString('pt-BR') || ''}
                  </p>
                  <p className="text-[11px] text-slate-600 line-clamp-2 mt-1">{h.resumoExecutivo}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DossieConformidadeView;
