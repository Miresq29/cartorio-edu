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

// id -> novo nome completo (confirmado por correspondência de primeiro nome)
const UPDATES = {
  'Wxa3E1y7eJfP4Gr0YErh8iWOk9q2': 'Elias Raphael Bessa Lyra Nunes',
  'J7kQ8t97iOXnkdoDrE2riyCPirk1': 'Guthierry Lopes Oliveira',
  'rq8jodCcIEcfL1PaD3BPCpGzjUW2': 'Amabelle Soares Souza',
  '6IKFA2fRmeTyEqPewFrdbLH5igw1': 'Gusttavo Teixeira Bomjardim',
  'HeGeozeMTgh6JpjdWjCS9QiqdEw2': 'Bruna Gomes da Costa',
  '1HWYxt3KQLV94DVN5dhOAeMjaT53': 'Talita Vieira dos Santos',
  'LFpLLshcckOqeZhosDxWXrw0POn2': 'Jhessy Meireles Silva',
  'umFYTMj2I3Wy057GM3fNPdjlNaV2': 'Fabrício Pessoa Oliveira Filho',
  'NKIEx4DwIWdYuvXyuHBUvMkPbPH3': 'Jussara costa Damasio Silva',
  'AccCVZqVNEhVXK7uWnu1Vdy6m532': 'Sabrina Silva Gonçalves',
  '3wIr3YfEpYPCPn220ici66FPFED3': 'Deisymara Gonçalves Santos',
  'eC1FfPTychWiYay6hkJQPgd8PTu1': 'Mariana Correia Calixto',
  'SH41Dvz1UcadKskHt6Riucp9sJU2': 'Anna Carolina Pardinho Santos',
  'Wt0PUoM9b1gJvlyTL143Bw8eTH83': 'Paulo Aloísio Simas Teixeira Gonçalves',
  'ySnF5Zs63ygDtIxRZCIwdkcsxKR2': 'Lucigleide Neves de Souza',
  '7ZyrFh7bY7PZhLrGUH2w9Jb7El72': 'Elickison Keanu Correia da Silva',
  'a0DDsm6wTcNak5BdWmMUOYKgsFo1': 'Henrique de Almeida Sampaio',
  'rcQyDJzKPMTL9UFlhVTJbqEXWx52': 'Daniel Costa Damasio',
  'PJHhjMN43fTshpi0ySw0729BVco2': 'Waldirley Conceição Santana',
  'b8CAPfZpIMPFqW41tLaJoQOoGwf2': 'Mileny Nascimento Santos',
  'Dh9yfNSRbsOkz3azoazEhLCtOhE3': 'Tainara de Jesus Lopes Souza',
  'ilKVBZFVlDf1PxCMvIaFJUhaYOl2': 'Gerlania Nunes dos Santos',
  'aAJe1zI6MSQlzZtxSbljPY7oasE3': 'Alessandro Rodrigues Ferreira',
  'fkvqgRrVlhSVfEdcvzXUNiwowci1': 'Claudiana Pereira Silva Souto',
};

async function main() {
  for (const [uid, novoNome] of Object.entries(UPDATES)) {
    await db.collection('users').doc(uid).update({ name: novoNome });
    try { await auth.updateUser(uid, { displayName: novoNome }); } catch (e) { console.warn(`  (auth displayName falhou p/ ${uid}: ${e.message})`); }
    console.log(`OK: ${uid} -> ${novoNome}`);
  }
  console.log(`\n${Object.keys(UPDATES).length} usuários atualizados.`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
