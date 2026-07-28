// Script de migração única — corrige tenantId órfão criado pelo bug em
// que telas de conteúdo gravavam o tenantId bruto do SUPERADMIN em vez do
// cartório ativo. Ver plano em memória da sessão para contexto completo.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const key = JSON.parse(readFileSync('./key-cartorio-edu.json', 'utf8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();

const TENANT = '2tabmoc';

async function retag(col, id, extra = {}) {
  await db.collection(col).doc(id).update({ tenantId: TENANT, ...extra });
  console.log(`retag ${col}/${id} -> tenantId=${TENANT}`, extra);
}

async function main() {
  // 1. Retagueia conteúdo órfão para Montes Claros
  const repositorioIds = [
    '5HleUhlOyJOvQEX7mESC', 'DefPPAihDlTNiejja2jp', 'PdSxI6I58odzBHAI6OJa',
    'XxQprakskQjru6t29bjh', 'alyCuIQN2BjfhfkfApsm', 'cvHCx0fjQawqO7Bbq1WS',
    'gZr3BEmLeLx2pQENboLf', 'pIgvusxMVG7s1N7zzQ3v', 'sgTMIYjhE8KFJkabo6zv',
  ];
  for (const id of repositorioIds) await retag('repositorio', id);

  await retag('knowledgeBase', 'cEtA2grm6jzxC43TYdvN');
  await retag('treinamentosQuizzes', 'nFEigoi3QWDKZjTgsup2');
  await retag('comunicados', '1Gp6hImm2ktwlM5z8orZ');
  await retag('treinamentos', 'i5dDTsBTFItyAxds9IVF');

  // 2. Apaga rascunhos de teste
  await db.collection('trilhas').doc('lStSvAvubZj3gtkd3C7V').delete();
  console.log('deleted trilhas/lStSvAvubZj3gtkd3C7V (Teste01)');
  await db.collection('treinamentosQuizzes').doc('BwfuS0aesKTTWTTWSWnQ').delete();
  console.log('deleted treinamentosQuizzes/BwfuS0aesKTTWTTWSWnQ (quiz lixo)');

  // 3. Atualiza perfis da trilha SGI para os perfis reais atribuíveis
  await db.collection('trilhas').doc('6nD6JBOcIxUhlPNXmM64').update({
    perfis: ['colaborador', 'gestor', 'admin'],
  });
  console.log('updated trilhas/6nD6JBOcIxUhlPNXmM64 perfis');

  // 4. Corrige tenantId da equipe interna (MJ Consultoria, não amarrada a cartório)
  await db.collection('users').doc('ZYyjGK11NebGls5O4MyPA4DHr2P2').update({ tenantId: '' });
  console.log('fixed users/ZYyjGK11NebGls5O4MyPA4DHr2P2 (SUPERADMIN) tenantId=""');
  await db.collection('users').doc('4QiF0hefFmZm8F1wgwyjTFPvZ9i2').update({ tenantId: '' });
  console.log('fixed users/4QiF0hefFmZm8F1wgwyjTFPvZ9i2 (mirianesquarcio) tenantId=""');

  // 5. Remove doc de usuário órfão/duplicado (ID não é um UID válido do Firebase Auth)
  await db.collection('users').doc('hYi1mfLBx4vZlBYzoo8L').delete();
  console.log('deleted users/hYi1mfLBx4vZlBYzoo8L (orphan doc)');

  console.log('\nMigração concluída.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
