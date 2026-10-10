// Teste ponta a ponta do certificado modelo 2 no tenant isolado demo-turorial.
// Uso: node scripts/teste-certificado-v2.mjs listar | emitir <colaboradorId> | adulterar <codigo>
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { initializeApp as adminInit, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const __dirname = dirname(fileURLToPath(import.meta.url));
const key = JSON.parse(readFileSync(join(__dirname, 'key-cartorio-edu.json'), 'utf8'));
adminInit({ credential: cert(key) });
const adb = getFirestore();

const TENANT = 'demo-turorial';
const GESTOR = { email: 'gestor.tutorial2@jabur.net' };
const [acao, arg] = process.argv.slice(2);

async function clienteFirebase() {
  const req = createRequire(join(__dirname, '..', 'frontend', 'package.json'));
  const imp = (m) => import(pathToFileURL(req.resolve(m)).href);
  const { initializeApp } = await imp('firebase/app');
  const { getAuth, signInWithCustomToken, signOut } = await imp('firebase/auth');
  const { getFunctions, httpsCallable } = await imp('firebase/functions');
  const app = initializeApp({ apiKey: 'AIzaSyD7jXKOb1kmasmFppfT0PAto6FfsyEWfVw', authDomain: 'cartorio-edu.firebaseapp.com', projectId: 'cartorio-edu' });
  return { auth: getAuth(app), fns: getFunctions(app), signInWithCustomToken, signOut, httpsCallable };
}

if (acao === 'listar') {
  const s = await adb.collection('users').where('tenantId', '==', TENANT).get();
  s.docs.forEach(d => { const u = d.data(); console.log(d.id, '|', u.role, '|', u.name, '|', u.email, '| cpf:', !!u.cpf, '| cargo:', u.cargo || '-'); });
  const e = await adb.collection('examesResultados').where('tenantId', '==', TENANT).where('aprovado', '==', true).get();
  e.docs.forEach(d => { const x = d.data(); console.log('exame aprovado:', x.userId, '|', x.fonteTitulo, '|', x.score); });
} else if (acao === 'emitir') {
  const c = await clienteFirebase();
  // Custom token do próprio gestor de teste (a senha registrada mudou) — mesma identidade/role.
  const gestorUid = (await getAuth().getUserByEmail(GESTOR.email)).uid;
  await c.signInWithCustomToken(c.auth, await getAuth().createCustomToken(gestorUid));
  const titulo = process.argv[4] || 'Teste Certificado Modelo 2';
  const r = await c.httpsCallable(c.fns, 'emitirCertificadoManual')({ colaboradorId: arg, trilhaTitulo: titulo, tipo: 'exame', notaFinal: 90, cargaHoraria: 2 });
  console.log('emitir:', r.data);
  const doc = (await adb.collection('certificados').doc(r.data.codigoVerificacao).get()).data();
  console.log('doc:', JSON.stringify({ ...doc, cpf: doc.cpf ? '(preenchido)' : '' }, null, 2));
  await c.signOut(c.auth);
  const v = await c.httpsCallable(c.fns, 'verificarCertificado')({ codigo: r.data.codigoVerificacao.toLowerCase() });
  console.log('verificar (sem login):', JSON.stringify(v.data, null, 2));
  console.log('CPF vazou na verificação?', JSON.stringify(v.data).includes('cpf'));
} else if (acao === 'adulterar') {
  const c = await clienteFirebase();
  const ref = adb.collection('certificados').doc(arg);
  const original = (await ref.get()).data().notaFinal;
  await ref.update({ notaFinal: 100 });
  const v = await c.httpsCallable(c.fns, 'verificarCertificado')({ codigo: arg });
  console.log('após adulterar nota:', v.data);
  await ref.update({ notaFinal: original });
  const v2 = await c.httpsCallable(c.fns, 'verificarCertificado')({ codigo: arg });
  console.log('após restaurar:', v2.data.valido);
  const inex = await c.httpsCallable(c.fns, 'verificarCertificado')({ codigo: 'MJ-0000-0000-0000-0000' });
  console.log('código inexistente:', inex.data);
}
process.exit(0);
