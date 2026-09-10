// frontend/src/features/Admin/TreinamentosOficiaisPanel.tsx
// Painel SUPERADMIN para deixar prontos, com um clique por tema, os treinamentos
// oficiais MJ Consultoria (Provimento 213/2026, Compliance e Antissuborno,
// Provimento 149, LGPD) — vinculando o vídeo já cadastrado em Vídeos/Repositório
// e habilitando quiz automático (gerado por IA quando o colaborador faz a trilha).

import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import {
  collection, onSnapshot, query, where, addDoc, serverTimestamp,
} from 'firebase/firestore';

interface ItemMidia {
  id: string;
  titulo: string;
  tipoConteudo: 'video' | 'repositorio';
  label: string;
}

interface Topico {
  chave: string;
  titulo: string;
  descricao: string;
  conteudo: string;
}

const TOPICOS: Topico[] = [
  {
    chave: 'provimento-213-2026',
    titulo: 'Provimento 213/2026 – CNJ',
    descricao: 'Boas práticas do cartório à luz do Provimento 213/2026 do CNJ.',
    conteudo: 'Assista ao vídeo abaixo, preparado pela MJ Consultoria, com a explicação do Provimento 213/2026 do CNJ e seus impactos na rotina do cartório. Preste atenção nos pontos abordados — eles serão cobrados no quiz ao final do módulo.',
  },
  {
    chave: 'compliance-antissuborno',
    titulo: 'Compliance e Antissuborno',
    descricao: 'Programa de integridade, conflito de interesses e prevenção à corrupção no cartório.',
    conteudo: 'Assista ao vídeo abaixo sobre compliance e prevenção ao suborno no dia a dia do cartório. Preste atenção nos pontos abordados — eles serão cobrados no quiz ao final do módulo.',
  },
  {
    chave: 'provimento-149',
    titulo: 'Provimento 149 – CNJ',
    descricao: 'Prevenção à lavagem de dinheiro e ao financiamento do terrorismo (PLD-FT) nos serviços notariais.',
    conteudo: 'Assista ao vídeo abaixo sobre o Provimento 149 do CNJ e as obrigações de PLD-FT do cartório. Preste atenção nos pontos abordados — eles serão cobrados no quiz ao final do módulo.',
  },
  {
    chave: 'lgpd',
    titulo: 'LGPD – Proteção de Dados Pessoais',
    descricao: 'Tratamento de dados pessoais no cartório conforme a Lei Geral de Proteção de Dados.',
    conteudo: 'Assista ao vídeo abaixo sobre LGPD e o tratamento de dados pessoais no cartório. Preste atenção nos pontos abordados — eles serão cobrados no quiz ao final do módulo.',
  },
];

