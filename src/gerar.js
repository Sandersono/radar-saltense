import { readFile } from 'node:fs/promises';
import { gerarSite } from './gerar-site.js';
import { vistoriarPasta } from './vistoria.js';

const dados = JSON.parse(await readFile('data/processado/dados.json', 'utf8'));
// Arquivo semanal salvo pelo robô; se faltar ou estiver estragado, o gerador monta com os dados atuais.
let semanas = null;
try { semanas = JSON.parse(await readFile('data/processado/semanas.json', 'utf8')); } catch { semanas = null; }
await gerarSite(dados, 'dist', semanas);
// Vistoria do site pronto (também no caminho "só publicar" do robô): CPF ou página obrigatória faltando impedem a publicação.
const { bloqueios, avisos } = await vistoriarPasta('dist');
for (const a of avisos) console.warn(`Aviso da vistoria: ${a}`);
if (bloqueios.length) {
  console.error(`NÃO PUBLICADO (vistoria).\n- ${bloqueios.join('\n- ')}`);
  process.exit(1);
}
console.log('Site gerado em dist/');
