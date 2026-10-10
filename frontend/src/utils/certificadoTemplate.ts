// Template ÚNICO de certificado (modelo 2) — frente + verso, A4 paisagem, 2 páginas.
// Função pura: recebe os dados já resolvidos (nenhuma chamada a Firestore/rede aqui dentro —
// o QR Code, por ser gerado de forma assíncrona pela lib `qrcode`, é computado pelo chamador
// e passado pronto em `qrDataUrl`) e devolve o HTML/CSS completo pra abrir numa nova janela e
// imprimir. É o único lugar que desenha um certificado na plataforma — CertificadoView.tsx e
// ExamesView.tsx chamam esta mesma função, pra nunca mais existirem dois certificados com
// aparência diferente pro mesmo tipo de conquista.

export interface ItemConteudo {
  tema: string;
  cargaHoraria: number;
}

export interface CertificadoTemplateDados {
  codigo: string;
  hash: string;
  nome: string;
  cargo: string;
  serventiaNome: string;
  serventiaUf?: string;
  tipo: 'trilha' | 'modulo' | 'exame';
  curso: string;
  moduloTitulo?: string;
  modalidade: string;
  cargaHoraria: number;
  dataInicio?: string;   // ISO yyyy-mm-dd
  dataConclusao?: string; // ISO yyyy-mm-dd
  dataEmissao: string;    // ISO yyyy-mm-dd
  aproveitamento: number;
  notaMinima: number;
  instrutorNome: string;
  instrutorCargo: string;
  instrutorQualificacoes: string;
  assinaturaUrl?: string;
  emissoraRazaoSocial: string;
  emissoraCnpj: string;
  localEmissao: string;
  qrDataUrl: string;
  verificacaoUrl: string; // ex: https://cartorio-edu.vercel.app/verificar
  itens?: ItemConteudo[];  // tópicos/aulas do curso, com carga horária individual (opcional)
  numQuestoes?: number;    // nº de questões da avaliação final (quando houver)
}

