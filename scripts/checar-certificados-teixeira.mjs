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

const certsSnap = await db.collection('certificados').where('tenantId', '==', 'teixeira').get();
console.log(`Total certificados teixeira: ${certsSnap.size}`);
let semId = 0, comId = 0, idDesatualizado = 0;
certsSnap.docs.forEach(d => {
  const c = d.data();
  if (!c.colaboradorId) { semId++; console.log(`  SEM colaboradorId: "${c.colaboradorNome}" (${d.id})`); return; }
  comId++;
  const userAtual = usersById.get(c.colaboradorId);
  if (userAtual && userAtual.name !== c.colaboradorNome) {
    idDesatualizado++;
    console.log(`  nome desatualizado: cert diz "${c.colaboradorNome}", usuario atual é "${userAtual.name}" (colaboradorId=${c.colaboradorId}) -> OK pois filtro agora usa ID`);
  }
});
console.log(`\nCom colaboradorId: ${comId} | Sem colaboradorId: ${semId} | Nome desatualizado (mas ID ok): ${idDesatualizado}`);
