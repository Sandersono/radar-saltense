import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { VEREADORES_ESPERADOS } from './config.js';
import { coletarTudo } from './coletar.js';
import { processar } from './processar.js';
import { conferir, aumentosDespesas } from './conferir.js';
import { relatorio } from './relatorio.js';
import { gerarSite } from './gerar-site.js';
import { vistoriarPasta, relatorioVistoria } from './vistoria.js';
import { mesclarFolha } from './regras/folha.js';
import { serializarRespostas } from './regras/respostas.js';
import { reaproveitarTce, datasTce, idadeTce } from './regras/tce-anterior.js';
import { mesclarIegm, mesclarContratos, escolherObras } from './regras/prefeitura.js';
import { mesclarFontesObras } from './regras/obras-cidade.js';
import { hojeSP, marcos, semanaComHistorico } from './regras/semana.js';

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
// Emendas e promessas são arquivos de referência editados à mão: com cache, vale o que está no disco agora.
if (usarCache) {
  for (const [campo, caminho] of [['emendas', 'data/referencia/emendas.json'], ['promessas', 'data/referencia/promessas.json'], ['ligacoesObras', 'data/referencia/obras-ligacoes.json']]) {
    const ref = await doDisco(caminho);
    coleta[campo] = Object.keys(ref).length ? ref : null;
  }
}
// Nota do TCE, obras e compras: mesma regra (coleta nova vale mais que o disco; cache vale menos).
const iegmDisco = await doDisco('data/processado/iegm.json');
coleta.iegm = usarCache ? mesclarIegm(coleta.iegm, iegmDisco) : mesclarIegm(iegmDisco, coleta.iegm);
const obrasDisco = await doDisco('data/processado/obras.json');
const obrasSalvas = obrasDisco.obras ? obrasDisco : null;
coleta.obras = usarCache ? escolherObras(coleta.obras, obrasSalvas) : escolherObras(obrasSalvas, coleta.obras);
const contratosDisco = await doDisco('data/processado/contratos.json');
coleta.contratos = usarCache ? mesclarContratos(coleta.contratos, contratosDisco) : mesclarContratos(contratosDisco, coleta.contratos);
// Obras em Salto (PNCP, Obrasgov.br, paralisadas da Prefeitura): cada fonte fica com a coleta mais nova.
const obrasFontesDisco = await doDisco('data/processado/obras-fontes.json');
coleta.obrasFontes = usarCache ? mesclarFontesObras(coleta.obrasFontes, obrasFontesDisco) : mesclarFontesObras(obrasFontesDisco, coleta.obrasFontes);
let anterior = null;
try { anterior = JSON.parse(await readFile('data/processado/meta.json', 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
// TCE-SP fora do ar: receitas/gastos não coletados repetem o último resultado publicado.
const tceFora = coleta.receitas === null || coleta.despesas === null || coleta.siconfi === null;
const dadosAnteriores = await doDisco('data/processado/dados.json');
const dados = reaproveitarTce(processar(coleta), coleta, tceFora ? dadosAnteriores : null, anterior);
// Dado do TCE repetido: nota para o leitor e linha de manutenção (passou de 10 dias, só avisa; nunca trava a publicação).
dados.meta.tceColetadoEm = datasTce(coleta, anterior, dados.meta.atualizadoEm);
const idade = idadeTce(dados.meta.tceColetadoEm, dados.meta.atualizadoEm);
dados.avisos.push(...idade.avisos);
dados.avisosManutencao.push(...idade.manutencao);
// Resumo da semana: compara com os marcos da última versão publicada e guarda as novidades por 7 dias.
dados.meta.marcosAnteriores = dadosAnteriores.vereadores ? marcos(dadosAnteriores) : ((anterior && anterior.marcosAnteriores) || null);
const semana = semanaComHistorico(dados, hojeSP(dados.meta.atualizadoEm), dados.meta.marcosAnteriores, anterior && anterior.novidadesRecentes);
dados.semana = semana.semana;
dados.meta.novidadesRecentes = semana.novidadesRecentes;

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
if (Object.values(coleta.obrasFontes).some(Boolean)) await writeFile('data/processado/obras-fontes.json', json(coleta.obrasFontes));
await gerarSite(dados, 'dist');
// Vistoria do site pronto: CPF ou página obrigatória faltando impedem a publicação (o workflow para aqui).
const vistoria = await vistoriarPasta('dist');
await appendFile('conferencia.md', relatorioVistoria(vistoria));
if (vistoria.bloqueios.length) {
  console.error(`NÃO PUBLICADO (vistoria). O site continua na última versão boa.\n- ${vistoria.bloqueios.join('\n- ')}`);
  process.exit(1);
}
console.log('Pronto. Veja conferencia.md e a pasta dist/.');
