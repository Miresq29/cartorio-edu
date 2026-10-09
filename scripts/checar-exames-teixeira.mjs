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
const usersById = new Map(usersSnap.docs.map(d => [d.id, d.data()]));

const examesSnap = await db.collection('examesResultados').where('tenantId', '==', 'teixeira').get();
console.log(`Total examesResultados teixeira: ${examesSnap.size}`);
examesSnap.docs.forEach(d => {
  const e = d.data();
  const u = usersById.get(e.userId);
  console.log(`  ${u ? u.name : '??(' + e.userId + ')'} -> fonte="${e.fonteTitulo}" aprovado=${e.aprovado} score=${e.score}`);
});

const trilhasProgSnap = await db.collection('trilhasProgresso').where('tenantId', '==', 'teixeira').get();
console.log(`\nTotal trilhasProgresso teixeira: ${trilhasProgSnap.size}`);
trilhasProgSnap.docs.forEach(d => {
  const p = d.data();
  console.log(`  userId=${p.userId} userName="${p.userName}" trilha="${p.trilhaTitulo}" concluida=${p.concluida} pct=${p.percentualObrigatorios}`);
});
