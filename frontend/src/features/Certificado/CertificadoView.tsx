// frontend/src/features/Certificado/CertificadoView.tsx
// Módulo de Certificados — geração em PDF direto no browser (sem backend)
// Usa window.print() com CSS @media print para gerar PDF fiel

import React, { useState, useEffect, useRef } from 'react';
import {
  collection, query, where, onSnapshot, orderBy,
  addDoc, serverTimestamp, doc, getDoc
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Certificado {
  id: string;
  colaboradorId: string;
  colaboradorNome: string;
  cargo: string;
  cartorio: string;
  trilhaTitulo: string;
  moduloTitulo?: string;
  tipo: 'trilha' | 'modulo' | 'exame';
  notaFinal: number;
  cargaHoraria: number;
  codigoVerificacao: string;
  emitidoEm: any;
  emitidoPor: string;
  tenantId: string;
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
  concluido: boolean;
  tenantId: string;
}

interface UserData {
  id: string;
  name: string;
  cargo?: string;
  role: string;
  tenantId: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function gerarCodigo(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

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

// ─── Componente do Certificado (para impressão) ───────────────────────────────

const CertificadoImpressao: React.FC<{ cert: Certificado }> = ({ cert }) => {
  const dataExtenso = formatDate(cert.emitidoEm);

  return (
    <div id="certificado-print" style={{
      width: '297mm', height: '210mm',
      background: '#fff',
      fontFamily: '"Plus Jakarta Sans", "Segoe UI", sans-serif',
      position: 'relative',
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}>
      {/* Borda decorativa externa */}
      <div style={{
        position: 'absolute', inset: '8mm',
        border: '2px solid #1e3a5f',
        borderRadius: '4px',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', inset: '10mm',
        border: '0.5px solid #c8a84b',
        borderRadius: '3px',
        pointerEvents: 'none',
      }} />

      {/* Marca d'água */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: 0.03, fontSize: '120px', fontWeight: 900, color: '#1e3a5f',
        transform: 'rotate(-30deg)', letterSpacing: '-4px',
        userSelect: 'none', pointerEvents: 'none',
      }}>CERTIFICADO</div>

      {/* Faixa topo */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '18mm',
        background: 'linear-gradient(135deg, #0f2240 0%, #1e3a5f 60%, #c8a84b 100%)',
      }} />

      {/* Faixa rodapé */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '12mm',
        background: 'linear-gradient(90deg, #1e3a5f 0%, #0f2240 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16mm',
      }}>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '7pt' }}>
          Plataforma CartórioLearn · MJ Consultoria LGPD
        </span>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '7pt' }}>
          Código: {cert.codigoVerificacao}
        </span>
      </div>

      {/* Conteúdo principal */}
      <div style={{
        position: 'absolute', top: '22mm', left: '18mm', right: '18mm', bottom: '16mm',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        {/* Logo / título topo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4mm' }}>
          <div style={{
            width: '32px', height: '32px', background: '#1e3a5f',
            borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px',
          }}>⚖️</div>
          <div>
            <div style={{ fontSize: '10pt', fontWeight: 800, color: '#1e3a5f', letterSpacing: '2px', textTransform: 'uppercase' }}>
              CartórioLearn
            </div>
            <div style={{ fontSize: '6pt', color: '#888', letterSpacing: '1px', textTransform: 'uppercase' }}>
              MJ Consultoria · Plataforma de Conformidade Notarial
            </div>
          </div>
        </div>

        {/* CERTIFICADO DE CONCLUSÃO */}
        <div style={{
          fontSize: '7pt', fontWeight: 800, color: '#c8a84b',
          letterSpacing: '4px', textTransform: 'uppercase', marginBottom: '2mm',
        }}>
          ✦ Certificado de {cert.tipo === 'exame' ? 'Aprovação em Exame' : 'Conclusão'} ✦
        </div>

        {/* Texto central */}
        <div style={{ textAlign: 'center', marginBottom: '4mm' }}>
          <p style={{ fontSize: '9pt', color: '#555', margin: '0 0 4mm 0' }}>
            Certificamos que
          </p>
          <p style={{
            fontSize: '26pt', fontWeight: 900, color: '#1e3a5f',
            margin: '0 0 2mm 0', lineHeight: 1.1,
            borderBottom: '1.5px solid #c8a84b', paddingBottom: '3mm', paddingLeft: '12mm', paddingRight: '12mm',
          }}>
            {cert.colaboradorNome}
          </p>
          <p style={{ fontSize: '8pt', color: '#777', margin: '2mm 0 4mm 0' }}>
            {cert.cargo}{cert.cartorio ? ` · ${cert.cartorio}` : ''}
          </p>
          <p style={{ fontSize: '10pt', color: '#333', margin: '0 0 1mm 0', lineHeight: 1.6 }}>
            concluiu com êxito o{cert.tipo === 'modulo' ? ' módulo' : cert.tipo === 'exame' ? ' exame' : 'a trilha'}
          </p>
          <p style={{
            fontSize: '15pt', fontWeight: 800, color: '#0f2240',
            margin: '0 0 1mm 0',
          }}>
            "{cert.trilhaTitulo}"
          </p>
          {cert.moduloTitulo && (
            <p style={{ fontSize: '9pt', color: '#666', margin: '0 0 2mm 0' }}>
              Módulo: {cert.moduloTitulo}
            </p>
          )}
          <p style={{ fontSize: '8pt', color: '#555', margin: '2mm 0 0 0' }}>
            com aprovação de <strong style={{ color: '#1e3a5f' }}>{cert.notaFinal}%</strong> e
            carga horária de <strong style={{ color: '#1e3a5f' }}>{cert.cargaHoraria} horas</strong>,
            em conformidade com os Provimentos CNJ nº 161/2023, 213/2026 e 149/2023.
          </p>
        </div>

        {/* Data e assinaturas */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          width: '100%', marginTop: 'auto', paddingTop: '4mm',
        }}>
          {/* Data */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '8pt', color: '#333', marginBottom: '1mm' }}>
              Belo Horizonte, {dataExtenso}
            </div>
            <div style={{ width: '60mm', borderTop: '1px solid #999', paddingTop: '1mm' }}>
              <div style={{ fontSize: '6pt', color: '#888', textAlign: 'center' }}>Data de Emissão</div>
            </div>
          </div>

          {/* Selo central */}
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '28mm', height: '28mm', border: '2px solid #c8a84b',
              borderRadius: '50%', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              background: 'radial-gradient(circle, #fff9ed, #fff)',
              margin: '0 auto',
            }}>
              <div style={{ fontSize: '16px' }}>⚖️</div>
              <div style={{ fontSize: '5pt', fontWeight: 800, color: '#1e3a5f', textAlign: 'center', lineHeight: 1.2 }}>
                CERTIFICADO<br/>VÁLIDO
              </div>
            </div>
          </div>

          {/* Assinatura */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '8pt', color: '#333', marginBottom: '1mm', fontStyle: 'italic' }}>
              Mirian Jabur
            </div>
            <div style={{ width: '60mm', borderTop: '1px solid #999', paddingTop: '1mm' }}>
              <div style={{ fontSize: '6pt', color: '#888', textAlign: 'center' }}>
                DPO · MJ Consultoria LGPD
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Modal de Emissão ─────────────────────────────────────────────────────────