const TreinamentosOficiaisPanel: React.FC = () => {
  const [itensVideo, setItensVideo] = useState<{ id: string; titulo: string }[]>([]);
  const [itensRepo, setItensRepo] = useState<{ id: string; titulo: string; tipo: string }[]>([]);
  const [trilhasOficiaisExistentes, setTrilhasOficiaisExistentes] = useState<Set<string>>(new Set());
  const [buscas, setBuscas] = useState<Record<string, string>>({});
  const [selecionados, setSelecionados] = useState<Record<string, ItemMidia>>({});
  const [criando, setCriando] = useState<Record<string, boolean>>({});
  const [cargasHorarias, setCargasHorarias] = useState<Record<string, number>>({});

  useEffect(() => {
    const q1 = onSnapshot(collection(db, 'videos'), s => setItensVideo(s.docs.map(d => ({ id: d.id, titulo: d.data().titulo }))));
    const q2 = onSnapshot(collection(db, 'repositorio'), s => setItensRepo(s.docs.map(d => ({ id: d.id, titulo: d.data().titulo, tipo: d.data().tipo }))));
    const q3 = onSnapshot(query(collection(db, 'trilhas'), where('oficial', '==', true)), s =>
      setTrilhasOficiaisExistentes(new Set(s.docs.map(d => d.data().titulo)))
    );
    return () => { q1(); q2(); q3(); };
  }, []);

  const TIPO_REPO_LABEL: Record<string, string> = { youtube: 'Vídeo YouTube', audio: 'Áudio', mp4: 'Vídeo Drive' };
  const opcoes: ItemMidia[] = [
    ...itensVideo.map(v => ({ id: v.id, titulo: v.titulo, tipoConteudo: 'video' as const, label: 'Vídeo' })),
    ...itensRepo.map(r => ({ id: r.id, titulo: r.titulo, tipoConteudo: 'repositorio' as const, label: TIPO_REPO_LABEL[r.tipo] || 'Repositório' })),
  ];

  const criarTrilha = async (topico: Topico) => {
    const item = selecionados[topico.chave];
    if (!item) return;
    setCriando(prev => ({ ...prev, [topico.chave]: true }));
    try {
      await addDoc(collection(db, 'trilhas'), {
        titulo: topico.titulo,
        descricao: topico.descricao,
        perfis: ['colaborador', 'gestor', 'admin'],
        modulos: [{
          id: crypto.randomUUID(),
          titulo: topico.titulo,
          descricao: topico.descricao,
          tipo: 'obrigatorio',
          conteudo: topico.conteudo,
          temQuiz: true,
          notaMinima: 7,
          conteudoRef: { tipo: item.tipoConteudo, itemId: item.id },
        }],
        ativa: true,
        oficial: true,
        notificarEmail: false,
        instrutor: 'Mirian Jabur',
        cargaHoraria: cargasHorarias[topico.chave] || 1,
        tenantIds: ['GLOBAL'],
        createdAt: serverTimestamp(),
      });
    } finally {
      setCriando(prev => ({ ...prev, [topico.chave]: false }));
    }
  };

  return (
    <div className="p-12 min-h-full bg-slate-50 animate-in fade-in space-y-8 max-w-4xl">
      <header>
        <h2 className="text-4xl font-black text-navy italic uppercase tracking-tighter">
          Treinamentos <span className="text-blue-500">Oficiais</span>
        </h2>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2">
          Conteúdo pronto para publicar em todos os cartórios // MJ Consultoria Master
        </p>
      </header>

      <div className="bg-white border border-slate-200 rounded-[40px] p-10 space-y-6 shadow-lg">
      <div>
        <h3 className="text-navy font-bold uppercase text-sm italic">Treinamentos Oficiais Prontos</h3>
        <p className="text-[10px] text-slate-400 mt-2">
          <i className="fa-solid fa-circle-info mr-1"></i>
          Para cada tema, escolha o vídeo já cadastrado em Vídeos ou Repositório e clique em "Criar Trilha Oficial".
          A trilha é publicada globalmente (todos os cartórios), com quiz gerado automaticamente por IA quando o colaborador a faz.
        </p>
      </div>
      <div className="space-y-4">
        {TOPICOS.map(topico => {
          const jaCriada = trilhasOficiaisExistentes.has(topico.titulo);
          const busca = buscas[topico.chave] || '';
          const item = selecionados[topico.chave];
          const filtradas = opcoes.filter(o => !busca || o.titulo.toLowerCase().includes(busca.toLowerCase()));
          return (
            <div key={topico.chave} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-navy font-bold text-sm">{topico.titulo}</p>
                  <p className="text-[10px] text-slate-400">{topico.descricao}</p>
                </div>
                {jaCriada && (
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex-shrink-0">
                    <i className="fa-solid fa-circle-check mr-1"></i>Trilha criada
                  </span>
                )}
              </div>

              {!jaCriada && (
                <>
                  {item ? (
                    <div className="flex items-center gap-2 bg-white border border-amber-200 rounded-xl px-3 py-2">
                      <i className="fa-solid fa-link text-amber-500"></i>
                      <span className="text-xs text-navy font-bold flex-1">{item.titulo}</span>
                      <span className="text-[9px] font-black uppercase text-slate-400">{item.label}</span>
                      <button type="button" onClick={() => setSelecionados(prev => { const p = { ...prev }; delete p[topico.chave]; return p; })}
                        className="text-slate-400 hover:text-red-500"><i className="fa-solid fa-xmark"></i></button>
                    </div>
                  ) : (
                    <>
                      <input value={busca} onChange={e => setBuscas(prev => ({ ...prev, [topico.chave]: e.target.value }))}
                        placeholder="Buscar vídeo já cadastrado por título..."
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-navy outline-none focus:border-blue-500" />
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {filtradas.length === 0 && <p className="text-[10px] text-slate-400 p-2">Nenhum vídeo encontrado.</p>}
                        {filtradas.map(o => (
                          <button key={`${o.tipoConteudo}_${o.id}`} type="button"
                            onClick={() => setSelecionados(prev => ({ ...prev, [topico.chave]: o }))}
                            className="w-full text-left flex justify-between items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs hover:border-blue-400">
                            <span className="text-navy">{o.titulo}</span>
                            <span className="text-[9px] font-black uppercase text-slate-400 flex-shrink-0">{o.label}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <div className="flex items-center gap-2">
                    <label className="text-[9px] font-black uppercase text-slate-400 whitespace-nowrap">Carga horária</label>
                    <input type="number" min={1} step={0.5}
                      value={cargasHorarias[topico.chave] ?? 1}
                      onChange={e => setCargasHorarias(prev => ({ ...prev, [topico.chave]: Number(e.target.value) }))}
                      className="w-20 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-navy outline-none focus:border-blue-500" />
                    <span className="text-[9px] text-slate-400">horas</span>
                  </div>
                  <button type="button" onClick={() => criarTrilha(topico)} disabled={!item || criando[topico.chave]}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                    {criando[topico.chave] ? <><i className="fa-solid fa-circle-notch animate-spin mr-2"></i>Criando...</> : <><i className="fa-solid fa-plus mr-2"></i>Criar Trilha Oficial</>}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
};

export default TreinamentosOficiaisPanel;
