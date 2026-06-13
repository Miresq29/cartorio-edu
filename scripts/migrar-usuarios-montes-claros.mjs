/**
 * Migração de usuários: cartorioragpro → cartorio-edu
 * Cartório: cartorio-Tab2Moc  →  2tabmoc (2º Ofício de Notas de Montes Claros)
 *
 * Pré-requisitos:
 *   1. Colocar a chave do projeto ANTIGO em: scripts/key-cartorioragpro.json
 *   2. Colocar a chave do projeto NOVO  em: scripts/key-cartorio-edu.json
 *   3. node --version >= 18
 *   4. npm install firebase-admin  (rode dentro da pasta scripts/)
 *
 * Execução:
 *   cd scripts
 *   npm install firebase-admin
 *   node migrar-usuarios-montes-claros.mjs
 */

import { initializeApp, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Configuração ─────────────────────────────────────────────────────────────

const TENANT_ID_ANTIGO = 'cartorio-Tab2Moc';
const TENANT_ID_NOVO   = '2tabmoc';
const SENHA_TEMPORARIA = 'MJConsultoria@2025';  // será exigida troca no primeiro acesso

// Mapeamento de roles antigas → novas
const ROLE_MAP = {
  atendente:  'colaborador',
  colaborador:'colaborador',
  gestor:     'gestor',
  admin:      'admin',
  gerente:    'admin',
  SUPERADMIN: 'admin',  // nunca deve ter SUPERADMIN do antigo virar SUPERADMIN no novo
};

// ─── Inicializar os dois projetos ─────────────────────────────────────────────

const keyAntigo = JSON.parse(readFileSync(join(__dirname, 'key-cartorioragpro.json'), 'utf8'));
const keyNovo   = JSON.parse(readFileSync(join(__dirname, 'key-cartorio-edu.json'),   'utf8'));

const appAntigo = initializeApp({ credential: cert(keyAntigo) }, 'antigo');
const appNovo   = initializeApp({ credential: cert(keyNovo)   }, 'novo');

const dbAntigo  = getFirestore(appAntigo);
const dbNovo    = getFirestore(appNovo);
const authNovo  = getAuth(appNovo);

// ─── Migração ─────────────────────────────────────────────────────────────────

async function migrar() {
  console.log('─'.repeat(60));
  console.log('  Migração de Colaboradores — Montes Claros');
  console.log(`  Origem : cartorioragpro / ${TENANT_ID_ANTIGO}`);
  console.log(`  Destino: cartorio-edu   / ${TENANT_ID_NOVO}`);
  console.log('─'.repeat(60));

  // 1. Buscar usuários do cartório antigo
  const snap = await dbAntigo.collection('users')
    .where('tenantId', '==', TENANT_ID_ANTIGO)
    .get();

  if (snap.empty) {
    console.log('\n⚠️  Nenhum usuário encontrado com tenantId =', TENANT_ID_ANTIGO);
    process.exit(0);
  }

  console.log(`\n📋 ${snap.size} usuário(s) encontrado(s) no projeto antigo\n`);

  const resultados = [];

  for (const docSnap of snap.docs) {
    const u = docSnap.data();
    const email = (u.email || '').toLowerCase().trim();
    const nome  = u.name || u.nome || '(sem nome)';
    const cargo = u.cargo || '';
    const role  = ROLE_MAP[u.role] || 'colaborador';

    if (!email) {
      console.log(`  ⚠️  Pulando "${nome}" — sem e-mail`);
      resultados.push({ nome, email: '—', status: 'PULADO (sem e-mail)' });
      continue;
    }

    process.stdout.write(`  → ${nome} <${email}> ... `);

    try {
      // 2. Criar conta no Firebase Auth do projeto novo
      let authUid;
      try {
        const authUser = await authNovo.createUser({
          email,
          password: SENHA_TEMPORARIA,
          displayName: nome,
        });
        authUid = authUser.uid;
        process.stdout.write('Auth OK ... ');
      } catch (authErr) {
        if (authErr.code === 'auth/email-already-exists') {
          // Usuário já existe no Auth — pegar o UID existente
          const existing = await authNovo.getUserByEmail(email);
          authUid = existing.uid;
          process.stdout.write('Auth já existe ... ');
        } else {
          throw authErr;
        }
      }

      // 3. Criar/atualizar documento no Firestore do projeto novo
      await dbNovo.collection('users').doc(authUid).set({
        name:            nome,
        email,
        cargo,
        role,
        tenantId:        TENANT_ID_NOVO,
        ativo:           u.active !== false,
        active:          u.active !== false,
        isFirstLogin:    true,
        mustChangePassword: true,
        migradoDe:       TENANT_ID_ANTIGO,
        migradoEm:       new Date().toISOString(),
        createdAt:       u.createdAt || null,
      }, { merge: true });

      process.stdout.write('Firestore OK\n');
      resultados.push({ nome, email, role, status: 'OK', uid: authUid });

    } catch (err) {
      process.stdout.write(`ERRO: ${err.message}\n`);
      resultados.push({ nome, email, status: `ERRO: ${err.message}` });
    }
  }

  // ─── Resumo ───────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log('  RESUMO');
  console.log('─'.repeat(60));

  const ok     = resultados.filter(r => r.status === 'OK');
  const pulado = resultados.filter(r => r.status.startsWith('PULADO'));
  const erro   = resultados.filter(r => r.status.startsWith('ERRO'));

  console.log(`  ✅ Migrados com sucesso : ${ok.length}`);
  console.log(`  ⚠️  Pulados             : ${pulado.length}`);
  console.log(`  ❌ Com erro             : ${erro.length}`);

  if (ok.length > 0) {
    console.log('\n  Usuários migrados:');
    ok.forEach(r => console.log(`    • ${r.nome} <${r.email}> [${r.role}]`));
  }

  if (erro.length > 0) {
    console.log('\n  Erros:');
    erro.forEach(r => console.log(`    • ${r.nome}: ${r.status}`));
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`  Senha temporária definida: ${SENHA_TEMPORARIA}`);
  console.log('  Todos os usuários precisarão trocar a senha no primeiro acesso.');
  console.log('─'.repeat(60) + '\n');
}

migrar().catch(err => {
  console.error('\n❌ Erro fatal:', err.message);
  process.exit(1);
});
