import React, { useState, useEffect } from 'react';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, where, serverTimestamp, getDoc, setDoc
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useApp } from '../../context/AppContext';

// ─── Types ───────────────────────────────────────────────────────────────────

type Perfil = 'gestor' | 'auditor' | 'atendente' | 'expert' | 'viewer';

interface Modulo {
  id: string;
  titulo: string;
  descricao: string;
  tipo: 'obrigatorio' | 'opcional';
  conteudo: string;        // texto ou URL
  temQuiz: boolean;
  notaMinima: number;      // 0-10
}

interface Trilha {
  id: string;
  titulo: string;
  descricao: string;
  perfis: Perfil[];
  modulos: Modulo[];
  ativa: boolean;
  tenantId: string;
  createdAt: any;
}

interface ModuloProgresso {
  assistido: boolean;
  aprovado: boolean;
  nota: number | null;
  tentativas: number;
}

interface TrilhaProgresso {
  id: string;
  userId: string;
  userName: string;
  trilhaId: string;
  trilhaTitulo: string;
  modulos: Record<string, ModuloProgresso>;
  percentualObrigatorios: number;
  concluida: boolean;
  tenantId: string;
  updatedAt: any;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PERFIS: { value: Perfil; label: string; color: string }[] = [
  { value: 'gestor',    label: 'Gestor',      color: '#3b82f6' },
  { value: 'auditor',   label: 'Auditor',     color: '#f59e0b' },
  { value: 'atendente', label: 'Atendente',   color: '#10b981' },
  { value: 'expert',    label: 'Expert',      color: '#8b5cf6' },
  { value: 'viewer',    label: 'Viewer',      color: '#64748b' },
];

const PERFIL_LABEL: Record<string, string> = {
  gestor: 'Gestor', auditor: 'Auditor', atendente: 'Atendente',
  expert: 'Expert', viewer: 'Viewer', SUPERADMIN: 'Super Admin', admin: 'Admin',
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function calcPercObrigatorios(trilha: Trilha, prog: TrilhaProgresso): number {
  const obrigatorios = trilha.modulos.filter(m => m.tipo === 'obrigatorio');
  if (obrigatorios.length === 0) return 100;
  const concluidos = obrigatorios.filter(m => {
    const p = prog.modulos[m.id];
    if (!p) return false;
    return p.assistido && (!m.temQuiz || p.aprovado);
  });
  return Math.round((concluidos.length / obrigatorios.length) * 100);
}

// ─── Modulo Form ─────────────────────────────────────────────────────────────

const ModuloForm: React.FC<{
  modulo: Modulo;
  onChange: (m: Modulo) => void;
  onRemove: () => void;
  index: number;
}> = ({ modulo, onChange, onRemove, index }) => (
  <div style={{ background: '#0a111f', border: '1px solid #1e293b', borderRadius: 16, padding: 20, marginBottom: 12 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <span style={{ fontSize: 11, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: 2 }}>
        Módulo {index + 1}
      </span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={() => onChange({ ...modulo, tipo: modulo.tipo === 'obrigatorio' ? 'opcional' : 'obrigatorio' })}
          style={{
            padding: '4px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 10,
            fontWeight: 900, textTransform: 'uppercase',
            background: modulo.tipo === 'obrigatorio' ? '#dc2626' : '#1e293b',
            color: modulo.tipo === 'obrigatorio' ? 'white' : '#64748b',
          }}
        >
          {modulo.tipo === 'obrigatorio' ? '★ Obrigatório' : '◇ Opcional'}
        </button>
        <button onClick={onRemove} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16 }}>
          <i className="fa-solid fa-trash-can"></i>
        </button>
      </div>
    </div>
    <div style={{ display: 'grid', gap: 10 }}>
      <input
        value={modulo.titulo}
        onChange={e => onChange({ ...modulo, titulo: e.target.value })}
        placeholder="Título do módulo"
        style={{ background: '#05080f', border: '1px solid #1e293b', borderRadius: 10, padding: '10px 14px', color: 'white', fontSize: 13 }}
      />
      <textarea
        value={modulo.descricao}
        onChange={e => onChange({ ...modulo, descricao: e.target.value })}
        placeholder="Descrição do módulo — o que o colaborador vai aprender"
        rows={2}
        style={{ background: '#05080f', border: '1px solid #1e293b', borderRadius: 10, padding: '10px 14px', color: 'white', fontSize: 13, resize: 'vertical' }}
      />
      <textarea
        value={modulo.conteudo}
        onChange={e => onChange({ ...modulo, conteudo: e.target.value })}
        placeholder="Conteúdo do módulo (texto, links, ou referências de documentos da Base Legal)"
        rows={3}
        style={{ background: '#05080f', border: '1px solid #1e293b', borderRadius: 10, padding: '10px 14px', color: 'white', fontSize: 13, resize: 'vertical' }}
      />
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#94a3b8', fontSize: 13 }}>
          <input
            type="checkbox"
            checked={modulo.temQuiz}
            onChange={e => onChange({ ...modulo, temQuiz: e.target.checked })}
          />
          Tem quiz de avaliação
        </label>
        {modulo.temQuiz && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 13 }}>
            Nota mínima:
            <select
              value={modulo.notaMinima}
              onChange={e => onChange({ ...modulo, notaMinima: Number(e.target.value) })}
              style={{ background: '#05080f', border: '1px solid #1e293b', borderRadius: 8, padding: '4px 10px', color: 'white', fontSize: 13 }}
            >
              {[5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n}.0</option>)}
            </select>
          </label>
        )}
      </div>
    </div>
  </div>
);

