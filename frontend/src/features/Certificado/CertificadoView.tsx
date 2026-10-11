// frontend/src/features/Certificado/CertificadoView.tsx
// Módulo de Certificados — gera o PDF abrindo uma janela com o HTML de certificadoTemplate()
// e chamando print() dentro dela (mesmo mecanismo usado em ExamesView.tsx).

import React, { useState, useEffect } from 'react';
import {
  collection, query, where, onSnapshot, orderBy,
  addDoc, serverTimestamp, doc, getDoc
} from 'firebase/firestore';
import QRCode from 'qrcode';
import { db } from '../../services/firebase';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { obterOuCriarCertificado, VERIFICACAO_BASE_URL } from '../../utils/certificadoVerificacao';
import { certificadoTemplate } from '../../utils/certificadoTemplate';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Certificado {
  id: string;
  colaboradorId: string;
  colaboradorNome: string;
  cpf?: string;
  cargo: string;
  cartorio: string;
  serventiaUf?: string;
  trilhaTitulo: string;
  moduloTitulo?: string;
  tipo: 'trilha' | 'modulo' | 'exame';
  notaFinal: number;
  notaMinima?: number;
  cargaHoraria: number;
  modalidade?: string;
  instrutor?: string;
  instrutorCargo?: string;
  instrutorQualificacoes?: string;
  assinaturaUrl?: string;
  emissoraRazaoSocial?: string;
  emissoraCnpj?: string;
  localEmissao?: string;
  dataInicio?: string;
  dataConclusao?: string;
  dataEmissao?: string;
  hash?: string;
  codigoVerificacao: string;
  emitidoEm: any;
  emitidoPor: string;
  tenantId: string;
  validoAte?: any;
}

interface TrilhaRef {
  id: string;
  titulo: string;
  cargaHoraria?: number;
  instrutor?: string;
  oficial?: boolean;
}

interface QuizResult {
  id: string;
  colaborador: string;
  userId?: string;
  nota: number;
  aprovado: boolean;
  trailTitle?: string;
  moduleTitle?: string;
  tenantId: string;
  createdAt: any;
}

interface TrilhaProgresso {
  id: string;
  userId: string;
  userName: string;
  trilhaId: string;
  trilhaTitulo?: string;
  concluida: boolean;
  tenantId: string;
}

interface ExameResultado {
  id: string;
  userId: string;
  fonteTitulo: string;
  score: number;
  aprovado: boolean;
  tenantId: string;
  createdAt: any;
}

interface UserData {
  id: string;
  name: string;
  cargo?: string;
  role: string;
  tenantId: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(ts: any): string {
  if (!ts) return '–';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatDateShort(ts: any): string {
  if (!ts) return '–';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-BR');
}

// ─── Modal de Emissão ─────────────────────────────────────────────────────────

const ModalEmitir: React.FC<{
  quizResults: QuizResult[];
  trilhasProgresso: TrilhaProgresso[];
  exames: ExameResultado[];
  usuarios: UserData[];
  trilhas: TrilhaRef[];
  cartorio: string;
  onEmitir: (data: Omit<Certificado, 'id' | 'codigoVerificacao' | 'emitidoEm' | 'tenantId' | 'emitidoPor'>) => void;
  onClose: () => void;
}> = ({ quizResults, trilhasProgresso, exames, usuarios, trilhas, cartorio, onEmitir, onClose }) => {
  const [colab, setColab] = useState('');
  const [tipo, setTipo] = useState<'trilha' | 'modulo' | 'exame'>('trilha');
  const [item, setItem] = useState('');
  // Carga horária: pré-preenchida a partir da trilha (mínimo 1h), mas sempre editável —
  // '' significa "usar o valor calculado automaticamente".
  const [cargaHorariaManual, setCargaHorariaManual] = useState<number | ''>('');

  const colabUser = usuarios.find(u => u.id === colab);
  const colabResults = quizResults.filter(r => r.userId === colab || r.colaborador === colabUser?.name);
  const colabTrilhas = trilhasProgresso.filter(p => (p.userId === colab) && p.concluida);
  // Exames formais (colecao separada de examesResultados) — sem isso, colaboradores que só
  // fizeram Exames (não quizzes de trilha) nunca apareciam com nenhum item para certificar.
  const colabExames = exames.filter(e => e.userId === colab && e.aprovado);

  const opcoesItem = tipo === 'trilha'
    ? [...new Set(colabTrilhas.map(t => t.trilhaTitulo || t.trilhaId).filter(Boolean))]
    : tipo === 'modulo'
    ? [...new Set(colabResults.filter(r => r.aprovado && r.moduleTitle).map(r => `${r.trailTitle} — ${r.moduleTitle}`).filter(Boolean))]
    : [...new Set([
        ...colabResults.filter(r => r.aprovado && !r.moduleTitle).map(r => r.trailTitle || ''),
        ...colabExames.map(e => e.fonteTitulo || ''),
      ].filter(Boolean))];

  const colabsDisponiveis = usuarios.filter(u => u.role !== 'SUPERADMIN' && u.role !== 'gestor');

  const mediaItem = (() => {
    if (!item) return 0;
    if (tipo === 'exame') {
      const notasQuiz = colabResults.filter(r => r.aprovado && !r.moduleTitle && r.trailTitle === item).map(r => r.nota);
      const notasExame = colabExames.filter(e => e.fonteTitulo === item).map(e => e.score);
      const notas = [...notasQuiz, ...notasExame];
      return notas.length ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length) : 0;
    }
    const notas = colabResults.filter(r => r.aprovado &&
      (tipo === 'trilha' ? r.trailTitle === item : `${r.trailTitle} — ${r.moduleTitle}` === item)
    ).map(r => r.nota);
    return notas.length ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length) : 0;
  })();

