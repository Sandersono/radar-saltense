import { AUTOR, SALARIO, ANO_INICIO } from '../config.js';
import { esc } from '../util/texto.js';
import { layout, link, aviso } from './base.js';

export function paginaFontes(d) {
  const avisos = d.avisos && d.avisos.length
    ? `<ul>${d.avisos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>`
    : '<p>Nenhum aviso.</p>';
  const contagemNomes = new Map();
  for (const x of d.naoAtribuidos || []) if (x.fonte.startsWith('votação')) contagemNomes.set(x.nome, (contagemNomes.get(x.nome) || 0) + 1);
  const nomesSoltos = [...contagemNomes].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
  const nomesHtml = nomesSoltos.length
    ? `<ul>${nomesSoltos.map(([nome, c]) => `<li>"${esc(nome)}": ${c} ${c === 1 ? 'registro' : 'registros'}</li>`).join('')}</ul>`
    : '<p>Nenhum.</p>';
  const corpo = `<h1>De onde vêm os números</h1>
<p>Tudo sai de fontes oficiais. Nada é digitado à mão, exceto a população do IBGE, que fica registrada no código com a fonte. O site é refeito todo dia de madrugada.</p>
<nav class="sumario" aria-label="Nesta página"><a class="chip" href="#fontes">Fontes</a><a class="chip" href="#regras">A regra das propostas</a><a class="chip" href="#ruas">Ruas e bairros</a><a class="chip" href="#presenca">Presença</a><a class="chip" href="#votacoes">Votações</a><a class="chip" href="#avisos">Avisos</a><a class="chip" href="#creditos">Fotos e fontes</a></nav>
<section id="fontes" class="secao cartao">
<h2>Fontes</h2>
<ul>
<li><strong>Propostas:</strong> <a href="https://cmsalto.sisvetor.com.br/ords/cmsalto/f?p=742:92">portal de proposituras da Câmara</a>. Cada proposta tem link para a ficha oficial.</li>
<li><strong>Presença:</strong> <a href="https://www.camarasalto.sp.gov.br/sessoes/presenca-dos-vereadores">PDFs mensais de presença</a>. P = presença, A = ausência, AJ = ausência justificada.</li>
<li><strong>Votações:</strong> <a href="https://www.camarasalto.sp.gov.br/sessoes/votacao-tramitacao-dos-projetos">PDF anual "Resultado das votações"</a>.</li>
<li><strong>Impostos e receitas:</strong> <a href="impostometro.html#fontes-impostometro">API de receitas do TCE-SP</a>, usada no impostômetro.</li>
<li><strong>Vereadores e partidos:</strong> <a href="https://www.camarasalto.sp.gov.br/">página inicial da Câmara</a>.</li>
</ul>
</section>
<section id="regras" class="secao cartao">
<h2>Homenagem ou trabalho: a regra</h2>
<table><thead><tr><th>Tipo de documento</th><th>Grupo</th></tr></thead><tbody>
<tr><td>Indicação</td><td>Pedidos de melhoria nos bairros</td></tr>
<tr><td>Requerimento</td><td>Perguntas e cobranças</td></tr>
<tr><td>Moção de aplauso, congratulação, parabéns, pesar, homenagem ou reconhecimento</td><td>Homenagens</td></tr>
<tr><td>Moção de apelo, repúdio ou apoio</td><td>Outros</td></tr>
<tr><td>Decreto Legislativo de título de cidadão, honra ao mérito, honraria, medalha, comenda ou diploma</td><td>Homenagens</td></tr>
<tr><td>Lei ou resolução que dá nome a rua ou prédio, ou cria dia, semana ou data comemorativa</td><td>Homenagens</td></tr>
<tr><td>Demais leis, resoluções, decretos legislativos, emendas à Lei Orgânica e iniciativa popular</td><td>Propostas de lei</td></tr>
<tr><td>Ato da Presidência, Atos da Mesa e Portaria</td><td>Não contam para nenhum vereador</td></tr>
</tbody></table>
<p>Proposta com mais de um autor conta para cada autor. Propostas de comissões, da Mesa, de frentes parlamentares e da Prefeitura não contam para nenhum vereador.</p>
</section>
<section id="ruas" class="secao cartao">
<h2>Ruas e bairros</h2>
<p>O nome da rua e do bairro é lido do próprio texto do pedido. Quando o texto não deixa claro o lugar, o pedido continua no site, mas fica fora da busca por bairro. "O problema que não some" junta pedidos do mesmo tipo (buraco, asfalto, iluminação, limpeza, bueiro, sinalização, poda, lixo) para a mesma rua, a partir de 2 pedidos.</p>
${aviso('Pedido repetido não prova que a Prefeitura ignorou. Pedido não é obra feita.')}
</section>
<section id="presenca" class="secao cartao">
<h2>Presença</h2>
<p>Contamos as marcas P, A e AJ dos PDFs oficiais. "Quem mais faltou" conta só as ausências sem justificativa (A). Dado ausente não é falta: célula vazia não conta. As sessões extraordinárias aparecem junto com as ordinárias.</p>
</section>
<section id="votacoes" class="secao cartao">
<h2>Votações</h2>
<p>O PDF oficial informa o resultado e cita, às vezes só pelo primeiro nome, quem votou contra ou faltou. O primeiro nome é ligado ao vereador. Se um nome não bater com exatamente um vereador, ele fica de fora. Um voto só é ligado ao vereador se ele aparece na tabela de presença daquele mês (quando ela existe). O site não deduz votos a favor.</p>
</section>
<section id="avisos" class="secao cartao">
<h2>Avisos sobre os dados oficiais</h2>
<p>Quando um documento oficial traz algo fora do padrão, o site avisa aqui em vez de esconder.</p>
${avisos}
<h3>Nomes nas votações que não deu para ligar a um vereador</h3>
<p>Estes nomes aparecem nos PDFs de votação, mas não bateram com exatamente um vereador (apelidos, grafias diferentes ou vereador fora da tabela de presença do mês). O site não atribui esses votos a ninguém.</p>
${nomesHtml}
</section>
<section id="creditos" class="secao cartao">
<h2>Fotos e fontes</h2>
<p>Fotos dos vereadores: Câmara Municipal de Salto (site oficial).</p>
<p>Fontes tipográficas: Nunito e Inter, sob a licença SIL Open Font License.</p>
</section>
${SALARIO ? `<section class="secao cartao"><h2>Salário</h2><p>O contador multiplica o salário mensal oficial pelo número de vereadores, desde 1º de janeiro de ${ANO_INICIO}. É uma estimativa. ${link(SALARIO.fonte, 'Fonte oficial do valor')}.</p></section>` : ''}
<section class="secao cartao">
<h2>Achou um erro?</h2>
<p>Me chama no Instagram <a href="https://instagram.com/${AUTOR.instagram}">@${AUTOR.instagram}</a>. Se a Câmara corrigir o dado na fonte, o site se corrige sozinho na próxima atualização.</p>
</section>`;
  return layout({ titulo: 'De onde vêm os números: Radar Saltense', corpo, atualizadoEm: d.meta.atualizadoEm });
}
