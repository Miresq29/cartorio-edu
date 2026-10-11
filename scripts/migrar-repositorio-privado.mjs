// Move driveId/driveUrl de repositorio/{id} (legível por todo o tenant) para
// repositorioPrivado/{id} (só gestão; o colaborador recebe o player pela function abrirMidia).
// Uso: node scripts/migrar-repositorio-privado.mjs [--aplicar]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
initializeApp({ credential: cert(JSON.parse(readFileSync(join(__dirname, 'key-cartorio-edu.json'), 'utf8'))) });
const db = getFirestore();
const aplicar = process.argv.includes('--aplicar');

const snap = await db.collection('repositorio').get();
const alvos = snap.docs.filter(d => d.data().driveId !== undefined || d.data().driveUrl !== undefined);
console.log(`${snap.size} itens no Repositório; ${alvos.length} com driveId/driveUrl no doc público. Modo: ${aplicar ? 'APLICAR' : 'simulação'}`);

let migrados = 0;
for (const d of alvos) {
  const { driveId = '', driveUrl = '', tenantIds = [] } = d.data();
  if (!aplicar) continue;
  const batch = db.batch();
  batch.set(db.collection('repositorioPrivado').doc(d.id), { driveId, driveUrl, tenantIds }, { merge: true });
  batch.update(d.ref, { driveId: FieldValue.delete(), driveUrl: FieldValue.delete() });
  await batch.commit();
  migrados++;
}
const restantes = aplicar
  ? (await db.collection('repositorio').get()).docs.filter(d => d.data().driveId !== undefined || d.data().driveUrl !== undefined).length
  : alvos.length;
const privados = (await db.collection('repositorioPrivado').count().get()).data().count;
console.log(`migrados: ${migrados} | ainda com driveId no doc público: ${restantes} | docs em repositorioPrivado: ${privados}`);
process.exit(0);
