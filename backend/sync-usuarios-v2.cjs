/**
 * Versão CommonJS (CJS) — mais compatível com Node.js 24
 * Uso:
 *   node backend/sync-usuarios-v2.cjs          ← relatório
 *   node backend/sync-usuarios-v2.cjs --apply  ← aplica mudanças
 */
'use strict';

const admin = require('firebase-admin');
const serviceAccount = require('./cartorio-homolog-service-account.json');

const APPLY = process.argv.includes('--apply');

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

const norm = (s = '') =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const auth = admin.auth();

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(APPLY ? '  MODO: APLICAR MUDANÇAS' : '  MODO: RELATÓRIO (use --apply para aplicar)');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Busca todos os users e filtra no cliente para aceitar variações de tenantId
  const snap = await db.collection('users').get();
  const todos = snap.docs.map(d => ({ uid: d.id, ...d.data() }));

  // Detecta os tenantIds que têm emails @segundocartorionotas
  const tenantIds = [...new Set(
    todos
      .filter(u => (u.email || '').includes('segundocartorionotas'))
      .map(u => u.tenantId)
      .filter(Boolean)
  )];
  console.log('TenantIds detectados para @segundocartorionotas:', tenantIds);

  const usuarios = todos.filter(u =>
    tenantIds.includes(u.tenantId) ||
    (u.email || '').includes('segundocartorionotas')
  );
  console.log(`Usuários do tenant: ${usuarios.length}\n`);

  const porEmail = new Map(usuarios.map(u => [(u.email || '').toLowerCase(), u]));
  const porNome  = new Map(usuarios.map(u => [norm(u.name || u.displayName || ''), u]));

  const ok = [], atualizar = [], naoAchado = [];

  for (const item of LISTA_OFICIAL) {
    const emailKey = item.email.toLowerCase();
    const nomeKey  = norm(item.nome);

    if (porEmail.has(emailKey)) {
      ok.push({ item, usuario: porEmail.get(emailKey) });
    } else if (porNome.has(nomeKey)) {
      atualizar.push({ item, usuario: porNome.get(nomeKey) });
    } else {
      naoAchado.push({ item });
    }
  }

  console.log(`✅ Já corretos (${ok.length}):`);
  ok.forEach(({ item }) => console.log(`   ${item.email} — ${item.nome}`));

  console.log(`\n🔄 Email diferente — será atualizado (${atualizar.length}):`);
  atualizar.forEach(({ item, usuario }) => {
    console.log(`   ${item.nome}`);
    console.log(`      Email atual: ${usuario.email || '(vazio)'}`);
    console.log(`      Novo email:  ${item.email}`);
    console.log(`      UID: ${usuario.uid}`);
  });

  console.log(`\n❌ Não encontrados na base (${naoAchado.length}):`);
  naoAchado.forEach(({ item }) => console.log(`   ${item.email} — ${item.nome}`));

  if (!APPLY) {
    console.log('\n──────────────────────────────────────────────────────────');
    console.log('Relatório concluído. Execute com --apply para atualizar.');
    console.log('──────────────────────────────────────────────────────────\n');
    return;
  }

  if (atualizar.length === 0) {
    console.log('\nNada a atualizar.');
    return;
  }

  console.log('\nAplicando atualizações...\n');
  for (const { item, usuario } of atualizar) {
    try {
      await db.collection('users').doc(usuario.uid).update({ email: item.email });
      try {
        await auth.updateUser(usuario.uid, { email: item.email });
        console.log(`✅ Auth + Firestore OK: ${item.nome} → ${item.email}`);
      } catch (ae) {
        console.log(`⚠  Auth não atualizado (${ae.code}), Firestore OK: ${item.nome}`);
      }
    } catch (e) {
      console.error(`❌ Erro: ${item.nome} — ${e.message}`);
    }
  }
  console.log('\nConcluído.');
}

main().catch(e => { console.error(e); process.exit(1); });
