import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const key = JSON.parse(readFileSync(join(__dirname, 'key-cartorio-edu.json'), 'utf8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();

const usersSnap = await db.collection('users').get();
const nomeAtualPorId = new Map(usersSnap.docs.map(d => [d.id, d.data().name]));
console.log(`Total usuarios no sistema: ${usersSnap.size}`);

async function checarColecao(nomeColecao, campoNome) {
  const snap = await db.collection(nomeColecao).get();
  const porTenant = new Map();
  snap.docs.forEach(d => {
    const data = d.data();
    const nomeAtual = nomeAtualPorId.get(data.userId);
    if (nomeAtual && data[campoNome] !== undefined && data[campoNome] !== nomeAtual) {
      const tid = data.tenantId || '(sem tenantId)';
      if (!porTenant.has(tid)) porTenant.set(tid, []);
      porTenant.get(tid).push({ userId: data.userId, antigo: data[campoNome], atual: nomeAtual, doc: d.id });
    }
  });
  console.log(`\n=== ${nomeColecao}.${campoNome}: ${snap.size} docs totais ===`);
  if (porTenant.size === 0) { console.log('  Nenhuma divergencia encontrada.'); return; }
  for (const [tid, items] of porTenant) {
    console.log(`  Tenant "${tid}": ${items.length} docs desatualizados`);
    const porUser = new Map();
    items.forEach(i => porUser.set(i.userId, i.atual + ' (era "' + i.antigo + '")'));
    [...porUser.entries()].forEach(([uid, info]) => console.log(`    ${uid}: ${info}`));
  }
}

await checarColecao('trilhasProgresso', 'userName');
await checarColecao('treinamentosQuizResults', 'colaborador');
await checarColecao('certificados', 'colaboradorNome');
