import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { coletarFolha } from '../coleta/folha-camara.js';
import { mesclarFolha, GRUPOS_FOLHA } from '../regras/folha.js';
import { anoMesBR } from '../util/texto.js';

const DADOS = 'data/processado/dados.json';
const SAIDA = 'data/processado/folha-camara.json';

const i = process.argv.indexOf('--desde');
const desde = i > 0 ? process.argv[i + 1] : '2025-01';
if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(desde)) {
  console.error('Uso: node src/ferramentas/folha-camara.js --desde AAAA-MM');
  process.exit(1);
}

const { ano: anoHoje, mes: mesHoje } = anoMesBR();
const hoje = `${anoHoje}-${String(mesHoje).padStart(2, '0')}`;
const meses = [];
for (let [a, m] = desde.split('-').map(Number); `${a}-${String(m).padStart(2, '0')}` <= hoje; m === 12 ? (a++, m = 1) : m++) {
  meses.push(`${a}-${String(m).padStart(2, '0')}`);
}

const dados = JSON.parse(await readFile(DADOS, 'utf8'));
const vereadores = (dados.vereadores || []).map(({ id, nome, apelido }) => ({ id, nome, apelido }));

const novos = await coletarFolha(meses, vereadores);
// Mês sem vereadores na folha é parcial na fonte: guarda os dados, mas marca para a UI.
for (const r of Object.values(novos)) if (r && r.grupos.vereadores.pessoas === 0) r.parcial = true;

let salvo = {};
try { salvo = JSON.parse(await readFile(SAIDA, 'utf8')); } catch { /* primeira carga */ }
const final = mesclarFolha(salvo, novos);
await mkdir(dirname(SAIDA), { recursive: true });
await writeFile(SAIDA, JSON.stringify(final, null, 2) + '\n');

const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
for (const mes of meses) {
  const r = novos[mes];
  if (!r) { console.log(`${mes}: sem folha publicada`); continue; }
  const partes = Object.keys(GRUPOS_FOLHA).map((g) => `${g} ${r.grupos[g].pessoas} (${brl(r.grupos[g].total)})`);
  console.log(`${mes}: ${partes.join(', ')}; vereadores casados ${Object.keys(r.porVereador).length}/${vereadores.length}`);
}
