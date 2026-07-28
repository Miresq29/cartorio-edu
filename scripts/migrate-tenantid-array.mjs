// Migracao unica: converte o campo escalar tenantId (string) para tenantIds (array)
// nas 9 colecoes de conteudo compartilhavel entre cartorios. Ver plano de
// "Visibilidade multi-cartorio" na sessao. Idempotente: docs que ja tem
// tenantIds sao pulados.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const key = JSON.parse(readFileSync('./key-cartorio-edu.json', 'utf8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();

const COLECOES = [
  'trilhas', 'repositorio', 'knowledgeBase', 'comunicados',
  'checklists', 'videos', 'materiaisbanner', 'treinamentos', 'treinamentosQuizzes',
];

async function migrarColecao(col) {
  const snap = await db.collection(col).get();
  let migrados = 0, pulados = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (Array.isArray(data.tenantIds)) { pulados++; continue; }
    const valorAntigo = typeof data.tenantId === 'string' && data.tenantId.trim() ? data.tenantId : 'GLOBAL';
    await doc.ref.update({
      tenantIds: [valorAntigo],
      tenantId: FieldValue.delete(),
    });
    migrados++;
  }
  console.log(`${col}: ${migrados} migrados, ${pulados} ja migrados (${snap.size} total)`);
}

async function main() {
  for (const col of COLECOES) await migrarColecao(col);
  console.log('\nMigracao concluida.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