  const trilhaTituloAtual = tipo === 'modulo' ? item.split(' — ')[0] : item;
  const trilhaRefAtual = trilhas.find(t => t.titulo === trilhaTituloAtual);
  const cargaHorariaPadrao = tipo === 'trilha' ? 20 : tipo === 'modulo' ? 5 : 10;
  const cargaHorariaAuto = Math.max(1, trilhaRefAtual?.cargaHoraria || cargaHorariaPadrao);
  const instrutorAuto = trilhaRefAtual?.oficial ? 'Mirian Jabur' : (trilhaRefAtual?.instrutor || '');

  useEffect(() => { setCargaHorariaManual(''); }, [item, tipo]);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-lg space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-navy font-black text-sm uppercase tracking-widest">Emitir Certificado</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-navy w-8 h-8 flex items-center justify-center">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Colaborador */}
        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Colaborador *</label>
          <select value={colab} onChange={e => { setColab(e.target.value); setItem(''); }}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-navy outline-none focus:border-blue-500">
            <option value="">Selecione...</option>
            {colabsDisponiveis.map(u => (
              <option key={u.id} value={u.id}>{u.name} — {u.cargo || u.role}</option>
            ))}
          </select>
        </div>

        {/* Tipo */}
        <div className="space-y-2">
          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Tipo de Certificado</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'trilha', label: 'Trilha', icon: 'fa-road' },
              { id: 'modulo', label: 'Módulo', icon: 'fa-book-open' },
              { id: 'exame',  label: 'Exame',  icon: 'fa-file-pen' },
            ].map(t => (
              <button key={t.id} onClick={() => { setTipo(t.id as any); setItem(''); }}
                className={`p-3 rounded-xl border text-center transition-all ${
                  tipo === t.id ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-slate-200 text-slate-500 hover:border-slate-600'
                }`}>
                <i className={`fa-solid ${t.icon} block mb-1`}></i>
                <span className="text-[10px] font-black uppercase">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Item */}
        {colab && (
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
              {tipo === 'trilha' ? 'Trilha Concluída' : tipo === 'modulo' ? 'Módulo Aprovado' : 'Exame Aprovado'} *
            </label>
            {opcoesItem.length === 0 ? (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                Nenhum {tipo} concluído/aprovado para este colaborador ainda.
              </p>
            ) : (
              <select value={item} onChange={e => setItem(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-navy outline-none focus:border-blue-500">
                <option value="">Selecione...</option>
                {opcoesItem.map((o, i) => <option key={i} value={o}>{o}</option>)}
              </select>
            )}
          </div>
        )}

        {/* Carga horária */}
        {colab && item && (
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Carga Horária (horas)</label>
            <input type="number" min={1} step={0.5}
              value={cargaHorariaManual === '' ? cargaHorariaAuto : cargaHorariaManual}
              onChange={e => setCargaHorariaManual(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-navy outline-none focus:border-blue-500" />
            <p className="text-[10px] text-slate-400">
              {trilhaRefAtual?.cargaHoraria
                ? `Preenchido a partir da trilha (${trilhaRefAtual.cargaHoraria}h) — pode ajustar se necessário.`
                : 'A trilha não informou carga horária — mínimo de 1h aplicado. Pode ajustar se necessário.'}
            </p>
          </div>
        )}

        {/* Preview rápido */}
        {colab && item && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Preview</p>
            <p className="text-sm font-black text-navy">{colabUser?.name}</p>
            <p className="text-xs text-slate-500">{colabUser?.cargo} · {cartorio}</p>
            <p className="text-xs text-blue-400">{item}</p>
            {mediaItem > 0 && <p className="text-xs text-emerald-400">Média: {mediaItem}%</p>}
            {instrutorAuto && <p className="text-xs text-slate-500">Instrutor(a): {instrutorAuto}</p>}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 border border-slate-200 hover:border-slate-600 transition-all">
            Cancelar
          </button>
          <button
            onClick={() => {
              if (!colab || !item) return;
              const moduloTitulo = tipo === 'modulo' ? item.split(' — ')[1] : undefined;
              // Carga horária: usa o ajuste manual quando preenchido, senão o valor
              // calculado a partir da trilha (mínimo 1h). Instrutor: trilhas oficiais
              // (distribuídas pela MJ Consultoria) sempre saem com "Mirian Jabur";
              // as demais usam o instrutor cadastrado na própria trilha, se houver.
              const cargaHoraria = cargaHorariaManual === '' ? cargaHorariaAuto : Math.max(1, cargaHorariaManual);
              onEmitir({
                colaboradorId: colab,
                colaboradorNome: colabUser?.name || '',
                cargo: colabUser?.cargo || colabUser?.role || '',
                cartorio,
                trilhaTitulo: trilhaTituloAtual,
                moduloTitulo,
                tipo,
                notaFinal: mediaItem || 100,
                cargaHoraria,
                instrutor: instrutorAuto,
              });
            }}
            disabled={!colab || !item}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-navy px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
            <i className="fa-solid fa-certificate mr-2"></i>Emitir Certificado
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main View ────────────────────────────────────────────────────────────────

const CertificadoView: React.FC = () => {
  const { state, tenantId } = useApp();
  const { showToast } = useToast();
  const user = state.user!;
  const isGestor = ['SUPERADMIN', 'gestor', 'admin'].includes(user.role);
  const verTodos = isGestor || user.role === 'equipe_mj';

  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [trilhasProgresso, setTrilhasProgresso] = useState<TrilhaProgresso[]>([]);
  const [exames, setExames] = useState<ExameResultado[]>([]);
  const [usuarios, setUsuarios] = useState<UserData[]>([]);
  const [trilhas, setTrilhas] = useState<TrilhaRef[]>([]);
  const [cartorioNome, setCartorioNome] = useState(tenantId);
  const [showModal, setShowModal] = useState(false);
  const [imprimindo, setImprimindo] = useState<Certificado | null>(null);
  const [emitindoPendentes, setEmitindoPendentes] = useState(false);

  // Load data
  useEffect(() => {
    // Colaborador só pode ler os próprios certificados (regra do Firestore) — a consulta precisa
    // do filtro; ordenação client-side nesse caso pra não exigir índice composto novo.
    const q1 = verTodos
      ? query(collection(db, 'certificados'), where('tenantId', '==', tenantId), orderBy('emitidoEm', 'desc'))
      : query(collection(db, 'certificados'), where('tenantId', '==', tenantId), where('colaboradorId', '==', user.id));
    const u1 = onSnapshot(q1, s => {
      const docs = s.docs.map(d => ({ id: d.id, ...d.data() } as Certificado));
      if (!verTodos) docs.sort((a, b) => ((b.emitidoEm as any)?.toMillis?.() ?? 0) - ((a.emitidoEm as any)?.toMillis?.() ?? 0));
      setCertificados(docs);
    });

    // Resultados/progresso: mesma restrição — colaborador só os próprios (filtro por userId).
    const doTenant = (col: string) => verTodos
      ? query(collection(db, col), where('tenantId', '==', tenantId))
      : query(collection(db, col), where('tenantId', '==', tenantId), where('userId', '==', user.id));

    const q2 = verTodos
      ? query(collection(db, 'treinamentosQuizResults'), where('tenantId', '==', tenantId), orderBy('createdAt', 'desc'))
      : doTenant('treinamentosQuizResults');
    const u2 = onSnapshot(q2, s => {
      const docs = s.docs.map(d => ({ id: d.id, ...d.data() } as QuizResult));
      if (!verTodos) docs.sort((a, b) => ((b.createdAt as any)?.toMillis?.() ?? 0) - ((a.createdAt as any)?.toMillis?.() ?? 0));
      setQuizResults(docs);
    });

    const q5 = query(collection(db, 'trilhas'), where('tenantIds', 'array-contains-any', [tenantId, 'GLOBAL']));
    const u5 = onSnapshot(q5, s => setTrilhas(s.docs.map(d => ({ id: d.id, ...d.data() } as TrilhaRef))));

    const q3 = doTenant('trilhasProgresso');
    const u3 = onSnapshot(q3, s => setTrilhasProgresso(s.docs.map(d => ({ id: d.id, ...d.data() } as TrilhaProgresso))));

    const q6 = doTenant('examesResultados');
    const u6 = onSnapshot(q6, s => setExames(s.docs.map(d => ({ id: d.id, ...d.data() } as ExameResultado))));

    const q4 = query(collection(db, 'users'), where('tenantId', '==', tenantId));
    const u4 = onSnapshot(q4, s => setUsuarios(s.docs.map(d => ({ id: d.id, ...d.data() } as UserData))));

    // Pegar nome do cartório
    const loadCartorio = async () => {
      try {
        const snap = await getDoc(doc(db, 'tenants', tenantId));
        if (snap.exists()) setCartorioNome(snap.data().nome || snap.data().name || tenantId);
      } catch {}
    };
    loadCartorio();

    return () => { u1(); u2(); u3(); u4(); u5(); u6(); };
  }, [tenantId, verTodos, user.id]);

  // Para colaborador a consulta já vem filtrada pelo próprio colaboradorId.
  const meusCerts = certificados;

  // Emitir certificado
  const handleEmitir = async (data: Omit<Certificado, 'id' | 'codigoVerificacao' | 'emitidoEm' | 'tenantId' | 'emitidoPor'>) => {
    try {
      const { novo } = await obterOuCriarCertificado(data);
      if (!novo) {
        showToast('Esse colaborador já tem certificado para esse treinamento.', 'info');
        setShowModal(false);
        return;
      }
      await addDoc(collection(db, 'auditLogs'), { tipo: 'certificado_emitido', descricao: 'Certificado emitido: ' + (data.trilhaTitulo || '') + ' | Nota: ' + (data.notaFinal || '') + '%', usuario: user.name, usuarioId: user.id, tenantId, createdAt: serverTimestamp() });
      showToast('Certificado emitido com sucesso!', 'success');
      setShowModal(false);
    } catch {
      showToast('Erro ao emitir certificado.', 'error');
    }
  };

  // Emite em lote o certificado de "exame" para todo colaborador aprovado em algo que ainda
  // não tem certificado — cobre o caso comum de muita gente passar em provas/trilhas e nenhum
  // certificado nunca ter sido emitido manualmente (que exige um clique por pessoa/trilha).
  const emitirPendentes = async () => {
    setEmitindoPendentes(true);
    try {
      const melhorPorPar = new Map<string, ExameResultado>();
      exames.filter(e => e.aprovado).forEach(e => {
        const key = `${e.userId}__${e.fonteTitulo}`;
        const atual = melhorPorPar.get(key);
        if (!atual || e.score > atual.score) melhorPorPar.set(key, e);
      });

      let criados = 0;
      for (const e of melhorPorPar.values()) {
        if (!usuarios.some(u => u.id === e.userId)) continue;
        const trilhaRef = trilhas.find(t => t.titulo === e.fonteTitulo);

        const { novo } = await obterOuCriarCertificado({
          colaboradorId: e.userId,
          trilhaTitulo: e.fonteTitulo,
          tipo: 'exame',
          notaFinal: e.score,
          cargaHoraria: Math.max(1, trilhaRef?.cargaHoraria || 1),
        });
        if (novo) criados++;
      }

      if (criados > 0) {
        await addDoc(collection(db, 'auditLogs'), {
          tipo: 'certificados_emitidos_lote', descricao: `${criados} certificado(s) emitido(s) em lote`,
          usuario: user.name, usuarioId: user.id, tenantId, createdAt: serverTimestamp(),
        }).catch(() => {});
        showToast(`${criados} certificado(s) emitido(s)!`, 'success');
      } else {
        showToast('Nenhum certificado pendente — todo mundo aprovado já tem o seu.', 'info');
      }
    } catch {
      showToast('Erro ao emitir certificados pendentes.', 'error');
    }
    setEmitindoPendentes(false);
  };

  // Imprimir / gerar PDF — usa o mesmo certificadoTemplate(dados) de ExamesView.tsx: uma
  // janela nova com o HTML pronto (frente + verso), sem depender de CSS @media print na
  // própria tela (evita o wrapper escondido e a complexidade de só revelar ele na impressão).
  const handleImprimir = async (cert: Certificado) => {
    // Abre a janela já no clique (antes de qualquer await), senão o bloqueador de pop-up barra.
    // Sem 'noopener' no window.open — com ele o navegador devolve null e não dá pra escrever
    // na janela; o opener é cortado manualmente logo em seguida.
    const win = window.open('', '_blank');
    if (!win) { showToast('Permita pop-ups pra abrir o certificado.', 'error'); return; }
    win.opener = null;
    win.document.write('<p style="font-family:sans-serif;padding:24px">Gerando certificado…</p>');
    setImprimindo(cert);
    try {
      const qrDataUrl = await QRCode.toDataURL(`${VERIFICACAO_BASE_URL}?codigo=${cert.codigoVerificacao}`, { margin: 1, width: 240 });
      const html = certificadoTemplate({
        codigo: cert.codigoVerificacao,
        hash: cert.hash || '',
        nome: cert.colaboradorNome,
        cargo: cert.cargo,
        serventiaNome: cert.cartorio,
        serventiaUf: cert.serventiaUf || '',
        tipo: cert.tipo,
        curso: cert.trilhaTitulo,
        moduloTitulo: cert.moduloTitulo,
        modalidade: cert.modalidade || 'EAD assíncrona',
        cargaHoraria: cert.cargaHoraria,
        dataInicio: cert.dataInicio,
        dataConclusao: cert.dataConclusao,
        dataEmissao: cert.dataEmissao || (cert.emitidoEm?.toDate ? cert.emitidoEm.toDate().toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)),
        aproveitamento: cert.notaFinal,
        notaMinima: cert.notaMinima ?? 70,
        instrutorNome: cert.instrutor || 'Mirian Jabur',
        instrutorCargo: cert.instrutorCargo || 'Instrutora e Responsável Técnica',
        instrutorQualificacoes: cert.instrutorQualificacoes || '',
        assinaturaUrl: cert.assinaturaUrl || '',
        emissoraRazaoSocial: cert.emissoraRazaoSocial || 'AG Serviços em TI Ltda. (MJ Consultoria)',
        emissoraCnpj: cert.emissoraCnpj || '07.113.086/0001-08',
        localEmissao: cert.localEmissao || 'Belo Horizonte/MG',
        qrDataUrl,
        verificacaoUrl: VERIFICACAO_BASE_URL,
      });
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch {
      win.close();
      showToast('Erro ao gerar o certificado.', 'error');
    }
    setImprimindo(null);
  };

  const tipoLabel = { trilha: 'Trilha', modulo: 'Módulo', exame: 'Exame' };
  const tipoColor = { trilha: 'teal', modulo: 'blue', exame: 'purple' };

  return (
    <>
      {/* Interface principal */}
      <div className="p-8 space-y-6 bg-slate-50 min-h-screen animate-in fade-in">

        {/* Modal de emissão */}
        {showModal && isGestor && (
          <ModalEmitir
            quizResults={quizResults}
            trilhasProgresso={trilhasProgresso}
            exames={exames}
            usuarios={usuarios}
            trilhas={trilhas}
            cartorio={cartorioNome}
            onEmitir={handleEmitir}
            onClose={() => setShowModal(false)}
          />
        )}

        {/* Header */}
        <header className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-black text-navy italic uppercase tracking-tighter">
              Certificados de <span className="text-amber-500">Conclusão</span>
            </h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">
              Emissão · Histórico · Download PDF
            </p>
          </div>
          {isGestor && (
            <div className="flex gap-2">
              <button onClick={emitirPendentes} disabled={emitindoPendentes}
                title="Gera automaticamente o certificado de todo colaborador aprovado que ainda não tem um"
                className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-navy border border-slate-200 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2">
                <i className={`fa-solid ${emitindoPendentes ? 'fa-spinner fa-spin' : 'fa-bolt'}`}></i>
                {emitindoPendentes ? 'Emitindo...' : 'Emitir Pendentes'}
              </button>
              <button onClick={() => setShowModal(true)}
                className="bg-amber-600 hover:bg-amber-500 text-navy px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2">
                <i className="fa-solid fa-certificate"></i>Emitir Certificado
              </button>
            </div>
          )}
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Emitidos',      value: meusCerts.length,                                       icon: 'fa-certificate',    color: 'amber'   },
            { label: 'Trilhas',             value: meusCerts.filter(c => c.tipo === 'trilha').length,       icon: 'fa-road',           color: 'teal'    },
            { label: 'Módulos',             value: meusCerts.filter(c => c.tipo === 'modulo').length,       icon: 'fa-book-open',      color: 'blue'    },
            { label: 'Exames',              value: meusCerts.filter(c => c.tipo === 'exame').length,        icon: 'fa-file-pen',       color: 'purple'  },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-[20px] p-5 space-y-2">
              <i className={`fa-solid ${s.icon} text-${s.color}-500`}></i>
              <p className="text-2xl font-black text-navy">{s.value}</p>
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Info CNJ */}
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 flex items-start gap-3">
          <i className="fa-solid fa-circle-info text-blue-400 text-lg mt-0.5 flex-shrink-0"></i>
          <div>
            <p className="text-blue-400 font-black text-xs uppercase tracking-widest">Certificados para Dossiê CNJ</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Os certificados gerados por esta plataforma são válidos como evidência de treinamento para o dossiê de conformidade CNJ, 
              conforme Provimentos nº 149/2023, 161/2024 e 213/2026. Cada certificado possui código de verificação único.
            </p>
          </div>
        </div>

        {/* Lista de certificados */}
        {meusCerts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center">
            <i className="fa-solid fa-certificate text-5xl text-slate-700 mb-4 block"></i>
            <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">Nenhum certificado emitido ainda</p>
            {isGestor && (
              <p className="text-slate-700 text-xs mt-1">Clique em "Emitir Certificado" para criar o primeiro</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">
              {meusCerts.length} certificado{meusCerts.length !== 1 ? 's' : ''} emitido{meusCerts.length !== 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {meusCerts.map(cert => (
                <div key={cert.id} className="bg-white border border-slate-200 rounded-[20px] p-5 hover:border-amber-500/30 transition-all group">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className={`text-[9px] font-black uppercase tracking-widest bg-${tipoColor[cert.tipo]}-500/10 text-${tipoColor[cert.tipo]}-400 px-2 py-0.5 rounded-lg`}>
                          <i className="fa-solid fa-certificate mr-1"></i>{tipoLabel[cert.tipo]}
                        </span>
                        <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg">
                          <i className="fa-solid fa-circle-check mr-1"></i>{cert.notaFinal}%
                        </span>
                      </div>
                      <h3 className="text-sm font-black text-navy leading-tight mb-0.5">{cert.trilhaTitulo}</h3>
                      {cert.moduloTitulo && (
                        <p className="text-[10px] text-slate-500 mb-1">{cert.moduloTitulo}</p>
                      )}
                      <p className="text-[10px] text-slate-500">
                        <i className="fa-solid fa-user mr-1"></i>{cert.colaboradorNome}
                        {cert.cargo && <span className="text-slate-600"> · {cert.cargo}</span>}
                      </p>
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        <i className="fa-solid fa-calendar mr-1"></i>{formatDateShort(cert.emitidoEm)}
                        <span className="ml-2 font-mono text-[9px] text-slate-700">{cert.codigoVerificacao}</span>
                      </p>
                    </div>

                    {/* Ações */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button onClick={() => handleImprimir(cert)}
                        className="bg-amber-600 hover:bg-amber-500 text-navy px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5">
                        <i className="fa-solid fa-download"></i>PDF
                      </button>
                      <button onClick={() => {
                        navigator.clipboard.writeText(cert.codigoVerificacao);
                        showToast('Código copiado!', 'success');
                      }}
                        className="bg-slate-50 hover:bg-slate-200 border border-slate-200 text-slate-500 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5">
                        <i className="fa-solid fa-copy"></i>Cód.
                      </button>
                      <a href={`${VERIFICACAO_BASE_URL}?codigo=${cert.codigoVerificacao}`} target="_blank" rel="noopener noreferrer"
                        className="bg-slate-50 hover:bg-slate-200 border border-slate-200 text-slate-500 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5">
                        <i className="fa-solid fa-shield-halved"></i>Verificar
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default CertificadoView;
