import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const key = JSON.parse(readFileSync(join(__dirname, 'key-cartorio-edu.json'), 'utf8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();

const COLECOES = ['treinamentos','treinamentosQuizzes','trilhas','knowledgeBase','checklists','videos','materiaisbanner','comunicados','simulacoesPhishing','repositorio'];
let achou = false;
for (const c of COLECOES) {
  const snap = await db.collection(c).where('tenantIds', 'array-contains', 'GLOBAL').get();
  if (!snap.empty) { achou = true; console.log(`${c}: AINDA TEM ${snap.size} com GLOBAL`); }
}
if (!achou) console.log('Confirmado: nenhuma colecao tem mais tenantIds com GLOBAL.');
