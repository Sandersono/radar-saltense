import { pathToFileURL } from 'node:url';
import { anos } from './config.js';
import { coletarVereadores } from './coleta/vereadores.js';
import { coletarProposituras } from './coleta/proposituras.js';
import { coletarPresencas } from './coleta/presenca.js';
import { coletarVotacoes } from './coleta/votacoes.js';
import { salvar } from './coleta/http.js';
import { coletarReceitas } from './coleta/receitas.js';
import { coletarFotos } from './coleta/fotos.js';
import { anoMesBR } from './util/texto.js';

export async function coletarTudo() {
  const lista = anos();
  const anoAtual = lista[lista.length - 1];
  const vereadores = await coletarVereadores();
  const { fotos, avisos: avisosFotos } = await coletarFotos(vereadores);
  const cardsPorAno = await coletarProposituras(lista, anoAtual);
  const presencas = await coletarPresencas(lista, anoAtual);
  const votacoes = await coletarVotacoes(lista, anoAtual);
  const hoje = anoMesBR();
  const receitas = await coletarReceitas(hoje.ano, hoje.mes);
  const coleta = { vereadores, cardsPorAno, presencas, votacoes, receitas, fotos, avisosFotos, coletadoEm: new Date().toISOString() };
  await salvar('data/bruto/coleta.json', JSON.stringify(coleta));
  return coleta;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const c = await coletarTudo();
  console.log(`Vereadores: ${c.vereadores.length}`);
  for (const [ano, l] of Object.entries(c.cardsPorAno)) console.log(`Proposituras ${ano}: ${l.length}`);
  console.log(`Tabelas de presença: ${c.presencas.length} (linhas: ${[...new Set(c.presencas.map((p) => p.linhas.length))].join(', ')})`);
  for (const v of c.votacoes) console.log(`Votações ${v.ano}: ${v.blocos.length} projetos`);
  console.log(`Receitas: ${Object.keys(c.receitas).length} meses publicados`);
  console.log(`Fotos: ${Object.keys(c.fotos).length} de ${c.vereadores.length}`);
}
