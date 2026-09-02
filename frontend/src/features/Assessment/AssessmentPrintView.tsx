// Geração do PDF do Diagnóstico de Maturidade via window.open + document.write + print().
// Janela isolada do bundle React, com HTML/CSS próprios — mesmo padrão usado em
// DossieConformidadeView, BannersView, ExamesView e RelatoriosView.

import { Assessment, PrioridadeGap } from './types';
import { DIMENSOES } from './constants';
import { labelNivel, situacaoScore } from './scoring';

interface Opts {
  tenantName: string;
  userName: string;
}

// Paleta de cores semânticas do PDF.
const CORES = {
  navy: '#0F2340',
  verde: '#1A7A5E', verdeBg: '#E8F5F1',
  vermelho: '#A32D2D', vermelhoBg: '#FCEBEB',
  ambar: '#BA7517', ambarBg: '#FAEEDA',
  azul: '#185FA5', azulBg: '#E6F1FB',
};

const SITUACAO: Record<string, { cor: string; bg: string; label: string }> = {
  critico: { cor: CORES.vermelho, bg: CORES.vermelhoBg, label: 'Crítico' },
  gap: { cor: CORES.ambar, bg: CORES.ambarBg, label: 'Gap' },
  adequado: { cor: CORES.verde, bg: CORES.verdeBg, label: 'Adequado' },
};

const PRIORIDADE: Record<PrioridadeGap, { cor: string; bg: string; label: string }> = {
  urgente: { cor: CORES.vermelho, bg: CORES.vermelhoBg, label: 'Urgente' },
  alta: { cor: CORES.ambar, bg: CORES.ambarBg, label: 'Alta' },
  baixa: { cor: CORES.azul, bg: CORES.azulBg, label: 'Baixa' },
};

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Nível qualitativo (1-5) de uma dimensão isolada, pela mesma escala de score do nível global.
function nivelPorScore(score: number): number {
  return score < 20 ? 1 : score < 40 ? 2 : score < 60 ? 3 : score < 80 ? 4 : 5;
}

// Recomendação padrão quando a IA ainda não gerou uma para a dimensão.
function recomendacaoPadrao(dimNome: string, ref: string): string {
  return `Adequar os indicadores desta dimensão (${dimNome}) conforme a base legal aplicável: ${ref}.`;
}

