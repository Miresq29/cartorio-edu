// Move users/{uid}.passwordHistory (SHA-256 + sal fixo, legível pelos colegas do tenant) para
// senhasHistorico/{uid} (sem acesso pelo cliente) como entradas "legado-sha256", e apaga o
// campo do cadastro. Uso: node scripts/migrar-historico-senhas.mjs [--aplicar]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
initializeApp({ credential: cert(JSON.parse(readFileSync(join(__dirname, 'key-cartorio-edu.json'), 'utf8'))) });
const db = getFirestore();
const aplicar = process.argv.includes('--aplicar');

const users = await db.collection('users').get();
const alvos = users.docs.filter(d => d.data().passwordHistory !== undefined);
console.log(`${users.size} usuários; ${alvos.length} com passwordHistory no cadastro. Modo: ${aplicar ? 'APLICAR' : 'simulação'}`);

let migrados = 0;
for (const d of alvos) {
  const antigos = (d.data().passwordHistory || []).filter(h => typeof h === 'string' && /^[0-9a-f]{64}$/.test(h));
  if (!aplicar) continue;
  const histRef = db.collection('senhasHistorico').doc(d.id);
  await db.runTransaction(async (tx) => {
    const atuais = (await tx.get(histRef)).data()?.entradas || [];
    const legados = antigos.map(hash => ({ tipo: 'legado-sha256', hash }));
    // legados primeiro (são mais antigos), depois o que já estiver no novo formato
    tx.set(histRef, { entradas: [...legados, ...atuais].slice(-3), atualizadoEm: FieldValue.serverTimestamp() });
    tx.update(d.ref, { passwordHistory: FieldValue.delete() });
  });
  migrados++;
}
const restantes = aplicar ? (await db.collection('users').get()).docs.filter(d => d.data().passwordHistory !== undefined).length : alvos.length;
console.log(`migrados: ${migrados} | cadastros ainda com passwordHistory: ${restantes}`);
process.exit(0);
