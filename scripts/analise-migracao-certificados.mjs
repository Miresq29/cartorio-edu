// Somente leitura: mede o que seria preciso para migrar certificados modelo 1 -> modelo 2.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const key = JSON.parse(readFileSync(join(__dirname, 'key-cartorio-edu.json'), 'utf8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();

function hashV1(docId, colaboradorId, trilhaTitulo, notaFinal, tenantId) {
  const hex = createHash('sha256').update(`${docId}|${colaboradorId}|${trilhaTitulo}|${notaFinal}|${tenantId}`).digest('hex').toUpperCase();
  const c = hex.slice(0, 16);
  return `MJ-${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}-${c.slice(12, 16)}`;
}

const snap = await db.collection('certificados').get();
const v1 = snap.docs.filter(d => (d.data().versaoModelo || 1) < 2);
console.log(`Total: ${snap.size} | modelo 1: ${v1.length} | modelo 2: ${snap.size - v1.length}`);

const stats = { semCodigo: 0, hashNaoConfere: 0, colisaoId: 0, semUser: 0, semTenant: 0, semTrilha: 0, semExame: 0, porTipo: {}, porTenant: {}, chavesCampos: {} };
const grupos = {};
const users = new Map(), tenants = new Map(), trilhas = new Map();
async function cached(map, col, id) {
  if (!map.has(id)) { const s = await db.collection(col).doc(id).get(); map.set(id, s.exists ? s.data() : null); }
  return map.get(id);
}

for (const d of v1) {
  const c = d.data();
  for (const k of Object.keys(c)) stats.chavesCampos[k] = (stats.chavesCampos[k] || 0) + 1;
  stats.porTipo[c.tipo || '(sem)'] = (stats.porTipo[c.tipo || '(sem)'] || 0) + 1;
  stats.porTenant[c.tenantId || '(sem)'] = (stats.porTenant[c.tenantId || '(sem)'] || 0) + 1;
  if (!c.codigoVerificacao) stats.semCodigo++;
  else {
    if (hashV1(d.id, c.colaboradorId, c.trilhaTitulo, c.notaFinal, c.tenantId) !== c.codigoVerificacao) stats.hashNaoConfere++;
    if (c.codigoVerificacao !== d.id && (await db.collection('certificados').doc(c.codigoVerificacao).get()).exists) stats.colisaoId++;
  }
  if (!(await cached(users, 'users', c.colaboradorId || '_'))) stats.semUser++;
  if (!(await cached(tenants, 'tenants', c.tenantId || '_'))) stats.semTenant++;
  if (!trilhas.has(c.trilhaTitulo)) {
    const t = await db.collection('trilhas').where('titulo', '==', c.trilhaTitulo || '').limit(1).get();
    trilhas.set(c.trilhaTitulo, t.empty ? null : t.docs[0].data());
  }
  if (!trilhas.get(c.trilhaTitulo)) stats.semTrilha++;
  if (c.tipo === 'exame') {
    const e = await db.collection('examesResultados').where('userId', '==', c.colaboradorId || '_').where('fonteTitulo', '==', c.trilhaTitulo || '').limit(1).get();
    if (e.empty) stats.semExame++;
  }
  const g = `${c.tenantId}|${c.colaboradorId}|${c.trilhaTitulo}|${c.tipo}|${c.moduloTitulo || ''}`;
  grupos[g] = (grupos[g] || 0) + 1;
}

const duplicados = Object.values(grupos).filter(n => n > 1).length;
console.log(JSON.stringify({ ...stats, gruposDuplicados: duplicados }, null, 2));
console.log('Amostra modelo 1:', JSON.stringify(v1.slice(0, 2).map(d => ({ id: d.id, ...d.data(), cpf: undefined })), null, 2));
process.exit(0);
