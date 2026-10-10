import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const key = JSON.parse(readFileSync(join(__dirname, 'key-cartorio-edu.json'), 'utf8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();

const COLECOES = ['trilhas', 'repositorio'];
let total = 0;
for (const nomeColecao of COLECOES) {
  const snap = await db.collection(nomeColecao).where('tenantIds', 'array-contains', 'truebrands').get();
  for (const d of snap.docs) {
    const atual = d.data().tenantIds || [];
    await d.ref.update({ tenantIds: atual.filter(t => t !== 'truebrands') });
    console.log(`${nomeColecao}/${d.id} ("${d.data().titulo}"): removido truebrands`);
    total++;
  }
}
console.log(`\nTotal corrigido: ${total}`);
