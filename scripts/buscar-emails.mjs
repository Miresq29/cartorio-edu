import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const __dirname = dirname(fileURLToPath(import.meta.url));
const key = JSON.parse(readFileSync(join(__dirname, 'key-cartorio-edu.json'), 'utf8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();
const auth = getAuth();

const emails = ['manoela.critxf@gmail.com', 'franciele.critxf@gmail.com'];
for (const email of emails) {
  console.log('---', email);
  try {
    const u = await auth.getUserByEmail(email);
    console.log('Auth uid:', u.uid);
    const doc = await db.collection('users').doc(u.uid).get();
    console.log('Firestore doc:', doc.exists ? JSON.stringify(doc.data()) : '(nao existe doc em users/)');
  } catch (e) {
    console.log('Nao encontrado no Auth:', e.message);
  }
}
process.exit(0);
