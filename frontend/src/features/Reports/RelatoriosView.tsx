// frontend/src/features/Reports/RelatoriosView.tsx
// Relatórios completos — KPIs, gráficos recharts, evidências exportáveis

import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';
import {
  collection, query, orderBy, onSnapshot, where, doc
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useApp } from '../../context/AppContext';
import { FormatoTreinamento, FORMATO_LABEL } from '../../utils/formatoTreinamento';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuizResult {
  id: string;
  colaborador: string;
  userId?: string;
  nota: number;
  aprovado: boolean;
  trailTitle?: string;
  moduleTitle?: string;
  ia?: boolean;
  tenantId?: string;
  createdAt: any;
}

interface TrilhaProgresso {
  id: string;
  userId: string;
  userName: string;
  trilhaId: string;
  trilhaTitulo?: string;
  concluida: boolean;
  percentualObrigatorios?: number;
  updatedAt?: any;
  tenantId: string;
}

interface ExameResultado {
  id: string;
  userId: string;
  fonteTitulo: string;
  score: number;
  aprovado: boolean;
  createdAt: any;
  tenantId?: string;
}

interface UserData {
  id: string;
  name: string;
  cargo?: string;
  role: string;
  tenantId: string;
}

interface Certificado {
  id: string;
  colaboradorNome: string;
  trilhaTitulo: string;
  notaFinal: number;
  emitidoEm: any;
  validoAte?: string;
  tenantId: string;
}

interface CatalogoTreinamento {
  id: string;
  titulo: string;
  tipo: 'trilha' | 'treinamento';
  instrutor?: string;
  oficial?: boolean;
  formato?: FormatoTreinamento;
  cargaHoraria?: number;
  createdAt?: any;
}

type Tab = 'visao_geral' | 'iso' | 'colaboradores' | 'trilhas' | 'trilhas_evidencias' | 'treinamentos' | 'risco' | 'evidencias';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(a: number, b: number) { return b === 0 ? 0 : Math.round((a / b) * 100); }

