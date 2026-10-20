// Migração única — tira o gabarito (correta/explicacao) de dentro de treinamentosQuizzes, que
// todo colaborador do cliente lê, e o move para treinamentosQuizzesGabarito/{mesmo id} (sem acesso
// pelo cliente). Também grava acertos[] nos resultados antigos, que o painel de dificuldade usa.
// Rodar a partir da raiz:  node scripts/separar-gabarito-quizzes.mjs [--aplicar]
// Sem --aplicar só mostra o que faria.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const key = JSON.parse(readFileSync('./key-cartorio-edu.json', 'utf8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();
const APLICAR = process.argv.includes('--aplicar');

async function main() {
  const quizzes = await db.collection('treinamentosQuizzes').get();
  let migrados = 0, resultadosAtualizados = 0;

  for (const doc of quizzes.docs) {
    const quiz = doc.data();
    const questoes = quiz.questoes || [];
    if (!questoes.some(q => 'correta' in q || 'explicacao' in q)) continue;

    const gabarito = questoes.map(q => ({ correta: Number(q.correta), explicacao: String(q.explicacao || '') }));
    const resultados = await db.collection('treinamentosQuizResults').where('quizId', '==', doc.id).get();
    const semAcertos = resultados.docs.filter(r => !Array.isArray(r.data().acertos));
    console.log(`${doc.id} "${quiz.titulo}": ${questoes.length} questões, ${semAcertos.length} resultado(s) sem acertos[]`);
    migrados++;
    resultadosAtualizados += semAcertos.length;
    if (!APLICAR) continue;

    const batch = db.batch();
    // Grava o gabarito separado antes de limpar o doc — submeterQuizTreinamento prefere ele.
    batch.set(db.collection('treinamentosQuizzesGabarito').doc(doc.id), { questoes: gabarito, tenantIds: quiz.tenantIds || [] });
    for (const r of semAcertos) {
      const resps = r.data().respostas || [];
      batch.update(r.ref, { acertos: gabarito.map((g, i) => Number(resps[i]) === g.correta) });
    }
    batch.update(doc.ref, { questoes: questoes.map(({ correta, explicacao, ...resto }) => resto) });
    await batch.commit();
  }

  console.log(`\n${migrados} quiz(zes), ${resultadosAtualizados} resultado(s). ${APLICAR ? 'Aplicado.' : 'Simulação — rode com --aplicar.'}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
