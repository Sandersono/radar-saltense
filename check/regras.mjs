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
  assert.equal(casar('Mesa da Câmara da Estância Turística de Salto'), null);
  assert.equal(casar('Frente Parlamentar'), null);
  assert.equal(casar(''), null);
  assert.throws(() => criarCasador([{ id: 'a', nome: 'Ana X' }, { id: 'b', nome: 'Ana Y' }]), /repetido/);
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
  assert.equal(classificar('Moção', 'Moção de repúdio, apesar dos apelos da população'), 'outros');
  assert.equal(classificar('Decreto Legislativo', 'Recomenda ao Executivo estudo de tráfego'), 'lei');
  assert.equal(classificar('Lei Ordinária', 'Institui o diagnóstico precoce de autismo'), 'lei');
  assert.equal(classificar('Lei Complementar', 'Altera o Código Tributário'), 'lei');
  assert.equal(classificar('Resolução', 'Institui a Semana do Legislativo Jovem'), 'homenagem');
  assert.equal(classificar('Ato da Presidência', 'Dispõe sobre normas administrativas'), 'administrativo');
  assert.equal(classificar('Categoria Nova', 'qualquer coisa'), 'outros');
  console.log('ok: classificar');
}

import { extrairLocais, tiposPedido } from '../src/regras/local.js';

{
  const fmt = (t) => extrairLocais(t).map((l) => `${l.tipo}:${l.nome}`);
  assert.deepEqual(
    fmt('Vereador Edemilson – Solicitando a manutenção da área de lazer no Bairro Santa Lúcia, especialmente nas Ruas Tangará e Melvin Jones.'),
    ['bairro:Santa Lúcia', 'rua:Rua Tangará', 'rua:Rua Melvin Jones'],
  );
  assert.deepEqual(
    fmt('Solicitando o tamponamento de buracos em toda a extensão das Avenidas Nações Unidas e Valter Nardelli; em toda a extensão da Rua São Felipe, no Bairro Jardim São Judas.'),
    ['rua:Avenida Nações Unidas', 'rua:Avenida Valter Nardelli', 'rua:Rua São Felipe', 'bairro:Jardim São Judas'],
  );
  assert.deepEqual(fmt('Solicitando reparos no Jd. Saltense'), ['bairro:Jardim Saltense']);
  assert.deepEqual(fmt('na Rua 9 de Julho em frente à Caixa Econômica'), ['rua:Rua 9 de Julho']);
  assert.deepEqual(
    fmt('revitalização do parque localizado entre as Ruas Irã e Marechal Deodoro, no Jardim das Nações.'),
    ['rua:Rua Irã', 'rua:Rua Marechal Deodoro', 'bairro:Jardim das Nações'],
  );
  assert.deepEqual(fmt('limpeza no Centro de Convivência José Lisboa'), []);
  assert.deepEqual(fmt('recape da Rua 9 de Julho, no Centro.'), ['rua:Rua 9 de Julho', 'bairro:Centro']);
  assert.equal(extrairLocais('na Rua São Felipe')[0].chave, 'rua sao felipe');
  assert.deepEqual(tiposPedido('Solicitando o tamponamento de buracos e o nivelamento da Rua Rússia'), ['buraco', 'asfalto']);
  assert.deepEqual(tiposPedido('Solicitando a desobstrução e a manutenção dos bueiros'), ['drenagem']);
  assert.deepEqual(tiposPedido('Solicitando informações sobre o formato do edital'), []);
  console.log('ok: local');
}

import { lerCard } from '../src/regras/apex.js';
import { lerVereadores } from '../src/regras/vereadores-html.js';
import { linkCategoriaAno, linksPdfPresenca, mesDoArquivo } from '../src/regras/presenca-html.js';

{
  const B = 'https://www.camarasalto.sp.gov.br';
  assert.deepEqual(
    lerCard({
      id: 92700,
      titulo: '<strong>Categoria:</strong> Indicação</br><strong>Número do Documento:</strong> 2062</br><strong>Autor(es):</strong> Almir de Melo Santos</br><strong> Data:</strong> 10/11/2026 00:00:00',
      texto: 'Vereador Almir – Solicitando o tamponamento de buracos na Rua São Joaquim.<br><strong> Solução Final: Aprovado</strong>',
    }),
    {
      id: '92700', categoria: 'Indicação', numero: '2062', autores: ['Almir de Melo Santos'], data: '2026-11-10',
      ementa: 'Vereador Almir – Solicitando o tamponamento de buracos na Rua São Joaquim.', solucao: 'Aprovado',
    },
  );

  const home = `<a href="/vereador-almir-de-melo-santos">
    <img src="https://camarasalto.sp.gov.br/images/legislatura-2024-2028/almir_de_melo_santos.jpg" alt="Almir de Melo Santos (PRD)" class="img-thumbnail img_profile">
    <div class="name_profile">Almir de Melo Santos (PRD)</div></a>
    <a href="/vereador-arildo-guadagnini"><img src="https://camarasalto.sp.gov.br/images/a.jpg" class="img_profile">
    <div class="name_profile">Arildo Guadagnini (Democracia Cristã)</div></a>`;
  assert.deepEqual(lerVereadores(home, B), [
    { id: 'almir-de-melo-santos', nome: 'Almir de Melo Santos', partido: 'PRD', url: `${B}/vereador-almir-de-melo-santos`, foto: 'https://camarasalto.sp.gov.br/images/legislatura-2024-2028/almir_de_melo_santos.jpg' },
    { id: 'arildo-guadagnini', nome: 'Arildo Guadagnini', partido: 'Democracia Cristã', url: `${B}/vereador-arildo-guadagnini`, foto: 'https://camarasalto.sp.gov.br/images/a.jpg' },
  ]);

  const indice = '<a href="/sessoes/presenca-dos-vereadores/category/346-2025">2025</a><a href="/sessoes/presenca-dos-vereadores/category/608-2026">2026</a>';
  assert.equal(linkCategoriaAno(indice, 2025, B), `${B}/sessoes/presenca-dos-vereadores/category/346-2025`);
  assert.equal(linkCategoriaAno(indice, 2019, B), null);
  const lista = '<a href="/pdf/presenca-dos-vereadores/2025/presenca-reunioes-março-2025.pdf">a</a><a href="/pdf/presenca-dos-vereadores/2025/presenca-reunioes-agosto-2025 II.pdf">b</a><a href="/pdf/presenca-dos-vereadores/2025/presenca-reunioes-março-2025.pdf">a</a>';
  const links = linksPdfPresenca(lista, B);
  assert.equal(links.length, 2);
  assert.deepEqual(mesDoArquivo(links[0]), { mes: 3, ano: 2025 });
  assert.deepEqual(mesDoArquivo(links[1]), { mes: 8, ano: 2025 });
  console.log('ok: leitores html');
}
