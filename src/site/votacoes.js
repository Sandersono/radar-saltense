import { esc } from '../util/texto.js';
import { layout, dataBR, seloFonte, aviso, numero } from './base.js';

export function paginaVotacoes(d) {
  const nome = Object.fromEntries(d.vereadores.map((v) => [v.id, v.nome]));
  const nomes = (ids) => ids.map((id) => esc(nome[id])).join(', ');
  const totalEventos = d.votacoes.reduce((s, p) => s + p.eventos.length, 0);
  const artigos = d.votacoes.map((pj) => `<article class="cartao votacao">
<h2 class="votacao-titulo">${esc(pj.rotulo)}</h2>
<p>${esc(pj.ementa)}</p>
<p class="partido">Autor: ${esc(pj.autor)}</p>
<ul class="eventos">${pj.eventos.map((e) => `<li>
<p class="resultado"><span class="data">${dataBR(e.data)}</span> ${e.turno ? `${esc(e.turno)}: ` : ''}${esc(e.resultado)}</p>
${e.contra.length ? `<p><span class="etiqueta etiqueta-contra">Contra</span> ${nomes(e.contra)}</p>` : ''}
${e.ausentes.length ? `<p><span class="etiqueta etiqueta-ausentes">Ausentes</span> ${nomes(e.ausentes)}</p>` : ''}
<p>${seloFonte(e.url, 'PDF oficial')}</p>
</li>`).join('')}</ul>
</article>`).join('\n');
  const corpo = `<h1>Votações</h1>
<p>${numero(d.votacoes.length)} projetos e ${numero(totalEventos)} votações registradas no documento oficial da Câmara.</p>
${aviso('Leitura do documento oficial "Resultado das votações", publicado pela Câmara. Ele só cita quem votou contra ou faltou, às vezes só pelo primeiro nome. Nome que não deu para identificar com certeza fica de fora.')}
${artigos}`;
  return layout({ titulo: 'Votações da Câmara de Salto/SP', trilha: [{ nome: 'Câmara', caminho: 'camara.html' }, { nome: 'Votações', caminho: 'votacoes.html' }], mostrarAtualizado: true, descricao: 'Os projetos votados na Câmara de Salto/SP: o resultado de cada votação e quem votou contra ou faltou, com o PDF oficial da Câmara.', caminho: 'votacoes.html', corpo, atualizadoEm: d.meta.atualizadoEm });
}
