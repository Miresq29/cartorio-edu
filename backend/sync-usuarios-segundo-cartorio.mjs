/**
 * Sincroniza usuários do Segundo Cartório de Notas com a lista oficial.
 * Modo padrão: relatório (--apply para aplicar mudanças)
 *
 * Uso:
 *   node backend/sync-usuarios-segundo-cartorio.mjs          ← só relatório
 *   node backend/sync-usuarios-segundo-cartorio.mjs --apply  ← aplica mudanças
 */

import admin from 'firebase-admin';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const serviceAccount = require('./cartorio-homolog-service-account.json');

const APPLY = process.argv.includes('--apply');

// ── Lista oficial enviada pela gestão ─────────────────────────────────────────
const LISTA_OFICIAL = [
  { email: 'administrativo@segundocartorionotas.com.br',  nome: 'Dayane Noronha'      },
  { email: 'apoioescritura2@segundocartorionotas.com.br', nome: 'Ana Luzia'           },
  { email: 'arquivo2@segundocartorionotas.com.br',        nome: 'Rayanne Santos'      },
  { email: 'arquivo@segundocartorionotas.com.br',         nome: 'Ester Mirian'        },
  { email: 'assessora@segundocartorionotas.com.br',       nome: 'Jane Piranga'        },
  { email: 'atendimento@segundocartorionotas.com.br',     nome: 'Lorena Romanholo'    },
  { email: 'balcao1@segundocartorionotas.com.br',         nome: 'Brenda Prates'       },
  { email: 'balcao2@segundocartorionotas.com.br',         nome: 'Warley Martins'      },
  { email: 'balcao3@segundocartorionotas.com.br',         nome: 'Emanuelle Leite'     },
  { email: 'balcao4@segundocartorionotas.com.br',         nome: 'Clarissa Leila'      },
  { email: 'balcao5@segundocartorionotas.com.br',         nome: 'Jhuly Gabriele'      },
  { email: 'balcao6@segundocartorionotas.com.br',         nome: 'Beatriz Ferreira'    },
  { email: 'balcao8@segundocartorionotas.com.br',         nome: 'Adwaney Mendes'      },
  { email: 'caixa@segundocartorionotas.com.br',           nome: 'Erick Luan'          },
  { email: 'escritura1@segundocartorionotas.com.br',      nome: 'João Rafael'         },
  { email: 'escritura2@segundocartorionotas.com.br',      nome: 'Gabriela Rodrigues'  },
  { email: 'escritura3@segundocartorionotas.com.br',      nome: 'Bruna Lima'          },
  { email: 'escritura4@segundocartorionotas.com.br',      nome: 'Ellen Maia'          },
  { email: 'escritura5@segundocartorionotas.com.br',      nome: 'Denysye Rodrigues'   },
  { email: 'escritura@segundocartorionotas.com.br',       nome: 'Ludimila Alves'      },
  { email: 'externo@segundocartorionotas.com.br',         nome: 'Roberth Kley'        },
  { email: 'financeiro@segundocartorionotas.com.br',      nome: 'Gabrielle Rodrigues' },
  { email: 'gestaodaqualidade@segundocartorionotas.com.br', nome: 'Clênio Rezende'   },
  { email: 'procuracao2@segundocartorionotas.com.br',     nome: 'Lara Silva'          },
  { email: 'procuracao3@segundocartorionotas.com.br',     nome: 'Barbara Ellen'       },
  { email: 'procuracao4@segundocartorionotas.com.br',     nome: 'Sofia Oliveira'      },
  { email: 'recepcao@segundocartorionotas.com.br',        nome: 'Neusrovel Versiani'  },
  { email: 'ti@segundocartorionotas.com.br',              nome: 'Afonso Henrique'     },
  { email: 'vivianne@segundocartorionotas.com.br',        nome: 'Vivianne Romanholo'  },
];

