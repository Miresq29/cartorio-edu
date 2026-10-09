import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const key = JSON.parse(readFileSync(join(__dirname, 'key-cartorio-edu.json'), 'utf8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();

const usersSnap = await db.collection('users').where('tenantId', '==', 'teixeira').get();
const nomeAtualPorId = new Map(usersSnap.docs.map(d => [d.id, d.data().name]));

async function backfillColecao(nomeColecao, campoNome = 'userName') {
  const snap = await db.collection(nomeColecao).where('tenantId', '==', 'teixeira').get();
  let atualizados = 0;
  const batchSize = 400;
  let batch = db.batch();
  let count = 0;
  for (const d of snap.docs) {
    const data = d.data();
    const nomeAtual = nomeAtualPorId.get(data.userId);
    if (nomeAtual && data[campoNome] !== undefined && data[campoNome] !== nomeAtual) {
      batch.update(d.ref, { [campoNome]: nomeAtual });
      atualizados++;
      count++;
      if (count >= batchSize) { await batch.commit(); batch = db.batch(); count = 0; }
    }
  }
  if (count > 0) await batch.commit();
  console.log(`${nomeColecao}.${campoNome}: ${atualizados} documentos atualizados (de ${snap.size} total)`);
}

await backfillColecao('trilhasProgresso', 'userName');
await backfillColecao('treinamentosQuizResults', 'colaborador');
