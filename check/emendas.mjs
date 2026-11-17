import assert from 'node:assert/strict';
import { iniciaisDe, casarIniciais, resumirEmendas, nomesPdf, pdfsNovos } from '../src/regras/emendas.js';

assert.equal(iniciaisDe('Almir de Melo Santos'), 'AMS');
assert.equal(iniciaisDe('Graziela Costa Leite'), 'GCL');
assert.equal(iniciaisDe('Luzia de Fátima Izidório Vidal'), 'LFIV');

const vs = [
  { id: 'almir', nome: 'Almir de Melo Santos' },
  { id: 'antonio', nome: 'Antônio Moreira Sobrinho' },
  { id: 'graziela', nome: 'Graziela Costa Leite' },
];
assert.equal(casarIniciais('AMS', vs), null);
assert.equal(casarIniciais('AMS', vs, { AMS: 'almir' }), 'almir');
assert.equal(casarIniciais('GCL', vs), 'graziela');
assert.equal(casarIniciais('XYZ', vs), null);

const r = resumirEmendas([
  { vereador: 'almir', valor: 1000, pago: 1000, situacao: 'CONCLUÍDA' },
  { vereador: 'almir', valor: 500, pago: 0, situacao: 'DEVOLVIDA' },
  { vereador: 'graziela', valor: 200, pago: 200, situacao: 'CONCLUÍDA' },
]);
assert.deepEqual(r.porVereador.almir, { total: 1500, pago: 1000, quantidade: 2, situacoes: { 'CONCLUÍDA': 1, DEVOLVIDA: 1 } });
assert.deepEqual(r.porVereador.graziela, { total: 200, pago: 200, quantidade: 1, situacoes: { 'CONCLUÍDA': 1 } });
assert.equal(r.total, 1700);
assert.equal(r.pago, 1200);
assert.deepEqual(r.situacoes, { 'CONCLUÍDA': 2, DEVOLVIDA: 1 });

// Robô: PDFs da categoria que a ferramenta ainda não viu.
const html = '<a href="/pdf/x/Tabela%20-%2031.08.2026.pdf">a</a> <a href="/pdf/x/Tabela%20-%2031.08.2026.pdf">b</a> <a href="/pdf/x/Nova.pdf">c</a> <a href="/outro.html">d</a>';
assert.deepEqual(nomesPdf(html), ['/pdf/x/Tabela - 31.08.2026.pdf', '/pdf/x/Nova.pdf']);
assert.deepEqual(pdfsNovos(nomesPdf(html), { arquivos: ['/pdf/x/Tabela - 31.08.2026.pdf'] }), ['/pdf/x/Nova.pdf']);
assert.deepEqual(pdfsNovos(nomesPdf(html), { fonte: 'https://c.br/pdf/x/Nova.pdf' }), ['/pdf/x/Tabela - 31.08.2026.pdf']);
console.log('emendas ok');
