import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { VEREADORES_ESPERADOS } from './config.js';
import { coletarTudo } from './coletar.js';
import { processar } from './processar.js';
import { conferir, aumentosDespesas } from './conferir.js';
import { relatorio } from './relatorio.js';
import { gerarSite } from './gerar-site.js';
import { mesclarFolha } from './regras/folha.js';
import { serializarRespostas } from './regras/respostas.js';
import { reaproveitarTce } from './regras/tce-anterior.js';
import { mesclarIegm, mesclarContratos, escolherObras } from './regras/prefeitura.js';

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
// Nota do TCE, obras e compras: mesma regra (coleta nova vale mais que o disco; cache vale menos).
const iegmDisco = await doDisco('data/processado/iegm.json');
coleta.iegm = usarCache ? mesclarIegm(coleta.iegm, iegmDisco) : mesclarIegm(iegmDisco, coleta.iegm);
const obrasDisco = await doDisco('data/processado/obras.json');
const obrasSalvas = obrasDisco.obras ? obrasDisco : null;
coleta.obras = usarCache ? escolherObras(coleta.obras, obrasSalvas) : escolherObras(obrasSalvas, coleta.obras);
const contratosDisco = await doDisco('data/processado/contratos.json');
coleta.contratos = usarCache ? mesclarContratos(coleta.contratos, contratosDisco) : mesclarContratos(contratosDisco, coleta.contratos);
let anterior = null;
try { anterior = JSON.parse(await readFile('data/processado/meta.json', 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
// TCE-SP fora do ar: receitas/gastos não coletados repetem o último resultado publicado.
const tceFora = coleta.receitas === null || coleta.despesas === null || coleta.siconfi === null;
const dados = reaproveitarTce(processar(coleta), coleta, tceFora ? await doDisco('data/processado/dados.json') : null, anterior);

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
const json = (v) => `${JSON.stringify(v, null, 2)}\n`;
if (coleta.iegm && Object.keys(coleta.iegm.anos).length) await writeFile('data/processado/iegm.json', json(coleta.iegm));
if (coleta.obras) await writeFile('data/processado/obras.json', json(coleta.obras));
if (Object.keys(coleta.contratos).length) await writeFile('data/processado/contratos.json', json(coleta.contratos));
await gerarSite(dados, 'dist');
console.log('Pronto. Veja conferencia.md e a pasta dist/.');
