import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const key = JSON.parse(readFileSync(join(__dirname, 'key-cartorio-edu.json'), 'utf8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();

const snap = await db.collection('certificados').where('tenantId', '==', 'teixeira').get();
console.log('Total certificados teixeira agora:', snap.size);
const porColab = new Map();
snap.docs.forEach(d => { const c = d.data(); porColab.set(c.colaboradorNome, (porColab.get(c.colaboradorNome)||0)+1); });
[...porColab.entries()].sort((a,b)=>b[1]-a[1]).forEach(([nome,n]) => console.log(` ${nome}: ${n}`));
