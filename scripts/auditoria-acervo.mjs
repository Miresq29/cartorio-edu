import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const __dirname = dirname(fileURLToPath(import.meta.url));
const key = JSON.parse(readFileSync(join(__dirname, 'key-cartorio-edu.json'), 'utf8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();
const auth = getAuth();

function log(title) { console.log('\n=== ' + title + ' ==='); }

// ---------- Carrega tudo ----------
const [trilhasSnap, repoSnap, videosSnap, tenantsSnap, usersSnap] = await Promise.all([
  db.collection('trilhas').get(),
  db.collection('repositorio').get(),
  db.collection('videos').get(),
  db.collection('tenants').get(),
  db.collection('users').get(),
]);

const trilhas = trilhasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
const repo = new Map(repoSnap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
const videos = new Map(videosSnap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
const tenants = new Map(tenantsSnap.docs.map(d => [d.id, d.data()]));
const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

log(`Contagens gerais`);
console.log(`Trilhas: ${trilhas.length} | Repositorio: ${repo.size} | Videos: ${videos.size} | Tenants: ${tenants.size} | Usuarios: ${users.length}`);

// ---------- 1. Referencias quebradas (conteudoRef apontando pra doc inexistente) ----------
log('1. Referencias quebradas em modulos (conteudoRef -> doc inexistente)');
let quebradas = 0;
for (const t of trilhas) {
  for (const m of (t.modulos || [])) {
    if (!m.conteudoRef) continue;
    const { tipo, itemId } = m.conteudoRef;
    const existe = tipo === 'repositorio' ? repo.has(itemId) : tipo === 'video' ? videos.has(itemId) : null;
    if (existe === false) {
      quebradas++;
      console.log(`  QUEBRADA: trilha "${t.titulo}" (${t.id}) modulo "${m.titulo}" -> ${tipo}/${itemId} nao existe`);
    }
  }
}
if (!quebradas) console.log('  Nenhuma referencia quebrada encontrada.');

// ---------- 2. Itens do repositorio orfaos (ativos, nao referenciados por nenhuma trilha) ----------
log('2. Itens do repositorio ATIVOS sem nenhuma trilha os referenciando');
const referenciados = new Set();
for (const t of trilhas) {
  for (const m of (t.modulos || [])) {
    if (m.conteudoRef?.tipo === 'repositorio') referenciados.add(m.conteudoRef.itemId);
  }
}
let orfaos = 0;
for (const [id, item] of repo) {
  if (item.ativo !== false && !referenciados.has(id)) {
    orfaos++;
    console.log(`  ORFAO: "${item.titulo}" (${id}) tipo=${item.tipo} tenantIds=${JSON.stringify(item.tenantIds)}`);
  }
}
if (!orfaos) console.log('  Nenhum orfao encontrado.');

// ---------- 3. Cobertura de tenant: trilha distribuida mas conteudo vinculado nao acompanha ----------
log('3. Trilhas distribuidas a um tenant cujo conteudo vinculado NAO cobre esse tenant (quebra de leitura)');
let mismatches = 0;
for (const t of trilhas) {
  const tenantsAlvo = t.tenantIds || [];
  if (tenantsAlvo.includes('GLOBAL')) continue; // GLOBAL cobre todo mundo, sem o que comparar
  for (const m of (t.modulos || [])) {
    if (m.conteudoRef?.tipo !== 'repositorio') continue;
    const item = repo.get(m.conteudoRef.itemId);
    if (!item) continue; // já reportado em (1)
    const itemTenants = item.tenantIds || [];
    if (itemTenants.includes('GLOBAL')) continue;
    const faltando = tenantsAlvo.filter(tid => !itemTenants.includes(tid));
    if (faltando.length) {
      mismatches++;
      console.log(`  MISMATCH: trilha "${t.titulo}" (${t.id}) modulo "${m.titulo}" -> item "${item.titulo}" nao inclui tenant(s) ${JSON.stringify(faltando)} (colaborador desses tenants veria o modulo mas tomaria permission-denied ao abrir)`);
    }
  }
}
if (!mismatches) console.log('  Nenhum mismatch de cobertura encontrado.');

// ---------- 4. Conteudo "aguardando distribuicao" (tenantIds vazio, so equipe MJ ve) ----------
log('4. Conteudo com tenantIds=[] (aguardando distribuicao, comportamento esperado do novo padrao)');
const trilhasVazias = trilhas.filter(t => (t.tenantIds || []).length === 0);
const repoVazios = [...repo.values()].filter(i => (i.tenantIds || []).length === 0);
console.log(`  Trilhas: ${trilhasVazias.length} | Repositorio: ${repoVazios.length}`);
trilhasVazias.forEach(t => console.log(`    trilha "${t.titulo}" (${t.id})`));
repoVazios.forEach(i => console.log(`    repositorio "${i.titulo}" (${i.id})`));

// ---------- 5. True Brands ----------
log('5. Tenant True Brands');
const tb = tenants.get('truebrands');
console.log('  tenant doc:', tb ? JSON.stringify(tb) : 'NAO ENCONTRADO');
const tbUsers = users.filter(u => u.tenantId === 'truebrands');
console.log(`  usuarios vinculados: ${tbUsers.length}`);
tbUsers.forEach(u => console.log(`    ${u.name} <${u.email}> role=${u.role} ativo=${u.ativo}`));

// ---------- 6. Teixeira: nomes e duplicatas ----------
log('6. Teixeira: formato de nome e duplicatas de e-mail');
const teixeiraUsers = users.filter(u => u.tenantId === 'teixeira');
console.log(`  total usuarios: ${teixeiraUsers.length}`);
const nomeCurto = teixeiraUsers.filter(u => !/^\S{2,}(\s+\S{2,})+$/.test((u.name || '').trim()));
console.log(`  nomes com uma palavra so (nao conformes ao novo padrao): ${nomeCurto.length}`);
nomeCurto.forEach(u => console.log(`    ${u.name} <${u.email}> (${u.id})`));
const emailCount = new Map();
teixeiraUsers.forEach(u => emailCount.set(u.email, (emailCount.get(u.email) || 0) + 1));
const duplicados = [...emailCount.entries()].filter(([, c]) => c > 1);
console.log(`  emails duplicados: ${duplicados.length}`);
duplicados.forEach(([email, c]) => console.log(`    ${email} aparece ${c}x`));

// ---------- 7. Auth vs Firestore: usuarios sem par ----------
log('7. Consistencia Auth <-> Firestore (amostra: truebrands + teixeira)');
for (const u of [...tbUsers, ...teixeiraUsers]) {
  try {
    await auth.getUser(u.id);
  } catch (e) {
    console.log(`  SEM CONTA AUTH: ${u.name} <${u.email}> doc=${u.id} (${e.message})`);
  }
}
console.log('  (sem saida acima = todos ok)');

// ---------- 8. SUPERADMIN global: contagem total vs GLOBAL-only ----------
log('8. Conferencia da correcao SUPERADMIN modo global (trilhas/repositorio)');
const trilhasGlobalOnly = trilhas.filter(t => (t.tenantIds || []).includes('GLOBAL')).length;
const repoGlobalOnly = [...repo.values()].filter(i => (i.tenantIds || []).includes('GLOBAL')).length;
console.log(`  Trilhas: total=${trilhas.length}, so-GLOBAL=${trilhasGlobalOnly} (antes do fix, SUPERADMIN global so via isso)`);
console.log(`  Repositorio: total=${repo.size}, so-GLOBAL=${repoGlobalOnly}`);

console.log('\n=== FIM DA AUDITORIA ===');
process.exit(0);