// ─── Trilha Card ─────────────────────────────────────────────────────────────

const TrilhaCard: React.FC<{
  trilha: Trilha;
  progresso?: TrilhaProgresso;
  onEdit?: () => void;
  onDelete?: () => void;
  onView?: () => void;
  isGestor: boolean;
}> = ({ trilha, progresso, onEdit, onDelete, onView, isGestor }) => {
  const obrigatorios = trilha.modulos.filter(m => m.tipo === 'obrigatorio').length;
  const opcionais = trilha.modulos.filter(m => m.tipo === 'opcional').length;
  const perc = progresso ? progresso.percentualObrigatorios : 0;

  return (
    <div style={{
      background: '#0a111f', border: `1px solid ${trilha.ativa ? '#1e3a8a' : '#1e293b'}`,
      borderRadius: 20, padding: 24, position: 'relative', overflow: 'hidden'
    }}>
      {!trilha.ativa && (
        <div style={{ position: 'absolute', top: 12, right: 12, background: '#1e293b', color: '#64748b', fontSize: 9, fontWeight: 900, padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase' }}>
          Inativa
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 16, fontWeight: 900, color: 'white', marginBottom: 4 }}>{trilha.titulo}</p>
          <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{trilha.descricao}</p>
        </div>
        {isGestor && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
            <button onClick={onEdit} style={{ background: '#1e293b', border: 'none', color: '#3b82f6', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
              <i className="fa-solid fa-pen"></i>
            </button>
            <button onClick={onDelete} style={{ background: '#1e293b', border: 'none', color: '#dc2626', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
              <i className="fa-solid fa-trash"></i>
            </button>
          </div>
        )}
      </div>

      {/* Perfis */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {trilha.perfis.map(p => {
          const info = PERFIS.find(x => x.value === p);
          return (
            <span key={p} style={{ background: info?.color + '20', color: info?.color, border: `1px solid ${info?.color}40`, fontSize: 9, fontWeight: 900, padding: '3px 10px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
              {info?.label}
            </span>
          );
        })}
      </div>

      {/* Módulos info */}
      <div style={{ display: 'flex', gap: 16, marginBottom: progresso ? 16 : 0 }}>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>
          <i className="fa-solid fa-circle-dot" style={{ color: '#dc2626', marginRight: 4 }}></i>
          {obrigatorios} obrigatório{obrigatorios !== 1 ? 's' : ''}
        </span>
        {opcionais > 0 && (
          <span style={{ fontSize: 11, color: '#94a3b8' }}>
            <i className="fa-solid fa-circle" style={{ color: '#3b82f6', marginRight: 4 }}></i>
            {opcionais} opcional{opcionais !== 1 ? 'is' : ''}
          </span>
        )}
      </div>

      {/* Progresso do colaborador */}
      {progresso && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Seu progresso</span>
            <span style={{ fontSize: 11, fontWeight: 900, color: perc === 100 ? '#10b981' : '#f59e0b' }}>{perc}%</span>
          </div>
          <div style={{ background: '#1e293b', borderRadius: 999, height: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 999, background: perc === 100 ? '#10b981' : '#3b82f6', width: `${perc}%`, transition: 'width 0.5s' }}></div>
          </div>
          {progresso.concluida && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <i className="fa-solid fa-trophy" style={{ color: '#f59e0b', fontSize: 14 }}></i>
              <span style={{ fontSize: 11, fontWeight: 900, color: '#f59e0b' }}>Trilha concluída!</span>
            </div>
          )}
        </div>
      )}

      {onView && (
        <button onClick={onView} style={{ marginTop: 16, width: '100%', background: '#1e3a8a', border: 'none', color: 'white', padding: '10px', borderRadius: 12, cursor: 'pointer', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>
          {progresso?.concluida ? '🏆 Ver Trilha' : '▶ Continuar Trilha'}
        </button>
      )}
    </div>
  );
};

// ─── Módulo Player ────────────────────────────────────────────────────────────

const ModuloPlayer: React.FC<{
  trilha: Trilha;
  progresso: TrilhaProgresso;
  onUpdateProgresso: (prog: TrilhaProgresso) => void;
  onClose: () => void;
}> = ({ trilha, progresso, onUpdateProgresso, onClose }) => {
  const [moduloIdx, setModuloIdx] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [respostas, setRespostas] = useState<Record<number, string>>({});
  const [quizEnviado, setQuizEnviado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quizQuestoes, setQuizQuestoes] = useState<{ pergunta: string; opcoes: string[]; correta: number; explicacao: string }[]>([]);
  const [gerandoQuiz, setGerandoQuiz] = useState(false);

  const modulo = trilha.modulos[moduloIdx];
  const progModulo = progresso.modulos[modulo?.id] || { assistido: false, aprovado: false, nota: null, tentativas: 0 };

  const marcarAssistido = async () => {
    if (!modulo) return;
    const novosProg = {
      ...progresso.modulos,
      [modulo.id]: { ...progModulo, assistido: true }
    };
    const novoProgresso = { ...progresso, modulos: novosProg };
    novoProgresso.percentualObrigatorios = calcPercObrigatorios(trilha, novoProgresso);
    novoProgresso.concluida = novoProgresso.percentualObrigatorios === 100;
    onUpdateProgresso(novoProgresso);
  };

  const gerarQuiz = async () => {
    if (!modulo) return;
    setGerandoQuiz(true);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `Você é um gerador de quiz para treinamento notarial. 
Retorne APENAS um JSON válido, sem texto adicional, sem markdown, sem explicações.
Formato exato:
{"questoes":[{"pergunta":"...","opcoes":["A","B","C","D"],"correta":0,"explicacao":"..."}]}
correta é o índice (0-3) da opção correta.`,
          messages: [{
            role: 'user',
            content: `Gere 4 questões de múltipla escolha sobre este conteúdo:
Módulo: ${modulo.titulo}
Conteúdo: ${modulo.conteudo || modulo.descricao}
Nota mínima para aprovação: ${modulo.notaMinima}/10`
          }]
        })
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || '{}';
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      setQuizQuestoes(parsed.questoes || []);
    } catch {
      setQuizQuestoes([
        { pergunta: 'Erro ao gerar quiz. Tente novamente.', opcoes: ['Ok'], correta: 0, explicacao: '' }
      ]);
    }
    setGerandoQuiz(false);
  };

  const enviarQuiz = () => {
    if (!modulo) return;
    const total = quizQuestoes.length;
    const acertos = quizQuestoes.filter((q, i) => String(respostas[i]) === String(q.correta)).length;
    const nota = total > 0 ? Math.round((acertos / total) * 10 * 10) / 10 : 0;
    const aprovado = nota >= modulo.notaMinima;

    const novosProg = {
      ...progresso.modulos,
      [modulo.id]: {
        assistido: true,
        aprovado: aprovado,
        nota: nota,
        tentativas: (progModulo.tentativas || 0) + 1,
      }
    };
    const novoProgresso = { ...progresso, modulos: novosProg };
    novoProgresso.percentualObrigatorios = calcPercObrigatorios(trilha, novoProgresso);
    novoProgresso.concluida = novoProgresso.percentualObrigatorios === 100;
    onUpdateProgresso(novoProgresso);
    setQuizEnviado(true);
  };

  if (!modulo) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000cc', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#0a111f', border: '1px solid #1e293b', borderRadius: 28, width: '100%', maxWidth: 720, maxHeight: '90vh', overflow: 'auto' }}>

        {/* Header */}
        <div style={{ padding: '24px 28px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 900, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>
              {trilha.titulo} · Módulo {moduloIdx + 1} de {trilha.modulos.length}
            </p>
            <h3 style={{ fontSize: 20, fontWeight: 900, color: 'white' }}>{modulo.titulo}</h3>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{modulo.descricao}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20, flexShrink: 0 }}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Navegação de módulos */}
        <div style={{ padding: '16px 28px', display: 'flex', gap: 8, overflowX: 'auto' }}>
          {trilha.modulos.map((m, i) => {
            const p = progresso.modulos[m.id];
            const done = p?.assistido && (!m.temQuiz || p?.aprovado);
            return (
              <button
                key={m.id}
                onClick={() => { setShowQuiz(false); setQuizEnviado(false); setRespostas({}); setQuizQuestoes([]); setModuloIdx(i); }}
                style={{
                  flexShrink: 0, padding: '6px 14px', borderRadius: 10, border: '1px solid', cursor: 'pointer', fontSize: 11, fontWeight: 900,
                  background: i === moduloIdx ? '#1e3a8a' : done ? '#052e16' : '#05080f',
                  color: i === moduloIdx ? 'white' : done ? '#10b981' : '#64748b',
                  borderColor: i === moduloIdx ? '#3b82f6' : done ? '#10b981' : '#1e293b',
                }}
              >
                {done ? '✓ ' : ''}{m.tipo === 'obrigatorio' ? '★ ' : '◇ '}{m.titulo}
              </button>
            );
          })}
        </div>

        {/* Conteúdo */}
        <div style={{ padding: '0 28px 28px' }}>
          <div style={{ background: '#05080f', border: '1px solid #1e293b', borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>
              {modulo.tipo === 'obrigatorio' ? '★ Módulo Obrigatório' : '◇ Módulo Opcional'}
            </p>
            <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{modulo.conteudo || modulo.descricao}</p>
          </div>

          {/* Status do módulo */}
          {progModulo.nota !== null && (
            <div style={{ background: progModulo.aprovado ? '#052e16' : '#450a0a', border: `1px solid ${progModulo.aprovado ? '#10b981' : '#dc2626'}40`, borderRadius: 12, padding: 12, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
              <i className={`fa-solid ${progModulo.aprovado ? 'fa-circle-check' : 'fa-circle-xmark'}`} style={{ color: progModulo.aprovado ? '#10b981' : '#dc2626', fontSize: 18 }}></i>
              <div>
                <p style={{ fontSize: 12, fontWeight: 900, color: progModulo.aprovado ? '#10b981' : '#dc2626' }}>
                  {progModulo.aprovado ? 'Aprovado' : 'Reprovado'} — Nota: {progModulo.nota}/10
                </p>
                <p style={{ fontSize: 11, color: '#64748b' }}>Tentativas: {progModulo.tentativas} · Nota mínima: {modulo.notaMinima}</p>
              </div>
            </div>
          )}

          {/* Ações */}
          {!showQuiz && !quizEnviado && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {!progModulo.assistido && (
                <button onClick={marcarAssistido} style={{ flex: 1, minWidth: 160, background: '#1e3a8a', border: 'none', color: 'white', padding: 14, borderRadius: 12, cursor: 'pointer', fontWeight: 900, fontSize: 12, textTransform: 'uppercase' }}>
                  <i className="fa-solid fa-check" style={{ marginRight: 8 }}></i>Marcar como Lido
                </button>
              )}
              {modulo.temQuiz && (!progModulo.aprovado || progModulo.tentativas === 0) && (
                <button onClick={async () => { setShowQuiz(true); await gerarQuiz(); }} style={{ flex: 1, minWidth: 160, background: '#7c3aed', border: 'none', color: 'white', padding: 14, borderRadius: 12, cursor: 'pointer', fontWeight: 900, fontSize: 12, textTransform: 'uppercase' }}>
                  <i className="fa-solid fa-pen-to-square" style={{ marginRight: 8 }}></i>
                  {progModulo.tentativas > 0 ? 'Refazer Quiz' : 'Fazer Quiz'}
                </button>
              )}
              {progModulo.assistido && (!modulo.temQuiz || progModulo.aprovado) && (
                <div style={{ flex: 1, background: '#052e16', border: '1px solid #10b98140', borderRadius: 12, padding: 14, textAlign: 'center' }}>
                  <i className="fa-solid fa-circle-check" style={{ color: '#10b981', marginRight: 8 }}></i>
                  <span style={{ color: '#10b981', fontWeight: 900, fontSize: 12 }}>Módulo Concluído</span>
                </div>
              )}
            </div>
          )}

          {/* Quiz */}
          {showQuiz && !quizEnviado && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 900, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>
                <i className="fa-solid fa-brain" style={{ marginRight: 8 }}></i>Quiz de Avaliação
              </p>
              {gerandoQuiz ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 24, marginBottom: 12 }}></i>
                  <p style={{ fontSize: 13 }}>Gerando questões com IA...</p>
                </div>
              ) : (
                <>
                  {quizQuestoes.map((q, qi) => (
                    <div key={qi} style={{ background: '#05080f', border: '1px solid #1e293b', borderRadius: 14, padding: 18, marginBottom: 12 }}>
                      <p style={{ fontSize: 13, color: 'white', marginBottom: 12, fontWeight: 700 }}>{qi + 1}. {q.pergunta}</p>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {q.opcoes.map((op, oi) => (
                          <button
                            key={oi}
                            onClick={() => setRespostas(r => ({ ...r, [qi]: String(oi) }))}
                            style={{
                              textAlign: 'left', padding: '10px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 12,
                              border: `1px solid ${respostas[qi] === String(oi) ? '#3b82f6' : '#1e293b'}`,
                              background: respostas[qi] === String(oi) ? '#1e3a8a' : '#0a111f',
                              color: respostas[qi] === String(oi) ? 'white' : '#94a3b8',
                            }}
                          >
                            <span style={{ fontWeight: 900, marginRight: 8 }}>{['A', 'B', 'C', 'D'][oi]}.</span>{op}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => { setShowQuiz(false); setRespostas({}); }} style={{ padding: '12px 20px', borderRadius: 12, border: '1px solid #1e293b', background: 'none', color: '#64748b', cursor: 'pointer', fontWeight: 900, fontSize: 12 }}>
                      Cancelar
                    </button>
                    <button
                      onClick={enviarQuiz}
                      disabled={Object.keys(respostas).length < quizQuestoes.length}
                      style={{ flex: 1, background: Object.keys(respostas).length < quizQuestoes.length ? '#1e293b' : '#7c3aed', border: 'none', color: 'white', padding: 12, borderRadius: 12, cursor: 'pointer', fontWeight: 900, fontSize: 12, textTransform: 'uppercase' }}
                    >
                      Enviar Respostas
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Resultado do quiz */}
          {quizEnviado && (() => {
            const p = progresso.modulos[modulo.id];
            return (
              <div style={{ background: p?.aprovado ? '#052e16' : '#450a0a', border: `1px solid ${p?.aprovado ? '#10b981' : '#dc2626'}30`, borderRadius: 16, padding: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>{p?.aprovado ? '🎉' : '📚'}</div>
                <p style={{ fontSize: 18, fontWeight: 900, color: p?.aprovado ? '#10b981' : '#dc2626', marginBottom: 4 }}>
                  {p?.aprovado ? 'Aprovado!' : 'Não aprovado'}
                </p>
                <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 16 }}>
                  Sua nota: <strong style={{ color: 'white' }}>{p?.nota}/10</strong> · Mínima: {modulo.notaMinima}
                </p>
                {!p?.aprovado && (
                  <button onClick={() => { setShowQuiz(false); setQuizEnviado(false); setRespostas({}); setQuizQuestoes([]); }} style={{ background: '#7c3aed', border: 'none', color: 'white', padding: '10px 24px', borderRadius: 12, cursor: 'pointer', fontWeight: 900, fontSize: 12, textTransform: 'uppercase' }}>
                    Tentar Novamente
                  </button>
                )}
                {p?.aprovado && (
                  <button onClick={() => { if (moduloIdx < trilha.modulos.length - 1) { setModuloIdx(moduloIdx + 1); setShowQuiz(false); setQuizEnviado(false); setRespostas({}); setQuizQuestoes([]); } else { onClose(); } }} style={{ background: '#10b981', border: 'none', color: 'white', padding: '10px 24px', borderRadius: 12, cursor: 'pointer', fontWeight: 900, fontSize: 12, textTransform: 'uppercase' }}>
                    {moduloIdx < trilha.modulos.length - 1 ? 'Próximo Módulo →' : 'Concluir Trilha 🏆'}
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

// ─── Main View ────────────────────────────────────────────────────────────────

const TrailsView: React.FC = () => {
  const { state } = useApp();
  const user = state.user!;
  const tenantId = user.tenantId;
  const isGestor = ['SUPERADMIN', 'gestor', 'admin'].includes(user.role);

  const [tab, setTab] = useState<'minhas' | 'todas' | 'criar' | 'progresso'>(isGestor ? 'todas' : 'minhas');
  const [trilhas, setTrilhas] = useState<Trilha[]>([]);
  const [progressos, setProgressos] = useState<TrilhaProgresso[]>([]);
  const [todosProgressos, setTodosProgressos] = useState<TrilhaProgresso[]>([]);
  const [editando, setEditando] = useState<Trilha | null>(null);
  const [trilhaAtiva, setTrilhaAtiva] = useState<{ trilha: Trilha; progresso: TrilhaProgresso } | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    titulo: '', descricao: '', perfis: [] as Perfil[], modulos: [] as Modulo[], ativa: true
  });

  // Load trilhas
  useEffect(() => {
    const q = query(collection(db, 'trilhas'), where('tenantId', '==', tenantId));
    return onSnapshot(q, snap => {
      setTrilhas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Trilha)));
    });
  }, [tenantId]);

  // Load my progressos
  useEffect(() => {
    const q = query(collection(db, 'trilhasProgresso'),
      where('tenantId', '==', tenantId), where('userId', '==', user.id));
    return onSnapshot(q, snap => {
      setProgressos(snap.docs.map(d => ({ id: d.id, ...d.data() } as TrilhaProgresso)));
    });
  }, [tenantId, user.id]);

  // Load all progressos (gestor only)
  useEffect(() => {
    if (!isGestor) return;
    const q = query(collection(db, 'trilhasProgresso'), where('tenantId', '==', tenantId));
    return onSnapshot(q, snap => {
      setTodosProgressos(snap.docs.map(d => ({ id: d.id, ...d.data() } as TrilhaProgresso)));
    });
  }, [tenantId, isGestor]);

  const minhasTrilhas = trilhas.filter(t => t.ativa && t.perfis.includes(user.role as Perfil));
  const meuProgresso = (trilhaId: string) => progressos.find(p => p.trilhaId === trilhaId);

  const iniciarEditar = (trilha?: Trilha) => {
    if (trilha) {
      setEditando(trilha);
      setForm({ titulo: trilha.titulo, descricao: trilha.descricao, perfis: trilha.perfis, modulos: trilha.modulos, ativa: trilha.ativa });
    } else {
      setEditando(null);
      setForm({ titulo: '', descricao: '', perfis: [], modulos: [], ativa: true });
    }
    setTab('criar');
  };

  const addModulo = () => {
    setForm(f => ({ ...f, modulos: [...f.modulos, { id: uid(), titulo: '', descricao: '', tipo: 'obrigatorio', conteudo: '', temQuiz: true, notaMinima: 7 }] }));
  };

  const salvarTrilha = async () => {
    if (!form.titulo || form.modulos.length === 0 || form.perfis.length === 0) return;
    setSaving(true);
    try {
      const data = { ...form, tenantId, updatedAt: serverTimestamp() };
      if (editando) {
        await updateDoc(doc(db, 'trilhas', editando.id), data);
      } else {
        await addDoc(collection(db, 'trilhas'), { ...data, createdAt: serverTimestamp() });
      }
      setTab('todas');
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const deletarTrilha = async (id: string) => {
    if (!confirm('Excluir esta trilha?')) return;
    await deleteDoc(doc(db, 'trilhas', id));
  };

  const abrirTrilha = async (trilha: Trilha) => {
    let prog = progressos.find(p => p.trilhaId === trilha.id);
    if (!prog) {
      const novoDoc = await addDoc(collection(db, 'trilhasProgresso'), {
        userId: user.id, userName: user.name, trilhaId: trilha.id,
        trilhaTitulo: trilha.titulo, modulos: {}, percentualObrigatorios: 0,
        concluida: false, tenantId, updatedAt: serverTimestamp()
      });
      prog = { id: novoDoc.id, userId: user.id, userName: user.name, trilhaId: trilha.id, trilhaTitulo: trilha.titulo, modulos: {}, percentualObrigatorios: 0, concluida: false, tenantId, updatedAt: null };
    }
    setTrilhaAtiva({ trilha, progresso: prog });
  };

  const updateProgresso = async (novoProgresso: TrilhaProgresso) => {
    const { id, ...data } = novoProgresso;
    await updateDoc(doc(db, 'trilhasProgresso', id), { ...data, updatedAt: serverTimestamp() });
    if (novoProgresso.concluida) { try { await addDoc(collection(db, 'auditLogs'), { tipo: 'trilha_concluida', descricao: 'Trilha concluida: ' + (novoProgresso.trilhaTitulo || ''), usuario: novoProgresso.userName, usuarioId: novoProgresso.userId, tenantId, createdAt: serverTimestamp() }); } catch {} }
    if (novoProgresso.concluida) { try { await addDoc(collection(db, 'auditLogs'), { tipo: 'trilha_concluida', descricao: 'Trilha concluida: ' + (novoProgresso.trilhaTitulo || ''), usuario: novoProgresso.userName, usuarioId: novoProgresso.userId, tenantId, createdAt: serverTimestamp() }); } catch {} }
    setTrilhaAtiva(prev => prev ? { ...prev, progresso: novoProgresso } : null);
  };

  const togglePerfil = (p: Perfil) => {
    setForm(f => ({ ...f, perfis: f.perfis.includes(p) ? f.perfis.filter(x => x !== p) : [...f.perfis, p] }));
  };

  // Stats para gestor
  const statsProgresso = (trilhaId: string) => {
    const progs = todosProgressos.filter(p => p.trilhaId === trilhaId);
    const concluidos = progs.filter(p => p.concluida).length;
    return { total: progs.length, concluidos };
  };

  return (
    <div style={{ padding: 32, background: '#05080f', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 28, fontWeight: 900, color: 'white', fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: -1 }}>
          Trilhas de <span style={{ color: '#3b82f6' }}>Treinamento</span>
        </h2>
        <p style={{ fontSize: 11, color: '#475569', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 3, marginTop: 4 }}>
          Capacitação por perfil de usuário · CartórioRAG PRO
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {!isGestor && (
          <button onClick={() => setTab('minhas')} style={{ padding: '10px 20px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, background: tab === 'minhas' ? '#1e3a8a' : '#0a111f', color: tab === 'minhas' ? 'white' : '#475569' }}>
            <i className="fa-solid fa-road" style={{ marginRight: 6 }}></i>Minhas Trilhas
          </button>
        )}
        {isGestor && <>
          <button onClick={() => setTab('todas')} style={{ padding: '10px 20px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, background: tab === 'todas' ? '#1e3a8a' : '#0a111f', color: tab === 'todas' ? 'white' : '#475569' }}>
            <i className="fa-solid fa-list" style={{ marginRight: 6 }}></i>Todas as Trilhas
          </button>
          <button onClick={() => iniciarEditar()} style={{ padding: '10px 20px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, background: tab === 'criar' ? '#1e3a8a' : '#0a111f', color: tab === 'criar' ? 'white' : '#475569' }}>
            <i className="fa-solid fa-plus" style={{ marginRight: 6 }}></i>{editando ? 'Editando Trilha' : 'Nova Trilha'}
          </button>
          <button onClick={() => setTab('progresso')} style={{ padding: '10px 20px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, background: tab === 'progresso' ? '#1e3a8a' : '#0a111f', color: tab === 'progresso' ? 'white' : '#475569' }}>
            <i className="fa-solid fa-chart-bar" style={{ marginRight: 6 }}></i>Progresso Geral
          </button>
        </>}
      </div>

      {/* ── Minhas Trilhas ── */}
      {tab === 'minhas' && (
        <div>
          {minhasTrilhas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#475569' }}>
              <i className="fa-solid fa-road" style={{ fontSize: 40, marginBottom: 16, display: 'block' }}></i>
              <p style={{ fontWeight: 900, fontSize: 16, marginBottom: 8 }}>Nenhuma trilha disponível</p>
              <p style={{ fontSize: 13 }}>Seu gestor ainda não criou trilhas para o perfil {PERFIL_LABEL[user.role]}.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {minhasTrilhas.map(t => (
                <TrilhaCard
                  key={t.id} trilha={t} isGestor={false}
                  progresso={meuProgresso(t.id)}
                  onView={() => abrirTrilha(t)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Todas as Trilhas (gestor) ── */}
      {tab === 'todas' && isGestor && (
        <div>
          {trilhas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#475569' }}>
              <i className="fa-solid fa-folder-open" style={{ fontSize: 40, marginBottom: 16, display: 'block' }}></i>
              <p style={{ fontWeight: 900, fontSize: 16, marginBottom: 8 }}>Nenhuma trilha criada</p>
              <button onClick={() => iniciarEditar()} style={{ marginTop: 16, background: '#1e3a8a', border: 'none', color: 'white', padding: '12px 24px', borderRadius: 12, cursor: 'pointer', fontWeight: 900, fontSize: 12, textTransform: 'uppercase' }}>
                <i className="fa-solid fa-plus" style={{ marginRight: 8 }}></i>Criar Primeira Trilha
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
              {trilhas.map(t => {
                const stats = statsProgresso(t.id);
                return (
                  <div key={t.id} style={{ background: '#0a111f', border: '1px solid #1e293b', borderRadius: 20, padding: 24 }}>
                    <TrilhaCard trilha={t} isGestor={true} onEdit={() => iniciarEditar(t)} onDelete={() => deletarTrilha(t.id)} />
                    <div style={{ marginTop: 16, padding: '12px 16px', background: '#05080f', borderRadius: 12, display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: '#64748b' }}>
                        <i className="fa-solid fa-users" style={{ marginRight: 6 }}></i>{stats.total} participante{stats.total !== 1 ? 's' : ''}
                      </span>
                      <span style={{ fontSize: 11, color: '#10b981', fontWeight: 900 }}>
                        {stats.concluidos} concluíd{stats.concluidos !== 1 ? 'os' : 'o'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Criar / Editar Trilha ── */}
      {tab === 'criar' && isGestor && (
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ background: '#0a111f', border: '1px solid #1e293b', borderRadius: 28, padding: 32 }}>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: 'white', marginBottom: 24, textTransform: 'uppercase', letterSpacing: 1 }}>
              {editando ? 'Editar Trilha' : 'Nova Trilha de Treinamento'}
            </h3>

            <div style={{ display: 'grid', gap: 14, marginBottom: 24 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: 2, display: 'block', marginBottom: 6 }}>Título da Trilha</label>
                <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ex: Trilha do Atendente · Onboarding Notarial"
                  style={{ width: '100%', background: '#05080f', border: '1px solid #1e293b', borderRadius: 12, padding: '12px 16px', color: 'white', fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: 2, display: 'block', marginBottom: 6 }}>Descrição</label>
                <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Descreva o objetivo e o público desta trilha"
                  rows={2}
                  style={{ width: '100%', background: '#05080f', border: '1px solid #1e293b', borderRadius: 12, padding: '12px 16px', color: 'white', fontSize: 14, resize: 'vertical' }} />
              </div>

              <div>
                <label style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: 2, display: 'block', marginBottom: 10 }}>Perfis de Acesso</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {PERFIS.map(p => (
                    <button key={p.value} onClick={() => togglePerfil(p.value)}
                      style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${form.perfis.includes(p.value) ? p.color : '#1e293b'}`, background: form.perfis.includes(p.value) ? p.color + '25' : '#05080f', color: form.perfis.includes(p.value) ? p.color : '#64748b', cursor: 'pointer', fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>
                      {form.perfis.includes(p.value) && <i className="fa-solid fa-check" style={{ marginRight: 6 }}></i>}{p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#94a3b8', fontSize: 13 }}>
                  <input type="checkbox" checked={form.ativa} onChange={e => setForm(f => ({ ...f, ativa: e.target.checked }))} />
                  Trilha ativa (visível para os colaboradores)
                </label>
              </div>
            </div>

            {/* Módulos */}
            <div style={{ borderTop: '1px solid #1e293b', paddingTop: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 900, color: 'white', textTransform: 'uppercase', letterSpacing: 1 }}>Módulos</p>
                  <p style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>★ Obrigatório = conta para conclusão · ◇ Opcional = complementar</p>
                </div>
                <button onClick={addModulo} style={{ background: '#1e3a8a', border: 'none', color: 'white', padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>
                  <i className="fa-solid fa-plus" style={{ marginRight: 6 }}></i>Módulo
                </button>
              </div>

              {form.modulos.length === 0 && (
                <div style={{ textAlign: 'center', padding: 30, color: '#475569', border: '1px dashed #1e293b', borderRadius: 16 }}>
                  <p style={{ fontSize: 13 }}>Adicione pelo menos um módulo para criar a trilha</p>
                </div>
              )}

              {form.modulos.map((m, i) => (
                <ModuloForm
                  key={m.id} modulo={m} index={i}
                  onChange={novo => setForm(f => ({ ...f, modulos: f.modulos.map((x, xi) => xi === i ? novo : x) }))}
                  onRemove={() => setForm(f => ({ ...f, modulos: f.modulos.filter((_, xi) => xi !== i) }))}
                />
              ))}
            </div>

            {/* Salvar */}
            <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setTab(isGestor ? 'todas' : 'minhas')} style={{ padding: '12px 24px', borderRadius: 12, border: '1px solid #1e293b', background: 'none', color: '#64748b', cursor: 'pointer', fontWeight: 900, fontSize: 12, textTransform: 'uppercase' }}>
                Cancelar
              </button>
              <button onClick={salvarTrilha} disabled={saving || !form.titulo || form.modulos.length === 0 || form.perfis.length === 0}
                style={{ padding: '12px 32px', borderRadius: 12, border: 'none', background: saving || !form.titulo || form.modulos.length === 0 || form.perfis.length === 0 ? '#1e293b' : '#10b981', color: 'white', cursor: 'pointer', fontWeight: 900, fontSize: 12, textTransform: 'uppercase' }}>
                <i className="fa-solid fa-floppy-disk" style={{ marginRight: 8 }}></i>
                {saving ? 'Salvando...' : editando ? 'Salvar Alterações' : 'Criar Trilha'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Progresso Geral (gestor) ── */}
      {tab === 'progresso' && isGestor && (
        <div>
          {trilhas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#475569' }}>
              <p>Nenhuma trilha criada ainda.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {trilhas.map(t => {
                const progs = todosProgressos.filter(p => p.trilhaId === t.id);
                return (
                  <div key={t.id} style={{ background: '#0a111f', border: '1px solid #1e293b', borderRadius: 20, padding: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <div>
                        <p style={{ fontSize: 15, fontWeight: 900, color: 'white' }}>{t.titulo}</p>
                        <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{t.modulos.length} módulos · {t.perfis.map(p => PERFIL_LABEL[p]).join(', ')}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: 22, fontWeight: 900, color: '#10b981' }}>{progs.filter(p => p.concluida).length}</p>
                        <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>de {progs.length} concluídos</p>
                      </div>
                    </div>
                    {progs.length > 0 && (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {progs.map(p => (
                          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#05080f', borderRadius: 12 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 10, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#94a3b8', flexShrink: 0 }}>
                              {p.userName?.substring(0, 2).toUpperCase() || '??'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 12, fontWeight: 700, color: 'white', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.userName}</p>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <div style={{ flex: 1, background: '#1e293b', borderRadius: 999, height: 4, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', borderRadius: 999, background: p.concluida ? '#10b981' : '#3b82f6', width: `${p.percentualObrigatorios}%` }}></div>
                                </div>
                                <span style={{ fontSize: 10, fontWeight: 900, color: p.concluida ? '#10b981' : '#64748b', flexShrink: 0 }}>{p.percentualObrigatorios}%</span>
                              </div>
                            </div>
                            {p.concluida && <span style={{ fontSize: 16 }}>🏆</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {progs.length === 0 && (
                      <p style={{ fontSize: 12, color: '#475569', textAlign: 'center', padding: 16 }}>Nenhum colaborador iniciou esta trilha ainda</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Player de módulo */}
      {trilhaAtiva && (
        <ModuloPlayer
          trilha={trilhaAtiva.trilha}
          progresso={trilhaAtiva.progresso}
          onUpdateProgresso={updateProgresso}
          onClose={() => setTrilhaAtiva(null)}
        />
      )}
    </div>
  );
};

export default TrailsView;