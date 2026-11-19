import assert from 'node:assert/strict';
import { csv, expiraEm, securityTxt, llmsTxt, manifesto, empresaPublica, soEmpresas } from '../src/site/dados-abertos.js';
import { vistoriar, faltandoMaquina } from '../src/vistoria.js';

// CSV: BOM, ";" como separador, aspas só quando preciso (aspas dobradas), CRLF no fim de cada linha.
const tabela = csv(['a', 'b'], [['x;y', 'diz "oi"'], ['linha\nnova', null], [' esp', 3], ['simples', 'ok']]);
assert.equal(tabela.charCodeAt(0), 0xfeff);
assert.deepEqual([...Buffer.from(tabela).subarray(0, 3)], [0xef, 0xbb, 0xbf]);
assert.equal(tabela.slice(1), 'a;b\r\n"x;y";"diz ""oi"""\r\n"linha\nnova";\r\n" esp";3\r\nsimples;ok\r\n');

// security.txt: vale um ano, ISO 8601 em UTC sem milissegundos; campos do RFC 9116.
assert.equal(expiraEm('2026-11-18T10:44:24.311Z'), '2027-11-18T10:44:24Z');
assert.equal(expiraEm('2028-02-29T12:00:00Z'), '2029-03-01T12:00:00Z');
const s = securityTxt('2026-11-18T10:44:24.311Z');
assert.match(s, /^Contact: https:\/\/instagram\.com\/\w+$/m);
assert.match(s, /^Expires: 2027-11-18T10:44:24Z$/m);
assert.match(s, /^Preferred-Languages: pt-BR$/m);
assert.match(s, /^Canonical: https:\/\/radarsaltense\.com\.br\/\.well-known\/security\.txt$/m);
assert.match(s, /^Policy: https:\/\/radarsaltense\.com\.br\/sobre\.html$/m);

// llms.txt: H1, citação, data, links absolutos; página que não saiu fica de fora.
const l = llmsTxt({ atualizadoEm: '2026-11-18T10:44:24.311Z', conjuntos: [{ arquivo: 'dados/x.csv', nome: 'X', descricao: 'desc' }], existe: (c) => c !== 'entenda.html' });
assert.ok(l.startsWith('# Radar Saltense\n\n> '));
assert.match(l, /Última atualização dos dados: 18\/11\/2026\./);
assert.ok(l.includes('\n- [X](https://radarsaltense.com.br/dados/x.csv): desc\n'));
assert.ok(l.includes('## Páginas principais') && l.includes('## Dados abertos') && l.includes('## Fontes oficiais'));
assert.ok(!l.includes('entenda.html') && l.includes('perguntas-frequentes.html'));
for (const m of l.matchAll(/\]\(([^)]+)\)/g)) assert.match(m[1], /^https:\/\//);

// Manifesto: JSON válido com os ícones de 192 e 512.
assert.deepEqual(JSON.parse(manifesto()).icons.map((i) => i.sizes), ['192x192', '512x512']);

// Privacidade: empresa só com CNPJ completo; o resto vira "pessoa física" ou sai da lista.
assert.equal(empresaPublica('FULANO DE TAL', '12345678901'), 'pessoa física');
assert.equal(empresaPublica('EMPRESA LTDA', '12.043.445/0008-04'), 'EMPRESA LTDA');
assert.equal(empresaPublica(null, null), null);
assert.deepEqual(soEmpresas([{ cnpj: '12345678901', nome: 'X', total: 1 }, { cnpj: '12043445000804', nome: 'Y', total: 2 }]).map((e) => e.nome), ['Y']);

// Vistoria: CPF num CSV bloqueia (também sem pontuação depois de "CPF"); "CPFL" não; arquivo de máquina faltando é aviso.
const cpfEm = (conteudo) => vistoriar([], [], [{ caminho: 'dados/x.csv', conteudo }]).bloqueios.filter((b) => b.startsWith('dados/x.csv')).length;
assert.equal(cpfEm('a;123.456.789-01'), 1);
assert.equal(cpfEm('a;CPF nº 12345678901'), 1);
assert.equal(cpfEm('a;CPFL 12345678901;46.634.507/0001-06'), 0);
assert.equal(faltandoMaquina(['llms.txt', 'dados.html']).length, 2);
assert.deepEqual(faltandoMaquina(['dados.html', 'llms.txt', '.well-known/security.txt', 'site.webmanifest']), []);
console.log('dados abertos: ok');