const ModalEmitir: React.FC<{
  quizResults: QuizResult[];
  trilhasProgresso: TrilhaProgresso[];
  usuarios: UserData[];
  cartorio: string;
  onEmitir: (data: Omit<Certificado, 'id' | 'codigoVerificacao' | 'emitidoEm' | 'tenantId' | 'emitidoPor'>) => void;
  onClose: () => void;
}> = ({ quizResults, trilhasProgresso, usuarios, cartorio, onEmitir, onClose }) => {
  const [colab, setColab] = useState('');
  const [tipo, setTipo] = useState<'trilha' | 'modulo' | 'exame'>('trilha');
  const [item, setItem] = useState('');

  const colabUser = usuarios.find(u => u.id === colab);
  const colabResults = quizResults.filter(r => r.userId === colab || r.colaborador === colabUser?.name);
  const colabTrilhas = trilhasProgresso.filter(p => (p.userId === colab) && p.concluido);

  const opcoesItem = tipo === 'trilha'
    ? [...new Set(colabTrilhas.map(t => t.trilhaTitulo || t.trilhaId).filter(Boolean))]
    : [...new Set(colabResults.filter(r => r.aprovado).map(r =>
        tipo === 'modulo' ? `${r.trailTitle} — ${r.moduleTitle}` : r.trailTitle || ''
      ).filter(Boolean))];

  const colabsDisponiveis = usuarios.filter(u => u.role !== 'SUPERADMIN' && u.role !== 'gestor');

  const mediaItem = (() => {
    if (!item) return 0;
    const notas = colabResults.filter(r => r.aprovado &&
      (tipo === 'trilha' ? r.trailTitle === item : `${r.trailTitle} — ${r.moduleTitle}` === item)
    ).map(r => r.nota);
    return notas.length ? Math.round(notas.reduce((a, b) => a + b) / notas.length) : 0;
  })();

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-lg space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-[#0A1628] font-black text-sm uppercase tracking-widest">Emitir Certificado</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-[#0A1628] w-8 h-8 flex items-center justify-center">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Colaborador */}
        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Colaborador *</label>
          <select value={colab} onChange={e => { setColab(e.target.value); setItem(''); }}
            className="w-full bg-slate-900 border border-slate-200 rounded-xl px-4 py-3 text-sm text-[#0A1628] outline-none focus:border-blue-500">
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
                className="w-full bg-slate-900 border border-slate-200 rounded-xl px-4 py-3 text-sm text-[#0A1628] outline-none focus:border-blue-500">
                <option value="">Selecione...</option>
                {opcoesItem.map((o, i) => <option key={i} value={o}>{o}</option>)}
              </select>
            )}
          </div>
        )}

        {/* Preview rápido */}
        {colab && item && (
          <div className="bg-slate-900 border border-slate-200 rounded-xl p-4 space-y-1">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Preview</p>
            <p className="text-sm font-black text-[#0A1628]">{colabUser?.name}</p>
            <p className="text-xs text-slate-500">{colabUser?.cargo} · {cartorio}</p>
            <p className="text-xs text-blue-400">{item}</p>
            {mediaItem > 0 && <p className="text-xs text-emerald-400">Média: {mediaItem}%</p>}
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
              const trilhaTitulo = tipo === 'modulo' ? item.split(' — ')[0] : item;
              const moduloTitulo = tipo === 'modulo' ? item.split(' — ')[1] : undefined;
              onEmitir({
                colaboradorId: colab,
                colaboradorNome: colabUser?.name || '',
                cargo: colabUser?.cargo || colabUser?.role || '',
                cartorio,
                trilhaTitulo,
                moduloTitulo,
                tipo,
                notaFinal: mediaItem || 100,
                cargaHoraria: tipo === 'trilha' ? 20 : tipo === 'modulo' ? 5 : 10,
              });
            }}
            disabled={!colab || !item}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-[#0A1628] px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
            <i className="fa-solid fa-certificate mr-2"></i>Emitir Certificado
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main View ────────────────────────────────────────────────────────────────

const CertificadoView: React.FC = () => {
  const { state } = useApp();
  const { showToast } = useToast();
  const user = state.user!;
  const tenantId = user.tenantId;
  const isGestor = ['SUPERADMIN', 'gestor', 'admin'].includes(user.role);

  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [trilhasProgresso, setTrilhasProgresso] = useState<TrilhaProgresso[]>([]);
  const [usuarios, setUsuarios] = useState<UserData[]>([]);
  const [cartorioNome, setCartorioNome] = useState(user.tenantId);
  const [showModal, setShowModal] = useState(false);
  const [imprimindo, setImprimindo] = useState<Certificado | null>(null);

  // Load data
  useEffect(() => {
    const q1 = query(collection(db, 'certificados'), where('tenantId', '==', tenantId), orderBy('emitidoEm', 'desc'));
    const u1 = onSnapshot(q1, s => setCertificados(s.docs.map(d => ({ id: d.id, ...d.data() } as Certificado))));

    const q2 = query(collection(db, 'treinamentosQuizResults'), orderBy('createdAt', 'desc'));
    const u2 = onSnapshot(q2, s => setQuizResults(s.docs.map(d => ({ id: d.id, ...d.data() } as QuizResult))));

    const q3 = query(collection(db, 'trilhasProgresso'), where('tenantId', '==', tenantId));
    const u3 = onSnapshot(q3, s => setTrilhasProgresso(s.docs.map(d => ({ id: d.id, ...d.data() } as TrilhaProgresso))));

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

    return () => { u1(); u2(); u3(); u4(); };
  }, [tenantId]);

  // Filtrar certificados do colaborador atual se não for gestor
  const meusCerts = isGestor
    ? certificados
    : certificados.filter(c => c.colaboradorId === user.id || c.colaboradorNome === user.name);

  // Emitir certificado
  const handleEmitir = async (data: Omit<Certificado, 'id' | 'codigoVerificacao' | 'emitidoEm' | 'tenantId' | 'emitidoPor'>) => {
    try {
      const novo: Omit<Certificado, 'id'> = {
        ...data,
        codigoVerificacao: gerarCodigo(),
        emitidoEm: serverTimestamp(),
        emitidoPor: user.name,
        tenantId,
      };
      await addDoc(collection(db, 'certificados'), novo);
      await addDoc(collection(db, 'auditLogs'), { tipo: 'certificado_emitido', descricao: 'Certificado emitido: ' + (novo.trilhaTitulo || '') + ' | Nota: ' + (novo.notaFinal || '') + '%', usuario: user.name, usuarioId: user.id, tenantId, createdAt: serverTimestamp() });
      showToast('Certificado emitido com sucesso!', 'success');
      setShowModal(false);
    } catch {
      showToast('Erro ao emitir certificado.', 'error');
    }
  };

  // Imprimir / gerar PDF
  const handleImprimir = (cert: Certificado) => {
    setImprimindo(cert);
    setTimeout(() => {
      window.print();
      setTimeout(() => setImprimindo(null), 1000);
    }, 300);
  };

  const tipoLabel = { trilha: 'Trilha', modulo: 'Módulo', exame: 'Exame' };
  const tipoColor = { trilha: 'teal', modulo: 'blue', exame: 'purple' };

  return (
    <>
      {/* CSS para impressão */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #certificado-wrapper { display: block !important; }
          @page { size: A4 landscape; margin: 0; }
        }
        #certificado-wrapper { display: none; }
      `}</style>

      {/* Wrapper de impressão (oculto em tela) */}
      <div id="certificado-wrapper">
        {imprimindo && <CertificadoImpressao cert={imprimindo} />}
      </div>

      {/* Interface principal */}
      <div className="p-8 space-y-6 bg-slate-50 min-h-screen animate-in fade-in">

        {/* Modal de emissão */}
        {showModal && isGestor && (
          <ModalEmitir
            quizResults={quizResults}
            trilhasProgresso={trilhasProgresso}
            usuarios={usuarios}
            cartorio={cartorioNome}
            onEmitir={handleEmitir}
            onClose={() => setShowModal(false)}
          />
        )}

        {/* Header */}
        <header className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-black text-[#0D1B3E] italic uppercase tracking-tighter">
              Certificados de <span className="text-amber-500">Conclusão</span>
            </h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">
              Emissão · Histórico · Download PDF
            </p>
          </div>
          {isGestor && (
            <button onClick={() => setShowModal(true)}
              className="bg-amber-600 hover:bg-amber-500 text-[#0A1628] px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2">
              <i className="fa-solid fa-certificate"></i>Emitir Certificado
            </button>
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
              <p className="text-2xl font-black text-[#0A1628]">{s.value}</p>
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
              conforme Provimentos nº 149/2023, 161/2023 e 213/2026. Cada certificado possui código de verificação único.
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
                      <h3 className="text-sm font-black text-[#0A1628] leading-tight mb-0.5">{cert.trilhaTitulo}</h3>
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
                        className="bg-amber-600 hover:bg-amber-500 text-[#0A1628] px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5">
                        <i className="fa-solid fa-download"></i>PDF
                      </button>
                      <button onClick={() => {
                        navigator.clipboard.writeText(cert.codigoVerificacao);
                        showToast('Código copiado!', 'success');
                      }}
                        className="bg-slate-900 hover:bg-slate-800 border border-slate-200 text-slate-500 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5">
                        <i className="fa-solid fa-copy"></i>Cód.
                      </button>
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
