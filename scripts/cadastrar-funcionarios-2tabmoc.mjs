/**
 * Cadastro em lote — 2º Ofício de Notas de Montes Claros (tenantId: 2tabmoc)
 *
 * Cria contas no Firebase Auth + documentos no Firestore.
 * • isFirstLogin: true  → usuário é forçado a trocar a senha ao entrar
 * • Senha temporária    → Cartorio@2025  (mínimo 12 chars, atende a política)
 * • E-mails marcados ⚠️ são placeholders — atualize no painel após o cadastro
 *
 * Pré-requisitos:
 *   - scripts/key-cartorio-edu.json  (chave de serviço do projeto cartorio-edu)
 *   - cd scripts && npm install firebase-admin
 *
 * Execução:
 *   node cadastrar-funcionarios-2tabmoc.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Config ──────────────────────────────────────────────────────────────────
const TENANT_ID        = '2tabmoc';
const SENHA_TEMPORARIA = 'Cartorio@2025';  // força troca no primeiro acesso (12+ chars)

// ─── Lista de funcionários ────────────────────────────────────────────────────
// ⚠️ = e-mail placeholder — atualize no painel de Colaboradores após o cadastro
const FUNCIONARIOS = [
  // ── Diretoria ────────────────────────────────────────────────────────────
  { name: 'Vivianne Romanholo Barbosa de Castro Rosado', email: 'vivianne@segundocartorionotas.com.br',          cargo: 'Tabeliã Titular',          role: 'gestor'      },
  { name: 'Ludimila Alves de Oliveira',                  email: 'escritura@segundocartorionotas.com.br',         cargo: 'Tabeliã Substituta',        role: 'gestor'      },
  { name: 'Jane Suely Piranga Costa',                    email: 'jane@2tabmoc.sem-email.br',                    cargo: 'Assessora de Diretoria',    role: 'admin', placeholder: true },

  // ── Qualidade ────────────────────────────────────────────────────────────
  { name: 'Clênio Vilela de Rezende',                    email: 'gestaodaqualidade@segundocartorionotas.com.br', cargo: 'Líder de Qualidade',        role: 'admin'       },
  { name: 'Lorena Romanholo Barbosa de Castro',          email: 'atendimento@segundocartorionotas.com.br',       cargo: 'Analista da Qualidade',     role: 'admin'       },

  // ── Notarial / Líderes ────────────────────────────────────────────────────
  { name: 'João Rafael Veloso Quintino',                 email: 'escritura1@segundocartorionotas.com.br',        cargo: 'Líder Notarial',            role: 'admin'       },
  { name: 'Dayane Noronha Pereira',                      email: 'dayane@2tabmoc.sem-email.br',                   cargo: 'Líder Administrativo',      role: 'admin', placeholder: true },
  { name: 'Afonso Henrique Cardoso Ribeiro',             email: 'ti@segundocartorionotas.com.br',                cargo: 'Líder de TI',               role: 'admin'       },

  // ── Balcão ───────────────────────────────────────────────────────────────
  { name: 'Warley Martins de Araujo',                    email: 'balcao2@segundocartorionotas.com.br',           cargo: 'Escrevente Balcão',         role: 'colaborador' },
  { name: 'Jhuly Gabriele Gonçalves',                    email: 'balcao5@segundocartorionotas.com.br',           cargo: 'Escrevente Balcão',         role: 'colaborador' },
  { name: 'Beatriz Ferreira Pimenta',                    email: 'balcao6@segundocartorionotas.com.br',           cargo: 'Escrevente Balcão',         role: 'colaborador' },
  { name: 'Emanuelle Leite Ferreira Rosa',               email: 'balcao3@segundocartorionotas.com.br',           cargo: 'Escrevente Balcão',         role: 'colaborador' },
  { name: 'Lara Lorrane Gonçalves da Silva',             email: 'procuracao2@segundocartorionotas.com.br',       cargo: 'Escrevente Balcão',         role: 'colaborador' },
  { name: 'Brenda Prates Vieira Barbosa',                email: 'balcao1@segundocartorionotas.com.br',           cargo: 'Assistente de Balcão',      role: 'colaborador' },
  { name: 'Clarissa Laila Oliveira Cesar',               email: 'balcao4@segundocartorionotas.com.br',           cargo: 'Assistente de Balcão',      role: 'colaborador' },
  { name: 'Adwaney Mendes da Silva',                     email: 'adwaney@2tabmoc.sem-email.br',                  cargo: 'Assistente de Balcão',      role: 'colaborador', placeholder: true },
  { name: 'Ellen Talita da Silva Maia',                  email: 'balcao7@segundocartorionotas.com.br',           cargo: 'Escrevente Escritura',      role: 'colaborador' },

  // ── Administrativo ────────────────────────────────────────────────────────
  { name: 'Gabrielle Rodrigues Fonseca',                 email: 'gabrielle@2tabmoc.sem-email.br',                cargo: 'Assistente Administrativo', role: 'colaborador', placeholder: true },
  { name: 'Erick Luan Rodrigues Martins',                email: 'erickluan@2tabmoc.sem-email.br',                cargo: 'Operador de Caixa',         role: 'colaborador', placeholder: true },
  { name: 'Roberth Kley Pereira de Oliveira',            email: 'externo@segundocartorionotas.com.br',           cargo: 'Contínuo',                  role: 'colaborador' },
  { name: 'Ester Mirian Souto Damasceno',                email: 'ester@2tabmoc.sem-email.br',                    cargo: 'Auxiliar de Cartório',      role: 'colaborador', placeholder: true },
  { name: 'Vanete Santos',                               email: 'vanete@2tabmoc.sem-email.br',                   cargo: 'Auxiliar de Limpeza',       role: 'colaborador', placeholder: true },
  { name: 'Neusrovel Rodrigues Versiani',                email: 'neusrovel@2tabmoc.sem-email.br',                cargo: 'Porteiro',                  role: 'colaborador', placeholder: true },

  // ── Procuração ────────────────────────────────────────────────────────────
  { name: 'Barbara Ellen Rocha Ruas',                    email: 'procuracao3@segundocartorionotas.com.br',       cargo: 'Escrevente Procuração',     role: 'colaborador' },
  { name: 'Sofia Oliveira Muniz',                        email: 'procuracao4@segundocartorionotas.com.br',       cargo: 'Escrevente Procuração',     role: 'colaborador' },
  { name: 'Denylton Gabriel Antunes Dias',               email: 'procuracao@segundocartorionotas.com.br',        cargo: 'Escrevente Procuração',     role: 'colaborador' },

  // ── Escritura ─────────────────────────────────────────────────────────────
  { name: 'Gabriela Aparecida Moreira Rodrigues',        email: 'escritura2@segundocartorionotas.com.br',        cargo: 'Escrevente Escritura',      role: 'colaborador' },
  { name: 'Denysye Rodrigues Barbosa',                   email: 'escritura5@segundocartorionotas.com.br',        cargo: 'Escrevente Escritura',      role: 'colaborador' },
  { name: 'Bruna Silva Lima',                            email: 'escritura3@segundocartorionotas.com.br',        cargo: 'Escrevente Escritura',      role: 'colaborador' },

  // ── Arquivo ───────────────────────────────────────────────────────────────
  { name: 'Rayanne Chrystine Gomes Santos',              email: 'rayanne@2tabmoc.sem-email.br',                  cargo: 'Arquivo',                   role: 'colaborador', placeholder: true },
  { name: 'Erick Expedito Mendes Soares',                email: 'erickexpedito@2tabmoc.sem-email.br',            cargo: 'Auxiliar de Cartório',      role: 'colaborador', placeholder: true },
];

// ─── Inicializar Firebase ─────────────────────────────────────────────────────
const key = JSON.parse(readFileSync(join(__dirname, 'key-cartorio-edu.json'), 'utf8'));
const app  = initializeApp({ credential: cert(key) }, 'cartorio-edu');
const db   = getFirestore(app);
const auth = getAuth(app);

// ─── Execução ─────────────────────────────────────────────────────────────────
async function cadastrar() {
  console.log('═'.repeat(65));
  console.log('  Cadastro em Lote — 2º Ofício de Notas de Montes Claros');
  console.log(`  Total: ${FUNCIONARIOS.length} funcionários | Senha: ${SENHA_TEMPORARIA}`);
  console.log('═'.repeat(65) + '\n');

  const resultados = { ok: [], ja_existe: [], placeholder: [], erro: [] };

  for (const f of FUNCIONARIOS) {
    const label = `${f.name} <${f.email}>`;
    process.stdout.write(`  ${f.placeholder ? '⚠️ ' : '→  '}${f.name} ... `);

    try {
      let uid;
      let jaExistia = false;

      // Tentar criar no Firebase Auth
      try {
        const authUser = await auth.createUser({
          email: f.email,
          password: SENHA_TEMPORARIA,
          displayName: f.name,
        });
        uid = authUser.uid;
        process.stdout.write('Auth ✓ ... ');
      } catch (err) {
        if (err.code === 'auth/email-already-exists') {
          const existing = await auth.getUserByEmail(f.email);
          uid = existing.uid;
          jaExistia = true;
          process.stdout.write('Auth já existe ... ');
        } else {
          throw err;
        }
      }

      // Criar/atualizar documento no Firestore
      const docRef = db.collection('users').doc(uid);
      const snap   = await docRef.get();

      if (snap.exists && jaExistia) {
        // Atualizar apenas campos que podem ter mudado
        await docRef.update({
          name:    f.name,
          cargo:   f.cargo,
          role:    f.role,
          tenantId: TENANT_ID,
          ativo:   true,
          active:  true,
        });
        process.stdout.write('Firestore atualizado\n');
        resultados.ja_existe.push(f);
      } else {
        await docRef.set({
          name:               f.name,
          email:              f.email,
          cargo:              f.cargo,
          role:               f.role,
          tenantId:           TENANT_ID,
          ativo:              true,
          active:             true,
          isFirstLogin:       true,
          mustChangePassword: true,
          emailPlaceholder:   f.placeholder || false,
          createdAt:          new Date().toISOString(),
          createdBy:          'cadastro-lote-script',
        });
        process.stdout.write('Firestore ✓\n');
        resultados.ok.push(f);
      }

      if (f.placeholder) resultados.placeholder.push(f);

    } catch (err) {
      process.stdout.write(`ERRO: ${err.message}\n`);
      resultados.erro.push({ ...f, erro: err.message });
    }
  }

  // ─── Resumo ───────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(65));
  console.log('  RESUMO');
  console.log('═'.repeat(65));
  console.log(`  ✅ Criados com sucesso : ${resultados.ok.length}`);
  console.log(`  🔄 Já existiam         : ${resultados.ja_existe.length}`);
  console.log(`  ⚠️  E-mail placeholder  : ${resultados.placeholder.length}`);
  console.log(`  ❌ Com erro            : ${resultados.erro.length}`);

  if (resultados.placeholder.length > 0) {
    console.log('\n  ⚠️  E-MAILS PLACEHOLDER — atualize no painel de Colaboradores:');
    resultados.placeholder.forEach(f => {
      console.log(`    • ${f.name.padEnd(40)} ${f.email}`);
    });
  }

  if (resultados.erro.length > 0) {
    console.log('\n  ❌ ERROS:');
    resultados.erro.forEach(f => console.log(`    • ${f.name}: ${f.erro}`));
  }

  console.log('\n' + '═'.repeat(65));
  console.log(`  Senha temporária: ${SENHA_TEMPORARIA}`);
  console.log('  Todos os novos usuários serão forçados a trocar a senha');
  console.log('  no primeiro acesso (mínimo 12 caracteres, senha forte).');
  console.log('═'.repeat(65) + '\n');
}

cadastrar().catch(err => {
  console.error('\n❌ Erro fatal:', err.message);
  process.exit(1);
});
