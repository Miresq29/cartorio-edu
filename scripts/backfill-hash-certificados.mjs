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

function gerarHashVerificacao(docId, colaboradorId, trilhaTitulo, notaFinal, tenantId) {
  const input = `${docId}|${colaboradorId}|${trilhaTitulo}|${notaFinal}|${tenantId}`;
  const hex = createHash('sha256').update(input).digest('hex').toUpperCase();
  const code = hex.slice(0, 16);
  return `MJ-${code.slice(0,4)}-${code.slice(4,8)}-${code.slice(8,12)}-${code.slice(12,16)}`;
}

const snap = await db.collection('certificados').get();
console.log(`Total certificados no sistema: ${snap.size}`);
let atualizados = 0;
for (const d of snap.docs) {
  const c = d.data();
  const novoCodigo = gerarHashVerificacao(d.id, c.colaboradorId, c.trilhaTitulo, c.notaFinal, c.tenantId);
  if (c.codigoVerificacao !== novoCodigo) {
    await d.ref.update({ codigoVerificacao: novoCodigo });
    atualizados++;
  }
}
console.log(`Codigos recalculados: ${atualizados}`);
