import { readFile } from 'node:fs/promises';
import { salvar } from '../coleta/http.js';
import { coletarRespostas } from '../coleta/respostas.js';
import { filaRespostas, resumoRespostas, serializarRespostas } from '../regras/respostas.js';

const ARQ = 'data/processado/respostas.json';
const i = process.argv.indexOf('--limite');
const limite = i > 0 ? Number(process.argv[i + 1]) : Infinity;

const dados = JSON.parse(await readFile('data/processado/dados.json', 'utf8'));
const reqs = dados.proposituras.filter((p) => p.categoria === 'Requerimento').map((p) => ({ id: p.id, data: p.data, vereadores: p.vereadores }));
let estado = {};
try { estado = JSON.parse(await readFile(ARQ, 'utf8')); } catch { /* primeira execução */ }
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

const fila = filaRespostas(estado, reqs, hoje, limite);
console.log(`Fila: ${fila.length} requerimentos`);
for (let k = 0; k < fila.length; k += 50) {
  const { estado: novos, falhas, interrompido } = await coletarRespostas(fila.slice(k, k + 50), hoje, Infinity);
  estado = { ...estado, ...novos };
  await salvar(ARQ, serializarRespostas(estado));
  console.log(`${Math.min(k + 50, fila.length)}/${fila.length} (falhas no lote: ${falhas.length}${falhas.length ? `; ids: ${falhas.join(', ')}` : ''})`);
  if (interrompido) { console.log(`Interrompido (${interrompido}); rode de novo para continuar.`); break; }
}
console.log(resumoRespostas(estado, reqs).geral);