const UNIDADES_FEM = ['', 'uma', 'duas', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const DEZ_A_DEZENOVE = ['dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta'];

function extensoFeminino(n: number): string | null {
  if (!Number.isInteger(n) || n < 0 || n > 69) return null;
  if (n === 0) return 'zero';
  if (n < 10) return UNIDADES_FEM[n];
  if (n < 20) return DEZ_A_DEZENOVE[n - 10];
  const dez = Math.floor(n / 10);
  const un = n % 10;
  return un === 0 ? DEZENAS[dez] : `${DEZENAS[dez]} e ${UNIDADES_FEM[un]}`;
}

// "1 (uma) hora" / "2 (duas) horas" / "2.5 horas" (sem extenso quando não é inteiro simples)
export function concordanciaHoras(n: number): string {
  const plural = n !== 1;
  const extenso = extensoFeminino(n);
  const numero = Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
  return extenso ? `${numero} (${extenso}) hora${plural ? 's' : ''}` : `${numero} hora${plural ? 's' : ''}`;
}

function formatarDataExtenso(iso?: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatarDataCurta(iso?: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('pt-BR');
}

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function certificadoTemplate(d: CertificadoTemplateDados): string {
  const serventiaLinha = `${d.cargo}${d.serventiaNome ? ` · ${d.serventiaNome}${d.serventiaUf ? `/${d.serventiaUf}` : ''}` : ''}`;
  const tituloCurso = d.moduloTitulo ? `${d.curso} — ${d.moduloTitulo}` : d.curso;
  const periodo = d.dataInicio && d.dataConclusao && d.dataInicio !== d.dataConclusao
    ? `realizado no período de ${formatarDataCurta(d.dataInicio)} a ${formatarDataCurta(d.dataConclusao)}`
    : `realizado em ${formatarDataCurta(d.dataConclusao || d.dataEmissao)}`;
  const periodoColuna = d.dataInicio && d.dataConclusao && d.dataInicio !== d.dataConclusao
    ? `${formatarDataCurta(d.dataInicio)} a ${formatarDataCurta(d.dataConclusao)}`
    : formatarDataCurta(d.dataConclusao || d.dataEmissao);

  const itens: ItemConteudo[] = d.itens && d.itens.length
    ? d.itens
    : [{ tema: tituloCurso, cargaHoraria: d.cargaHoraria }];
  const horasItens = itens.reduce((acc, it) => acc + (it.cargaHoraria || 0), 0);
  const linhasConteudo = itens.map((it) => `
    <tr><td>${esc(it.tema)}</td><td class="num">${esc(concordanciaHoras(it.cargaHoraria))}</td></tr>
  `).join('');
  const linhaAvaliacao = d.numQuestoes
    ? `<tr><td>Avaliação final — ${esc(d.numQuestoes)} questão${d.numQuestoes !== 1 ? 'ões' : ''}</td><td class="num">—</td></tr>`
    : '';
  const totalGeral = Math.max(horasItens, d.cargaHoraria);

  const assinaturaImg = d.assinaturaUrl
    ? `<img src="${esc(d.assinaturaUrl)}" alt="Assinatura" class="assinatura-img" />`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Certificado — ${esc(d.nome)}</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #1a1a1a; }
  .pagina { width: 297mm; height: 210mm; position: relative; background: #fff; overflow: hidden; page-break-after: always; }
  .pagina:last-child { page-break-after: auto; }
  .faixa-topo { position: absolute; top: 0; left: 0; right: 0; height: 16mm; background: linear-gradient(135deg, #0A1628 0%, #0f2240 70%); border-bottom: 1.5mm solid #C9A84C; display: flex; align-items: center; padding: 0 16mm; gap: 10px; }
  .faixa-topo .marca { color: #fff; font-weight: 900; letter-spacing: 2px; font-size: 13pt; text-transform: uppercase; }
  .faixa-topo .sub { color: #C9A84C; font-size: 7.5pt; letter-spacing: 1px; text-transform: uppercase; margin-left: 10px; }
  .faixa-base { position: absolute; bottom: 0; left: 0; right: 0; height: 11mm; background: #0A1628; display: flex; align-items: center; justify-content: space-between; padding: 0 16mm; color: rgba(255,255,255,0.75); font-size: 8pt; }
  .conteudo { position: absolute; top: 20mm; left: 16mm; right: 16mm; bottom: 15mm; display: flex; flex-direction: column; align-items: center; }
  .titulo-cert { font-size: 15pt; font-weight: 900; color: #0A1628; letter-spacing: 1px; text-transform: uppercase; margin-top: 2mm; }
  .certificamos { font-size: 11pt; color: #555; margin-top: 6mm; }
  .nome { font-size: 27pt; font-weight: 900; color: #0A1628; border-bottom: 1.5px solid #C9A84C; padding: 2mm 10mm 3mm; margin-top: 2mm; text-align: center; }
  .linha-cargo { font-size: 11pt; color: #444; margin-top: 3mm; }
  .paragrafo { font-size: 10.5pt; color: #333; text-align: center; max-width: 220mm; line-height: 1.6; margin-top: 5mm; }
  .faixa-5col { display: flex; width: 100%; margin-top: 6mm; border: 1px solid #C9A84C; border-radius: 3px; overflow: hidden; }
  .faixa-5col .col { flex: 1; text-align: center; padding: 3mm 2mm; border-left: 1px solid #e8d9a0; }
  .faixa-5col .col:first-child { border-left: none; }
  .faixa-5col .label { font-size: 6.5pt; color: #8a6e2f; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
  .faixa-5col .valor { font-size: 9.5pt; color: #0A1628; font-weight: 800; margin-top: 1mm; }
  .rodape-interno { display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: auto; }
  .rodape-interno .bloco { text-align: center; flex: 1; }
  .rodape-interno .bloco .linha { width: 55mm; border-top: 1px solid #999; margin: 1mm auto 0; padding-top: 1mm; font-size: 7pt; color: #888; }
  .qr-bloco img { width: 20mm; height: 20mm; }
  .qr-bloco .valide { font-size: 7pt; color: #8a6e2f; font-weight: 700; letter-spacing: 0.5px; margin-top: 1mm; }
  .qr-bloco .url { font-size: 6.5pt; color: #aaa; }
  .assinatura-img { height: 11mm; display: block; margin: 0 auto 1mm; }
  .assinatura-nome { font-size: 9.5pt; color: #333; }
  .hash-box { margin-top: 4mm; border: 1px solid #ddd; background: #fafafa; border-radius: 3px; padding: 2mm 6mm; text-align: center; width: 100%; }
  .hash-box .label { font-size: 6.5pt; color: #999; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
  .hash-box .valor { font-family: "Consolas", "Courier New", monospace; font-size: 7pt; color: #555; word-break: break-all; }

  /* Verso */
  .verso-header { display: flex; align-items: center; gap: 10px; }
  .verso-header .marca { color: #0A1628; font-weight: 900; font-size: 11pt; text-transform: uppercase; }
  .verso-header .meta { font-size: 8pt; color: #888; margin-left: auto; }
  .verso-titulo { font-size: 12pt; font-weight: 900; color: #0A1628; text-transform: uppercase; margin-top: 6mm; letter-spacing: 1px; }
  .verso-curso { font-size: 13pt; font-weight: 800; color: #0f2240; margin-top: 2mm; }
  .verso-sub { font-size: 8.5pt; color: #777; margin-top: 1mm; }
  table.conteudo-tabela { width: 100%; border-collapse: collapse; margin-top: 4mm; font-size: 8.5pt; }
  table.conteudo-tabela th { background: #0A1628; color: #fff; text-align: left; padding: 2mm 3mm; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.5px; }
  table.conteudo-tabela td { padding: 1.8mm 3mm; border-bottom: 1px solid #eee; }
  table.conteudo-tabela td.num { text-align: right; white-space: nowrap; }
  table.conteudo-tabela tr.total td { font-weight: 800; border-top: 1.5px solid #C9A84C; border-bottom: none; }
  .verso-3col { display: flex; gap: 6mm; margin-top: 6mm; }
  .verso-3col .col { flex: 1; border: 1px solid #e5e5e5; border-radius: 3px; padding: 3mm; }
  .verso-3col .col h4 { font-size: 7.5pt; color: #8a6e2f; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2mm; }
  .verso-3col .col p { font-size: 8.5pt; color: #333; line-height: 1.5; margin-bottom: 1mm; }
  @media print { body { background: white; } }
</style>
</head>
<body>

<!-- ───────────── FRENTE ───────────── -->
<div class="pagina">
  <div class="faixa-topo">
    <span class="marca">⚖ Integra-Academy</span>
    <span class="sub">MJ Consultoria · Plataforma de Conformidade Notarial</span>
  </div>
  <div class="faixa-base">
    <span>Emitido por ${esc(d.emissoraRazaoSocial)} · CNPJ ${esc(d.emissoraCnpj)}</span>
    <span>Código de validação: ${esc(d.codigo)}</span>
  </div>

  <div class="conteudo">
    <div class="titulo-cert">Certificado de Conclusão de Curso Livre</div>
    <div class="certificamos">Certificamos que</div>
    <div class="nome">${esc(d.nome)}</div>
    <div class="linha-cargo">${esc(serventiaLinha)}</div>
    <div class="paragrafo">
      concluiu o curso livre "${esc(tituloCurso)}", na modalidade ${esc(d.modalidade)}, ${periodo},
      com carga horária total de ${concordanciaHoras(d.cargaHoraria)}, obtendo aproveitamento de
      ${esc(d.aproveitamento)}% na avaliação final. Conteúdo alinhado aos Provimentos CNJ nº 149/2023,
      161/2024 e 213/2026.
    </div>

    <div class="faixa-5col">
      <div class="col"><div class="label">Carga Horária</div><div class="valor">${esc(concordanciaHoras(d.cargaHoraria))}</div></div>
      <div class="col"><div class="label">Modalidade</div><div class="valor">${esc(d.modalidade)}</div></div>
      <div class="col"><div class="label">Período</div><div class="valor">${esc(periodoColuna)}</div></div>
      <div class="col"><div class="label">Aproveitamento (mín. ${esc(d.notaMinima)}%)</div><div class="valor">${esc(d.aproveitamento)}%</div></div>
      <div class="col"><div class="label">Conteúdo Programático</div><div class="valor">Ver verso</div></div>
    </div>

    <div class="rodape-interno" style="margin-top: 6mm;">
      <div class="bloco">
        <div>${esc(d.localEmissao)}, ${formatarDataExtenso(d.dataEmissao)}</div>
        <div class="linha">Local e data de emissão</div>
      </div>
      <div class="bloco qr-bloco">
        <img src="${esc(d.qrDataUrl)}" alt="QR de verificação" />
        <div class="valide">Valide a autenticidade</div>
        <div class="url">${esc(d.verificacaoUrl.replace('https://', ''))}</div>
      </div>
      <div class="bloco">
        ${assinaturaImg}
        <div class="assinatura-nome">${esc(d.instrutorNome)}</div>
        <div class="linha">${esc(d.instrutorCargo)}<br/>${esc(d.instrutorQualificacoes)}</div>
      </div>
    </div>

    <div class="hash-box">
      <div class="label">Hash de Integridade (SHA-256)</div>
      <div class="valor">${esc(d.hash)}</div>
    </div>
  </div>
</div>

<!-- ───────────── VERSO ───────────── -->
<div class="pagina">
  <div class="faixa-topo">
    <span class="marca">⚖ Integra-Academy</span>
    <span class="sub">Certificado nº ${esc(d.codigo)} · ${esc(d.nome)}</span>
  </div>
  <div class="faixa-base">
    <span>Valide em ${esc(d.verificacaoUrl.replace('https://', ''))}</span>
    <span>Código ${esc(d.codigo)}</span>
  </div>

  <div class="conteudo" style="align-items: stretch;">
    <div class="verso-titulo">Conteúdo Programático</div>
    <div class="verso-curso">${esc(tituloCurso)}</div>
    <div class="verso-sub">Curso livre · ${esc(d.modalidade)} · Carga horária total: ${esc(concordanciaHoras(d.cargaHoraria))}</div>

    <table class="conteudo-tabela">
      <thead><tr><th>Tópico / Tema</th><th style="text-align:right">Carga Horária</th></tr></thead>
      <tbody>
        ${linhasConteudo}
        ${linhaAvaliacao}
        <tr class="total"><td>Total</td><td class="num">${esc(concordanciaHoras(totalGeral))}</td></tr>
      </tbody>
    </table>

    <div class="verso-3col">
      <div class="col">
        <h4>Avaliação de Aprendizagem</h4>
        <p>Nota mínima: <strong>${esc(d.notaMinima)}%</strong></p>
        <p>Aproveitamento obtido: <strong>${esc(d.aproveitamento)}%</strong></p>
        <p>Situação: <strong>Aprovado</strong></p>
      </div>
      <div class="col">
        <h4>Instrutora</h4>
        <p><strong>${esc(d.instrutorNome)}</strong></p>
        <p>${esc(d.instrutorCargo)}</p>
        <p>${esc(d.instrutorQualificacoes)}</p>
      </div>
      <div class="col">
        <h4>Referências Normativas</h4>
        <p>Provimento CNJ nº 149/2023</p>
        <p>Provimento CNJ nº 161/2024</p>
        <p>Provimento CNJ nº 213/2026</p>
      </div>
    </div>

    <div class="hash-box" style="margin-top: auto;">
      <div class="label">Hash de Integridade (SHA-256)</div>
      <div class="valor">${esc(d.hash)}</div>
    </div>
  </div>
</div>

<script>window.onload = () => { window.print(); };</script>
</body>
</html>`;
}
