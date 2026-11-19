import { AUTOR, ANO_INICIO } from '../config.js';
import { esc } from '../util/texto.js';
import { layout, ENDERECO, organizacaoJsonLd, ORGANIZACAO, hrefDe, paginaAusente } from './base.js';

// O que o site cobre hoje; página que não foi gerada nesta rodada sai da lista.
const COBRE = [
  ['index.html#vereadores', 'Os vereadores', `presença nas sessões, votações e todas as propostas desde ${ANO_INICIO}, com a ficha oficial de cada uma.`],
  ['camara.html', 'A Câmara', 'quanto custa (folha e salários), requerimentos respondidos, emendas dos vereadores e campanhas de 2024.'],
  ['prefeitura.html', 'A Prefeitura', 'promessas do plano de governo, obras, compras no PNCP e a nota do Tribunal de Contas.'],
  ['impostometro.html', 'Impostos', 'quanto a cidade arrecada no ano, mês a mês.'],
  ['gastos.html', 'Raio-X dos gastos', 'para onde vai o dinheiro e as empresas que mais receberam.'],
  ['origem.html', 'De onde vem o dinheiro', 'a receita por fonte de recurso, o que é livre ou carimbado e onde foi gasto.'],
  ['bairros.html', 'Bairros', 'o que os vereadores pediram para cada bairro.'],
  ['semana.html', 'Resumo da semana', 'o que mudou nos dados oficiais, semana a semana.'],
];

export function paginaSobre(d) {
  const insta = `https://instagram.com/${AUTOR.instagram}`;
  const itens = COBRE.filter(([c]) => !paginaAusente(c))
    .map(([c, nome, texto]) => `<li><a href="${esc(hrefDe(c))}">${esc(nome)}</a>: ${esc(texto)}</li>`).join('');
  const corpo = `<h1>Sobre o Radar Saltense</h1>
<p>O Radar Saltense mostra, com dado oficial e link para a fonte, o que fazem a Câmara e a Prefeitura de Salto/SP e quanto isso custa.</p>
<section id="quem-faz" class="secao cartao">
<h2>Quem faz</h2>
<p>O site é feito por ${esc(AUTOR.nome)}, que mora em Salto. É um projeto pessoal e independente. Contato pelo Instagram: <a href="${esc(insta)}">@${esc(AUTOR.instagram)}</a>.</p>
</section>
<section id="por-que" class="secao cartao">
<h2>Por que o site existe</h2>
<p>Os dados da Câmara e da Prefeitura são públicos, mas ficam espalhados em portais, PDFs e planilhas. Aqui eles aparecem juntos, em português simples, para qualquer morador entender um número em segundos e conferir na fonte.</p>
</section>
<section id="independencia" class="secao cartao">
<h2>Independência</h2>
<p>O Radar Saltense não tem ligação com a Câmara, com a Prefeitura nem com partidos. O site mostra fatos, não dá opinião sobre políticos e não acusa ninguém. A mesma regra vale para todos os vereadores.</p>
</section>
<section id="como-coleta" class="secao cartao">
<h2>Como os dados são coletados</h2>
<p>Um robô busca os dados todo dia nos sites oficiais: Câmara Municipal de Salto, Tribunal de Contas do Estado (TCE-SP), Tesouro Nacional, Portal Nacional de Contratações Públicas, Obrasgov.br, IBGE e Tribunal Superior Eleitoral. Os números não são digitados à mão. O que é conferido por uma pessoa, como o andamento das promessas e os nomes dos bairros, sempre traz a prova oficial ou a regra usada. <a href="fontes.html">Veja todas as fontes e as regras usadas</a>.</p>
</section>
<section id="correcao" class="secao cartao">
<h2>Achou um erro?</h2>
<p>Me chama no Instagram <a href="${esc(insta)}">@${esc(AUTOR.instagram)}</a>. Quando o erro está na fonte oficial, o site se corrige sozinho assim que a fonte corrige. Quando o erro é do site, ele é corrigido e a regra passa a valer para todos.</p>
</section>
<section id="seguranca" class="secao cartao">
<h2>Achou um dado pessoal ou uma falha?</h2>
<p>O site não mostra CPF nem nome de pessoa física. Se você encontrar um dado pessoal numa página ou num arquivo do site, ou uma falha de segurança, mande uma mensagem no Instagram <a href="${esc(insta)}">@${esc(AUTOR.instagram)}</a> com o endereço da página.</p>
<p>O dado pessoal é retirado do site assim que a mensagem é conferida, e a regra que o deixou passar é corrigida para todas as páginas. Ao contar uma falha, não exponha dados de outras pessoas. O mesmo contato está no arquivo <a href=".well-known/security.txt">security.txt</a>.</p>
</section>
<section id="cobre" class="secao cartao">
<h2>O que o site cobre</h2>
<ul class="lista">${itens}</ul>
</section>`;
  return layout({
    titulo: 'Sobre: quem faz o site e como ele funciona',
    descricao: 'Quem faz o Radar Saltense, por que ele existe, como os dados oficiais de Salto/SP são coletados e como pedir uma correção.',
    caminho: 'sobre.html',
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'AboutPage', name: 'Sobre o Radar Saltense', url: `${ENDERECO}sobre.html`, inLanguage: 'pt-BR', about: { '@id': ORGANIZACAO['@id'] } },
      organizacaoJsonLd(),
    ],
    corpo,
    atualizadoEm: d.meta.atualizadoEm,
  });
}

// 404: servida pelo GitHub Pages em qualquer profundidade, por isso os caminhos são absolutos ("/").
// Fora do índice e do sitemap, sem canonical.
export function pagina404(d) {
  const secoes = [
    ['index.html#vereadores', 'Os vereadores'], ['camara.html', 'A Câmara'], ['prefeitura.html', 'A Prefeitura'], ['obras.html', 'Obras'],
    ['impostometro.html', 'Impostos'], ['gastos.html', 'Raio-X dos gastos'], ['bairros.html', 'Bairros'], ['semana.html', 'Resumo da semana'],
    ['entenda.html', 'Entenda'], ['perguntas-frequentes.html', 'Perguntas frequentes'], ['fontes.html', 'De onde vêm os números'],
  ].filter(([c]) => !paginaAusente(c));
  const corpo = `<h1>Página não encontrada</h1>
<p>O endereço que você abriu não existe ou mudou de lugar. Os dados continuam aqui:</p>
<ul class="lista">${secoes.map(([c, nome]) => `<li><a href="${esc(hrefDe(c, '/'))}">${esc(nome)}</a></li>`).join('')}</ul>
<p><a class="botao" href="/">Ir para a página inicial</a></p>`;
  return layout({
    titulo: 'Página não encontrada',
    descricao: 'O endereço não existe no Radar Saltense. Veja as seções do site.',
    robots: 'noindex',
    prefixo: '/',
    corpo,
    atualizadoEm: d.meta.atualizadoEm,
  });
}
