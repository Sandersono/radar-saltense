import assert from 'node:assert/strict';
import { vistoriar, OBRIGATORIAS } from '../src/vistoria.js';

const corpo = (extra = '') => `<html><body><main><h1>Título</h1><p>${'texto '.repeat(120)}</p>${extra}</main></body></html>`;
const base = OBRIGATORIAS.map((caminho) => ({ caminho, html: corpo() }));
const arquivos = [...OBRIGATORIAS, 'estilo.css', 'vereador/a.html'];

// Tudo certo
assert.deepEqual(vistoriar([...base, { caminho: 'vereador/a.html', html: corpo('<a href="../index.html">x</a>') }], arquivos), { bloqueios: [], avisos: [] });

// CPF bloqueia: no texto, em atributo, em script ou num arquivo de dados publicado
const comCpf = (extra) => vistoriar([...base.slice(1), { caminho: 'index.html', html: corpo(extra) }], arquivos).bloqueios.length;
assert.equal(comCpf('<p>CPF 123.456.789-01</p>'), 1);
assert.equal(comCpf('<img alt="123.456.789-01">'), 1);
assert.equal(vistoriar(base, arquivos, [{ caminho: 'dados/busca.json', conteudo: '["x 123.456.789-01"]' }]).bloqueios.length, 1);
// Não confunde com CNPJ, valor, número de processo com mais grupos
assert.equal(comCpf('<p>46.634.507/0001-06 · 1.234.567,89 · 1.234.567.890-12 · 12.345.678.901-23 · 123.456.789-012</p>'), 0);

// Página obrigatória faltando ou vazia bloqueia
assert.equal(vistoriar(base.slice(1), arquivos).bloqueios.length, 1);
assert.equal(vistoriar([...base.slice(1), { caminho: 'index.html', html: '<main></main>' }], arquivos).bloqueios.length, 1);

// Avisos: link quebrado, âncora inexistente, undefined/NaN/null, valor negativo
const a = vistoriar([...base.slice(1), { caminho: 'index.html', html: corpo('<a href="nada.html">x</a><a href="camara.html#custo">y</a><p>Total: NaN e null</p><p>R$ -5</p>') }], arquivos);
assert.equal(a.bloqueios.length, 0);
assert.equal(a.avisos.length, 3);
assert.ok(a.avisos.some((x) => x.includes('nada.html') && x.includes('camara.html#custo')));
assert.ok(a.avisos.some((x) => x.includes('NaN')));
assert.ok(a.avisos.some((x) => x.includes('negativo')));

// Links externos e âncoras existentes não geram aviso; "nulla" ou "anulado" não contam como null
assert.equal(vistoriar([...base.slice(1), { caminho: 'index.html', html: corpo('<a href="https://x.gov.br/a#b">x</a><a href="#ok" id="ok">y</a><p>valor anulado</p>') }], arquivos).avisos.length, 0);
console.log('vistoria: ok');
