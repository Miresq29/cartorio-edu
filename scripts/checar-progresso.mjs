import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const key = JSON.parse(readFileSync(join(__dirname, 'key-cartorio-edu.json'), 'utf8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();

for (const col of ['repositorioProgresso', 'videosProgresso']) {
  const snap = await db.collection(col).limit(3).get();
  console.log(`\n${col}: ${snap.size} amostras (de um total desconhecido)`);
  snap.docs.forEach(d => console.log(' ', d.id, '->', JSON.stringify(d.data())));
  const full = await db.collection(col).count().get();
  console.log(`  total real: ${full.data().count}`);
}
