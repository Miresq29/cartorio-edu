import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const key = JSON.parse(readFileSync(join(__dirname, 'key-cartorio-edu.json'), 'utf8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();

const snap = await db.collection('repositorio').where('tenantIds', 'array-contains-any', ['truebrands', 'GLOBAL']).get();
snap.docs.forEach(d => {
  const r = d.data();
  console.log(d.id, '|', r.titulo, '| tenantIds=', JSON.stringify(r.tenantIds), '| criadoPor=', r.criadoPor, '| createdAt=', r.createdAt?.toDate?.());
});
console.log('TOTAL:', snap.size);
