import assert from 'node:assert/strict';
import { normalizar, slug, limparHtml, anoMesBR } from '../src/util/texto.js';

assert.equal(normalizar('  Antônio   Moreira '), 'antonio moreira');
assert.equal(slug('Luzia de Fátima Izidório Vidal'), 'luzia-de-fatima-izidorio-vidal');
assert.equal(limparHtml('a<br>b &amp; <strong>c</strong>'), 'a b & c');
assert.deepEqual(anoMesBR(Date.parse('2027-01-01T02:00:00Z')), { ano: 2026, mes: 12 });
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
  assert.equal(casar('Antônio.'), 'antonio');
  assert.deepEqual(dividirNomes('Graziela, Michel e Arildo.'), ['Graziela', 'Michel', 'Arildo']);
  assert.equal(casar('Antônio Cordeiro dos Santos'), null);
  assert.equal(casar('Edival Pereira Rosa Preto'), 'edival');
  assert.equal(casar('Antonio'), 'antonio');
  assert.equal(casar('Rogerio dos Santos'), 'rogerio');
  assert.equal(casar('Rogério Alves Filho'), null);
  assert.equal(casar('Antônio Moreira'), 'antonio');
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
  assert.equal(extrairLocais('na Rua Dr. Barros Júnior, no Centro')[0].nome, 'Rua Dr Barros Júnior');
  assert.equal(extrairLocais('Avenida Prof. Fulano de Tal')[0].nome, 'Avenida Prof Fulano de Tal');
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
    <div class="name_profile">Arildo Guadagnini (Democracia Cristã)</div></a>
    <a href="/vereadora-graziela-costa-leite"><img src="https://camarasalto.sp.gov.br/images/g.jpg" class="img_profile">
    <div class="name_profile">Graziela Costa Leite (PSB)</div></a>`;
  assert.deepEqual(lerVereadores(home, B), [
    { id: 'almir-de-melo-santos', nome: 'Almir de Melo Santos', partido: 'PRD', url: `${B}/vereador-almir-de-melo-santos`, foto: 'https://camarasalto.sp.gov.br/images/legislatura-2024-2028/almir_de_melo_santos.jpg' },
    { id: 'arildo-guadagnini', nome: 'Arildo Guadagnini', partido: 'Democracia Cristã', url: `${B}/vereador-arildo-guadagnini`, foto: 'https://camarasalto.sp.gov.br/images/a.jpg' },
    { id: 'graziela-costa-leite', nome: 'Graziela Costa Leite', partido: 'PSB', url: `${B}/vereadora-graziela-costa-leite`, foto: 'https://camarasalto.sp.gov.br/images/g.jpg' },
  ]);

  const indice = '<a href="/sessoes/presenca-dos-vereadores/category/346-2025">2025</a><a href="/sessoes/presenca-dos-vereadores/category/608-2026">2026</a>';
  assert.equal(linkCategoriaAno(indice, 2025, B), `${B}/sessoes/presenca-dos-vereadores/category/346-2025`);
  assert.equal(linkCategoriaAno(indice, 2019, B), null);
  const lista = '<a href="/pdf/presenca-dos-vereadores/2025/presenca-reunioes-março-2025.pdf">a</a><a href="/pdf/presenca-dos-vereadores/2025/presenca-reunioes-agosto-2025 II.pdf">b</a><a href="/pdf/presenca-dos-vereadores/2025/presenca-reunioes-março-2025.pdf">a</a>';
  const links = linksPdfPresenca(lista, B);
  assert.equal(links.length, 2);
  assert.deepEqual(mesDoArquivo(links[0]), { mes: 3, ano: 2025 });
  assert.deepEqual(mesDoArquivo(links[1]), { mes: 8, ano: 2025 });
  // Caso real (Indicação 1833/2025): coautores separados por </br> no campo Autor(es).
  const coautoria = lerCard({
    id: 88569,
    titulo: '<strong>Categoria:</strong> Indicação</br><strong>Número do Documento:</strong> 1833</br><strong>Autor(es):</strong> Almir de Melo Santos</br> Antonio Moreira Sobrinho</br> Clayton Aparecido dos Santos</br><strong> Data:</strong> 14/10/2025 00:00:00',
    texto: 'Solicitando algo',
  });
  assert.deepEqual(coautoria.autores, ['Almir de Melo Santos', 'Antonio Moreira Sobrinho', 'Clayton Aparecido dos Santos']);
  assert.equal(coautoria.data, '2025-10-14');
  console.log('ok: leitores html');
}

import { lerPresenca } from '../src/regras/presenca-pdf.js';
import { lerVotacoes } from '../src/regras/votacao-pdf.js';

{
  const itens = [
    { str: 'PRESENÇA DOS VEREADORES - NOVEMBRO 2026', x: 100, y: 800 },
    { str: 'VEREADOR', x: 120, y: 780 }, { str: '3/11', x: 262, y: 780 }, { str: '10/11', x: 300, y: 780 },
    { str: 'Almir de Melo Santos', x: 50, y: 765 }, { str: 'P', x: 268, y: 765 }, { str: 'P', x: 308, y: 765 },
    { str: 'Arildo Guadagnini', x: 50, y: 750 }, { str: 'AJ', x: 266, y: 750 },
    { str: 'LEGENDAS', x: 100, y: 700 }, { str: 'P = PRESENÇA', x: 100, y: 690 },
  ];
  assert.deepEqual(lerPresenca(itens), {
    sessoes: ['3/11', '10/11'],
    linhas: [
      { nome: 'Almir de Melo Santos', marcas: ['P', 'P'] },
      { nome: 'Arildo Guadagnini', marcas: ['AJ', null] },
    ],
  });

  const pagina = [
    { str: 'Nº da', x: 34, y: 503 }, { str: 'Propositura', x: 34, y: 492 }, { str: 'Data da Votação', x: 631, y: 503 },
    { str: 'Projeto de Lei', x: 34, y: 321 }, { str: 'nº 72', x: 34, y: 310 }, { str: '/2025', x: 54, y: 310 },
    { str: 'Dispõe sobre receitas digitadas', x: 105, y: 321 },
    { str: 'Graziela Costa', x: 253, y: 321 }, { str: 'Leite', x: 270, y: 310 },
    { str: '04.11.2025', x: 578, y: 321 },
    { str: 'Projeto aprovado por maioria de votos.', x: 578, y: 310 },
    { str: 'Contra: Rogério', x: 578, y: 288 },
    { str: '15.12.2025', x: 578, y: 277 },
    { str: 'Veto Total ao', x: 34, y: 244 }, { str: 'Autógrafo nº', x: 34, y: 234 }, { str: '69/2025 do', x: 34, y: 223 },
    { str: 'Projeto de Lei', x: 34, y: 211 }, { str: 'nº 72/2025', x: 34, y: 201 },
    { str: 'Prefeitura', x: 261, y: 244 },
    { str: 'Veto rejeitado por unanimidade de votos.', x: 578, y: 244 },
    { str: 'Ausente :', x: 578, y: 233 }, { str: 'Antônio', x: 615, y: 233 },
  ];
  const pagina2 = [
    { str: 'Projeto de Emenda', x: 34, y: 500 }, { str: 'à Lei Orgânica 01/2026', x: 34, y: 489 },
    { str: '31.03.2026', x: 578, y: 500 }, { str: '–', x: 621, y: 500 }, { str: '1º Turno', x: 628, y: 500 },
    { str: 'Veto aprovado por maioria de votos', x: 578, y: 489 },
    { str: 'Contrários ao veto : Graziela, Michel, Antônio', x: 578, y: 478 },
    { str: 'e Arildo', x: 578, y: 467 },
  ];
  const r = lerVotacoes([pagina, pagina2]);
  assert.equal(r.length, 3);
  assert.equal(r[0].rotulo, 'Projeto de Lei nº 72/2025');
  assert.equal(r[0].autor, 'Graziela Costa Leite');
  assert.deepEqual(r[0].eventos.map((e) => [e.data, e.resultado, e.contra, e.ausentes]), [['2025-11-04', 'Projeto aprovado por maioria de votos.', ['Rogério'], []]]);
  assert.equal(r[1].rotulo, 'Veto Total ao Autógrafo nº 69/2025 do Projeto de Lei nº 72/2025');
  assert.equal(r[1].autor, 'Prefeitura');
  assert.deepEqual(r[1].eventos.map((e) => [e.data, e.resultado, e.ausentes]), [['2025-12-15', 'Veto rejeitado por unanimidade de votos.', ['Antônio']]]);
  assert.deepEqual(r[2].eventos.map((e) => [e.data, e.turno, e.contra]), [['2026-03-31', '1º Turno', ['Graziela', 'Michel', 'Antônio', 'Arildo']]]);
  const pagina3 = [
    { str: 'Projeto de Lei nº 44/2026', x: 34, y: 400 },
    { str: '13.10.2026', x: 578, y: 400 },
    { str: 'Artigo 4º rejeitado por maioria de votos.', x: 578, y: 389 },
    { str: 'Contra: Almir, Graziela,', x: 578, y: 378 },
    { str: 'Antonio', x: 578, y: 367 },
    { str: 'Projeto aprovado por maioria de votos.', x: 578, y: 356 },
    { str: 'Contra: Graziela', x: 578, y: 345 },
    { str: 'Projeto de Lei nº 43/2026', x: 34, y: 300 },
    { str: '13.10.2026', x: 578, y: 300 },
    { str: 'Emenda nº 12 – Aprovada por unanimidade de', x: 578, y: 289 },
    { str: 'votos . Ausente : Graziela', x: 578, y: 278 },
    { str: 'Veto Total ao Autógrafo nº 79/2025', x: 34, y: 200 },
    { str: '24.02.2026', x: 578, y: 200 },
    { str: 'Veto aprovado por maioria de votos', x: 578, y: 189 },
    { str: 'Contra: Michel', x: 578, y: 178 },
    { str: 'Com voto de desempate a favor do veto do', x: 578, y: 167 },
    { str: 'presidente Clayton', x: 578, y: 156 },
    { str: 'Projeto de Lei nº 04/2026', x: 34, y: 100 },
    { str: '26.03.2026 Parecer contrário na Comissão', x: 578, y: 100 },
  ];
  const r3 = lerVotacoes([pagina3]);
  assert.deepEqual(r3.map((b) => b.rotulo), ['Projeto de Lei nº 44/2026', 'Projeto de Lei nº 43/2026', 'Veto Total ao Autógrafo nº 79/2025', 'Projeto de Lei nº 04/2026']);
  assert.deepEqual(r3[0].eventos.map((e) => [e.data, e.resultado, e.contra]), [
    ['2026-10-13', 'Artigo 4º rejeitado por maioria de votos.', ['Almir', 'Graziela', 'Antonio']],
    ['2026-10-13', 'Projeto aprovado por maioria de votos.', ['Graziela']],
  ]);
  assert.deepEqual(r3[1].eventos.map((e) => [e.ausentes, e.contra]), [[['Graziela'], []]]);
  assert.match(r3[1].eventos[0].resultado, /^Emenda nº 12 – Aprovada por unanimidade de votos/);
  assert.deepEqual(r3[2].eventos.map((e) => e.contra), [['Michel']]);
  assert.match(r3[2].eventos[0].resultado, /presidente Clayton$/);
  assert.deepEqual(r3[3].eventos, []);
  const r4 = lerVotacoes([[
    { str: 'Substitutivo nº 01 ao Projeto de Lei nº 38/2026', x: 34, y: 400 },
    { str: 'Veto Parcial ao Autógrafo nº 44/2026', x: 34, y: 385 },
    { str: '10.11.2026', x: 578, y: 385 },
    { str: 'Veto mantido por maioria de votos', x: 578, y: 374 },
  ]]);
  assert.deepEqual(r4.map((b) => b.rotulo), ['Substitutivo nº 01 ao Projeto de Lei nº 38/2026', 'Veto Parcial ao Autógrafo nº 44/2026']);
  assert.equal(r4[1].eventos.length, 1);
  const r5 = lerVotacoes([
    [
      { str: 'Projeto de Lei', x: 34, y: 120 }, { str: 'nº 72', x: 34, y: 109 }, { str: '/2025', x: 54, y: 109 },
      { str: '04.11.2025', x: 578, y: 120 }, { str: 'Projeto aprovado por unanimidade de votos.', x: 578, y: 109 },
    ],
    [
      { str: 'Projeto de Lei nº 73/2025', x: 34, y: 500 },
      { str: '05.11.2025', x: 578, y: 500 }, { str: 'Projeto rejeitado por maioria de votos.', x: 578, y: 489 },
    ],
  ]);
  assert.deepEqual(r5.map((b) => [b.rotulo, b.eventos.length]), [['Projeto de Lei nº 72/2025', 1], ['Projeto de Lei nº 73/2025', 1]]);
  const dez = [
    { str: 'PRESENÇA DOS VEREADORES - DEZEMBRO 2025', x: 76, y: 774 },
    { str: '15/12', x: 289, y: 756 }, { str: '15/12', x: 349, y: 756 },
    { str: 'VEREADOR', x: 96, y: 744 }, { str: '02/12', x: 209, y: 744 }, { str: '09/12', x: 242, y: 744 },
    { str: '(1ª Reunião do', x: 275, y: 744 }, { str: '(2ª Reunião', x: 341, y: 744 },
    { str: 'dia)', x: 296, y: 732 }, { str: 'do dia)', x: 350, y: 732 },
    { str: 'Almir de Melo Santos', x: 39, y: 715 }, { str: 'P', x: 220, y: 715 }, { str: 'P', x: 253, y: 715 }, { str: 'P', x: 300, y: 715 }, { str: 'A', x: 360, y: 715 },
    { str: 'Arildo Guadagnini', x: 39, y: 701 },
    { str: 'LEGENDAS', x: 100, y: 600 },
  ];
  assert.deepEqual(lerPresenca(dez), {
    sessoes: ['02/12', '09/12', '15/12', '15/12'],
    linhas: [
      { nome: 'Almir de Melo Santos', marcas: ['P', 'P', 'P', 'A'] },
      { nome: 'Arildo Guadagnini', marcas: [null, null, null, null] },
    ],
  });
  console.log('ok: leitores pdf');
}

import { conferir, aumentosDespesas } from '../src/conferir.js';

{
  const base = {
    vereadores: Array.from({ length: 11 }, (_, i) => ({ id: String(i) })),
    presencasLidas: [{ arquivo: 'a.pdf', linhas: 11 }],
    votacoesLidas: [{ ano: 2026, blocos: 5, semEventos: 0 }],
    proposituras: [{}],
    receitas: { anoAnterior: { ano: 2025, mesesPublicados: 12 } },
    gastos: { anos: { 2026: { areas: { bimestre: 4, total: 300, somaAreas: 300, lista: [] } } }, novas: [], empresas: [] },
    meta: { totalProposituras: 100, atualizadoEm: '2026-11-14T09:00:00Z', receitasMensais: { '2026-09': 100 } },
  };
  assert.deepEqual(conferir(base, { totalProposituras: 90 }, 11), []);
  assert.deepEqual(conferir(base, null, 11), []);
  assert.equal(conferir({ ...base, meta: { totalProposituras: 80 } }, { totalProposituras: 90 }, 11).length, 1);
  assert.equal(conferir({ ...base, presencasLidas: [{ arquivo: 'a.pdf', linhas: 10 }] }, null, 11).length, 1);
  assert.equal(conferir({ ...base, vereadores: base.vereadores.slice(1) }, null, 11).length, 1);
  assert.equal(conferir({ ...base, votacoesLidas: [{ ano: 2026, blocos: 0, semEventos: 0 }] }, null, 11).length, 1);
  assert.equal(conferir({ ...base, presencasLidas: [] }, null, 11).length, 1);
  assert.equal(conferir({ ...base, votacoesLidas: [] }, null, 11).length, 1);
  assert.equal(conferir({ ...base, proposituras: [] }, null, 11).length, 1);
  assert.equal(conferir({ ...base, receitas: null }, null, 11).length, 1);
  const anoIncompleto = { ...base, receitas: { anoAnterior: { ano: 2025, mesesPublicados: 11 } } };
  assert.equal(conferir(anoIncompleto, null, 11).length, 0);
  assert.equal(conferir({ ...anoIncompleto, meta: { ...base.meta, atualizadoEm: '2026-02-10T09:00:00Z' } }, null, 11).length, 0);
  assert.equal(conferir({ ...base, meta: { ...base.meta, receitasMensais: {} } }, { totalProposituras: 90, receitasMensais: { '2026-09': 100 } }, 11).length, 1);
  assert.equal(conferir({ ...base, meta: { ...base.meta, receitasMensais: { '2026-09': 90 } } }, { totalProposituras: 90, receitasMensais: { '2026-09': 100 } }, 11).length, 1);
  assert.equal(conferir({ ...base, meta: { ...base.meta, receitasMensais: { '2026-09': 96 } } }, { totalProposituras: 90, receitasMensais: { '2026-09': 100 } }, 11).length, 0);
  assert.equal(conferir({ ...base, receitas: { anoAtual: 2027, anoAnterior: { ano: 2026, mesesPublicados: 12 } } }, { totalProposituras: 90, receitasMensais: { '2025-05': 100 } }, 11).length, 0);
  assert.match(conferir({ ...base, meta: { ...base.meta, receitasMensais: { '2026-09': 90 } } }, { totalProposituras: 90, receitasMensais: { '2026-09': 100 } }, 11)[0], /R\$ 100.*R\$ 90.*meta\.json/);
  const antD = { totalProposituras: 90, despesasMensais: { '2026-09': 1000 } };
  const comD = (m) => ({ ...base, meta: { ...base.meta, despesasMensais: m } });
  assert.equal(conferir({ ...base, gastos: null }, null, 11).length, 1);
  assert.equal(conferir(comD({ '2026-09': 1000 }), antD, 11).length, 0);
  assert.equal(conferir(comD({}), antD, 11).length, 1);
  assert.equal(conferir(comD({ '2026-09': 1060 }), antD, 11).length, 0);
  assert.equal(conferir(comD({ '2026-09': 940 }), antD, 11).length, 1);
  assert.equal(conferir(comD({ '2026-09': 1040 }), antD, 11).length, 0);
  assert.equal(conferir(comD({ '2026-09': 500 }), { totalProposituras: 90, despesasMensais: { '2026-09': 0 } }, 11).length, 0);
  const sobe = aumentosDespesas({ despesasMensais: { '2026-09': 1060 } }, antD);
  assert.equal(sobe.length, 1);
  assert.match(sobe[0], /subiu mais de 5%/);
  assert.deepEqual(aumentosDespesas({ despesasMensais: { '2026-09': 1040 } }, antD), []);
  assert.deepEqual(aumentosDespesas({ despesasMensais: { '2026-09': 1060 } }, null), []);
  assert.equal(conferir({ ...base, gastos: { anos: { 2026: { areas: { bimestre: 4, total: 300, somaAreas: 290, lista: [] } } }, novas: [], empresas: [] } }, null, 11).length, 1);
  assert.equal(conferir({ ...base, gastos: { anos: { 2026: { areas: null } }, novas: [], empresas: [] } }, null, 11).length, 0);
  console.log('ok: conferir');
}

import { valorBR, grupoReceita, tipoImposto, resumirReceitas, montarImpostometro, valorContador } from '../src/regras/receitas.js';

{
  const P = 'PREFEITURA MUNICIPAL DE SALTO';
  const L = (alinea, v = '0,00', orgao = P) => ({ orgao, ds_alinea: alinea, vl_arrecadacao: v });
  assert.equal(valorBR('1.234,56'), 1234.56);
  assert.equal(valorBR('-10,00'), -10);
  assert.throws(() => valorBR('abc'));
  assert.throws(() => valorBR(''));
  assert.throws(() => valorBR(undefined));
  assert.equal(valorBR('-1.234,56'), -1234.56);
  assert.equal(valorBR('2994,49'), 2994.49);

  const IPTU = '11125001 - Imposto sobre a Propriedade Predial e Territorial Urbana';
  assert.deepEqual([grupoReceita(L(IPTU)), tipoImposto(L(IPTU))], ['impostos', 'iptu']);
  assert.equal(tipoImposto(L('11125300 - Impostos sobre Transmissão &quot;Inter Vivos&quot; de Bens Imóveis')), 'itbi');
  assert.equal(tipoImposto(L('11145100 - Impostos sobre Serviços de Qualquer Natureza')), 'iss');
  assert.equal(tipoImposto(L('11130311 - Imposto sobre a Renda - Retido na Fonte - Trabalho')), 'ir');
  assert.deepEqual([grupoReceita(L('11210400 - Taxa de Controle e Fiscalização Ambiental')), tipoImposto(L('11210400 - Taxa de Controle e Fiscalização Ambiental'))], ['impostos', 'taxas']);
  assert.equal(grupoReceita(L('17215010 - Cota-Parte do ICMS')), 'estado');
  assert.equal(grupoReceita(L('17115110 - Cota-Parte do Fundo de Participação dos Municípios')), 'uniao');
  assert.equal(grupoReceita(L('17515000 - Transferências de Recursos do FUNDEB')), 'fundeb');
  assert.equal(grupoReceita(L('21120000 - Operações de Crédito Internas')), 'emprestimos');
  assert.equal(grupoReceita(L('79230000 - Outros Ressarcimentos - Intra OFSS')), 'fora');
  assert.equal(grupoReceita(L('16990000 - Serviços Sujeitos à Regulação', '1,00', 'SERVICO AUTONOMO DE AGUA E ESGOTO DE SALTO - SAAE SALTO')), 'saae');
  assert.equal(grupoReceita(L('13210100 - Remuneração de Depósitos Bancários')), 'outras');

  const r1 = resumirReceitas({
    '2026-09': [L(IPTU, '1.000,00'), L('11145100 - Impostos sobre Serviços', '500,50'), L(IPTU, '-100,00'),
      L('17215010 - Cota-Parte do ICMS', '2.000,00'), L('79230000 - Intra', '50,00'),
      L('16990000 - Serviços', '300,00', 'SERVICO AUTONOMO DE AGUA E ESGOTO DE SALTO - SAAE SALTO')],
    '2026-10': [],
  });
  assert.deepEqual(Object.keys(r1.meses), ['2026-09']);
  assert.deepEqual(r1.meses['2026-09'], { grupos: { impostos: 1400.5, estado: 2000, saae: 300 }, tipos: { iptu: 900, iss: 500.5 }, impostos: 1400.5, fora: 50 });

  // 12 meses publicados (out/2025 a set/2026), R$ 1.000 de IPTU cada; out/2025 a set/2026 somam 365 dias.
  const porMes = {};
  for (const m of ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']) porMes[m] = [L(IPTU, '1.000,00')];
  const imp = montarImpostometro(resumirReceitas(porMes), 2026);
  assert.equal(imp.ultimoMesOficial, '2026-09');
  assert.equal(imp.fimOficial, '2026-09-30');
  assert.equal(imp.oficialAno, 9000);
  assert.equal(imp.inicioEstimativa, '2026-10-01');
  assert.ok(Math.abs(imp.ritmoDiario - 12000 / 365) < 1e-9);
  assert.deepEqual(imp.anoAnterior, { ano: 2025, mesesPublicados: 3, total: 3000, fechado: false });
  assert.equal(imp.serie[2026][8], 1000);
  assert.equal(imp.serie[2026][9], null);
  assert.deepEqual(imp.tiposAno, { iptu: 9000 });
  const dia = (s) => Date.parse(`${s}T00:00:00-03:00`);
  assert.ok(Math.abs(valorContador(imp, dia('2026-10-11')) - (9000 + 10 * 12000 / 365)) < 1e-6);
  assert.equal(valorContador(imp, dia('2026-09-15')), 9000);
  // virada do ano: o contador de 2026 para em 31/12 (92 dias de out a dez)
  assert.ok(Math.abs(valorContador(imp, dia('2027-01-05')) - (9000 + 92 * 12000 / 365)) < 1e-6);
  // janeiro de 2027 sem mês publicado: a parte oficial é 0 e a estimativa começa em 1º/01
  const jan = montarImpostometro(resumirReceitas(porMes), 2027);
  assert.equal(jan.oficialAno, 0);
  assert.equal(jan.inicioEstimativa, '2027-01-01');
  assert.deepEqual(jan.anoAnterior, { ano: 2026, mesesPublicados: 9, total: 9000, fechado: false });
  assert.ok(Math.abs(valorContador(jan, dia('2027-01-11')) - 10 * 12000 / 365) < 1e-6);
  assert.equal(jan.temOficialAno, false);
  assert.equal(jan.anoPainel, 2026);
  assert.deepEqual(jan.tiposPainel, { iptu: 9000 });
  assert.equal(jan.mesesRitmo, 12);
  assert.equal(imp.temOficialAno, true);
  assert.equal(imp.anoPainel, 2026);
  // 14 meses publicados: o ritmo usa só os 12 últimos
  const p14 = {};
  for (const m of ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']) p14[m] = [L(IPTU, '1.000,00')];
  const i14 = montarImpostometro(resumirReceitas(p14), 2026);
  assert.equal(i14.mesesRitmo, 12);
  assert.ok(Math.abs(i14.ritmoDiario - 12000 / 365) < 1e-9);
  // último mês publicado = dezembro: a estimativa começa em 1º/01 e o contador não passa do oficial
  const pdez = {};
  for (let m = 1; m <= 12; m++) pdez[`2026-${String(m).padStart(2, '0')}`] = [L(IPTU, '1.000,00')];
  const idez = montarImpostometro(resumirReceitas(pdez), 2026);
  assert.equal(idez.inicioEstimativa, '2027-01-01');
  assert.equal(valorContador(idez, dia('2026-12-31')), idez.oficialAno);
  assert.equal(valorContador(idez, dia('2027-03-01')), idez.oficialAno);
  console.log('ok: receitas');
}

import { iniciais, percentual, sugestoesBairros } from '../src/site/util.js';

{
  assert.equal(iniciais('Almir de Melo Santos'), 'AS');
  assert.equal(iniciais('Arildo Guadagnini'), 'AG');
  assert.equal(iniciais('Luzia de Fátima Izidório Vidal'), 'LV');
  assert.equal(iniciais('Clayton'), 'C');
  assert.equal(iniciais(''), '?');
  assert.equal(percentual(79, 84), 94);
  assert.equal(percentual(0, 0), 0);
  assert.equal(percentual(199, 200), 99);
  const locais = [
    { tipo: 'bairro', nome: 'Centro', idx: [1, 2, 3] },
    { tipo: 'rua', nome: 'Rua X', idx: [1, 2, 3, 4] },
    { tipo: 'bairro', nome: 'Jardim B', idx: [1] },
    { tipo: 'bairro', nome: 'Jardim A', idx: [5] },
  ];
  assert.deepEqual(sugestoesBairros(locais, 2), ['Centro', 'Jardim A']);
  assert.deepEqual(sugestoesBairros(locais), ['Centro', 'Jardim A', 'Jardim B']);
  console.log('ok: site util');
}

import { geometriaRecorte, fotoSite } from '../src/site/util.js';

{
  assert.deepEqual(geometriaRecorte(527, 800), { esquerda: 0, lado: 527, folga: 53, alturaCorpo: 474 });
  assert.deepEqual(geometriaRecorte(800, 600), { esquerda: 100, lado: 600, folga: 60, alturaCorpo: 540 });
  assert.equal(fotoSite('fotos/almir.jpg'), 'fotos/almir.webp');
  console.log('ok: recorte das fotos');
}

import { lerApelido } from '../src/regras/vereadores-html.js';

{
  const casar = criarCasador([
    { id: 'edival', nome: 'Edival Pereira Rosa', apelido: 'Preto' },
    { id: 'rogerio', nome: 'Rogério dos Santos Filho', apelido: 'Dr. Rogério Pinheiro' },
    { id: 'arildo', nome: 'Arildo Guadagnini', apelido: null },
  ], { arildo: ['Rildo'], edival: ['Preo'] });
  assert.equal(casar('Preto'), 'edival');
  assert.equal(casar('preto'), 'edival');
  assert.equal(casar('Preto e'), 'edival');
  assert.equal(casar('Preo'), 'edival');
  assert.equal(casar('Rogério Pinheiro'), 'rogerio');
  assert.equal(casar('Dr. Rogério Pinheiro'), 'rogerio');
  assert.equal(casar('Rogério'), 'rogerio');
  assert.equal(casar('Rildo'), 'arildo');
  assert.equal(casar('Pedro Preto'), null);
  const ambiguo = criarCasador([{ id: 'a', nome: 'Ana X', apelido: 'Nina' }, { id: 'b', nome: 'Bia Y', apelido: 'Nina' }]);
  assert.equal(ambiguo('Nina'), null);
  assert.equal(lerApelido('<p>Edival Pereira Rosa &#8211; &#8220;Preto&#8221;</p><p>Partido: União</p>', 'Edival Pereira Rosa'), 'Preto');
  assert.equal(lerApelido('<h2>Graziela Costa Leite – “Dra. Grazi”</h2>', 'Graziela Costa Leite'), 'Dra. Grazi');
  assert.equal(lerApelido('<p>Arildo Guadagnini (1º Vice-Secretário)</p>', 'Arildo Guadagnini'), null);
  console.log('ok: apelidos');
}

import { grupoFornecedor, cnpjDe, formatarCnpj, orgaoChave, resumirDespesas, areasSiconfi } from '../src/regras/despesas.js';

{
  const L = (orgao, evento, id, nome, valor, mes = 'Janeiro') => ({ orgao, mes, evento, nr_empenho: '1-2025', id_fornecedor: id, nm_fornecedor: nome, dt_emissao_despesa: '01/01/2025', vl_despesa: valor });
  const PREF = 'PREFEITURA MUNICIPAL DE SALTO';
  const CAM = 'CÂMARA MUNICIPAL DE SALTO';
  const SAAE = 'SERVICO AUTONOMO DE AGUA E ESGOTO DE SALTO - SAAE SALTO';
  const pj = (n) => `CNPJ - PESSOA JURÍDICA - ${n}`;

  assert.equal(grupoFornecedor(L(PREF, 'Valor Pago', 'PESSOA FÍSICA - 121458', 'FULANO DE TAL', '10,00')), 'pessoas');
  assert.equal(grupoFornecedor(L(PREF, 'Valor Pago', pj('46634507000106'), 'MUNICIPIO DE SALTO', '10,00')), 'publicos');
  assert.equal(grupoFornecedor(L(PREF, 'Valor Pago', pj('29979036000140'), 'INSTITUTO NACIONAL DO SEGURO SOCIAL', '10,00')), 'publicos');
  assert.equal(grupoFornecedor(L(PREF, 'Valor Pago', pj('00360305000104'), 'CAIXA ECONOMICA FEDERAL S/A', '10,00')), 'publicos');
  assert.equal(grupoFornecedor(L(PREF, 'Valor Pago', pj('30681633000173'), 'CSO AMBIENTAL DE SALTO SPE SA', '10,00')), 'empresas');
  assert.equal(grupoFornecedor(L(PREF, 'Valor Pago', pj('58645656000141'), 'ANTONIO CARLOS BRUNI JUNIOR', '10,00')), 'empresas');
  assert.equal(cnpjDe('CNPJ - PESSOA JURÍDICA - 30681633000173'), '30681633000173');
  assert.equal(cnpjDe('PESSOA FÍSICA - 121458'), null);
  assert.equal(formatarCnpj('30681633000173'), '30.681.633/0001-73');
  assert.equal(orgaoChave(PREF), 'prefeitura');
  assert.equal(orgaoChave(CAM), 'camara');
  assert.equal(orgaoChave(SAAE), 'saae');

  const porMes = {
    '2025-01': [
      L(PREF, 'Valor Pago', pj('11111111000111'), 'EMPRESA A LTDA', '1.500.000,00'),
      L(CAM, 'Valor Pago', pj('22222222000122'), 'EMPRESA B LTDA', '100,00'),
      L(PREF, 'Valor Pago', pj('46634507000106'), 'MUNICIPIO DE SALTO', '900,00'),
      L(SAAE, 'Valor Pago', 'PESSOA FÍSICA - 121458', 'FULANO DE TAL', '50,00'),
      L(PREF, 'Valor Pago', 'PESSOA FÍSICA - 999999', 'BELTRANO', '25,00'),
      L(PREF, 'Empenhado', pj('22222222000122'), 'EMPRESA B LTDA', '5.000,00'),
      L(PREF, 'Anulação', pj('22222222000122'), 'EMPRESA B LTDA', '300,00'),
    ],
    '2026-02': [
      L(PREF, 'Valor Pago', pj('22222222000122'), 'EMPRESA B LTDA', '2.000.000,00', 'Fevereiro'),
      L(PREF, 'Valor Pago', pj('33333333000133'), 'EMPRESA C LTDA', '999.999,99', 'Fevereiro'),
    ],
  };
  const r = resumirDespesas(porMes, ['22222222000122']);
  const a25 = r.anos['2025'];
  assert.equal(a25.total, 1501075);
  assert.equal(a25.ultimoMes, '2025-01');
  assert.equal(a25.mesesPublicados, 1);
  assert.deepEqual(a25.porOrgao, { prefeitura: 1500925, camara: 100, saae: 50 });
  assert.deepEqual(a25.porGrupo, { empresas: 1500100, publicos: 900, pessoas: 75 });
  assert.deepEqual(a25.pessoasFisicas, { total: 75, quantidade: 2 });
  assert.deepEqual(a25.topEmpresas.map((e) => e.cnpj), ['11111111000111', '22222222000122']);
  assert.equal(a25.topEmpresas[0].nome, 'EMPRESA A LTDA');
  assert.deepEqual(a25.concentracao, { top10: 1500100, totalEmpresas: 1500100, percentual: 100 });
  assert.equal(a25.anulado.total, 300);
  assert.deepEqual(a25.anulado.top, [{ cnpj: '22222222000122', nome: 'EMPRESA B LTDA', total: 300 }]);
  assert.equal(r.anos['2026'].total, 2999999.99);
  // novas: A (fora de 2024, R$ 1,5 mi) entra; B (pagou em 2024) e C (abaixo de R$ 1 mi) não
  assert.deepEqual(r.novas, [{ cnpj: '11111111000111', nome: 'EMPRESA A LTDA', total: 1500000, primeiroMes: '2025-01' }]);
  assert.deepEqual(r.mensal, { '2025-01': 1501075, '2026-02': 2999999.99 });
  // empresas: todos os CNPJs com pago > 0 (inclui órgão público), maior primeiro; nunca pessoa física
  assert.deepEqual(r.empresas.map((e) => e.cnpj), ['22222222000122', '11111111000111', '33333333000133', '46634507000106']);
  assert.deepEqual(r.empresas[0], { cnpj: '22222222000122', nome: 'EMPRESA B LTDA', porMes: { '2025-01': 100, '2026-02': 2000000 }, porOrgao: { camara: 100, prefeitura: 2000000 } });

  const COL = 'DESPESAS LIQUIDADAS ATÉ O BIMESTRE (d)';
  const ROT = 'Total das Despesas Exceto Intra-Orçamentárias';
  const it = (conta, valor, coluna = COL) => ({ rotulo: ROT, coluna, conta, valor });
  const areas = areasSiconfi([
    it('DESPESAS (EXCETO INTRA-ORÇAMENTÁRIAS) (I)', 300),
    it('Saúde', 200), it('Atenção Básica', 150), it('Educação', 100), it('Habitação', 0),
    it('Saúde', 999, 'DOTAÇÃO INICIAL'),
  ]);
  assert.deepEqual(areas, { total: 300, somaAreas: 300, lista: [{ area: 'Saúde', valor: 200 }, { area: 'Educação', valor: 100 }] });
  const flip = resumirDespesas({
    '2025-01': [L(PREF, 'Valor Pago', pj('44444444000144'), 'FUNDO X', '100,00')],
    '2025-02': [L(PREF, 'Valor Pago', pj('44444444000144'), 'EMPRESA X LTDA', '300,00', 'Fevereiro'), L(PREF, 'Valor Pago', 'OUTRO - 1', 'SEM CNPJ LTDA', '100,00', 'Fevereiro')],
  });
  assert.deepEqual(flip.anos['2025'].porGrupo, { empresas: 500, publicos: 0, pessoas: 0 });
  assert.deepEqual(flip.anos['2025'].topEmpresas, [{ cnpj: '44444444000144', nome: 'EMPRESA X LTDA', total: 400 }]);
  assert.deepEqual(flip.anos['2025'].concentracao, { top10: 400, totalEmpresas: 500, percentual: 80 });
  const vazio = resumirDespesas({
    '2025-01': [L(PREF, 'Valor Pago', pj('55555555000155'), 'EMPRESA Y LTDA', '100,00')],
    '2025-02': [L(PREF, 'Valor Pago', pj('55555555000155'), '', '200,00', 'Fevereiro')],
  });
  assert.equal(vazio.anos['2025'].topEmpresas[0].nome, 'EMPRESA Y LTDA');
  assert.equal(grupoFornecedor(L(PREF, 'Valor Pago', pj('11111111000199'), 'ASSOCIACAO FUNDO DE INCENTIVO A PESQUISA', '10,00')), 'empresas');
  assert.equal(grupoFornecedor(L(PREF, 'Valor Pago', pj('11111111000188'), 'MONGERAL AEGON SEGUROS E PREVIDENCIA S/A', '10,00')), 'empresas');
  assert.equal(grupoFornecedor(L(PREF, 'Valor Pago', pj('11111111000177'), 'FUNDO NACIONAL DE DESENVOLVIMENTO DA EDUCACAO', '10,00')), 'publicos');
  console.log('ok: despesas');
}