function formatDate(ts: any): string {
  if (!ts) return '–';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function getMonth(ts: any): string {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

function tsToMillis(ts: any): number {
  if (!ts) return 0;
  return ts?.toDate ? ts.toDate().getTime() : new Date(ts).getTime();
}

// Escapa conteúdo digitado por gestores/IA antes de embutir em HTML impresso — sem isso,
// um "<" ou "&" no nome/título quebra visualmente o PDF gerado.
function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const COLORS = ['#4F46E5', '#059669', '#D97706', '#DC2626', '#7C3AED', '#0891B2'];

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  label: string; value: string | number; sub?: string;
  icon: string; color: string; trend?: { value: number; label: string };
}> = ({ label, value, sub, icon, color, trend }) => (
  <div className="bg-white border border-slate-200 rounded-[14px] p-5 shadow-sm">
    <div className="flex items-start justify-between mb-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center`}
        style={{ background: color + '15' }}>
        <i className={`fa-solid ${icon} text-base`} style={{ color }}></i>
      </div>
      {trend && (
        <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${
          trend.value >= 0
            ? 'bg-emerald-50 text-emerald-600'
            : 'bg-red-50 text-red-500'
        }`}>
          {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
        </span>
      )}
    </div>
    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</p>
    <p className="text-3xl font-black text-navy">{value}</p>
    {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
  </div>
);

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-lg text-xs">
      <p className="font-black text-slate-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-bold">
          {p.name}: {p.value}{p.name?.includes('%') || p.name === 'Média' ? '%' : ''}
        </p>
      ))}
    </div>
  );
};

// ─── Main View ────────────────────────────────────────────────────────────────

const RelatoriosView: React.FC = () => {
  const { state, tenantId } = useApp();
  const user = state.user!;
  const isSuperAdmin = user.role === 'SUPERADMIN';

  const [tab, setTab] = useState<Tab>('visao_geral');
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [progresso, setProgresso] = useState<TrilhaProgresso[]>([]);
  const [usuarios, setUsuarios] = useState<UserData[]>([]);
  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [exames, setExames] = useState<ExameResultado[]>([]);
  const [catalogoTrilhas, setCatalogoTrilhas] = useState<CatalogoTreinamento[]>([]);
  const [catalogoTreinamentos, setCatalogoTreinamentos] = useState<CatalogoTreinamento[]>([]);
  const [periodo, setPeriodo] = useState('90');
  const [buscaColab, setBuscaColab] = useState('');
  const [buscaTrilha, setBuscaTrilha] = useState('');
  const [tenantName, setTenantName] = useState('');

  useEffect(() => {
    if (!tenantId) return;
    return onSnapshot(doc(db, 'tenants', tenantId), snap => setTenantName((snap.data() as any)?.name || tenantId));
  }, [tenantId]);

  useEffect(() => {
    const q1 = query(collection(db, 'treinamentosQuizResults'), where('tenantId', '==', tenantId), orderBy('createdAt', 'desc'));
    const u1 = onSnapshot(q1, s => setQuizResults(s.docs.map(d => ({ id: d.id, ...d.data() } as QuizResult))));

    const q2 = query(collection(db, 'trilhasProgresso'), where('tenantId', '==', tenantId));
    const u2 = onSnapshot(q2, s => setProgresso(s.docs.map(d => ({ id: d.id, ...d.data() } as TrilhaProgresso))));

    const q3 = query(collection(db, 'users'), where('tenantId', '==', tenantId));
    const u3 = onSnapshot(q3, s => setUsuarios(s.docs.map(d => ({ id: d.id, ...d.data() } as UserData))));

    const q4 = query(collection(db, 'certificados'), where('tenantId', '==', tenantId));
    const u4 = onSnapshot(q4, s => setCertificados(s.docs.map(d => ({ id: d.id, ...d.data() } as Certificado))));

    const q5 = query(collection(db, 'examesResultados'), where('tenantId', '==', tenantId));
    const u5 = onSnapshot(q5, s => setExames(s.docs.map(d => ({ id: d.id, ...d.data() } as ExameResultado))));

    const q6 = query(collection(db, 'trilhas'), where('tenantIds', 'array-contains-any', [tenantId, 'GLOBAL']));
    const u6 = onSnapshot(q6, s => setCatalogoTrilhas(s.docs.map(d => {
      const data = d.data();
      return { id: d.id, titulo: data.titulo || 'Sem título', tipo: 'trilha', instrutor: data.instrutor, oficial: data.oficial, formato: data.formato, cargaHoraria: data.cargaHoraria, createdAt: data.createdAt } as CatalogoTreinamento;
    })));

    const q7 = query(collection(db, 'treinamentos'), where('tenantIds', 'array-contains-any', [tenantId, 'GLOBAL']));
    const u7 = onSnapshot(q7, s => setCatalogoTreinamentos(s.docs.map(d => {
      const data = d.data();
      return { id: d.id, titulo: data.titulo || 'Sem título', tipo: 'treinamento', instrutor: data.instrutor, formato: data.formato, cargaHoraria: data.cargaHoraria, createdAt: data.createdAt } as CatalogoTreinamento;
    })));

    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); };
  }, [tenantId]);

  // Filtrar por período
  const periodoMs = Number(periodo) * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - periodoMs;
  const filteredResults = quizResults.filter(r => {
    const d = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt || 0);
    return d.getTime() >= cutoff;
  });
  const filteredExames = exames.filter(e => {
    const d = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.createdAt || 0);
    return d.getTime() >= cutoff;
  });

  // Avaliação unificada: quizzes de trilha (treinamentosQuizResults) + Exames formais (examesResultados).
  // Sem isso, colaboradores que só fazem Exames (como os de 2rimontesclaros) ficavam com KPIs,
  // exportação e score de risco zerados/errados, mesmo tendo feito e passado nas avaliações.
  const filteredAvaliacoes = useMemo(() => {
    const doExame = filteredExames.map(e => ({
      id: `exame_${e.id}`,
      colaborador: usuarios.find(u => u.id === e.userId)?.name || '–',
      userId: e.userId, nota: e.score, aprovado: e.aprovado,
      trailTitle: e.fonteTitulo, moduleTitle: undefined as string | undefined,
      ia: false, createdAt: e.createdAt,
    }));
    return [...filteredResults, ...doExame];
  }, [filteredResults, filteredExames, usuarios]);

  // Carga horária de uma trilha pelo id (catálogo de trilhas com instrutor/formato/horas).
  // Mesma regra do certificado: trilha concluída sempre conta pelo menos 1h, mesmo
  // quando a trilha não informou cargaHoraria — nunca fica de fora do total do colaborador.
  const cargaHorariaTrilha = (trilhaId: string) => {
    const t = catalogoTrilhas.find(c => c.id === trilhaId);
    return t ? Math.max(1, t.cargaHoraria || 0) : 0;
  };

  // KPIs
  const colab = usuarios.filter(u => !['SUPERADMIN', 'gestor'].includes(u.role));
  const totalTestes = filteredAvaliacoes.length;
  const totalAprovados = filteredAvaliacoes.filter(r => r.aprovado).length;
  const taxaAprovacao = pct(totalAprovados, totalTestes);
  const mediaGeral = totalTestes
    ? Math.round(filteredAvaliacoes.reduce((a, r) => a + r.nota, 0) / totalTestes)
    : 0;
  const totalCerts = certificados.length;

  // Gráfico 1: Aprovação por trilha
  const porTrilha = useMemo(() => {
    const map: Record<string, { total: number; aprovados: number; soma: number }> = {};
    filteredAvaliacoes.forEach(r => {
      const t = r.trailTitle || 'Sem trilha';
      if (!map[t]) map[t] = { total: 0, aprovados: 0, soma: 0 };
      map[t].total++;
      if (r.aprovado) map[t].aprovados++;
      map[t].soma += r.nota;
    });
    return Object.entries(map)
      .map(([name, v]) => ({
        name: name.length > 18 ? name.slice(0, 16) + '…' : name,
        'Taxa (%)': pct(v.aprovados, v.total),
        'Média': Math.round(v.soma / v.total),
        testes: v.total,
      }))
      .sort((a, b) => b['Taxa (%)'] - a['Taxa (%)'])
      .slice(0, 8);
  }, [filteredAvaliacoes]);

  // Gráfico 2: Atividade por mês
  const porMes = useMemo(() => {
    const map: Record<string, { testes: number; aprovados: number }> = {};
    filteredAvaliacoes.forEach(r => {
      const m = getMonth(r.createdAt);
      if (!m) return;
      if (!map[m]) map[m] = { testes: 0, aprovados: 0 };
      map[m].testes++;
      if (r.aprovado) map[m].aprovados++;
    });
    return Object.entries(map)
      .slice(-6)
      .map(([mes, v]) => ({
        mes,
        Testes: v.testes,
        Aprovados: v.aprovados,
      }));
  }, [filteredAvaliacoes]);

  // Gráfico 3: Distribuição de notas
  const distribuicaoNotas = useMemo(() => {
    const faixas = [
      { name: '0-49', min: 0, max: 49 },
      { name: '50-69', min: 50, max: 69 },
      { name: '70-84', min: 70, max: 84 },
      { name: '85-100', min: 85, max: 100 },
    ];
    return faixas.map(f => ({
      name: f.name,
      value: filteredAvaliacoes.filter(r => r.nota >= f.min && r.nota <= f.max).length,
    }));
  }, [filteredAvaliacoes]);

  // Por colaborador — aproveitamento considera quizzes de trilha E exames formais (Exames IA),
  // já que ambos avaliam conhecimento e antes só os quizzes de trilha eram contabilizados.
  const porColab = useMemo(() => {
    return colab
      .filter(u => !buscaColab || u.name.toLowerCase().includes(buscaColab.toLowerCase()))
      .map(u => {
        const res = filteredResults.filter(r => r.userId === u.id || r.colaborador === u.name);
        const examesUser = filteredExames.filter(e => e.userId === u.id);
        const notas = [...res.map(r => r.nota), ...examesUser.map(e => e.score)];
        const totalAvaliacoes = notas.length;
        const aprov = res.filter(r => r.aprovado).length + examesUser.filter(e => e.aprovado).length;
        const media = totalAvaliacoes ? Math.round(notas.reduce((a, n) => a + n, 0) / totalAvaliacoes) : 0;
        const prog = progresso.filter(p => p.userId === u.id && p.concluida);
        const cargaHoraria = prog.reduce((a, p) => a + cargaHorariaTrilha(p.trilhaId), 0);
        const certs = certificados.filter(c => c.colaboradorNome === u.name).length;
        return {
          id: u.id, name: u.name, cargo: u.cargo || '',
          testes: totalAvaliacoes, aprovados: aprov,
          taxa: pct(aprov, totalAvaliacoes),
          media, trilhas: prog.length, cargaHoraria, certs,
          ultimo: res[0],
        };
      })
      .sort((a, b) => b.taxa - a.taxa);
  }, [colab, filteredResults, filteredExames, progresso, certificados, catalogoTrilhas, buscaColab]);

  // Indicadores de cobertura (ISO) — funil: total de colaboradores -> quantos participaram
  // de algum treinamento -> quantos fizeram alguma avaliação -> quantos foram aprovados.
  // Serve como evidência objetiva de cobertura de capacitação (ISO 27001/9001, Provimento 213).
  const coberturaISO = useMemo(() => {
    const linhas = colab.map(u => {
      const progUser = progresso.filter(p => p.userId === u.id);
      const iniciouTreinamento = progUser.length > 0;
      const testesUser = filteredResults.filter(r => r.userId === u.id || r.colaborador === u.name);
      const examesUser = filteredExames.filter(e => e.userId === u.id);
      const totalAvaliacoes = testesUser.length + examesUser.length;
      const fezAvaliacao = totalAvaliacoes > 0;
      const aprovouAlguma = testesUser.some(r => r.aprovado) || examesUser.some(e => e.aprovado);
      let status: 'aprovado' | 'reprovado' | 'sem_avaliacao' | 'sem_atividade';
      if (aprovouAlguma) status = 'aprovado';
      else if (fezAvaliacao) status = 'reprovado';
      else if (iniciouTreinamento) status = 'sem_avaliacao';
      else status = 'sem_atividade';
      return { id: u.id, name: u.name, cargo: u.cargo || '', iniciouTreinamento, fezAvaliacao, status };
    });
    const totalColab = linhas.length;
    const participaram = linhas.filter(l => l.iniciouTreinamento || l.fezAvaliacao).length;
    const avaliados = linhas.filter(l => l.fezAvaliacao).length;
    const aprovados = linhas.filter(l => l.status === 'aprovado').length;
    const reprovados = linhas.filter(l => l.status === 'reprovado').length;
    const semAvaliacao = linhas.filter(l => l.status === 'sem_avaliacao').length;
    const semAtividade = linhas.filter(l => l.status === 'sem_atividade').length;
    return { linhas, totalColab, participaram, avaliados, aprovados, reprovados, semAvaliacao, semAtividade };
  }, [colab, progresso, filteredResults, filteredExames]);

  const exportCSVCobertura = () => {
    const rows = ['Colaborador;Cargo;Iniciou Treinamento;Fez Avaliacao;Situacao'];
    const label: Record<string, string> = { aprovado: 'Aprovado', reprovado: 'Reprovado', sem_avaliacao: 'Treinou, sem avaliar', sem_atividade: 'Sem atividade' };
    coberturaISO.linhas.forEach(l => {
      rows.push([l.name, l.cargo, l.iniciouTreinamento ? 'Sim' : 'Não', l.fezAvaliacao ? 'Sim' : 'Não', label[l.status]].join(';'));
    });
    const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cobertura_iso_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Score de risco/maturidade por colaborador — combina desempenho, atividade recente e situação do certificado.
  // Pesos: 40% (100 - média das notas), 30% ausência de atividade no período, 30% certificado vencido.
  const scoreColab = useMemo(() => {
    return colab
      .filter(u => !buscaColab || u.name.toLowerCase().includes(buscaColab.toLowerCase()))
      .map(u => {
        const res = filteredAvaliacoes.filter(r => r.userId === u.id || r.colaborador === u.name);
        const media = res.length ? Math.round(res.reduce((a, r) => a + r.nota, 0) / res.length) : null;
        const certsUsuario = certificados.filter(c => c.colaboradorNome === u.name);
        const certVencido = certsUsuario.length > 0 && certsUsuario.every(c => c.validoAte && new Date(c.validoAte).getTime() < Date.now());
        const semAtividade = res.length === 0;

        let risco = 0;
        risco += media !== null ? Math.max(0, 100 - media) * 0.4 : 40;
        risco += semAtividade ? 30 : 0;
        risco += certVencido ? 30 : 0;
        risco = Math.min(100, Math.round(risco));
        const nivel: 'Alto' | 'Médio' | 'Baixo' = risco >= 60 ? 'Alto' : risco >= 30 ? 'Médio' : 'Baixo';

        const motivos: string[] = [];
        if (media === null) motivos.push('Ainda não fez nenhuma prova');
        else if (media < 70) motivos.push(`Média baixa (${media}%)`);
        if (semAtividade && media !== null) motivos.push('Sem atividade no período');
        if (certVencido) motivos.push('Certificado vencido');
        if (motivos.length === 0) motivos.push('Sem pendências');

        return { id: u.id, name: u.name, cargo: u.cargo || '', media, risco, nivel, motivos };
      })
      .sort((a, b) => b.risco - a.risco);
  }, [colab, filteredAvaliacoes, certificados, buscaColab]);

  // Resumo de treinamentos — catálogo de trilhas + treinamentos avulsos com instrutor,
  // forma (EAD/presencial/híbrida), carga horária e participação/aproveitamento.
  const resumoTreinamentos = useMemo(() => {
    const trilhasResumo = catalogoTrilhas.map(t => {
      const progs = progresso.filter(p => p.trilhaId === t.id);
      const concluidos = progs.filter(p => p.concluida).length;
      return { ...t, participantes: progs.length, concluidos, taxa: pct(concluidos, progs.length) };
    });
    const treinamentosResumo = catalogoTreinamentos.map(t => {
      const res = quizResults.filter(r => r.trailTitle === t.titulo);
      const aprovados = res.filter(r => r.aprovado).length;
      return { ...t, participantes: res.length, concluidos: aprovados, taxa: pct(aprovados, res.length) };
    });
    return [...trilhasResumo, ...treinamentosResumo].sort((a, b) => (tsToMillis(b.createdAt)) - (tsToMillis(a.createdAt)));
  }, [catalogoTrilhas, catalogoTreinamentos, progresso, quizResults]);

  const cargaHorariaCatalogoTotal = resumoTreinamentos.reduce((a, t) => a + (t.cargaHoraria || 0), 0);

  const riscoAltoCount = scoreColab.filter(c => c.nivel === 'Alto').length;

  // Evidências de trilhas — um registro por colaborador × trilha, com % concluído e data,
  // para comprovação em fiscalizações (quem concluiu o quê e quando).
  const progressoEvidencia = useMemo(() => {
    return progresso
      .filter(p => !buscaTrilha || p.userName?.toLowerCase().includes(buscaTrilha.toLowerCase()) || (p.trilhaTitulo || '').toLowerCase().includes(buscaTrilha.toLowerCase()))
      .map(p => ({
        id: p.id,
        colaborador: p.userName || '–',
        trilha: p.trilhaTitulo || 'Sem título',
        percentual: p.percentualObrigatorios ?? 0,
        concluida: !!p.concluida,
        atualizadoEm: p.updatedAt,
      }))
      .sort((a, b) => (tsToMillis(b.atualizadoEm)) - (tsToMillis(a.atualizadoEm)));
  }, [progresso, buscaTrilha]);

  const exportCSVTrilhas = () => {
    // Separador ; — o Excel em português (pt-BR) usa vírgula como separador decimal e só
    // reconhece automaticamente ; como separador de colunas ao abrir o CSV direto (duplo clique).
    const rows = ['Colaborador;Trilha;Percentual Concluido;Status;Ultima Atualizacao'];
    progressoEvidencia.forEach(p => {
      rows.push([
        p.colaborador, p.trilha, `${p.percentual}%`,
        p.concluida ? 'Concluída' : 'Em andamento',
        formatDate(p.atualizadoEm),
      ].join(';'));
    });
    const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evidencias_trilhas_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Ficha individual de capacitação — evidência consolidada de um único colaborador,
  // pronta para apresentar em fiscalização (trilhas, testes, exames e certificados).
  const gerarFichaColaborador = (colabId: string, nome: string) => {
    const trilhasDoColab = progresso.filter(p => p.userId === colabId);
    const testesDoColab = quizResults.filter(r => r.userId === colabId || r.colaborador === nome);
    const examesDoColab = exames.filter(e => e.userId === colabId);
    const certsDoColab = certificados.filter(c => c.colaboradorNome === nome);
    const dadosUser = colab.find(u => u.id === colabId);
    const cargaHorariaColab = trilhasDoColab.filter(p => p.concluida).reduce((a, p) => a + cargaHorariaTrilha(p.trilhaId), 0);
    const codigo = `MJ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const win = window.open('', '_blank');
    if (!win) return;

    const linhasTrilhas = trilhasDoColab.length
      ? trilhasDoColab.map(p => `<tr><td>${escapeHtml(p.trilhaTitulo || 'Sem título')}</td><td>${p.percentualObrigatorios ?? 0}%</td><td>${p.concluida ? 'Concluída' : 'Em andamento'}</td><td>${formatDate(p.updatedAt)}</td></tr>`).join('')
      : '<tr><td colspan="4">Nenhuma trilha iniciada.</td></tr>';

    const linhasTestes = testesDoColab.length
      ? testesDoColab.map(r => `<tr><td>${escapeHtml(r.trailTitle || r.moduleTitle || '–')}</td><td>${r.nota}%</td><td>${r.aprovado ? 'Aprovado' : 'Reprovado'}</td><td>${formatDate(r.createdAt)}</td></tr>`).join('')
      : '<tr><td colspan="4">Nenhum teste realizado.</td></tr>';

    const linhasExames = examesDoColab.length
      ? examesDoColab.map(e => `<tr><td>${escapeHtml(e.fonteTitulo || '–')}</td><td>${e.score}%</td><td>${e.aprovado ? 'Aprovado' : 'Reprovado'}</td><td>${formatDate(e.createdAt)}</td></tr>`).join('')
      : '<tr><td colspan="4">Nenhum exame realizado.</td></tr>';

    const linhasCerts = certsDoColab.length
      ? certsDoColab.map(c => {
          const vencido = c.validoAte && new Date(c.validoAte).getTime() < Date.now();
          return `<tr><td>${escapeHtml(c.trilhaTitulo || '–')}</td><td>${formatDate(c.emitidoEm)}</td><td>${c.validoAte ? new Date(c.validoAte).toLocaleDateString('pt-BR') : '–'}</td><td>${vencido ? 'Vencido' : 'Válido'}</td></tr>`;
        }).join('')
      : '<tr><td colspan="4">Nenhum certificado emitido.</td></tr>';

    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Ficha de Capacitação</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Dancing+Script:wght@700&display=swap');
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: Arial, sans-serif; color:#1e293b; background:white; padding:40px; font-size:12px; }
.cover { text-align:center; padding:34px 24px; margin-bottom:32px; border:3px double #c9a84c; position:relative; }
.corner { position:absolute; width:22px; height:22px; border:2px solid #c9a84c; }
.corner.tl { top:8px; left:8px; border-right:none; border-bottom:none; }
.corner.tr { top:8px; right:8px; border-left:none; border-bottom:none; }
.corner.bl { bottom:8px; left:8px; border-right:none; border-top:none; }
.corner.br { bottom:8px; right:8px; border-left:none; border-top:none; }
.cover-logo { font-family:'Playfair Display', serif; font-size:34px; font-weight:900; color:#0f172a; letter-spacing:-2px; }
.cover-logo span { color:#c9a84c; }
.cover-title { font-size:18px; font-weight:900; color:#1e293b; margin-top:12px; text-transform:uppercase; letter-spacing:2px; }
.cover-sub { font-size:12px; color:#8a6e2f; margin-top:6px; text-transform:uppercase; letter-spacing:2px; }
.info { display:flex; gap:24px; justify-content:center; flex-wrap:wrap; margin-top:16px; font-size:11px; color:#475569; }
.section { margin-bottom:24px; page-break-inside:avoid; }
.section-title { background:#0f172a; color:white; padding:8px 14px; border-radius:8px 8px 0 0; font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:1px; border-left:4px solid #c9a84c; }
table { width:100%; border-collapse:collapse; font-size:11px; }
th, td { text-align:left; padding:6px 8px; border-bottom:1px solid #e8d9a0; }
th { background:#fdfbf5; color:#7a5c1e; text-transform:uppercase; font-size:9px; letter-spacing:1px; }
td { background:#fdfbf5; }
.assinatura { display:flex; justify-content:center; margin-top:40px; page-break-inside:avoid; }
.assinatura-bloco { text-align:center; }
.assinatura-nome { font-family:'Dancing Script', cursive; font-size:30px; color:#1e3a5f; line-height:1; margin-bottom:-2px; }
.assinatura-linha { border-top:1px solid #bbb; padding-top:6px; font-size:10px; color:#888; min-width:260px; }
.footer { text-align:center; margin-top:24px; padding-top:16px; border-top:1px solid #e8d9a0; font-size:9px; color:#a8882f; }
.verificacao { text-align:center; margin-top:6px; font-size:9px; color:#bbb; letter-spacing:1px; text-transform:uppercase; }
@media print { body { padding:20px; } .section, .assinatura { page-break-inside:avoid; } }
</style></head><body>
<div class="cover">
  <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
  <div class="cover-logo">MJ <span>Consultoria</span></div>
  <div class="cover-title">Ficha de Capacitação</div>
  <div class="cover-sub">Evidência individual de treinamento</div>
  <div class="info">
    <span><strong>Colaborador:</strong> ${escapeHtml(nome)}</span>
    <span><strong>Cargo:</strong> ${escapeHtml(dadosUser?.cargo || '–')}</span>
    <span><strong>Carga Horária Total:</strong> ${cargaHorariaColab > 0 ? `${cargaHorariaColab}h` : '–'}</span>
    <span><strong>Gerado em:</strong> ${new Date().toLocaleDateString('pt-BR')}</span>
  </div>
</div>

<div class="section">
  <div class="section-title">Trilhas de Aprendizagem</div>
  <table><thead><tr><th>Trilha</th><th>% Concluído</th><th>Status</th><th>Última Atualização</th></tr></thead>
  <tbody>${linhasTrilhas}</tbody></table>
</div>

<div class="section">
  <div class="section-title">Testes e Quizzes</div>
  <table><thead><tr><th>Treinamento</th><th>Nota</th><th>Resultado</th><th>Data</th></tr></thead>
  <tbody>${linhasTestes}</tbody></table>
</div>

<div class="section">
  <div class="section-title">Exames Formais</div>
  <table><thead><tr><th>Fonte</th><th>Nota</th><th>Resultado</th><th>Data</th></tr></thead>
  <tbody>${linhasExames}</tbody></table>
</div>

<div class="section">
  <div class="section-title">Certificados</div>
  <table><thead><tr><th>Trilha</th><th>Emitido em</th><th>Válido até</th><th>Situação</th></tr></thead>
  <tbody>${linhasCerts}</tbody></table>
</div>

<div class="assinatura">
  <div class="assinatura-bloco">
    <div class="assinatura-nome">Mirian Jabur</div>
    <div class="assinatura-linha">MJ Consultoria — Coordenação de Treinamento</div>
  </div>
</div>

<div class="footer">
  MJ Consultoria · Ficha gerada automaticamente pela plataforma de treinamento<br>
  Em conformidade com LGPD Lei nº 13.709/2018 · Provimento CNJ nº 149 · Provimento CNJ nº 213/2026
</div>
<div class="verificacao">Código de verificação: ${codigo}</div>
</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 600);
  };

  // Relatório consolidado em formato de documento (capa, seções, assinatura) — substitui o
  // "print da tela" (com botões, ícones e cores de interface) por um PDF apresentável,
  // no mesmo padrão visual da Ficha de Capacitação individual.
  const gerarRelatorioPDF = () => {
    const PERIODO_LABEL: Record<string, string> = {
      '7': 'Últimos 7 dias', '30': 'Últimos 30 dias', '90': 'Últimos 90 dias',
      '365': 'Último ano', '99999': 'Todo o período',
    };
    const codigo = `MJ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const win = window.open('', '_blank');
    if (!win) return;

    const linhasColab = porColab.length
      ? porColab.map(c => `<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.cargo || '–')}</td><td>${c.testes}</td><td>${c.aprovados}</td><td>${c.taxa}%</td><td>${c.media}%</td><td>${c.trilhas}</td><td>${c.cargaHoraria > 0 ? c.cargaHoraria + 'h' : '–'}</td><td>${c.certs}</td></tr>`).join('')
      : '<tr><td colspan="9">Nenhum colaborador cadastrado.</td></tr>';

    const linhasTrilha = porTrilha.length
      ? porTrilha.map(t => `<tr><td>${escapeHtml(t.name)}</td><td>${t.testes}</td><td>${t['Taxa (%)']}%</td><td>${t['Média']}%</td></tr>`).join('')
      : '<tr><td colspan="4">Sem dados no período.</td></tr>';

    const linhasRisco = scoreColab.length
      ? scoreColab.map(c => `<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.cargo || '–')}</td><td>${c.media !== null ? c.media + '%' : '–'}</td><td>${c.nivel}</td><td>${c.risco}</td><td>${escapeHtml(c.motivos.join(' · '))}</td></tr>`).join('')
      : '<tr><td colspan="6">Nenhum dado encontrado.</td></tr>';

    const isoBadge: Record<string, string> = { aprovado: 'Aprovado', reprovado: 'Reprovado', sem_avaliacao: 'Treinou, sem avaliar', sem_atividade: 'Sem atividade' };
    const linhasIso = coberturaISO.linhas.length
      ? coberturaISO.linhas.map(l => `<tr><td>${escapeHtml(l.name)}</td><td>${escapeHtml(l.cargo || '–')}</td><td>${l.iniciouTreinamento ? 'Sim' : 'Não'}</td><td>${l.fezAvaliacao ? 'Sim' : 'Não'}</td><td>${isoBadge[l.status]}</td></tr>`).join('')
      : '<tr><td colspan="5">Nenhum colaborador cadastrado.</td></tr>';

    const linhasEvidencias = filteredAvaliacoes.length
      ? filteredAvaliacoes.map(r => `<tr><td>${escapeHtml(r.colaborador)}</td><td>${escapeHtml(r.trailTitle || '–')}</td><td>${escapeHtml(r.moduleTitle || '–')}</td><td>${formatDate(r.createdAt)}</td><td>${r.nota}%</td><td>${r.aprovado ? 'Aprovado' : 'Reprovado'}</td><td>${r.ia ? 'IA' : 'Padrão'}</td></tr>`).join('')
      : '<tr><td colspan="7">Nenhum registro no período.</td></tr>';

    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório de Treinamento</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Dancing+Script:wght@700&display=swap');
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: Arial, sans-serif; color:#1e293b; background:white; padding:40px; font-size:12px; }
.cover { text-align:center; padding:34px 24px; margin-bottom:32px; border:3px double #c9a84c; position:relative; }
.corner { position:absolute; width:22px; height:22px; border:2px solid #c9a84c; }
.corner.tl { top:8px; left:8px; border-right:none; border-bottom:none; }
.corner.tr { top:8px; right:8px; border-left:none; border-bottom:none; }
.corner.bl { bottom:8px; left:8px; border-right:none; border-top:none; }
.corner.br { bottom:8px; right:8px; border-left:none; border-top:none; }
.cover-logo { font-family:'Playfair Display', serif; font-size:34px; font-weight:900; color:#0f172a; letter-spacing:-2px; }
.cover-logo span { color:#c9a84c; }
.cover-title { font-size:18px; font-weight:900; color:#1e293b; margin-top:12px; text-transform:uppercase; letter-spacing:2px; }
.cover-sub { font-size:12px; color:#8a6e2f; margin-top:6px; text-transform:uppercase; letter-spacing:2px; }
.info { display:flex; gap:24px; justify-content:center; flex-wrap:wrap; margin-top:16px; font-size:11px; color:#475569; }
.section { margin-bottom:24px; }
.section-title { background:#0f172a; color:white; padding:8px 14px; border-radius:8px 8px 0 0; font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:1px; border-left:4px solid #c9a84c; }
table { width:100%; border-collapse:collapse; font-size:10.5px; }
th, td { text-align:left; padding:6px 8px; border-bottom:1px solid #e8d9a0; }
th { background:#fdfbf5; color:#7a5c1e; text-transform:uppercase; font-size:9px; letter-spacing:1px; }
td { background:#fdfbf5; }
thead { display:table-header-group; }
tr { page-break-inside:avoid; }
.kpis { display:grid; grid-template-columns:repeat(5,1fr); gap:10px; margin-bottom:28px; }
.kpi { border:1px solid #e8d9a0; border-radius:8px; padding:12px; text-align:center; }
.kpi .v { font-size:22px; font-weight:900; color:#0f172a; }
.kpi .l { font-size:8.5px; color:#7a5c1e; text-transform:uppercase; letter-spacing:1px; margin-top:4px; }
.assinatura { display:flex; justify-content:center; margin-top:40px; page-break-inside:avoid; }
.assinatura-bloco { text-align:center; }
.assinatura-nome { font-family:'Dancing Script', cursive; font-size:30px; color:#1e3a5f; line-height:1; margin-bottom:-2px; }
.assinatura-linha { border-top:1px solid #bbb; padding-top:6px; font-size:10px; color:#888; min-width:260px; }
.footer { text-align:center; margin-top:24px; padding-top:16px; border-top:1px solid #e8d9a0; font-size:9px; color:#a8882f; }
.verificacao { text-align:center; margin-top:6px; font-size:9px; color:#bbb; letter-spacing:1px; text-transform:uppercase; }
@media print { body { padding:20px; } .assinatura { page-break-inside:avoid; } }
</style></head><body>
<div class="cover">
  <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
  <div class="cover-logo">MJ <span>Consultoria</span></div>
  <div class="cover-title">Relatório de Treinamento e Conformidade</div>
  <div class="cover-sub">${escapeHtml(tenantName || tenantId)}</div>
  <div class="info">
    <span><strong>Período:</strong> ${PERIODO_LABEL[periodo] || periodo}</span>
    <span><strong>Gerado em:</strong> ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
    <span><strong>Gerado por:</strong> ${escapeHtml(user.name || 'Operador')}</span>
  </div>
</div>

<div class="kpis">
  <div class="kpi"><div class="v">${totalTestes}</div><div class="l">Total de Testes</div></div>
  <div class="kpi"><div class="v">${taxaAprovacao}%</div><div class="l">Taxa de Aprovação</div></div>
  <div class="kpi"><div class="v">${mediaGeral}%</div><div class="l">Média Geral</div></div>
  <div class="kpi"><div class="v">${totalCerts}</div><div class="l">Certificados</div></div>
  <div class="kpi"><div class="v">${riscoAltoCount}</div><div class="l">Risco Alto</div></div>
</div>

<div class="section">
  <div class="section-title">Indicadores ISO — Cobertura de Capacitação</div>
  <table><thead><tr><th>Etapa</th><th>Quantidade</th><th>% do Total</th></tr></thead><tbody>
    <tr><td>Colaboradores cadastrados</td><td>${coberturaISO.totalColab}</td><td>100%</td></tr>
    <tr><td>Participaram de algum treinamento</td><td>${coberturaISO.participaram}</td><td>${pct(coberturaISO.participaram, coberturaISO.totalColab)}%</td></tr>
    <tr><td>Foram avaliados (teste/exame)</td><td>${coberturaISO.avaliados}</td><td>${pct(coberturaISO.avaliados, coberturaISO.totalColab)}%</td></tr>
    <tr><td>Aprovados</td><td>${coberturaISO.aprovados}</td><td>${pct(coberturaISO.aprovados, coberturaISO.totalColab)}%</td></tr>
    <tr><td>Reprovados</td><td>${coberturaISO.reprovados}</td><td>${pct(coberturaISO.reprovados, coberturaISO.totalColab)}%</td></tr>
    <tr><td>Treinaram, mas não avaliaram</td><td>${coberturaISO.semAvaliacao}</td><td>${pct(coberturaISO.semAvaliacao, coberturaISO.totalColab)}%</td></tr>
    <tr><td>Sem nenhuma atividade</td><td>${coberturaISO.semAtividade}</td><td>${pct(coberturaISO.semAtividade, coberturaISO.totalColab)}%</td></tr>
  </tbody></table>
</div>

<div class="section">
  <div class="section-title">Situação Individual de Cobertura</div>
  <table><thead><tr><th>Colaborador</th><th>Cargo</th><th>Iniciou Treinamento</th><th>Fez Avaliação</th><th>Situação</th></tr></thead>
  <tbody>${linhasIso}</tbody></table>
</div>

<div class="section">
  <div class="section-title">Aproveitamento por Colaborador</div>
  <table><thead><tr><th>Colaborador</th><th>Cargo</th><th>Testes</th><th>Aprovações</th><th>Taxa</th><th>Média</th><th>Trilhas</th><th>Carga Horária</th><th>Certs</th></tr></thead>
  <tbody>${linhasColab}</tbody></table>
</div>

<div class="section">
  <div class="section-title">Taxa de Aprovação por Trilha</div>
  <table><thead><tr><th>Trilha</th><th>Testes</th><th>Taxa (%)</th><th>Média</th></tr></thead>
  <tbody>${linhasTrilha}</tbody></table>
</div>

<div class="section">
  <div class="section-title">Risco por Colaborador</div>
  <table><thead><tr><th>Colaborador</th><th>Cargo</th><th>Média</th><th>Nível</th><th>Score</th><th>Motivos</th></tr></thead>
  <tbody>${linhasRisco}</tbody></table>
</div>

<div class="section">
  <div class="section-title">Evidências — Testes e Exames no Período</div>
  <table><thead><tr><th>Colaborador</th><th>Trilha</th><th>Módulo</th><th>Data</th><th>Nota</th><th>Status</th><th>Tipo</th></tr></thead>
  <tbody>${linhasEvidencias}</tbody></table>
</div>

<div class="assinatura">
  <div class="assinatura-bloco">
    <div class="assinatura-nome">Mirian Jabur</div>
    <div class="assinatura-linha">MJ Consultoria — Coordenação de Treinamento</div>
  </div>
</div>

<div class="footer">
  MJ Consultoria · Relatório gerado automaticamente pela plataforma de treinamento<br>
  Em conformidade com LGPD Lei nº 13.709/2018 · Provimento CNJ nº 149 · Provimento CNJ nº 213/2026
</div>
<div class="verificacao">Código de verificação: ${codigo}</div>
</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 600);
  };

  const exportCSV = () => {
    // Separador ; — o Excel em português (pt-BR) usa vírgula como separador decimal e só
    // reconhece automaticamente ; como separador de colunas ao abrir o CSV direto (duplo clique).
    const rows = ['Colaborador;Trilha;Módulo;Data;Nota;Status;Tipo'];
    filteredAvaliacoes.forEach(r => {
      rows.push([
        r.colaborador, r.trailTitle || '', r.moduleTitle || '',
        formatDate(r.createdAt), r.nota + '%',
        r.aprovado ? 'Aprovado' : 'Reprovado',
        r.ia ? 'IA' : 'Padrão'
      ].join(';'));
    });
    // BOM no início — sem ele o Excel abre acentos como "MÃ³dulo" em vez de "Módulo"
    const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evidencias_treinamento_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ABAS: { id: Tab; label: string; icon: string }[] = [
    { id: 'visao_geral',   label: 'Visão Geral',    icon: 'fa-chart-pie'    },
    { id: 'iso',           label: 'Indicadores ISO', icon: 'fa-award'       },
    { id: 'colaboradores', label: 'Colaboradores',  icon: 'fa-users'        },
    { id: 'trilhas',       label: 'Por Trilha',     icon: 'fa-road'         },
    { id: 'trilhas_evidencias', label: 'Progresso das Trilhas', icon: 'fa-clipboard-list' },
    { id: 'treinamentos',  label: 'Resumo de Treinamentos', icon: 'fa-chalkboard-user' },
    { id: 'risco',         label: 'Risco',          icon: 'fa-shield-halved' },
    { id: 'evidencias',    label: 'Testes e Exames', icon: 'fa-file-lines'   },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-navy">Relatórios de Treinamento</h2>
            <p className="text-sm text-slate-500 mt-0.5">Desempenho · Evidências · Exportação</p>
          </div>
          <div className="flex items-center gap-3">
            <select value={periodo} onChange={e => setPeriodo(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 outline-none focus:border-gold shadow-sm">
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="365">Último ano</option>
              <option value="99999">Todo o período</option>
            </select>
            <button onClick={gerarRelatorioPDF} className="flex items-center gap-2 bg-white border border-slate-200 hover:border-slate-400 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm"><i className="fa-solid fa-file-pdf text-xs"></i>Relatório em PDF</button><button onClick={exportCSV}
              className="flex items-center gap-2 bg-gold hover:bg-[#A8863C] text-navy px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm">
              <i className="fa-solid fa-file-excel text-xs"></i>Exportar Excel
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Total de Testes"   value={totalTestes}      icon="fa-clipboard-check"  color="#4F46E5" sub={`${coberturaISO.avaliados} de ${coberturaISO.totalColab} colaboradores avaliados`} />
          <StatCard label="Taxa de Aprovação" value={`${taxaAprovacao}%`} icon="fa-circle-check"  color="#059669" sub={`${totalAprovados} de ${totalTestes} avaliações — só quem fez prova`} />
          <StatCard label="Média Geral"       value={`${mediaGeral}%`} icon="fa-chart-bar"        color="#D97706" sub="só entre quem já foi avaliado" />
          <StatCard label="Certificados"      value={totalCerts}       icon="fa-certificate"      color="#7C3AED" sub="emitidos no total" />
          <StatCard label="Risco Alto"        value={riscoAltoCount}   icon="fa-shield-halved"    color="#DC2626" sub="colaboradores em atenção" />
        </div>

        {(coberturaISO.semAvaliacao + coberturaISO.semAtividade) > 0 && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <i className="fa-solid fa-circle-info mt-0.5"></i>
            <p>
              <strong>{coberturaISO.semAvaliacao + coberturaISO.semAtividade} colaborador{(coberturaISO.semAvaliacao + coberturaISO.semAtividade) !== 1 ? 'es' : ''} ainda não fizeram nenhuma prova</strong> —
              não entram na Taxa de Aprovação nem na Média Geral acima (essas duas só contam quem já foi avaliado).
              Veja a lista completa em <strong>Indicadores ISO</strong>.
            </p>
          </div>
        )}

        {/* Abas */}
        <div className="bg-white border border-slate-200 rounded-[16px] shadow-sm overflow-hidden">
          <div className="flex border-b border-slate-100">
            {ABAS.map(a => (
              <button key={a.id} onClick={() => setTab(a.id)}
                className={`flex items-center gap-2 px-5 py-4 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
                  tab === a.id
                    ? 'border-gold text-gold bg-white/50'
                    : 'border-transparent text-slate-500 hover:text-slate-600'
                }`}>
                <i className={`fa-solid ${a.icon}`}></i>{a.label}
              </button>
            ))}
          </div>

          <div className="p-6">

            {/* ── VISÃO GERAL ─────────────────────────────────────────────── */}
            {tab === 'visao_geral' && (
              <div className="space-y-6">

                {/* Linha 1: Atividade mensal + Distribuição */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Atividade mensal */}
                  <div className="lg:col-span-2 space-y-3 print:hidden">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Atividade Mensal</p>
                    {porMes.length === 0 ? (
                      <div className="h-48 flex items-center justify-center text-slate-500 text-sm">Sem dados no período</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={porMes} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Line type="monotone" dataKey="Testes"    stroke="#4F46E5" strokeWidth={2} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="Aprovados" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* Distribuição de notas */}
                  <div className="space-y-3">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Distribuição de Notas</p>
                    <div className="print:hidden">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={distribuicaoNotas} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                          dataKey="value" label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''} labelLine={false}>
                          {distribuicaoNotas.map((_, i) => (
                            <Cell key={i} fill={['#DC2626', '#D97706', '#059669', '#4F46E5'][i]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {distribuicaoNotas.map((d, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                            style={{ background: ['#DC2626', '#D97706', '#059669', '#4F46E5'][i] }}></div>
                          <span className="text-[10px] text-slate-500">{d.name}%: <strong className="text-slate-700">{d.value}</strong></span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Linha 2: Aprovação por trilha */}
                <div className="space-y-3 print:hidden">
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Taxa de Aprovação por Trilha</p>
                  {porTrilha.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-slate-500 text-sm">Sem dados no período</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={porTrilha} margin={{ top: 5, right: 10, left: -20, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-20} textAnchor="end" />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="Taxa (%)" radius={[4, 4, 0, 0]}>
                          {porTrilha.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                        <Bar dataKey="Média" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Resumo rápido */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Colaboradores ativos', value: colab.filter(u => filteredAvaliacoes.some(r => r.userId === u.id || r.colaborador === u.name)).length },
                    { label: 'Testes com IA', value: filteredAvaliacoes.filter(r => r.ia).length },
                    { label: 'Reprovações', value: filteredAvaliacoes.filter(r => !r.aprovado).length },
                    { label: 'Trilhas ativas', value: new Set(progresso.map(p => p.trilhaId)).size },
                  ].map((s, i) => (
                    <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                      <p className="text-2xl font-black text-slate-700">{s.value}</p>
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── INDICADORES ISO ─────────────────────────────────────────────── */}
            {tab === 'iso' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <p className="text-xs text-slate-500 max-w-2xl">
                    Cobertura de capacitação: quantos colaboradores existem, quantos participaram de algum treinamento,
                    quantos foram efetivamente avaliados (teste/exame) e o resultado — pronto para evidência em auditoria
                    ISO 27001/9001 e Provimento CNJ 213/2026.
                  </p>
                  <button onClick={exportCSVCobertura} className="flex items-center gap-2 bg-white border border-slate-200 hover:border-indigo-400 text-slate-600 hover:text-gold px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm">
                    <i className="fa-solid fa-file-excel"></i>CSV
                  </button>
                </div>

                {/* Funil */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Colaboradores" value={coberturaISO.totalColab} icon="fa-users" color="#0F172A" sub="cadastrados" />
                  <StatCard label="Participaram" value={coberturaISO.participaram} icon="fa-person-chalkboard" color="#4F46E5"
                    sub={`${pct(coberturaISO.participaram, coberturaISO.totalColab)}% do total`} />
                  <StatCard label="Avaliados" value={coberturaISO.avaliados} icon="fa-file-signature" color="#D97706"
                    sub={`${pct(coberturaISO.avaliados, coberturaISO.totalColab)}% do total`} />
                  <StatCard label="Aprovados" value={coberturaISO.aprovados} icon="fa-circle-check" color="#059669"
                    sub={`${pct(coberturaISO.aprovados, coberturaISO.totalColab)}% do total`} />
                </div>

                {/* Barra empilhada de situação */}
                <div className="space-y-2">
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Situação de todos os colaboradores</p>
                  <div className="w-full h-8 rounded-xl overflow-hidden flex border border-slate-200">
                    {[
                      { n: coberturaISO.aprovados,    color: '#059669' },
                      { n: coberturaISO.reprovados,   color: '#DC2626' },
                      { n: coberturaISO.semAvaliacao, color: '#D97706' },
                      { n: coberturaISO.semAtividade, color: '#94a3b8' },
                    ].filter(s => s.n > 0).map((s, i) => (
                      <div key={i} style={{ width: `${pct(s.n, coberturaISO.totalColab)}%`, background: s.color }}
                        className="flex items-center justify-center text-white text-[10px] font-black">
                        {pct(s.n, coberturaISO.totalColab) >= 6 ? `${pct(s.n, coberturaISO.totalColab)}%` : ''}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-4 text-[11px] text-slate-600">
                    <span><i className="fa-solid fa-square text-emerald-600 mr-1.5"></i>Aprovados: <strong>{coberturaISO.aprovados}</strong></span>
                    <span><i className="fa-solid fa-square text-red-600 mr-1.5"></i>Reprovados: <strong>{coberturaISO.reprovados}</strong></span>
                    <span><i className="fa-solid fa-square text-amber-600 mr-1.5"></i>Treinaram, sem avaliação: <strong>{coberturaISO.semAvaliacao}</strong></span>
                    <span><i className="fa-solid fa-square text-slate-400 mr-1.5"></i>Sem nenhuma atividade: <strong>{coberturaISO.semAtividade}</strong></span>
                  </div>
                </div>

                {/* Tabela por colaborador */}
                <div className="overflow-x-auto border border-slate-200 rounded-[14px]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-white border-b border-slate-200">
                        {['Colaborador', 'Cargo', 'Iniciou Treinamento', 'Fez Avaliação', 'Situação'].map(h => (
                          <th key={h} className="text-left p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {coberturaISO.linhas.map(l => {
                        const badge = {
                          aprovado:      { txt: 'Aprovado',            cls: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
                          reprovado:     { txt: 'Reprovado',           cls: 'bg-red-50 text-red-500 border-red-200'             },
                          sem_avaliacao: { txt: 'Treinou, sem avaliar',cls: 'bg-amber-50 text-amber-600 border-amber-200'       },
                          sem_atividade: { txt: 'Sem atividade',       cls: 'bg-slate-100 text-slate-500 border-slate-200'      },
                        }[l.status];
                        return (
                          <tr key={l.id} className="border-b border-slate-100 hover:bg-white transition-all">
                            <td className="p-3 font-bold text-navy">{l.name}</td>
                            <td className="p-3 text-slate-500">{l.cargo || '–'}</td>
                            <td className="p-3">{l.iniciouTreinamento ? <i className="fa-solid fa-check text-emerald-600"></i> : <i className="fa-solid fa-xmark text-slate-400"></i>}</td>
                            <td className="p-3">{l.fezAvaliacao ? <i className="fa-solid fa-check text-emerald-600"></i> : <i className="fa-solid fa-xmark text-slate-400"></i>}</td>
                            <td className="p-3">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${badge.cls}`}>{badge.txt}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── COLABORADORES ────────────────────────────────────────────── */}
            {tab === 'colaboradores' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <input value={buscaColab} onChange={e => setBuscaColab(e.target.value)}
                    placeholder="Buscar colaborador..."
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-gold w-64" />
                  <span className="text-xs text-slate-500 font-bold">{porColab.length} colaboradores</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-white border-b border-slate-200">
                        {['Colaborador', 'Cargo', 'Testes', 'Aprovações', 'Taxa', 'Média', 'Trilhas', 'Carga Horária', 'Certs', 'Último Teste', 'Ficha'].map(h => (
                          <th key={h} className="text-left p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {porColab.length === 0 && (
                        <tr><td colSpan={11} className="text-center p-8 text-slate-500">Nenhum dado encontrado.</td></tr>
                      )}
                      {porColab.map(c => (
                        <tr key={c.id} className="border-b border-slate-100 hover:bg-white transition-all">
                          <td className="p-3 font-bold text-navy">{c.name}</td>
                          <td className="p-3 text-slate-500">{c.cargo || '–'}</td>
                          <td className="p-3 text-slate-700 font-bold">{c.testes}</td>
                          <td className="p-3 text-emerald-600 font-bold">{c.aprovados}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-14 bg-slate-200 rounded-full h-1.5">
                                <div className="h-1.5 rounded-full" style={{
                                  width: `${c.taxa}%`,
                                  background: c.taxa >= 75 ? '#059669' : c.taxa >= 50 ? '#D97706' : '#DC2626'
                                }}></div>
                              </div>
                              <span className={`font-black ${c.taxa >= 75 ? 'text-emerald-600' : c.taxa >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{c.taxa}%</span>
                            </div>
                          </td>
                          <td className="p-3 font-bold text-slate-700">{c.media}%</td>
                          <td className="p-3 text-slate-500">{c.trilhas}</td>
                          <td className="p-3 text-slate-700 font-bold">{c.cargaHoraria > 0 ? `${c.cargaHoraria}h` : '–'}</td>
                          <td className="p-3">
                            {c.certs > 0
                              ? <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black px-2 py-0.5 rounded-lg">{c.certs} cert.</span>
                              : <span className="text-slate-500">–</span>}
                          </td>
                          <td className="p-3 text-slate-500 whitespace-nowrap">
                            {c.ultimo ? (
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                                c.ultimo.aprovado ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                              }`}>{c.ultimo.nota}% · {c.ultimo.aprovado ? 'Aprov.' : 'Reprov.'}</span>
                            ) : '–'}
                          </td>
                          <td className="p-3">
                            <button onClick={() => gerarFichaColaborador(c.id, c.name)}
                              className="flex items-center gap-1.5 text-[9px] bg-white border border-slate-200 hover:border-gold text-slate-600 hover:text-[#8a6e2f] px-3 py-1.5 rounded-lg font-black uppercase tracking-widest transition-all whitespace-nowrap">
                              <i className="fa-solid fa-file-pdf"></i>Gerar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── POR TRILHA ───────────────────────────────────────────────── */}
            {tab === 'trilhas' && (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-white border-b border-slate-200">
                        {['Trilha', 'Total de Testes', 'Aprovações', 'Taxa de Aprovação', 'Média', 'Testes c/ IA'].map(h => (
                          <th key={h} className="text-left p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {porTrilha.length === 0 && (
                        <tr><td colSpan={6} className="text-center p-8 text-slate-500">Sem dados no período.</td></tr>
                      )}
                      {porTrilha.map((t, i) => {
                        const raw = filteredAvaliacoes.filter(r => (r.trailTitle || 'Sem trilha') === t.name || (r.trailTitle || 'Sem trilha').startsWith(t.name.replace('…', '')));
                        const ia = raw.filter(r => r.ia).length;
                        return (
                          <tr key={i} className="border-b border-slate-100 hover:bg-white transition-all">
                            <td className="p-3 font-bold text-navy">{t.name}</td>
                            <td className="p-3 text-slate-700 font-bold">{t.testes}</td>
                            <td className="p-3 text-emerald-600 font-bold">{Math.round(t.testes * t['Taxa (%)'] / 100)}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="w-20 bg-slate-200 rounded-full h-1.5">
                                  <div className="h-1.5 rounded-full" style={{
                                    width: `${t['Taxa (%)']}%`,
                                    background: t['Taxa (%)'] >= 75 ? '#059669' : t['Taxa (%)'] >= 50 ? '#D97706' : '#DC2626'
                                  }}></div>
                                </div>
                                <span className={`font-black ${t['Taxa (%)'] >= 75 ? 'text-emerald-600' : t['Taxa (%)'] >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                                  {t['Taxa (%)']}%
                                </span>
                              </div>
                            </td>
                            <td className="p-3 font-bold text-slate-700">{t['Média']}%</td>
                            <td className="p-3">
                              {ia > 0
                                ? <span className="bg-white text-gold text-[10px] font-black px-2 py-0.5 rounded-lg border border-indigo-100">✨ {ia}</span>
                                : <span className="text-slate-500">–</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── PROGRESSO DAS TRILHAS ───────────────────────────────────────── */}
            {tab === 'trilhas_evidencias' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <input value={buscaTrilha} onChange={e => setBuscaTrilha(e.target.value)}
                      placeholder="Buscar colaborador ou trilha..."
                      className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-gold w-64" />
                    <span className="text-xs text-slate-500 font-bold">
                      {progressoEvidencia.length} registros
                      <span className="text-slate-400 font-normal ml-2">— % de módulos concluídos por colaborador em cada trilha (não é nota de prova)</span>
                    </span>
                  </div>
                  <button onClick={exportCSVTrilhas} className="flex items-center gap-2 bg-white border border-slate-200 hover:border-indigo-400 text-slate-600 hover:text-gold px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm">
                    <i className="fa-solid fa-file-excel"></i>CSV
                  </button>
                </div>
                <div className="overflow-x-auto border border-slate-200 rounded-[14px]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-white border-b border-slate-200">
                        {['Colaborador', 'Trilha', '% Concluído', 'Status', 'Última Atualização'].map(h => (
                          <th key={h} className="text-left p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {progressoEvidencia.length === 0 && (
                        <tr><td colSpan={5} className="text-center p-8 text-slate-500">Nenhum registro de progresso encontrado.</td></tr>
                      )}
                      {progressoEvidencia.map(p => (
                        <tr key={p.id} className="border-b border-slate-100 hover:bg-white transition-all">
                          <td className="p-3 font-bold text-navy">{p.colaborador}</td>
                          <td className="p-3 text-slate-600 max-w-[220px] truncate">{p.trilha}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-slate-200 rounded-full h-1.5">
                                <div className="h-1.5 rounded-full" style={{ width: `${p.percentual}%`, background: p.concluida ? '#059669' : '#D97706' }}></div>
                              </div>
                              <span className="font-black text-slate-700">{p.percentual}%</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                              p.concluida ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'
                            }`}>{p.concluida ? 'Concluída' : 'Em andamento'}</span>
                          </td>
                          <td className="p-3 text-slate-500 whitespace-nowrap">{formatDate(p.atualizadoEm)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── RESUMO DE TREINAMENTOS ──────────────────────────────────────── */}
            {tab === 'treinamentos' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <p className="text-xs text-slate-500 font-bold">
                    {resumoTreinamentos.length} treinamentos/trilhas cadastrados
                    <span className="text-slate-400 font-normal ml-2">— {cargaHorariaCatalogoTotal}h de carga horária total no catálogo</span>
                  </p>
                </div>
                <div className="overflow-x-auto border border-slate-200 rounded-[14px]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-white border-b border-slate-200">
                        {['Nome', 'Tipo', 'Instrutor', 'Forma', 'Carga Horária', 'Participantes', 'Concluídos', 'Aproveitamento'].map(h => (
                          <th key={h} className="text-left p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {resumoTreinamentos.length === 0 && (
                        <tr><td colSpan={8} className="text-center p-8 text-slate-500">Nenhuma trilha ou treinamento cadastrado ainda.</td></tr>
                      )}
                      {resumoTreinamentos.map(t => (
                        <tr key={t.id} className="border-b border-slate-100 hover:bg-white transition-all">
                          <td className="p-3 font-bold text-navy max-w-[240px] truncate">{t.titulo}</td>
                          <td className="p-3">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                              t.tipo === 'trilha' ? 'bg-purple-50 text-purple-600 border border-purple-200' : 'bg-blue-50 text-blue-600 border border-blue-200'
                            }`}>{t.tipo === 'trilha' ? 'Trilha' : 'Treinamento'}</span>
                          </td>
                          <td className="p-3 text-slate-600">{t.instrutor || (t.tipo === 'trilha' && t.oficial ? 'Mirian Jabur' : '–')}</td>
                          <td className="p-3 text-slate-600">{t.formato ? FORMATO_LABEL[t.formato] : '–'}</td>
                          <td className="p-3 text-slate-700 font-bold">
                            {t.tipo === 'trilha' ? `${Math.max(1, t.cargaHoraria || 0)}h` : (t.cargaHoraria ? `${t.cargaHoraria}h` : '–')}
                          </td>
                          <td className="p-3 text-slate-700 font-bold">{t.participantes}</td>
                          <td className="p-3 text-emerald-600 font-bold">{t.concluidos}</td>
                          <td className="p-3">
                            {t.participantes === 0 ? <span className="text-slate-500">–</span> : (
                              <div className="flex items-center gap-2">
                                <div className="w-14 bg-slate-200 rounded-full h-1.5">
                                  <div className="h-1.5 rounded-full" style={{ width: `${t.taxa}%`, background: t.taxa >= 75 ? '#059669' : t.taxa >= 50 ? '#D97706' : '#DC2626' }}></div>
                                </div>
                                <span className={`font-black ${t.taxa >= 75 ? 'text-emerald-600' : t.taxa >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{t.taxa}%</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── RISCO ────────────────────────────────────────────────────── */}
            {tab === 'risco' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <input value={buscaColab} onChange={e => setBuscaColab(e.target.value)}
                    placeholder="Buscar colaborador..."
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-gold w-64" />
                  <p className="text-xs text-slate-500">
                    Índice combinando desempenho em testes, atividade recente e validade de certificados — quanto maior, mais atenção o colaborador exige.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-white border-b border-slate-200">
                        {['Colaborador', 'Cargo', 'Média', 'Nível de Risco', 'Score', 'Motivos'].map(h => (
                          <th key={h} className="text-left p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {scoreColab.length === 0 && (
                        <tr><td colSpan={6} className="text-center p-8 text-slate-500">Nenhum dado encontrado.</td></tr>
                      )}
                      {scoreColab.map(c => {
                        const cor = c.nivel === 'Alto' ? '#DC2626' : c.nivel === 'Médio' ? '#D97706' : '#059669';
                        return (
                          <tr key={c.id} className="border-b border-slate-100 hover:bg-white transition-all">
                            <td className="p-3 font-bold text-navy">{c.name}</td>
                            <td className="p-3 text-slate-500">{c.cargo || '–'}</td>
                            <td className="p-3 text-slate-700 font-bold">{c.media !== null ? `${c.media}%` : '–'}</td>
                            <td className="p-3">
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-lg" style={{ background: cor + '15', color: cor }}>
                                {c.nivel}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-slate-200 rounded-full h-1.5">
                                  <div className="h-1.5 rounded-full" style={{ width: `${c.risco}%`, background: cor }}></div>
                                </div>
                                <span className="font-black" style={{ color: cor }}>{c.risco}</span>
                              </div>
                            </td>
                            <td className="p-3 text-slate-500">{c.motivos.join(' · ')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── TESTES E EXAMES ───────────────────────────────────────────────── */}
            {tab === 'evidencias' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-slate-700">
                    {filteredAvaliacoes.length} avaliações no período (nota e aprovação)
                    <span className="text-slate-500 font-normal ml-2">— válidas como evidência para dossiê CNJ (Provimentos 149, 161 e 213)</span>
                  </p>
                  <button onClick={gerarRelatorioPDF} className="flex items-center gap-2 bg-white border border-slate-200 hover:border-slate-400 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm"><i className="fa-solid fa-file-pdf text-xs"></i>Relatório em PDF</button><button onClick={exportCSV}
                    className="flex items-center gap-2 bg-white border border-slate-200 hover:border-indigo-400 text-slate-600 hover:text-gold px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm">
                    <i className="fa-solid fa-file-excel"></i>CSV
                  </button>
                </div>
                <div className="overflow-x-auto border border-slate-200 rounded-[14px]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-white border-b border-slate-200">
                        {['Colaborador', 'Trilha', 'Módulo', 'Data/Hora', 'Nota', 'Status', 'Tipo'].map(h => (
                          <th key={h} className="text-left p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAvaliacoes.length === 0 && (
                        <tr><td colSpan={7} className="text-center p-8 text-slate-500">Nenhum registro no período.</td></tr>
                      )}
                      {filteredAvaliacoes.map(r => (
                        <tr key={r.id} className="border-b border-slate-100 hover:bg-white transition-all">
                          <td className="p-3 font-bold text-navy">{r.colaborador}</td>
                          <td className="p-3 text-slate-600 max-w-[160px] truncate">{r.trailTitle || '–'}</td>
                          <td className="p-3 text-slate-500 max-w-[140px] truncate">{r.moduleTitle || '–'}</td>
                          <td className="p-3 text-slate-500 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                          <td className={`p-3 font-black ${r.nota >= 75 ? 'text-success' : 'text-danger'}`}>{r.nota}%</td>
                          <td className="p-3">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                              r.aprovado
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                : 'bg-red-50 text-red-500 border border-red-200'
                            }`}>{r.aprovado ? 'Aprovado' : 'Reprovado'}</span>
                          </td>
                          <td className="p-3">
                            {r.ia
                              ? <span className="bg-white text-gold text-[10px] font-black px-2 py-0.5 rounded-lg border border-indigo-100">✨ IA</span>
                              : <span className="text-slate-500 text-[10px]">Padrão</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RelatoriosView;
