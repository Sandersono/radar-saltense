import { readFile } from 'node:fs/promises';
import { salvar } from '../coleta/http.js';
import { coletarContratos } from '../coleta/contratos.js';

const ARQ = 'data/processado/contratos.json';
const anoAtual = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()).slice(0, 4));
const anos = [...new Set([2025, anoAtual])];

let existente = {};
try { existente = JSON.parse(await readFile(ARQ, 'utf8')); } catch { /* primeira execução */ }

const t0 = Date.now();
let novos;
let falha = null;
try { novos = await coletarContratos(anos); } catch (e) { falha = e; novos = e.anosCompletos ?? {}; }
// Só anos completos substituem os salvos.
const dados = { ...existente, ...novos };
if (Object.keys(novos).length) await salvar(ARQ, `${JSON.stringify(dados, null, 2)}\n`);

for (const [ano, d] of Object.entries(novos)) {
  const { total, semDisputa, porModalidade, semHomologado } = d.contratacoes;
  console.log(`${ano}: ${total.quantidade} contratações (homologado R$ ${total.valor}; ${semHomologado.quantidade} sem valor homologado); sem licitação ${semDisputa.pctQuantidade}% da qtd, ${semDisputa.pctValor}% do valor`);
  console.log(`  ${d.contratos.quantidade} contratos (R$ ${d.contratos.valor}) + ${d.contratos.empenhos.quantidade} empenhos (R$ ${d.contratos.empenhos.valor})`);
  console.log('  ', Object.values(porModalidade).map((m) => `${m.nome} ${m.quantidade}`).join(', '));
}
console.log(`${Math.round((Date.now() - t0) / 1000)}s`);
if (falha) throw falha;
