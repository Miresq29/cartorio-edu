import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import {
  collection, onSnapshot, query, orderBy, where,
  addDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { useApp } from '../../context/AppContext';

interface Question {
  id: string;
  texto: string;
  opcoes: string[];
  correta: number;
  explicacao: string;
}

interface Quiz {
  id: string;
  treinamento: string;
  titulo: string;
  questoes: Question[];
  geradoPorIA: boolean;
  createdAt?: any;
}

interface QuizResult {
  id: string;
  quizId: string;
  quizTitulo: string;
  treinamento: string;
  colaborador: string;
  cargo: string;
  nota: number;
  total: number;
  aprovado: boolean;
  respostas: number[];
  createdAt?: any;
}

interface Props {
  checklists: any[];
}

const DIAS_BLOQUEIO = 3;

const calcLiberadoEm = (results: QuizResult[], quizId: string, colaborador: string): Date | null => {
  const falhas = results
    .filter(r => r.quizId === quizId && r.colaborador === colaborador && !r.aprovado)
    .map(r => ({ ...r, ts: r.createdAt?.toDate?.() as Date | null }))
    .filter(r => r.ts)
    .sort((a, b) => b.ts!.getTime() - a.ts!.getTime());

  if (falhas.length === 0) return null;
  const liberadoEm = new Date(falhas[0].ts!.getTime() + DIAS_BLOQUEIO * 24 * 60 * 60 * 1000);
  return liberadoEm > new Date() ? liberadoEm : null;
};

const formatCountdown = (liberadoEm: Date): string => {
  const diff = liberadoEm.getTime() - Date.now();
  if (diff <= 0) return 'Liberado';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${mins}min`;
};

const TrainingQuiz: React.FC<Props> = ({ checklists }) => {
  const { state } = useApp();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [mode, setMode] = useState<'list' | 'create' | 'take' | 'result' | 'blocked'>('list');
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [respostas, setRespostas] = useState<number[]>([]);
  const [respondente, setRespondente] = useState({ nome: '', cargo: '' });
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [identStarted, setIdentStarted] = useState(false);
  const [bloqueadoAte, setBloqueadoAte] = useState<Date | null>(null);

  // Form manual
  const [form, setForm] = useState({ treinamento: '', titulo: '' });
  const [questoes, setQuestoes] = useState<Omit<Question, 'id'>[]>([
    { texto: '', opcoes: ['', '', '', ''], correta: 0, explicacao: '' }
  ]);

  // Form IA
  const [aiForm, setAiForm] = useState({ treinamento: '', quantidade: '5' });
  const [createMode, setCreateMode] = useState<'ia' | 'manual'>('ia');

  useEffect(() => {
    const q = query(collection(db, 'treinamentosQuizzes'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => setQuizzes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Quiz))));
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'treinamentosQuizResults'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => setResults(snap.docs.map(d => ({ id: d.id, ...d.data() } as QuizResult))));
    return () => unsub();
  }, []);

  // ---- GERAR QUIZ VIA IA ----
  const generateQuizWithAI = async () => {
    if (!aiForm.treinamento) return;
    setIsGenerating(true);
    setGenerateError('');

    const treinamento = checklists.find(c => c.title === aiForm.treinamento);
    const context = treinamento
      ? `Treinamento: ${treinamento.title}\nItens: ${treinamento.items?.map((i: any) => i.text).join('; ')}`
      : `Treinamento: ${aiForm.treinamento}`;

    const prompt = `Você é um especialista em treinamento notarial da MJ Consultoria.
Com base no seguinte treinamento, crie ${aiForm.quantidade} questões de múltipla escolha para avaliar o conhecimento dos colaboradores.

${context}

RESPONDA APENAS COM UM JSON VÁLIDO, sem texto antes ou depois, sem markdown, sem \`\`\`:
{
  "titulo": "Avaliação de [nome do treinamento]",
  "questoes": [
    {
      "texto": "Texto da pergunta",
      "opcoes": ["Opção A", "Opção B", "Opção C", "Opção D"],
      "correta": 0,
      "explicacao": "Explicação detalhada do porquê esta é a resposta correta e por que as outras estão erradas"
    }
  ]
}

Regras:
- "correta" é o índice (0 a 3) da opção correta
- As perguntas devem ser práticas e relevantes para o dia a dia do cartório
- A explicação deve ser clara e didática, com no mínimo 2 linhas
- Retorne exatamente ${aiForm.quantidade} questões`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const data = await response.json();
      const raw = data.content?.[0]?.text || '';

      // Parse JSON da resposta
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Resposta inválida da IA');

      const parsed = JSON.parse(jsonMatch[0]);
      const questoesComId = parsed.questoes.map((q: any, i: number) => ({ ...q, id: `q${i + 1}` }));

      await addDoc(collection(db, 'treinamentosQuizzes'), {
        treinamento: aiForm.treinamento,
        titulo: parsed.titulo,
        questoes: questoesComId,
        geradoPorIA: true,
        createdAt: serverTimestamp(),
      });

      setAiForm({ treinamento: '', quantidade: '5' });
      setMode('list');
    } catch (e: any) {
      setGenerateError('Erro ao gerar questionário. Tente novamente.');
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  // ---- CRIAR QUIZ MANUAL ----
  const handleCreateQuiz = async () => {
    if (!form.treinamento || !form.titulo) return;
    const questoesComId = questoes.map((q, i) => ({ ...q, id: `q${i + 1}` }));
    await addDoc(collection(db, 'treinamentosQuizzes'), {
      ...form, questoes: questoesComId, geradoPorIA: false, createdAt: serverTimestamp(),
    });
    setForm({ treinamento: '', titulo: '' });
    setQuestoes([{ texto: '', opcoes: ['', '', '', ''], correta: 0, explicacao: '' }]);
    setMode('list');
  };

  const addQuestao = () => setQuestoes(prev => [...prev, { texto: '', opcoes: ['', '', '', ''], correta: 0, explicacao: '' }]);
  const removeQuestao = (i: number) => setQuestoes(prev => prev.filter((_, idx) => idx !== i));
  const updateQuestao = (i: number, field: string, value: any) =>
    setQuestoes(prev => prev.map((q, idx) => idx === i ? { ...q, [field]: value } : q));
  const updateOpcao = (qi: number, oi: number, value: string) =>
    setQuestoes(prev => prev.map((q, idx) => {
      if (idx !== qi) return q;
      const opcoes = [...q.opcoes]; opcoes[oi] = value; return { ...q, opcoes };
    }));

  // ---- RESPONDER QUIZ ----
  const startQuiz = (quiz: Quiz) => {
    const nomeAtual = state.user?.name || '';
    // Verifica bloqueio de 3 dias para o usuário logado
    if (nomeAtual) {
      const liberado = calcLiberadoEm(results, quiz.id, nomeAtual);
      if (liberado) {
        setSelectedQuiz(quiz);
        setBloqueadoAte(liberado);
        setMode('blocked');
        return;
      }
    }
    setSelectedQuiz(quiz); setCurrentQ(0); setRespostas([]);
    setRespondente({ nome: nomeAtual, cargo: state.user?.role || '' });
    setIdentStarted(false);
    setMode('take');
  };

  const handleAnswer = (opcaoIdx: number) => {
    const novasRespostas = [...respostas, opcaoIdx];
    setRespostas(novasRespostas);
    if (currentQ + 1 < (selectedQuiz?.questoes.length || 0)) {
      setCurrentQ(prev => prev + 1);
    } else {
      finishQuiz(novasRespostas);
    }
  };

  const finishQuiz = async (resps: number[]) => {
    if (!selectedQuiz) return;
    const corretas = resps.filter((r, i) => r === selectedQuiz.questoes[i].correta).length;
    const nota = Math.round((corretas / selectedQuiz.questoes.length) * 100);
    const result: Omit<QuizResult, 'id'> = {
      quizId: selectedQuiz.id, quizTitulo: selectedQuiz.titulo,
      treinamento: selectedQuiz.treinamento, colaborador: respondente.nome,
      cargo: respondente.cargo, nota, total: selectedQuiz.questoes.length,
      aprovado: nota >= 70, respostas: resps, createdAt: serverTimestamp(),
    };
    const docRef = await addDoc(collection(db, 'treinamentosQuizResults'), result);
    setQuizResult({ ...result, id: docRef.id });
    setMode('result');
  };

  const deleteQuiz = async (id: string) => {
    if (!window.confirm('Excluir este questionário?')) return;
    await deleteDoc(doc(db, 'treinamentosQuizzes', id));
  };

  // ---- TELA DE RESULTADO COM EXPLICAÇÕES ----
  if (mode === 'result' && quizResult && selectedQuiz) {
    const corretas = quizResult.respostas.filter((r, i) => r === selectedQuiz.questoes[i].correta).length;
    return (
      <div className="space-y-6">
        {/* Placar */}
        <div className={`rounded-2xl p-8 text-center border ${quizResult.aprovado ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <i className={`fa-solid text-6xl mb-4 block ${quizResult.aprovado ? 'fa-circle-check text-emerald-400' : 'fa-circle-xmark text-red-400'}`}></i>
          <h3 className={`text-2xl font-black uppercase italic ${quizResult.aprovado ? 'text-emerald-400' : 'text-red-400'}`}>
            {quizResult.aprovado ? 'Aprovado!' : 'Reprovado'}
          </h3>
          <p className="text-[#0A1628] text-5xl font-black mt-2">{quizResult.nota}%</p>
          <p className="text-slate-500 text-sm mt-1">{quizResult.colaborador} — {quizResult.treinamento}</p>
          <p className="text-slate-500 text-xs mt-1">{corretas} de {selectedQuiz.questoes.length} corretas · Mínimo: 70%</p>
        </div>

        {/* Gabarito com explicações */}
        <div className="space-y-3">
          <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Gabarito Comentado</h4>
          {selectedQuiz.questoes.map((q, i) => {
            const acertou = quizResult.respostas[i] === q.correta;
            return (
              <div key={i} className={`p-5 rounded-2xl border space-y-3 ${acertou ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${acertou ? 'bg-emerald-500' : 'bg-red-500'}`}>
                    <i className={`fa-solid text-[#0A1628] text-xs ${acertou ? 'fa-check' : 'fa-xmark'}`}></i>
                  </div>
                  <p className="text-sm text-[#0A1628] font-bold">{i + 1}. {q.texto}</p>
                </div>

                <div className="ml-9 space-y-1">
                  {q.opcoes.map((opcao, oi) => {
                    const isSua = quizResult.respostas[i] === oi;
                    const isCorreta = q.correta === oi;
                    return (
                      <div key={oi} className={`px-3 py-2 rounded-lg text-xs flex items-center gap-2 ${
                        isCorreta ? 'bg-emerald-500/20 text-emerald-300 font-bold' :
                        isSua && !isCorreta ? 'bg-red-500/20 text-red-300 line-through' :
                        'text-slate-500'
                      }`}>
                        <span className="font-black">{String.fromCharCode(65 + oi)}.</span>
                        {opcao}
                        {isCorreta && <i className="fa-solid fa-check ml-auto text-emerald-400"></i>}
                        {isSua && !isCorreta && <i className="fa-solid fa-xmark ml-auto text-red-400"></i>}
                      </div>
                    );
                  })}
                </div>

                {/* Explicação sempre visível, destacada quando errou */}
                {q.explicacao && (
                  <div className={`ml-9 p-3 rounded-xl text-xs leading-relaxed ${
                    acertou
                      ? 'bg-slate-800/50 text-slate-500 border border-slate-200'
                      : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                  }`}>
                    <i className={`fa-solid fa-circle-info mr-2 ${acertou ? 'text-slate-500' : 'text-amber-400'}`}></i>
                    {q.explicacao}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button onClick={() => setMode('list')}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-[#0A1628] px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
            <i className="fa-solid fa-arrow-left mr-2"></i>Voltar
          </button>
          <button onClick={() => window.print()}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
            <i className="fa-solid fa-print mr-2"></i>Imprimir Resultado
          </button>
        </div>
      </div>
    );
  }

  // ---- TELA BLOQUEADA (aguardar 3 dias) ----
  if (mode === 'blocked' && selectedQuiz && bloqueadoAte) {
    return (
      <div className="space-y-6 max-w-lg mx-auto">
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center space-y-4">
          <i className="fa-solid fa-lock text-5xl text-red-400 block"></i>
          <div>
            <h3 className="text-red-400 font-black uppercase italic text-lg">Avaliação Bloqueada</h3>
            <p className="text-sm text-slate-500 mt-2">
              Você não atingiu a nota mínima de <span className="font-black text-[#0A1628]">70%</span> na tentativa anterior.
            </p>
            <p className="text-xs text-slate-500 mt-1">{selectedQuiz.titulo}</p>
          </div>
          <div className="bg-white border border-red-500/20 rounded-xl p-5 space-y-1">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Nova tentativa disponível em</p>
            <p className="text-4xl font-black text-red-400">{formatCountdown(bloqueadoAte)}</p>
            <p className="text-[9px] text-slate-600">
              Liberado em {bloqueadoAte.toLocaleDateString('pt-BR')} às {bloqueadoAte.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-left">
            <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1">
              <i className="fa-solid fa-lightbulb mr-1"></i>Dica de Estudo
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Use o tempo de espera para revisar o conteúdo do treinamento <span className="font-bold text-[#0A1628]">{selectedQuiz.treinamento}</span> na base legal e nos checklists.
            </p>
          </div>
          <button type="button" onClick={() => { setMode('list'); setBloqueadoAte(null); }}
            className="w-full bg-slate-800 hover:bg-slate-700 text-[#0A1628] px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
            <i className="fa-solid fa-arrow-left mr-2"></i>Voltar para Avaliações
          </button>
        </div>
      </div>
    );
  }

  // ---- TELA DE RESPONDER ----
  if (mode === 'take' && selectedQuiz) {
    if (!identStarted) {
      return (
        <div className="space-y-6 max-w-lg mx-auto">
          <div>
            <h3 className="text-[#0A1628] font-black uppercase italic text-sm">{selectedQuiz.titulo}</h3>
            <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">
              {selectedQuiz.treinamento} · {selectedQuiz.questoes.length} questões · Aprovação: 70%
            </p>
            {selectedQuiz.geradoPorIA && (
              <span className="inline-flex items-center gap-1 mt-2 text-[9px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 px-2 py-1 rounded-lg">
                <i className="fa-solid fa-wand-magic-sparkles"></i> Gerado por IA
              </span>
            )}
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Seu Nome *</label>
              <input value={respondente.nome} onChange={e => setRespondente(r => ({ ...r, nome: e.target.value }))}
                placeholder="Nome completo"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-[#0A1628] outline-none focus:border-blue-500" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Cargo / Função</label>
              <input value={respondente.cargo} onChange={e => setRespondente(r => ({ ...r, cargo: e.target.value }))}
                placeholder="Ex: Escrevente Técnico"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-[#0A1628] outline-none focus:border-blue-500" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setMode('list')} className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 border border-slate-200 hover:border-slate-600 transition-all">
              Cancelar
            </button>
            <button onClick={() => {
                // Verifica bloqueio ao iniciar (para nomes digitados manualmente)
                if (selectedQuiz && respondente.nome) {
                  const liberado = calcLiberadoEm(results, selectedQuiz.id, respondente.nome);
                  if (liberado) {
                    setBloqueadoAte(liberado);
                    setMode('blocked');
                    return;
                  }
                }
                setIdentStarted(true);
              }}
              disabled={!respondente.nome}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50">
              <i className="fa-solid fa-play mr-2"></i>Iniciar Avaliação
            </button>
          </div>
        </div>
      );
    }

    const questao = selectedQuiz.questoes[currentQ];
    return (
      <div className="space-y-6 max-w-lg mx-auto">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 font-bold">{respondente.nome}</span>
            <span className="text-xs text-slate-500">{currentQ + 1} / {selectedQuiz.questoes.length}</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5">
            <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${(currentQ / selectedQuiz.questoes.length) * 100}%` }}></div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <p className="text-[#0A1628] font-bold text-sm leading-relaxed">{currentQ + 1}. {questao.texto}</p>
          <div className="space-y-2">
            {questao.opcoes.map((opcao, i) => (
              <button key={i} onClick={() => handleAnswer(i)}
                className="w-full text-left p-4 rounded-xl bg-white border border-slate-200 hover:border-blue-500 hover:bg-blue-500/10 text-slate-700 text-sm transition-all">
                <span className="font-black text-blue-400 mr-3">{String.fromCharCode(65 + i)}.</span>{opcao}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---- TELA DE CRIAÇÃO ----
  if (mode === 'create') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode('list')} className="text-slate-500 hover:text-[#0A1628] transition-colors">
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div>
            <h3 className="text-[#0A1628] font-black uppercase italic text-sm">Novo Questionário</h3>
          </div>
        </div>

        {/* Toggle IA / Manual */}
        <div className="flex gap-2 bg-slate-900 p-1 rounded-xl w-fit">
          {(['ia', 'manual'] as const).map(m => (
            <button key={m} onClick={() => setCreateMode(m)}
              className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                createMode === m ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-[#0A1628]'
              }`}>
              <i className={`fa-solid mr-2 ${m === 'ia' ? 'fa-wand-magic-sparkles' : 'fa-pen'}`}></i>
              {m === 'ia' ? 'Gerar com IA' : 'Criar Manual'}
            </button>
          ))}
        </div>

        {/* MODO IA */}
        {createMode === 'ia' && (
          <div className="space-y-5 max-w-lg">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
              <p className="text-xs text-blue-300">
                <i className="fa-solid fa-wand-magic-sparkles mr-2"></i>
                A IA criará questões baseadas no conteúdo do treinamento selecionado, incluindo explicações para cada resposta.
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Treinamento *</label>
              <select value={aiForm.treinamento} onChange={e => setAiForm(f => ({ ...f, treinamento: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#0A1628] outline-none focus:border-blue-500">
                <option value="">Selecione o treinamento...</option>
                {checklists.map(c => <option key={c.id} value={c.title}>{c.title}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Quantidade de Questões</label>
              <select value={aiForm.quantidade} onChange={e => setAiForm(f => ({ ...f, quantidade: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#0A1628] outline-none focus:border-blue-500">
                {['3', '5', '7', '10'].map(n => <option key={n} value={n}>{n} questões</option>)}
              </select>
            </div>
            {generateError && <p className="text-red-400 text-xs">{generateError}</p>}
            <button onClick={generateQuizWithAI} disabled={isGenerating || !aiForm.treinamento}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {isGenerating
                ? <><i className="fa-solid fa-circle-notch animate-spin"></i>Gerando com IA...</>
                : <><i className="fa-solid fa-wand-magic-sparkles"></i>Gerar Questionário</>
              }
            </button>
          </div>
        )}

        {/* MODO MANUAL */}
        {createMode === 'manual' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Treinamento *</label>
                <select value={form.treinamento} onChange={e => setForm(f => ({ ...f, treinamento: e.target.value }))}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#0A1628] outline-none focus:border-blue-500">
                  <option value="">Selecione...</option>
                  {checklists.map(c => <option key={c.id} value={c.title}>{c.title}</option>)}
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Título *</label>
                <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ex: Avaliação NR-35"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#0A1628] outline-none focus:border-blue-500" />
              </div>
            </div>

            {questoes.map((q, qi) => (
              <div key={qi} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Questão {qi + 1}</span>
                  {questoes.length > 1 && (
                    <button onClick={() => removeQuestao(qi)} className="text-slate-600 hover:text-red-400 transition-colors">
                      <i className="fa-solid fa-trash text-xs"></i>
                    </button>
                  )}
                </div>
                <input value={q.texto} onChange={e => updateQuestao(qi, 'texto', e.target.value)}
                  placeholder="Digite a pergunta..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#0A1628] outline-none focus:border-blue-500" />
                <div className="space-y-2">
                  {q.opcoes.map((opcao, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <button onClick={() => updateQuestao(qi, 'correta', oi)}
                        className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                          q.correta === oi ? 'border-emerald-500 bg-emerald-500' : 'border-slate-200 hover:border-slate-500'
                        }`}>
                        {q.correta === oi && <i className="fa-solid fa-check text-[#0A1628] text-xs"></i>}
                      </button>
                      <input value={opcao} onChange={e => updateOpcao(qi, oi, e.target.value)}
                        placeholder={`Opção ${String.fromCharCode(65 + oi)}`}
                        className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-[#0A1628] outline-none focus:border-blue-500" />
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Explicação da resposta correta</label>
                  <textarea value={q.explicacao} onChange={e => updateQuestao(qi, 'explicacao', e.target.value)}
                    placeholder="Explique por que esta é a resposta correta..."
                    rows={2}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#0A1628] outline-none focus:border-blue-500 resize-none" />
                </div>
              </div>
            ))}

            <div className="flex gap-3">
              <button onClick={addQuestao}
                className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 border border-slate-200 hover:border-slate-600 hover:text-[#0A1628] transition-all">
                <i className="fa-solid fa-plus mr-2"></i>Questão
              </button>
              <button onClick={handleCreateQuiz} disabled={!form.treinamento || !form.titulo}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50">
                <i className="fa-solid fa-floppy-disk mr-2"></i>Salvar
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---- LISTA DE QUIZZES ----
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[#0A1628] font-black uppercase italic text-sm">
            Questionários de <span className="text-blue-500">Avaliação</span>
          </h3>
          <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">Criados pela IA ou manualmente</p>
        </div>
        <button onClick={() => setMode('create')}
          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2">
          <i className="fa-solid fa-plus"></i>Novo Questionário
        </button>
      </div>

      {quizzes.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <i className="fa-solid fa-circle-question text-4xl text-slate-700 mb-3 block"></i>
          <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">Nenhum questionário criado ainda</p>
          <p className="text-slate-700 text-xs mt-1">Clique em "Novo Questionário" e deixe a IA criar para você</p>
        </div>
      ) : (
        <div className="space-y-3">
          {quizzes.map(quiz => {
            const qtdResultados = results.filter(r => r.quizId === quiz.id).length;
            const aprovados = results.filter(r => r.quizId === quiz.id && r.aprovado).length;
            const nomeUsuario = state.user?.name || '';
            const bloqueado = nomeUsuario ? calcLiberadoEm(results, quiz.id, nomeUsuario) : null;
            return (
              <div key={quiz.id} className={`bg-white border rounded-2xl p-5 transition-all group ${bloqueado ? 'border-red-500/30' : 'border-slate-200 hover:border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[#0A1628] font-black text-sm">{quiz.titulo}</span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
                        {quiz.questoes.length} questões
                      </span>
                      {quiz.geradoPorIA && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md">
                          <i className="fa-solid fa-wand-magic-sparkles mr-1"></i>IA
                        </span>
                      )}
                      {bloqueado && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-md">
                          <i className="fa-solid fa-lock mr-1"></i>Bloqueado · {formatCountdown(bloqueado)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-xs text-slate-500">
                        <i className="fa-solid fa-graduation-cap text-blue-500 mr-1.5"></i>{quiz.treinamento}
                      </span>
                      <span className="text-xs text-slate-600">
                        {qtdResultados} realizações · {aprovados} aprovações
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button type="button" onClick={() => startQuiz(quiz)}
                      className={`text-[#0A1628] px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${bloqueado ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
                      <i className={`fa-solid ${bloqueado ? 'fa-lock' : 'fa-play'} mr-1`}></i>
                      {bloqueado ? 'Ver bloqueio' : 'Responder'}
                    </button>
                    <button type="button" title="Excluir questionário" onClick={() => deleteQuiz(quiz.id)} className="text-slate-600 hover:text-red-400 transition-colors p-2">
                      <i className="fa-solid fa-trash text-xs"></i>
                    </button>
                  </div>
                  <i className="fa-solid fa-chevron-right text-slate-700 text-xs ml-3 group-hover:opacity-0 transition-all"></i>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TrainingQuiz;
