import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validarEntenda, PLACEHOLDERS, chavesDe } from '../src/site/entenda.js';

// Contrato de data/referencia/entenda.json (spec 2026-11-17): o exemplo e, quando existe, o arquivo real.
const exemplo = JSON.parse(await readFile('check/fixtures/entenda-exemplo.json', 'utf8'));
assert.deepEqual(validarEntenda(exemplo), []);

// Cada regra do contrato pega o erro.
const um = (mudar) => { const e = structuredClone(exemplo); mudar(e); return validarEntenda(e); };
assert.ok(um((e) => { e.artigos[1].slug = e.artigos[0].slug; }).some((x) => /slug repetido/.test(x)));
assert.ok(um((e) => { e.artigos[0].slug = 'Com Espaço'; }).some((x) => /slug inválido/.test(x)));
assert.ok(um((e) => { e.artigos[0].descricao = 'x'.repeat(156); }).some((x) => /156 caracteres/.test(x)));
assert.ok(um((e) => { e.artigos[0].fontes[0].url = 'http://www.planalto.gov.br/'; }).some((x) => /https/.test(x)));
assert.ok(um((e) => { e.artigos[0].relacionados.push('nao-existe.html'); }).some((x) => /relacionado inexistente/.test(x)));
assert.ok(um((e) => { e.artigos[0].relacionados.push('entenda/outro.html'); }).some((x) => /relacionado inexistente/.test(x)));
assert.ok(um((e) => { e.artigos[0].resumo += ' Custa {{custoInventado}}.'; }).some((x) => /desconhecido \{\{custoInventado\}\}/.test(x)));
assert.ok(um((e) => { e.artigos[0].resumo += ' Custa {{custoCamaraMes}.'; }).some((x) => /mal fechadas/.test(x)));
assert.ok(um((e) => { e.artigos[0].titulo = 'Os {{numeroVereadores}} vereadores'; }).some((x) => /título não pode/.test(x)));
assert.ok(um((e) => { delete e.artigos[0].secoes; }).some((x) => /secoes/.test(x)));
assert.ok(um((e) => { e.artigos[0].perguntas[0].pergunta = 'Sem interrogação'; }).some((x) => /"\?"/.test(x)));
assert.ok(um((e) => { e.faq[0].link = 'sumiu.html'; }).some((x) => /link inexistente/.test(x)));
assert.ok(um((e) => { delete e.faq[0].grupo; }).some((x) => /grupo/.test(x)));
assert.deepEqual(validarEntenda([]), ['entenda.json não é um objeto']);

// O arquivo real, quando a frente de conteúdo já o escreveu.
let real = null;
try { real = JSON.parse(await readFile('data/referencia/entenda.json', 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
if (real) {
  assert.deepEqual(validarEntenda(real), [], 'data/referencia/entenda.json fora do contrato');
  for (const k of chavesDe(JSON.stringify(real))) assert.ok(PLACEHOLDERS.includes(k), k);
}
console.log(`entenda: ok${real ? ` (arquivo real: ${real.artigos.length} textos, ${real.faq.length} perguntas)` : ' (sem arquivo real)'}`);
