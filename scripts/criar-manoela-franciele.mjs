import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const __dirname = dirname(fileURLToPath(import.meta.url));
const key = JSON.parse(readFileSync(join(__dirname, 'key-cartorio-edu.json'), 'utf8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();
const auth = getAuth();

const TENANT_ID = 'teixeira';
const SENHA_PROVISORIA = 'Teixeira@2026!';
const NOVOS = [
  { nome: 'Manoela Ferreira Braga', email: 'manoela.critxf@gmail.com' },
  { nome: 'Franciele Pereira Ribeiro', email: 'franciele.critxf@gmail.com' },
];

async function main() {
  for (const { nome, email } of NOVOS) {
    let userRecord;
    try {
      userRecord = await auth.createUser({ email, password: SENHA_PROVISORIA, displayName: nome });
      console.log(`Auth criado: ${nome} -> ${userRecord.uid}`);
    } catch (e) {
      if (e.code === 'auth/email-already-exists') {
        userRecord = await auth.getUserByEmail(email);
        await auth.updateUser(userRecord.uid, { password: SENHA_PROVISORIA, displayName: nome });
        console.log(`Já existia, senha redefinida: ${nome} -> ${userRecord.uid}`);
      } else { throw e; }
    }
    await db.collection('users').doc(userRecord.uid).set({
      name: nome,
      email,
      role: 'colaborador',
      cargo: '',
      tenantId: TENANT_ID,
      active: true,
      ativo: true,
      isFirstLogin: true,
      mustChangePassword: true,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: 'script:criar-manoela-franciele',
    });
    console.log(`  users/${userRecord.uid} gravado (role=colaborador, tenantId=${TENANT_ID})`);
  }
  console.log(`\nSenha provisória para ambas: ${SENHA_PROVISORIA}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
