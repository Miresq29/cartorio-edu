import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const key = JSON.parse(readFileSync(join(__dirname, 'key-cartorio-edu.json'), 'utf8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();

const TENANT_ID = 'teixeira';

const usersSnap = await db.collection('users').where('tenantId', '==', TENANT_ID).get();
const usersById = new Map(usersSnap.docs.map(d => [d.id, d.data()]));

const tenantSnap = await db.collection('tenants').doc(TENANT_ID).get();
const cartorioNome = tenantSnap.data()?.name || TENANT_ID;

const trilhasSnap = await db.collection('trilhas').where('tenantIds', 'array-contains-any', [TENANT_ID, 'GLOBAL']).get();
const trilhaPorTitulo = new Map(trilhasSnap.docs.map(d => [d.data().titulo, { id: d.id, ...d.data() }]));

const examesSnap = await db.collection('examesResultados').where('tenantId', '==', TENANT_ID).where('aprovado', '==', true).get();
const certsSnap = await db.collection('certificados').where('tenantId', '==', TENANT_ID).get();

const certsExistentes = new Set(
  certsSnap.docs.map(d => `${d.data().colaboradorId}__${d.data().trilhaTitulo}`)
);

// Melhor tentativa aprovada por (userId, fonteTitulo) — maior nota, mais recente em empate
const melhorPorPar = new Map();
examesSnap.docs.forEach(d => {
  const e = d.data();
  const key = `${e.userId}__${e.fonteTitulo}`;
  const atual = melhorPorPar.get(key);
  if (!atual || e.score > atual.score) melhorPorPar.set(key, e);
});

let criados = 0, pulados = 0;
const gerarCodigo = () => `MJ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

for (const [key, e] of melhorPorPar) {
  const dedupeKey = `${e.userId}__${e.fonteTitulo}`;
  if (certsExistentes.has(dedupeKey)) { pulados++; continue; }
  const u = usersById.get(e.userId);
  if (!u) { pulados++; continue; }

  const trilhaRef = trilhaPorTitulo.get(e.fonteTitulo);
  const instrutor = trilhaRef?.oficial ? 'Mirian Jabur' : (trilhaRef?.instrutor || 'Mirian Jabur');
  const cargaHoraria = Math.max(1, trilhaRef?.cargaHoraria || 1);
  const validoAte = new Date();
  validoAte.setFullYear(validoAte.getFullYear() + 1);

  await db.collection('certificados').add({
    colaboradorId: e.userId,
    colaboradorNome: u.name,
    cargo: u.cargo || u.role || '',
    cartorio: cartorioNome,
    trilhaTitulo: e.fonteTitulo,
    tipo: 'exame',
    notaFinal: e.score,
    cargaHoraria,
    instrutor,
    codigoVerificacao: gerarCodigo(),
    emitidoEm: FieldValue.serverTimestamp(),
    emitidoPor: 'script:emitir-certificados-teixeira',
    tenantId: TENANT_ID,
    validoAte: validoAte.toISOString().slice(0, 10),
  });
  certsExistentes.add(dedupeKey);
  criados++;
}

console.log(`Certificados criados: ${criados} | pulados (ja existiam ou usuario nao encontrado): ${pulados}`);
