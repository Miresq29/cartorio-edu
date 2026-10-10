import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const key = JSON.parse(readFileSync(join(__dirname, 'key-cartorio-edu.json'), 'utf8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();

// Migra tenantIds:['GLOBAL'] (ou contendo 'GLOBAL') para a lista explicita de todos os
// tenants que existem HOJE — preserva o acesso de quem ja usa esse conteudo, mas um
// cliente criado depois dessa migracao nao herda mais nada automaticamente.
const tenantsSnap = await db.collection('tenants').get();
const todosTenantIds = tenantsSnap.docs.map(d => d.id);
console.log(`Tenants atuais (${todosTenantIds.length}):`, todosTenantIds.join(', '));

const COLECOES = [
  'treinamentos', 'treinamentosQuizzes', 'trilhas', 'knowledgeBase',
  'checklists', 'videos', 'materiaisbanner', 'comunicados',
  'simulacoesPhishing', 'repositorio',
];

let totalMigrados = 0;
for (const nomeColecao of COLECOES) {
  const snap = await db.collection(nomeColecao).where('tenantIds', 'array-contains', 'GLOBAL').get();
  if (snap.empty) { console.log(`${nomeColecao}: nenhum documento com GLOBAL.`); continue; }

  let batch = db.batch();
  let count = 0;
  for (const d of snap.docs) {
    const atual = d.data().tenantIds || [];
    // Preserva outros tenants especificos que porventura ja estivessem junto do GLOBAL
    // (incomum, mas nao custa), unindo com a lista completa atual.
    const novoSet = new Set([...atual.filter(t => t !== 'GLOBAL'), ...todosTenantIds]);
    batch.update(d.ref, { tenantIds: [...novoSet] });
    count++;
    if (count >= 400) { await batch.commit(); batch = db.batch(); count = 0; }
  }
  if (count > 0) await batch.commit();
  console.log(`${nomeColecao}: ${snap.size} documento(s) migrado(s) de GLOBAL para lista explicita.`);
  totalMigrados += snap.size;
}

console.log(`\nTotal migrado: ${totalMigrados} documentos.`);
