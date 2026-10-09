// Cria o tenant "True Brands" (empresa) + usuário gestor José Oliveira.
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

const TENANT_ID = 'truebrands';
const TENANT_NAME = 'True Brands';
const GESTOR_NOME = 'José Oliveira';
const GESTOR_EMAIL = 'jose.oliveira@vivatrue.com.br';
const SENHA_PROVISORIA = 'TrueBrands@2026!';

async function main() {
  const tenantRef = db.collection('tenants').doc(TENANT_ID);
  const tenantSnap = await tenantRef.get();
  if (tenantSnap.exists) {
    console.log(`Tenant "${TENANT_ID}" já existe, pulando criação.`);
  } else {
    await tenantRef.set({
      name: TENANT_NAME,
      tipoOrganizacao: 'empresa',
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: 'script:criar-tenant-truebrands',
    });
    console.log(`Tenant "${TENANT_ID}" (${TENANT_NAME}) criado.`);
  }

  let userRecord;
  try {
    userRecord = await auth.createUser({
      email: GESTOR_EMAIL,
      password: SENHA_PROVISORIA,
      displayName: GESTOR_NOME,
    });
    console.log(`Usuário Auth criado: ${userRecord.uid}`);
  } catch (e) {
    if (e.code === 'auth/email-already-exists') {
      userRecord = await auth.getUserByEmail(GESTOR_EMAIL);
      await auth.updateUser(userRecord.uid, { password: SENHA_PROVISORIA, displayName: GESTOR_NOME });
      console.log(`E-mail já existia — senha redefinida. uid: ${userRecord.uid}`);
    } else {
      throw e;
    }
  }

  await db.collection('users').doc(userRecord.uid).set({
    name: GESTOR_NOME,
    email: GESTOR_EMAIL,
    role: 'gestor',
    cargo: 'Gestor',
    tenantId: TENANT_ID,
    active: true,
    ativo: true,
    isFirstLogin: true,
    mustChangePassword: true,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: 'script:criar-tenant-truebrands',
  });
  console.log(`Documento users/${userRecord.uid} gravado com role=gestor, tenantId=${TENANT_ID}.`);
  console.log(`\nLogin: ${GESTOR_EMAIL}\nSenha provisória: ${SENHA_PROVISORIA} (troca obrigatória no 1º login)`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
