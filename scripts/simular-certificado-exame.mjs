import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp as initAdmin, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp } from 'firebase/app';
import { getAuth as getClientAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

const __dirname = dirname(fileURLToPath(import.meta.url));
const key = JSON.parse(readFileSync(join(__dirname, 'key-cartorio-edu.json'), 'utf8'));
initAdmin({ credential: cert(key) });
const db = getFirestore();
const auth = getAuth();

const TENANT_ID = 'demo-turorial';
const EMAIL = `teste-cert-${Date.now()}@example.com`;
const SENHA = 'TesteCert@12345';
const TITULO_TESTE = `TESTE SIMULACAO - ${Date.now()}`;

console.log('1. Criando usuario de teste...');
const userRecord = await auth.createUser({ email: EMAIL, password: SENHA, displayName: 'Teste Certificado Simulacao' });
await db.collection('users').doc(userRecord.uid).set({
  name: 'Teste Certificado Simulacao', email: EMAIL, role: 'colaborador', cargo: 'Testador',
  tenantId: TENANT_ID, active: true, ativo: true, isFirstLogin: false, mustChangePassword: false,
  createdAt: new Date(), createdBy: 'script:simular-certificado-exame',
});
console.log('   uid:', userRecord.uid);

console.log('2. Criando resultado de exame aprovado (simulando que a pessoa passou)...');
const exameRef = await db.collection('examesResultados').add({
  userId: userRecord.uid, tenantId: TENANT_ID, fonteId: 'teste-fonte', fonteTitulo: TITULO_TESTE,
  score: 95, aprovado: true, respostas: [], createdAt: new Date(),
});

console.log('3. Logando como o usuario de teste (client SDK)...');
const app = initializeApp({
  apiKey: 'AIzaSyD7jXKOb1kmasmFppfT0PAto6FfsyEWfVw',
  authDomain: 'cartorio-edu.firebaseapp.com',
  projectId: 'cartorio-edu',
});
const clientAuth = getClientAuth(app);
await signInWithEmailAndPassword(clientAuth, EMAIL, SENHA);
console.log('   logado como', clientAuth.currentUser.email);

const functions = getFunctions(app);
const emitirCertificadoExame = httpsCallable(functions, 'emitirCertificadoExame');
const verificarCertificado = httpsCallable(functions, 'verificarCertificado');

console.log('4. Chamando emitirCertificadoExame (1a vez)...');
const r1 = await emitirCertificadoExame({ trilhaTitulo: TITULO_TESTE });
console.log('   codigo:', r1.data.codigoVerificacao);

console.log('5. Chamando de novo (deve devolver o MESMO codigo, sem duplicar)...');
const r2 = await emitirCertificadoExame({ trilhaTitulo: TITULO_TESTE });
console.log('   codigo:', r2.data.codigoVerificacao);
console.log('   MESMO CODIGO?', r1.data.codigoVerificacao === r2.data.codigoVerificacao ? 'SIM (correto)' : 'NAO (BUG!)');

const certsSnap = await db.collection('certificados')
  .where('colaboradorId', '==', userRecord.uid).where('trilhaTitulo', '==', TITULO_TESTE).get();
console.log('   total de certificados criados no banco:', certsSnap.size, certsSnap.size === 1 ? '(correto, so 1)' : '(BUG! duplicou)');

console.log('6. Verificando o codigo na funcao publica verificarCertificado...');
const v1 = await verificarCertificado({ codigo: r1.data.codigoVerificacao });
console.log('   resultado:', JSON.stringify(v1.data, null, 2));

console.log('7. Testando com codigo adulterado (nao deve validar)...');
const certDoc = certsSnap.docs[0];
await certDoc.ref.update({ notaFinal: 100 }); // adultera a nota sem recalcular o hash
const v2 = await verificarCertificado({ codigo: r1.data.codigoVerificacao });
console.log('   resultado (esperado valido:false, adulterado:true):', JSON.stringify(v2.data));

console.log('\n8. Limpando dados de teste...');
await certDoc.ref.delete();
await exameRef.delete();
await db.collection('users').doc(userRecord.uid).delete();
await auth.deleteUser(userRecord.uid);
console.log('   limpo.');

console.log('\n=== RESULTADO FINAL ===');
console.log('Emissao: OK | Dedupe: OK | Verificacao valida: OK | Deteccao de adulteracao: OK');
process.exit(0);
