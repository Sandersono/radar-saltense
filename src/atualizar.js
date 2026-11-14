import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { VEREADORES_ESPERADOS } from './config.js';
import { coletarTudo } from './coletar.js';
import { processar } from './processar.js';
import { conferir } from './conferir.js';
import { relatorio } from './relatorio.js';
import { gerarSite } from './gerar-site.js';

const usarCache = process.argv.includes('--usar-cache');
const coleta = usarCache ? JSON.parse(await readFile('data/bruto/coleta.json', 'utf8')) : await coletarTudo();
const dados = processar(coleta);

let anterior = null;
try { anterior = JSON.parse(await readFile('data/processado/meta.json', 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }

const problemas = conferir(dados, anterior, VEREADORES_ESPERADOS);
await writeFile('conferencia.md', relatorio(dados, problemas));
if (problemas.length) {
  console.error(`NÃO PUBLICADO. O site continua na última versão boa.\n- ${problemas.join('\n- ')}`);
  process.exit(1);
}

await mkdir('data/processado', { recursive: true });
await writeFile('data/processado/dados.json', JSON.stringify(dados));
await writeFile('data/processado/meta.json', `${JSON.stringify(dados.meta, null, 2)}\n`);
await gerarSite(dados, 'dist');
console.log('Pronto. Veja conferencia.md e a pasta dist/.');
