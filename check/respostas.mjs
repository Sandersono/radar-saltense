import assert from 'node:assert/strict';
import { lerRespostas, filaRespostas, resumoRespostas } from '../src/regras/respostas.js';

const com = 'Anexos\nNome: Resp. Req. 752-25 - X.pdf\nTipo Documento: Resposta Requerimento\nData Documento: 03/02/2026\nDownload\nNome: Req. 752-25 - X.pdf\nTipo Documento: Requerimento\nData Documento: 10/12/2025\nDownload\nTotal 2';
const sem = 'Anexos\nNome: Req. 1-26.pdf\nTipo Documento: Requerimento\nData Documento: 05/01/2026\nTotal 1';
const duas = 'Tipo Documento: Resposta Requerimento\nData Documento: 20/03/2026\nTipo Documento: Resposta Requerimento\nData Documento: 01/03/2026';
assert.deepEqual(lerRespostas(com), { respondido: true, data: '2026-02-03' });
assert.deepEqual(lerRespostas(sem), { respondido: false, data: null });
assert.deepEqual(lerRespostas(duas), { respondido: true, data: '2026-03-01' });

const reqs = [
  { id: '1', data: '2026-11-01', vereadores: ['a'] },
  { id: '2', data: '2026-10-01', vereadores: ['a', 'b'] },
  { id: '3', data: '2026-09-01', vereadores: ['b'] },
  { id: '4', data: '2026-01-01', vereadores: ['b'] },
  { id: '5', data: '2026-08-01', vereadores: ['a'] },
];
const estado = {
  '3': { respondido: false, data: null, conferidoEm: '2026-11-10' },
  '4': { respondido: false, data: null, conferidoEm: '2026-11-01' },
  '5': { respondido: false, data: null, conferidoEm: '2026-11-05' },
};
// nunca conferidos (mais novos primeiro), depois pendentes de até 180 dias conferidos há mais tempo; o 4 tem mais de 180 dias
assert.deepEqual(filaRespostas(estado, reqs, '2026-11-16', 10), ['1', '2', '5', '3']);
assert.deepEqual(filaRespostas(estado, reqs, '2026-11-16', 3), ['1', '2', '5']);
assert.deepEqual(filaRespostas({ ...estado, '5': { ...estado['5'], conferidoEm: '2026-11-16' } }, reqs, '2026-11-16', 10), ['1', '2', '3']);

const est2 = {
  '1': { respondido: true, data: '2026-11-11', conferidoEm: '2026-11-16' },
  '2': { respondido: true, data: '2026-10-31', conferidoEm: '2026-11-16' },
  '3': { respondido: false, data: null, conferidoEm: '2026-11-16' },
};
const r = resumoRespostas(est2, reqs);
assert.deepEqual(r.geral, { feitos: 5, conferidos: 3, respondidos: 2, percentual: 67, medianaDias: 20 });
assert.deepEqual(r.porVereador.a, { feitos: 3, conferidos: 2, respondidos: 2, percentual: 100, medianaDias: 20 });
assert.deepEqual(r.porVereador.b, { feitos: 3, conferidos: 2, respondidos: 1, percentual: 50, medianaDias: 30 });
console.log('ok: respostas');
