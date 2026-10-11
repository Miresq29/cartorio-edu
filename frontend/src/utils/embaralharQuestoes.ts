// A IA tende a pôr a resposta certa nas primeiras alternativas — toda questão gerada passa por
// aqui antes de ser usada/gravada, pra a posição da correta ficar aleatória. (Os Exames fazem
// o mesmo no servidor, em functions/src/index.ts → embaralharAlternativas.)

// Número de questões padrão de toda avaliação gerada por IA na plataforma.
export const QUESTOES_POR_AVALIACAO = 7;

function indiceAleatorio(max: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}

function embaralhar<T>(itens: T[]): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = indiceAleatorio(i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F'];

// Formato com letras: { alternativas: [{ letra, texto }], correta: 'A' }
export function embaralharPorLetra<Q extends { alternativas: { letra: string; texto: string }[]; correta: string }>(q: Q): Q {
  const itens = embaralhar(q.alternativas.map(a => ({ texto: a.texto, correta: a.letra === q.correta })));
  return {
    ...q,
    alternativas: itens.map((a, i) => ({ letra: LETRAS[i], texto: a.texto })),
    correta: LETRAS[itens.findIndex(a => a.correta)] ?? q.correta,
  };
}

// Formato com índice: { opcoes: string[], correta: 0 }
export function embaralharPorIndice<Q extends { opcoes: string[]; correta: number }>(q: Q): Q {
  const itens = embaralhar(q.opcoes.map((texto, i) => ({ texto, correta: i === Number(q.correta) })));
  return { ...q, opcoes: itens.map(a => a.texto), correta: itens.findIndex(a => a.correta) };
}

// Instrução comum a todos os prompts — a justificativa não pode citar letra, já que a ordem muda.
export const INSTRUCAO_JUSTIFICATIVA_SEM_LETRA =
  'Na justificativa/explicação, NÃO cite letras ou posições de alternativas (a ordem será embaralhada) — explique pelo conteúdo.';
