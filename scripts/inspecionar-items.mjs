import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const key = JSON.parse(readFileSync(join(__dirname, 'key-cartorio-edu.json'), 'utf8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();

for (const id of ['DefPPAihDlTNiejja2jp', 'ECDxI5XBal7E0yfGz7UH']) {
  const d = await db.collection('repositorio').doc(id).get();
  console.log(id, '->', JSON.stringify(d.data()));
}
