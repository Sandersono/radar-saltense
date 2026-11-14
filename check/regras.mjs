import assert from 'node:assert/strict';
import { normalizar, slug, limparHtml } from '../src/util/texto.js';

assert.equal(normalizar('  Antônio   Moreira '), 'antonio moreira');
assert.equal(slug('Luzia de Fátima Izidório Vidal'), 'luzia-de-fatima-izidorio-vidal');
assert.equal(limparHtml('a<br>b &amp; <strong>c</strong>'), 'a b & c');
console.log('ok: texto');

import { criarCasador, dividirNomes } from '../src/regras/nomes.js';
import { classificar } from '../src/regras/classificar.js';

{
  const casar = criarCasador([
    { id: 'antonio', nome: 'Antônio Moreira Sobrinho' },
    { id: 'rogerio', nome: 'Rogério dos Santos Filho' },
    { id: 'edival', nome: 'Edival Pereira Rosa' },
  ]);
  assert.equal(casar('Antonio Moreira Sobrinho'), 'antonio');
  assert.equal(casar('Rogério'), 'rogerio');
  assert.equal(casar('Edival Pereira Rosa Preto'), 'edival');
  assert.equal(casar('Comissão de Finanças'), null);
  assert.equal(casar('Prefeitura da Estância Turística de Salto'), null);
  assert.throws(() => criarCasador([{ id: 'a', nome: 'Ana X' }, { id: 'b', nome: 'Ana Y' }]));
  assert.deepEqual(dividirNomes('Graziela, Michel, Antônio'), ['Graziela', 'Michel', 'Antônio']);
  assert.deepEqual(dividirNomes('e Arildo'), ['Arildo']);
  assert.deepEqual(dividirNomes('Graziela e Edemilson'), ['Graziela', 'Edemilson']);
  console.log('ok: nomes');
}

{
  assert.equal(classificar('Indicação', 'Solicitando tamponamento'), 'melhoria');
  assert.equal(classificar('Requerimento', 'Solicitando informações'), 'cobranca');
  assert.equal(classificar('Moção', 'Moção de Congratulações aos profissionais'), 'homenagem');
  assert.equal(classificar('Moção', 'Moção de Pesar pelo falecimento'), 'homenagem');
  assert.equal(classificar('Moção', 'Moção de repúdio ao aumento da tarifa'), 'outros');
  assert.equal(classificar('Decreto Legislativo', 'Concede Título de Cidadão Salteense a Fulano'), 'homenagem');
  assert.equal(classificar('Decreto Legislativo', 'Institui a honraria Maria de Lourdes Guarda'), 'homenagem');
  assert.equal(classificar('Lei Ordinária', 'Denomina Rua Fulano de Tal'), 'homenagem');
  assert.equal(classificar('Lei Ordinária', 'Institui o Dia Municipal do Ciclista'), 'homenagem');
  assert.equal(classificar('Lei Ordinária', 'Institui sobre o Selo Empresa Amiga 60+'), 'lei');
  assert.equal(classificar('Ementa Lei Orgânica', 'Modifica a redação do Art. 73'), 'lei');
  assert.equal(classificar('Portaria', 'Designa servidor'), 'administrativo');
  assert.equal(classificar('Atos da Mesa', 'Ponto facultativo'), 'administrativo');
  console.log('ok: classificar');
}