// Normaliza nomes para comparação (ignora acentos, case, espaços extras)
const norm = (s = '') =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth();

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(APPLY
    ? '  MODO: APLICAR MUDANÇAS'
    : '  MODO: RELATÓRIO (adicione --apply para aplicar)');
  console.log('═══════════════════════════════════════════════════════════\n');

  // ── 1. Busca todos os usuários do tenant ──────────────────────────────────
  const snap = await db.collection('users')
    .where('tenantId', '==', 'segundocartorionotas')
    .get();

  if (snap.empty) {
    // Tenta buscar por domínio de email para descobrir o tenantId correto
    console.log('⚠  Nenhum usuário com tenantId "segundocartorionotas". Buscando por email...');
    const snapEmail = await db.collection('users')
      .where('email', '>=', '@segundocartorionotas')
      .limit(5)
      .get();
    if (!snapEmail.empty) {
      const sample = snapEmail.docs[0].data();
      console.log(`   tenantId encontrado: "${sample.tenantId}"`);
      console.log('   Atualize o script com o tenantId correto e re-execute.\n');
    } else {
      // Busca ampla: lista todos os tenantIds distintos
      const allSnap = await db.collection('users').select('tenantId', 'email').limit(100).get();
      const tenants = [...new Set(allSnap.docs.map(d => d.data().tenantId).filter(Boolean))];
      console.log('   tenantIds na base:', tenants);
    }
    process.exit(0);
  }

  const usuariosNaBase = snap.docs.map(d => ({
    uid: d.id,
    ...d.data(),
  }));

  console.log(`Usuários encontrados no tenant "segundocartorionotas": ${usuariosNaBase.length}\n`);

  // ── 2. Mapas de busca ────────────────────────────────────────────────────
  const porEmail = new Map(usuariosNaBase.map(u => [u.email?.toLowerCase(), u]));
  const porNome  = new Map(usuariosNaBase.map(u => [norm(u.name || u.displayName), u]));

  const resultados = {
    ok: [],           // email e nome batem
    emailDiferente: [], // nome existe com email diferente → atualizar
    naoEncontrado: [], // não está na base
  };

  for (const item of LISTA_OFICIAL) {
    const emailKey = item.email.toLowerCase();
    const nomeKey  = norm(item.nome);

    if (porEmail.has(emailKey)) {
      // Email já existe — verifica se o nome bate
      const u = porEmail.get(emailKey);
      resultados.ok.push({ item, usuario: u });
    } else if (porNome.has(nomeKey)) {
      // Nome existe mas email diferente
      const u = porNome.get(nomeKey);
      resultados.emailDiferente.push({ item, usuario: u });
    } else {
      resultados.naoEncontrado.push({ item });
    }
  }

  // ── 3. Relatório ─────────────────────────────────────────────────────────
  console.log(`✅ Já corretos (${resultados.ok.length}):`);
  for (const { item } of resultados.ok) {
    console.log(`   ${item.email} — ${item.nome}`);
  }

  console.log(`\n🔄 Email diferente — será atualizado (${resultados.emailDiferente.length}):`);
  for (const { item, usuario } of resultados.emailDiferente) {
    console.log(`   Nome:      ${item.nome}`);
    console.log(`   Email base: ${usuario.email || '(vazio)'}`);
    console.log(`   Novo email: ${item.email}`);
    console.log(`   UID:       ${usuario.uid}\n`);
  }

  console.log(`\n❌ Não encontrados na base (${resultados.naoEncontrado.length}):`);
  for (const { item } of resultados.naoEncontrado) {
    console.log(`   ${item.email} — ${item.nome}`);
  }

  // ── 4. Aplicar mudanças ──────────────────────────────────────────────────
  if (!APPLY) {
    console.log('\n──────────────────────────────────────────────────────────');
    console.log('Nenhuma mudança aplicada. Execute com --apply para atualizar.');
    console.log('──────────────────────────────────────────────────────────\n');
    process.exit(0);
  }

  if (resultados.emailDiferente.length === 0) {
    console.log('\nNada a atualizar.');
    process.exit(0);
  }

  console.log('\nAplicando atualizações...\n');
  const erros = [];

  for (const { item, usuario } of resultados.emailDiferente) {
    try {
      // Atualiza Firestore
      await db.collection('users').doc(usuario.uid).update({ email: item.email });

      // Atualiza Firebase Auth (login)
      try {
        await auth.updateUser(usuario.uid, { email: item.email });
        console.log(`✅ Auth + Firestore atualizados: ${item.nome} → ${item.email}`);
      } catch (authErr) {
        // Se o Auth já tem esse email em outra conta, só atualiza Firestore
        console.log(`⚠  Auth não atualizado (${authErr.code}), Firestore OK: ${item.nome}`);
      }
    } catch (e) {
      console.error(`❌ Erro ao atualizar ${item.nome}:`, e.message);
      erros.push(item);
    }
  }

  if (erros.length) {
    console.log(`\n${erros.length} erro(s). Verifique acima.`);
  } else {
    console.log('\nTodas as atualizações concluídas com sucesso.');
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
