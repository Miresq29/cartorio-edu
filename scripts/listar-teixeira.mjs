import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const key = JSON.parse(readFileSync(join(__dirname, 'key-cartorio-edu.json'), 'utf8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();

const snap = await db.collection('users').where('tenantId', '==', 'teixeira').get();
const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
users.sort((a,b) => (a.name||'').localeCompare(b.name||''));
users.forEach(u => console.log(JSON.stringify({ id: u.id, name: u.name, email: u.email, role: u.role })));
console.log('TOTAL:', users.length);
process.exit(0);
