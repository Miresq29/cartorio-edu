// Verifica, para cada áudio ativo do Repositório, se o Drive libera o arquivo para leitores.
// O player de áudio do Drive só toca quando o download está liberado (diferente do vídeo, que
// o Drive converte e transmite mesmo com o download desativado). Somente leitura.
// Uso: node scripts/checar-audios-drive.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
initializeApp({ credential: cert(JSON.parse(readFileSync(join(__dirname, 'key-cartorio-edu.json'), 'utf8'))) });
const db = getFirestore();

const audios = (await db.collection('repositorio').where('tipo', '==', 'audio').get()).docs
  .filter(d => d.data().ativo !== false)
  .sort((a, b) => String(a.data().titulo).localeCompare(String(b.data().titulo), 'pt-BR', { numeric: true }));

let liberados = 0;
const bloqueados = [];
for (const d of audios) {
  const driveId = (await db.collection('repositorioPrivado').doc(d.id).get()).data()?.driveId;
  if (!driveId) { bloqueados.push(`${d.data().titulo}  (sem arquivo vinculado)`); continue; }
  const res = await fetch(`https://drive.usercontent.google.com/download?id=${driveId}&export=download`, { headers: { Range: 'bytes=0-15' } });
  const tipo = res.headers.get('content-type') || '';
  await res.arrayBuffer();
  if (tipo.startsWith('audio/') || tipo.startsWith('application/octet-stream')) liberados++;
  else bloqueados.push(d.data().titulo);
}
console.log(`Áudios ativos: ${audios.length} | tocam (download liberado): ${liberados} | ainda bloqueados: ${bloqueados.length}`);
if (bloqueados.length) console.log('\nAinda bloqueados no Drive:\n- ' + bloqueados.join('\n- '));
process.exit(0);
