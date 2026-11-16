import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { VEREADORES_ESPERADOS } from './config.js';
import { coletarTudo } from './coletar.js';
import { processar } from './processar.js';
import { conferir, aumentosDespesas } from './conferir.js';
import { relatorio } from './relatorio.js';
import { gerarSite } from './gerar-site.js';
import { mesclarFolha } from './regras/folha.js';
import { serializarRespostas } from './regras/respostas.js';

const usarCache = process.argv.includes('--usar-cache');
const coleta = usarCache ? JSON.parse(await readFile('data/bruto/coleta.json', 'utf8')) : await coletarTudo();

async function doDisco(caminho) {
  try { return JSON.parse(await readFile(caminho, 'utf8')); } catch (e) { if (e.code === 'ENOENT' || e instanceof SyntaxError) return {}; throw e; }
}
// Folha e respostas: junta com o que já está salvo (outra rodada pode ter gravado enquanto o robô coletava;
// um cache antigo nunca apaga nem desfaz o que está no disco). Coleta nova vale mais que o disco; cache vale menos.
const folhaDisco = await doDisco('data/processado/folha-camara.json');
coleta.folhaCamara = usarCache ? mesclarFolha(coleta.folhaCamara || {}, folhaDisco) : mesclarFolha(folhaDisco, coleta.folhaCamara || {});
const respostasDisco = await doDisco('data/processado/respostas.json');
const respostas = { ...respostasDisco };
for (const [id, e] of Object.entries(coleta.respostas || {})) {
  const d = respostas[id];
  if (!d || (usarCache ? e.conferidoEm > d.conferidoEm : e.conferidoEm >= d.conferidoEm)) respostas[id] = e;
}
coleta.respostas = respostas;
const dados = processar(coleta);

let anterior = null;
try { anterior = JSON.parse(await readFile('data/processado/meta.json', 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }

const problemas = conferir(dados, anterior, VEREADORES_ESPERADOS);
const aumentos = aumentosDespesas(dados.meta, anterior);
await writeFile('conferencia.md', relatorio(dados, problemas, aumentos));
if (problemas.length) {
  console.error(`NÃO PUBLICADO. O site continua na última versão boa.\n- ${problemas.join('\n- ')}`);
  process.exit(1);
}

await mkdir('data/processado', { recursive: true });
await writeFile('data/processado/dados.json', JSON.stringify(dados));
await writeFile('data/processado/meta.json', `${JSON.stringify(dados.meta, null, 2)}\n`);
await writeFile('data/processado/folha-camara.json', `${JSON.stringify(coleta.folhaCamara || {}, null, 2)}\n`);
await writeFile('data/processado/respostas.json', serializarRespostas(coleta.respostas));
await gerarSite(dados, 'dist');
console.log('Pronto. Veja conferencia.md e a pasta dist/.');
