import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const key = JSON.parse(readFileSync(join(__dirname, 'key-cartorio-edu.json'), 'utf8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();

const PADRAO_161 = /161\s*(\/|de\s+|,?\s*de\s+)?\s*2023/i;

console.log('=== 1. CERTIFICADO MJ-4A19-2643-728E-0C1C ===');
const certByCode = await db.collection('certificados').where('codigoVerificacao', '==', 'MJ-4A19-2643-728E-0C1C').get();
if (certByCode.empty) {
  const byId = await db.collection('certificados').doc('MJ-4A19-2643-728E-0C1C').get();
  if (byId.exists) {
    console.log('Encontrado pelo ID do documento:', JSON.stringify(byId.data(), null, 2));
  } else {
    console.log('NÃO ENCONTRADO nem por codigoVerificacao nem como ID de documento.');
  }
} else {
  certByCode.docs.forEach(d => console.log('docId:', d.id, JSON.stringify(d.data(), null, 2)));
}

console.log('\n=== 2. TOTAL DE CERTIFICADOS E MODELO ===');
const allCerts = await db.collection('certificados').get();
console.log('Total:', allCerts.size);
let v1 = 0, v2 = 0;
const amostraV1 = [];
allCerts.docs.forEach(d => {
  const c = d.data();
  if ((c.versaoModelo || 1) >= 2) v2++; else { v1++; if (amostraV1.length < 3) amostraV1.push({ id: d.id, ...c }); }
});
console.log('Modelo 1 (antigo):', v1);
console.log('Modelo 2 (novo):', v2);
console.log('Amostra modelo 1:', JSON.stringify(amostraV1, null, 2));

console.log('\n=== 3. CAMPOS DISPONÍVEIS PARA PERÍODO (dataInicio) ===');
const progressoComInicio = await db.collection('trilhasProgresso').where('iniciadoEm', '!=', null).limit(1).get().catch(() => ({ empty: true, size: 0 }));
console.log('trilhasProgresso com iniciadoEm preenchido (amostra):', progressoComInicio.size || 0);
const progressoTotal = await db.collection('trilhasProgresso').count().get();
console.log('trilhasProgresso total:', progressoTotal.data().count);

console.log('\n=== 4. SERVENTIA (tenants.nomeOficial/uf/municipio) ===');
const tenantsSnap = await db.collection('tenants').get();
let comNomeOficial = 0;
tenantsSnap.docs.forEach(d => { if (d.data().nomeOficial) comNomeOficial++; });
console.log(`Tenants: ${tenantsSnap.size} total, ${comNomeOficial} com nomeOficial preenchido`);

console.log('\n=== 5. USUÁRIOS — CPF e CARGO ===');
const usersSnap = await db.collection('users').get();
let comCpf = 0, comCargo = 0;
usersSnap.docs.forEach(d => { const u = d.data(); if (u.cpf) comCpf++; if (u.cargo) comCargo++; });
console.log(`Users: ${usersSnap.size} total, ${comCpf} com CPF, ${comCargo} com cargo`);

console.log('\n=== 6. CONFIG DE CERTIFICADO (assinatura/instrutor) ===');
const configSnap = await db.collection('config').doc('certificado').get();
console.log(configSnap.exists ? JSON.stringify(configSnap.data(), null, 2) : 'NÃO EXISTE (gestor nunca configurou)');

console.log('\n=== 7. BUSCA "161/2023" E VARIAÇÕES NO FIRESTORE ===');
async function buscarEmColecao(nomeColecao, camposTexto) {
  const snap = await db.collection(nomeColecao).get();
  const achados = [];
  snap.docs.forEach(d => {
    const data = d.data();
    for (const campo of camposTexto) {
      const valor = campo.split('.').reduce((o, k) => (o || {})[k], data);
      if (typeof valor === 'string' && PADRAO_161.test(valor)) {
        achados.push({ colecao: nomeColecao, id: d.id, campo, trecho: valor.slice(0, 200) });
      }
      // arrays de módulos/itens com conteúdo de texto
      if (Array.isArray(valor)) {
        valor.forEach((item, i) => {
          if (typeof item === 'string' && PADRAO_161.test(item)) {
            achados.push({ colecao: nomeColecao, id: d.id, campo: `${campo}[${i}]`, trecho: item.slice(0, 200) });
          } else if (item && typeof item === 'object') {
            for (const [k, v] of Object.entries(item)) {
              if (typeof v === 'string' && PADRAO_161.test(v)) {
                achados.push({ colecao: nomeColecao, id: d.id, campo: `${campo}[${i}].${k}`, trecho: v.slice(0, 200) });
              }
            }
          }
        });
      }
    }
  });
  return achados;
}

const alvos = [
  ['trilhas', ['titulo', 'descricao', 'modulos']],
  ['treinamentosQuizzes', ['titulo', 'questoes']],
  ['knowledgeBase', ['titulo', 'conteudo', 'texto']],
  ['repositorio', ['titulo', 'descricao']],
  ['comunicados', ['titulo', 'mensagem']],
  ['examesResultados', ['fonteTitulo']],
  ['certificados', ['trilhaTitulo', 'moduloTitulo']],
  ['videos', ['titulo', 'descricao']],
  ['checklists', ['titulo', 'descricao']],
];

let totalAchados = 0;
for (const [col, campos] of alvos) {
  try {
    const achados = await buscarEmColecao(col, campos);
    if (achados.length) {
      totalAchados += achados.length;
      console.log(`\n-- ${col}: ${achados.length} ocorrência(s) --`);
      achados.forEach(a => console.log(JSON.stringify(a)));
    } else {
      console.log(`${col}: nenhuma ocorrência`);
    }
  } catch (e) {
    console.log(`${col}: erro ao buscar — ${e.message}`);
  }
}
console.log(`\nTOTAL DE OCORRÊNCIAS DE "161/2023" NO FIRESTORE: ${totalAchados}`);
process.exit(0);