export function gerarPDFAssessment(assessment: Assessment, opts: Opts) {
  const win = window.open('', '_blank');
  if (!win) return;

  const dataGeracao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const sitGlobal = SITUACAO[situacaoScore(assessment.scoreGlobal)];
  const resumo = assessment.resumoExecutivo;

  // ── Seção 2: Resumo executivo — mini-gráfico de barras (CSS puro, sem libs) ──
  const miniGraficoBarras = DIMENSOES.map(d => {
    const score = assessment.scoresPorDim[d.id] ?? 0;
    const sit = SITUACAO[situacaoScore(score)];
    return `<div class="mini-bar-col">
      <div class="mini-bar-track"><div class="mini-bar-fill" style="height:${score}%;background:${sit.cor};"></div></div>
      <span class="mini-bar-score" style="color:${sit.cor};">${score}%</span>
      <span class="mini-bar-label">${escapeHtml(d.nome.length > 12 ? d.nome.slice(0, 10) + '…' : d.nome)}</span>
    </div>`;
  }).join('');

  // ── Seção 3: Score por dimensão ──────────────────────────────────────────
  const linhasScorePorDim = DIMENSOES.map(d => {
    const score = assessment.scoresPorDim[d.id] ?? 0;
    const sit = SITUACAO[situacaoScore(score)];
    return `<tr>
      <td>${escapeHtml(d.nome)}</td>
      <td><b style="color:${sit.cor}">${score}%</b></td>
      <td>Nível ${nivelPorScore(score)}</td>
      <td><span class="badge" style="background:${sit.bg};color:${sit.cor};">${sit.label}</span></td>
    </tr>`;
  }).join('');

  // ── Seção 4: Análise detalhada (barra de progresso + recomendação) ──────
  const blocosAnaliseDetalhada = DIMENSOES.map(d => {
    const score = assessment.scoresPorDim[d.id] ?? 0;
    const sit = SITUACAO[situacaoScore(score)];
    const recomendacao = assessment.recomendacoesPorDim?.[d.id] || recomendacaoPadrao(d.nome, d.ref);
    return `<div class="dim-card" style="border-left:4px solid ${sit.cor};">
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <b style="color:${CORES.navy};">${escapeHtml(d.nome)}</b>
        <span style="color:${sit.cor};font-weight:900;">${score}%</span>
      </div>
      <div class="barra-track"><div class="barra-fill" style="width:${score}%;background:${sit.cor};"></div></div>
      <p class="recomendacao"><b>Recomendação:</b> ${escapeHtml(recomendacao)}</p>
    </div>`;
  }).join('');

  // ── Seção 5: Plano de ação ───────────────────────────────────────────────
  const linhasPlanoAcao = assessment.gaps.length
    ? assessment.gaps.map(g => {
        const dimNome = DIMENSOES.find(d => d.id === g.dimId)?.nome || g.dimId;
        const prio = PRIORIDADE[g.prioridade];
        return `<tr>
          <td><span class="badge" style="background:${prio.bg};color:${prio.cor};">${prio.label.toUpperCase()}</span></td>
          <td>${escapeHtml(dimNome)}</td>
          <td>${escapeHtml(g.textoIndicador)}</td>
          <td>${escapeHtml(g.trilhaRecomendada)}</td>
          <td>${escapeHtml(g.prazoSugerido)}</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="5">Nenhum gap identificado neste diagnóstico.</td></tr>';

  win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Diagnóstico de Maturidade</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
body { font-family: Arial, sans-serif; color:#1e293b; background:white; padding:40px; font-size:12px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.cover { text-align:center; padding:60px 0 40px; border-bottom:3px solid ${CORES.navy}; margin-bottom:40px; }
.cover-logo { font-size:40px; font-weight:900; color:${CORES.navy}; letter-spacing:-2px; }
.cover-logo span { color:#c9a84c; }
.cover-title { font-size:22px; font-weight:900; color:#1e293b; margin-top:16px; text-transform:uppercase; letter-spacing:2px; }
.cover-sub { font-size:12px; color:#64748b; margin-top:8px; text-transform:uppercase; letter-spacing:3px; }
.cover-score { font-size:34px; font-weight:900; margin-top:20px; color:${sitGlobal.cor}; }
.cover-badge { display:inline-block; margin-top:6px; padding:4px 14px; border-radius:999px; font-size:11px; font-weight:900; text-transform:uppercase; background:${sitGlobal.bg}; color:${sitGlobal.cor}; }
.cover-nivel { font-size:14px; font-weight:900; color:${CORES.navy}; margin-top:8px; }
.cover-date { font-size:11px; color:#94a3b8; margin-top:20px; }
.section { margin-bottom:28px; page-break-inside:avoid; }
.section-title { background:${CORES.navy}; color:white; padding:10px 16px; border-radius:8px 8px 0 0; font-size:13px; font-weight:900; text-transform:uppercase; letter-spacing:1px; border-left:4px solid #c9a84c; }
.section-body { background:#f8fafc; border:1px solid #e2e8f0; border-top:none; border-radius:0 0 8px 8px; padding:16px; }
table { width:100%; border-collapse:collapse; font-size:11px; }
th, td { text-align:left; padding:6px 8px; border-bottom:1px solid #e2e8f0; vertical-align:top; }
th { color:#64748b; text-transform:uppercase; font-size:9px; letter-spacing:1px; }
.badge { padding:2px 8px; border-radius:6px; font-size:9px; font-weight:900; text-transform:uppercase; }
.resumo-cabecalho { font-size:15px; font-weight:900; color:${CORES.navy}; margin-bottom:10px; }
.resumo-rotulo { font-size:9px; font-weight:900; color:#c9a84c; text-transform:uppercase; letter-spacing:1px; margin-bottom:3px; }
.resumo-texto { font-size:11.5px; line-height:1.7; color:#334155; white-space:pre-wrap; margin-bottom:14px; }
.resumo-vazio { font-size:12px; color:#94a3b8; font-style:italic; }
.mini-grafico { display:flex; align-items:flex-end; gap:10px; height:120px; margin:16px 0; padding:0 4px; }
.mini-bar-col { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; height:100%; }
.mini-bar-track { width:100%; max-width:22px; height:80px; display:flex; align-items:flex-end; background:#e2e8f0; border-radius:4px 4px 0 0; overflow:hidden; }
.mini-bar-fill { width:100%; }
.mini-bar-score { font-size:9px; font-weight:900; margin-top:4px; }
.mini-bar-label { font-size:7px; color:#94a3b8; text-align:center; margin-top:2px; text-transform:uppercase; letter-spacing:0.3px; }
.dim-card { background:white; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:10px; }
.barra-track { width:100%; background:#e2e8f0; border-radius:999px; height:6px; margin-top:6px; }
.barra-fill { height:6px; border-radius:999px; }
.recomendacao { font-size:10px; color:#334155; margin-top:8px; }
.footer { text-align:center; margin-top:50px; padding-top:16px; border-top:1px solid #e2e8f0; font-size:9px; color:#94a3b8; }
@media print { body { padding:20px; } .section { page-break-inside:avoid; } }
</style></head><body>

<div class="cover">
  <div class="cover-logo">MJ <span>Consultoria</span></div>
  <div class="cover-title">Diagnóstico de Maturidade em Segurança da Informação</div>
  <div class="cover-sub">${escapeHtml(opts.tenantName)} — ${escapeHtml(assessment.periodo)}</div>
  <div class="cover-score">${assessment.scoreGlobal}%</div>
  <div class="cover-badge">${sitGlobal.label}</div>
  <div class="cover-nivel">${escapeHtml(labelNivel(assessment.nivel))}</div>
  ${assessment.bloqueado ? `<div style="font-size:10px;color:${CORES.vermelho};font-weight:900;margin-top:8px;text-transform:uppercase;">Nível travado — dimensão bloqueadora abaixo de 40%</div>` : ''}
  <div class="cover-date">Gerado em ${dataGeracao} por ${escapeHtml(opts.userName)}</div>
</div>

<div class="section">
  <div class="section-title">Resumo Executivo</div>
  <div class="section-body">
    ${resumo ? `
    <div class="resumo-cabecalho">${escapeHtml(resumo.cabecalho)}</div>
    ${resumo.introducao ? `<div class="resumo-rotulo">Introdução</div><p class="resumo-texto">${escapeHtml(resumo.introducao)}</p>` : ''}
    ${resumo.objetivo ? `<div class="resumo-rotulo">Objetivo</div><p class="resumo-texto">${escapeHtml(resumo.objetivo)}</p>` : ''}
    <div class="resumo-rotulo">Análise</div>
    <p class="resumo-texto">${escapeHtml(resumo.analiseGeral)}</p>
    ` : '<p class="resumo-vazio">Resumo não gerado.</p>'}

    <div class="resumo-rotulo">Score por dimensão</div>
    <div class="mini-grafico">${miniGraficoBarras}</div>

    <table style="margin-top:6px;">
      <thead><tr><th>Respondido por</th><th>Período</th><th>Score global</th><th>Nível</th></tr></thead>
      <tbody><tr>
        <td>${escapeHtml(assessment.respondidoPorNome)}</td>
        <td>${escapeHtml(assessment.periodo)}</td>
        <td><b style="color:${sitGlobal.cor}">${assessment.scoreGlobal}%</b></td>
        <td>${escapeHtml(labelNivel(assessment.nivel))}</td>
      </tr></tbody>
    </table>
  </div>
</div>

<div class="section">
  <div class="section-title">Score por Dimensão</div>
  <div class="section-body">
    <table><thead><tr><th>Dimensão</th><th>Score</th><th>Nível</th><th>Status</th></tr></thead>
    <tbody>${linhasScorePorDim}</tbody></table>
  </div>
</div>

<div class="section">
  <div class="section-title">Análise Detalhada por Dimensão</div>
  <div class="section-body">${blocosAnaliseDetalhada}</div>
</div>

<div class="section">
  <div class="section-title">Plano de Ação Prioritário</div>
  <div class="section-body">
    <table><thead><tr><th>Prioridade</th><th>Dimensão</th><th>Ação</th><th>Trilha recomendada</th><th>Prazo</th></tr></thead>
    <tbody>${linhasPlanoAcao}</tbody></table>
  </div>
</div>

<div class="footer">
  MJ Consultoria · Diagnóstico gerado automaticamente pela plataforma de treinamento<br>
  Em conformidade com LGPD Lei nº 13.709/2018 · Provimento CNJ nº 149 · Provimento CNJ nº 213/2026
</div>
</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 600);
}
