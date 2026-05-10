import React, { useState, useEffect } from 'react';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  query, where, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { GeminiService } from '../../services/geminiService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Questao {
  id: string;
  tenantId: string;
  contexto_ou_norma: string;
  pergunta: string;
  opcoes: string[];
  correta: number;
  explicacao: string;
  dificuldade: 'basico' | 'intermediario' | 'avancado';
  status: 'pending_review' | 'approved' | 'rejected';
  geradoPorIA: boolean;
  criadoPor: string;
  criadoEm: any;
  revisadoEm?: any;
  revisadoPor?: string;
}

// ─── Fisher-Yates (exported for ModuloPlayer in TrailsView) ──────────────────

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function shuffleOpcoes(q: Pick<Questao, 'opcoes' | 'correta'>): Pick<Questao, 'opcoes' | 'correta'> {
  const indices = [0, 1, 2, 3];
  const shuffled = shuffleArray(indices);
  return {
    opcoes: shuffled.map(i => q.opcoes[i]),
    correta: shuffled.indexOf(q.correta),
  };
}

export function sortearQuestoes(bank: Questao[], quantidade: number): Questao[] {
  return shuffleArray(bank)
    .slice(0, quantidade)
    .map(q => ({ ...q, ...shuffleOpcoes(q) }));
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DIFICULDADE_LABEL: Record<string, string> = {
  basico: 'Básico',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
};

const DIFICULDADE_DESC: Record<string, string> = {
  basico: 'conceitos fundamentais, definições e termos básicos',
  intermediario: 'procedimentos práticos, fluxos de trabalho e aplicação de normas',
  avancado: 'análise crítica, casos complexos, exceções e interpretação normativa',
};

const DIFICULDADE_COLOR: Record<string, string> = {
  basico: '#10b981',
  intermediario: '#f59e0b',
  avancado: '#ef4444',
};

type Tab = 'gerar' | 'curadoria' | 'banco';

// ─── Main Component ──────────────────────────────────────────────────────────

const BancoQuestoesView: React.FC = () => {
  const { state } = useApp();
  const { showToast } = useToast();
  const tenantId = state.user?.tenantId || '';
  const isGestor = ['SUPERADMIN', 'gestor', 'admin'].includes(state.user?.role || '');

  const [tab, setTab] = useState<Tab>('curadoria');
  const [questoes, setQuestoes] = useState<Questao[]>([]);

  const [contexto, setContexto] = useState('');
  const [dificuldade, setDificuldade] = useState<'basico' | 'intermediario' | 'avancado'>('intermediario');
  const [quantidade, setQuantidade] = useState(10);
  const [gerando, setGerando] = useState(false);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Questao>>({});

  const [filtroContexto, setFiltroContexto] = useState('');
  const [filtroDif, setFiltroDif] = useState('');

  useEffect(() => {
    if (!tenantId) return;
    const q = query(
      collection(db, 'bancoDQuestoes'),
      where('tenantId', '==', tenantId),
    );
    return onSnapshot(q, snap => {
      setQuestoes(
        snap.docs.map(d => ({ id: d.id, ...d.data() } as Questao))
          .sort((a, b) => (b.criadoEm?.seconds ?? 0) - (a.criadoEm?.seconds ?? 0))
      );
    });
  }, [tenantId]);

  const pendentes = questoes.filter(q => q.status === 'pending_review');
  const aprovadas = questoes.filter(q => q.status === 'approved');
  const contextosUnicos = [...new Set(questoes.map(q => q.contexto_ou_norma))].filter(Boolean);
  const bancofiltrado = aprovadas.filter(q => {
    const matchCtx = !filtroContexto || q.contexto_ou_norma === filtroContexto;
    const matchDif = !filtroDif || q.dificuldade === filtroDif;
    return matchCtx && matchDif;
  });

  const handleGerar = async () => {
    if (!contexto.trim()) { showToast('Informe o contexto ou norma.', 'warning'); return; }
    setGerando(true);
    try {
      const prompt = `Você é especialista em educação corporativa para serventias extrajudiciais brasileiras.

Gere ${quantidade} questões de múltipla escolha sobre:
Contexto/Norma: ${contexto}
Nível: ${DIFICULDADE_LABEL[dificuldade]} — ${DIFICULDADE_DESC[dificuldade]}

Retorne APENAS um JSON válido, sem markdown:
{"questoes":[{"pergunta":"enunciado","opcoes":["A","B","C","D"],"correta":0,"explicacao":"explicação citando norma"}]}

Regras: distratores plausíveis; baseie-se estritamente no contexto; correta é índice 0-3.`;

      const resp = await GeminiService.chat(prompt, 'Geração de banco de questões');
      const raw = typeof resp === 'string' ? resp : (resp as any).text;
      const clean = raw.replace(/```json|```/g, '').trim();
      const firstChar = clean.trimStart()[0];
      const parsed = firstChar === '[' ? { questoes: JSON.parse(clean) } : JSON.parse(clean);
      const lista = parsed.questoes || parsed;

      await Promise.all(lista.map((q: any) =>
        addDoc(collection(db, 'bancoDQuestoes'), {
          tenantId, contexto_ou_norma: contexto.trim(),
          pergunta: q.pergunta, opcoes: q.opcoes, correta: q.correta, explicacao: q.explicacao,
          dificuldade, status: 'pending_review', geradoPorIA: true,
          criadoPor: state.user?.id || '', criadoEm: serverTimestamp(),
        })
      ));
      showToast(`${lista.length} questões geradas — aguardam curadoria.`, 'success');
      setContexto('');
      setTab('curadoria');
    } catch (err: any) {
      showToast(err.message || 'Erro ao gerar questões.', 'error');
    } finally {
      setGerando(false);
    }
  };

  const aprovar = async (q: Questao) => {
    await updateDoc(doc(db, 'bancoDQuestoes', q.id), {
      status: 'approved', revisadoEm: serverTimestamp(), revisadoPor: state.user?.id || '',
    });
    showToast('Questão aprovada.', 'success');
  };

  const rejeitar = async (q: Questao) => {
    await updateDoc(doc(db, 'bancoDQuestoes', q.id), {
      status: 'rejected', revisadoEm: serverTimestamp(), revisadoPor: state.user?.id || '',
    });
    showToast('Questão rejeitada.', 'info');
  };

  const excluir = async (id: string) => {
    if (!confirm('Excluir esta questão permanentemente?')) return;
    await deleteDoc(doc(db, 'bancoDQuestoes', id));
    showToast('Questão excluída.', 'info');
  };

  const salvarEdicao = async () => {
    if (!editandoId) return;
    await updateDoc(doc(db, 'bancoDQuestoes', editandoId), { ...editForm });
    setEditandoId(null);
    setEditForm({});
    showToast('Questão atualizada.', 'success');
  };

  const iniciarEdicao = (q: Questao) => {
    setEditandoId(q.id);
    setEditForm({ pergunta: q.pergunta, opcoes: [...q.opcoes], correta: q.correta, explicacao: q.explicacao });
  };

  return (
    <div style={{ padding: 32, background: '#05080f', minHeight: '100vh' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 28, fontWeight: 900, color: 'white', fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: -1 }}>
          Banco de <span style={{ color: '#3b82f6' }}>Questões</span>
        </h2>
        <p style={{ fontSize: 11, color: '#475569', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 3, marginTop: 4 }}>
          Motor de treinamento agnóstico de normas · CartórioEDU
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Aprovadas', value: aprovadas.length, color: '#10b981' },
          { label: 'Curadoria', value: pendentes.length, color: '#f59e0b' },
          { label: 'Contextos', value: contextosUnicos.length, color: '#8b5cf6' },
        ].map(s => (
          <div key={s.label} style={{ background: '#0a111f', border: `1px solid ${s.color}25`, borderRadius: 12, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: 10, color: '#475569', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {([
          { id: 'curadoria', icon: 'fa-magnifying-glass', label: `Curadoria${pendentes.length > 0 ? ` (${pendentes.length})` : ''}` },
          { id: 'banco',     icon: 'fa-database',         label: `Banco (${aprovadas.length})` },
          { id: 'gerar',     icon: 'fa-wand-magic-sparkles', label: 'Gerar com IA' },
        ] as { id: Tab; icon: string; label: string }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '10px 20px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1,
              background: tab === t.id ? '#1e3a8a' : '#0a111f', color: tab === t.id ? 'white' : '#475569' }}>
            <i className={`fa-solid ${t.icon}`} style={{ marginRight: 6 }}></i>{t.label}
          </button>
        ))}
      </div>

      {/* ── Gerar ── */}
      {tab === 'gerar' && (
        <div style={{ maxWidth: 620 }}>
          <div style={{ background: '#0a111f', border: '1px solid #1e293b', borderRadius: 24, padding: 28 }}>
            <p style={{ fontSize: 12, fontWeight: 900, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 20 }}>
              <i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: 8 }}></i>Gerar questões com IA
            </p>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: 2, display: 'block', marginBottom: 6 }}>
                  Contexto ou Norma *
                </label>
                <input value={contexto} onChange={e => setContexto(e.target.value)} list="ctx-list"
                  placeholder="Ex: Provimento CNJ 161/2024 · LGPD · ISO 27001 · Escrituração Notarial"
                  style={{ width: '100%', background: '#05080f', border: '1px solid #1e293b', borderRadius: 12, padding: '12px 16px', color: 'white', fontSize: 13 }} />
                <datalist id="ctx-list">{contextosUnicos.map(c => <option key={c} value={c} />)}</datalist>
                <p style={{ fontSize: 10, color: '#334155', marginTop: 4 }}>Campo livre — qualquer norma, tema ou conteúdo de PDF</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: 2, display: 'block', marginBottom: 6 }}>Nível</label>
                  <select value={dificuldade} onChange={e => setDificuldade(e.target.value as any)}
                    style={{ width: '100%', background: '#05080f', border: '1px solid #1e293b', borderRadius: 12, padding: '12px 16px', color: 'white', fontSize: 13 }}>
                    <option value="basico">Básico</option>
                    <option value="intermediario">Intermediário</option>
                    <option value="avancado">Avançado</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: 2, display: 'block', marginBottom: 6 }}>Questões</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[10, 20, 30].map(n => (
                      <button key={n} onClick={() => setQuantidade(n)}
                        style={{ flex: 1, padding: '12px 0', borderRadius: 10, cursor: 'pointer', fontWeight: 900, fontSize: 13,
                          background: quantidade === n ? '#3b82f6' : '#05080f', color: quantidade === n ? 'white' : '#64748b',
                          border: `1px solid ${quantidade === n ? '#3b82f6' : '#1e293b'}` }}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ background: '#05080f', borderRadius: 10, padding: '10px 14px', border: `1px solid ${DIFICULDADE_COLOR[dificuldade]}25` }}>
                <span style={{ fontSize: 11, color: DIFICULDADE_COLOR[dificuldade], fontWeight: 700 }}>{DIFICULDADE_LABEL[dificuldade]}: </span>
                <span style={{ fontSize: 11, color: '#475569' }}>{DIFICULDADE_DESC[dificuldade]}</span>
              </div>
              <button onClick={handleGerar} disabled={gerando || !contexto.trim()}
                style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', cursor: gerando || !contexto.trim() ? 'not-allowed' : 'pointer',
                  background: gerando || !contexto.trim() ? '#1e293b' : '#3b82f6', color: 'white', fontWeight: 900, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                {gerando
                  ? <><i className="fa-solid fa-circle-notch fa-spin" style={{ marginRight: 8 }}></i>Gerando {quantidade} questões...</>
                  : <><i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: 8 }}></i>Gerar {quantidade} questões · {DIFICULDADE_LABEL[dificuldade]}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Curadoria ── */}
      {tab === 'curadoria' && (
        <div>
          {pendentes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#475569' }}>
              <i className="fa-solid fa-circle-check" style={{ fontSize: 40, color: '#10b981', marginBottom: 16, display: 'block' }}></i>
              <p style={{ fontWeight: 900, fontSize: 16, marginBottom: 8, color: '#94a3b8' }}>Nenhuma questão aguardando revisão</p>
              <p style={{ fontSize: 13 }}>Gere novas questões ou aguarde a próxima geração automática.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {pendentes.map((q, idx) => (
                <div key={q.id} style={{ background: '#0a111f', border: '1px solid #f59e0b25', borderRadius: 20, padding: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 9, fontWeight: 900, background: '#f59e0b20', color: '#f59e0b', border: '1px solid #f59e0b40', padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase' }}>Pendente</span>
                        <span style={{ fontSize: 9, fontWeight: 900, background: `${DIFICULDADE_COLOR[q.dificuldade]}20`, color: DIFICULDADE_COLOR[q.dificuldade], padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase' }}>
                          {DIFICULDADE_LABEL[q.dificuldade]}
                        </span>
                        <span style={{ fontSize: 9, color: '#475569', padding: '3px 8px', background: '#05080f', borderRadius: 6, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {q.contexto_ou_norma}
                        </span>
                      </div>
                    </div>
                    {editandoId !== q.id && (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => iniciarEdicao(q)}
                          style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: '#1e293b', color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}>
                          <i className="fa-solid fa-pen"></i>
                        </button>
                        <button onClick={() => rejeitar(q)}
                          style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#450a0a', color: '#ef4444', cursor: 'pointer', fontSize: 11, fontWeight: 900 }}>
                          Rejeitar
                        </button>
                        <button onClick={() => aprovar(q)}
                          style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#052e16', color: '#10b981', cursor: 'pointer', fontSize: 11, fontWeight: 900 }}>
                          ✓ Aprovar
                        </button>
                      </div>
                    )}
                  </div>

                  {editandoId === q.id ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 10, color: '#64748b', fontWeight: 900, display: 'block', marginBottom: 4 }}>PERGUNTA</label>
                        <textarea rows={3} value={editForm.pergunta || ''}
                          onChange={e => setEditForm(f => ({ ...f, pergunta: e.target.value }))}
                          style={{ width: '100%', background: '#05080f', border: '1px solid #3b82f6', borderRadius: 10, padding: '10px 14px', color: 'white', fontSize: 13, resize: 'vertical' }} />
                      </div>
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <button onClick={() => setEditForm(f => ({ ...f, correta: i }))}
                            style={{ width: 28, height: 28, borderRadius: 8, border: 'none', flexShrink: 0, cursor: 'pointer', fontWeight: 900, fontSize: 11,
                              background: editForm.correta === i ? '#10b981' : '#1e293b', color: editForm.correta === i ? 'white' : '#64748b' }}>
                            {['A', 'B', 'C', 'D'][i]}
                          </button>
                          <input value={(editForm.opcoes || [])[i] || ''}
                            onChange={e => { const ops = [...(editForm.opcoes || q.opcoes)]; ops[i] = e.target.value; setEditForm(f => ({ ...f, opcoes: ops })); }}
                            style={{ flex: 1, background: '#05080f', border: `1px solid ${editForm.correta === i ? '#10b981' : '#1e293b'}`, borderRadius: 8, padding: '8px 12px', color: 'white', fontSize: 12 }} />
                        </div>
                      ))}
                      <div>
                        <label style={{ fontSize: 10, color: '#64748b', fontWeight: 900, display: 'block', marginBottom: 4 }}>EXPLICAÇÃO</label>
                        <textarea rows={2} value={editForm.explicacao || ''}
                          onChange={e => setEditForm(f => ({ ...f, explicacao: e.target.value }))}
                          style={{ width: '100%', background: '#05080f', border: '1px solid #1e293b', borderRadius: 10, padding: '10px 14px', color: '#94a3b8', fontSize: 12, resize: 'vertical' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => { setEditandoId(null); setEditForm({}); }}
                          style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #1e293b', background: 'none', color: '#64748b', cursor: 'pointer', fontWeight: 900, fontSize: 11 }}>
                          Cancelar
                        </button>
                        <button onClick={salvarEdicao}
                          style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer', fontWeight: 900, fontSize: 11, textTransform: 'uppercase' }}>
                          Salvar
                        </button>
                        <button onClick={async () => { await salvarEdicao(); await aprovar({ ...q, ...editForm } as Questao); }}
                          style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: '#10b981', color: 'white', cursor: 'pointer', fontWeight: 900, fontSize: 11, textTransform: 'uppercase' }}>
                          Salvar e Aprovar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 12, lineHeight: 1.5 }}>
                        {idx + 1}. {q.pergunta}
                      </p>
                      <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
                        {q.opcoes.map((op, i) => (
                          <div key={i} style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12,
                            background: i === q.correta ? '#052e16' : '#05080f',
                            border: `1px solid ${i === q.correta ? '#10b98140' : '#1e293b'}`,
                            color: i === q.correta ? '#10b981' : '#64748b',
                            fontWeight: i === q.correta ? 700 : 400 }}>
                            <span style={{ fontWeight: 900, marginRight: 8 }}>{['A', 'B', 'C', 'D'][i]}.</span>{op}
                            {i === q.correta && <span style={{ float: 'right', fontSize: 10 }}>✓ correta</span>}
                          </div>
                        ))}
                      </div>
                      {q.explicacao && (
                        <p style={{ fontSize: 11, color: '#3b82f6', fontStyle: 'italic', padding: '8px 12px', background: '#1e3a8a15', borderRadius: 8 }}>
                          <i className="fa-solid fa-lightbulb" style={{ marginRight: 6 }}></i>{q.explicacao}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Banco ── */}
      {tab === 'banco' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <select value={filtroContexto} onChange={e => setFiltroContexto(e.target.value)}
              style={{ background: '#0a111f', border: '1px solid #1e293b', borderRadius: 10, padding: '8px 14px', color: filtroContexto ? 'white' : '#475569', fontSize: 11, minWidth: 200 }}>
              <option value="">Todos os contextos</option>
              {contextosUnicos.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filtroDif} onChange={e => setFiltroDif(e.target.value)}
              style={{ background: '#0a111f', border: '1px solid #1e293b', borderRadius: 10, padding: '8px 14px', color: filtroDif ? 'white' : '#475569', fontSize: 11 }}>
              <option value="">Todos os níveis</option>
              <option value="basico">Básico</option>
              <option value="intermediario">Intermediário</option>
              <option value="avancado">Avançado</option>
            </select>
            <span style={{ fontSize: 11, color: '#475569', display: 'flex', alignItems: 'center', marginLeft: 8 }}>
              {bancofiltrado.length} questão{bancofiltrado.length !== 1 ? 'ões' : ''}
            </span>
          </div>
          {bancofiltrado.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#475569' }}>
              <i className="fa-solid fa-database" style={{ fontSize: 40, marginBottom: 16, display: 'block' }}></i>
              <p>Nenhuma questão aprovada {filtroContexto || filtroDif ? 'neste filtro' : 'ainda'}.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {bancofiltrado.map(q => (
                <div key={q.id} style={{ background: '#0a111f', border: '1px solid #10b98120', borderRadius: 16, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 9, fontWeight: 900, background: '#10b98115', color: '#10b981', padding: '2px 8px', borderRadius: 5, textTransform: 'uppercase' }}>Aprovada</span>
                        <span style={{ fontSize: 9, fontWeight: 900, background: `${DIFICULDADE_COLOR[q.dificuldade]}15`, color: DIFICULDADE_COLOR[q.dificuldade], padding: '2px 8px', borderRadius: 5, textTransform: 'uppercase' }}>
                          {DIFICULDADE_LABEL[q.dificuldade]}
                        </span>
                        <span style={{ fontSize: 9, color: '#334155', padding: '2px 8px', background: '#05080f', borderRadius: 5 }}>{q.contexto_ou_norma}</span>
                      </div>
                      <p style={{ fontSize: 13, color: 'white', fontWeight: 600, lineHeight: 1.5 }}>{q.pergunta}</p>
                    </div>
                    {isGestor && (
                      <button onClick={() => excluir(q.id)}
                        style={{ background: 'none', border: 'none', color: '#1e293b', cursor: 'pointer', fontSize: 14, padding: 4, flexShrink: 0 }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#1e293b')}>
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BancoQuestoesView;
