// Verificação mensal: a população de Salto usada no site (src/config.js, POPULACAO) é a mais nova do IBGE?
// Fontes: API de agregados do IBGE. Estimativas da população (tabela 6579, variável 9324) e Censo (tabela 4709, variável 93).
// Ver OPERACAO.md, seção 11. Não mexe no site: só abre o issue com a linha a trocar.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { POPULACAO } from '../config.js';
import { buscarJson, montarCorpo, publicar, numeroBR, agoraIso } from './comum.js';

export const MUNICIPIO = '3545209'; // Salto (SP)
const API = 'https://servicodados.ibge.gov.br/api/v3/agregados';
export const FONTES = {
  estimativa: { url: `${API}/6579/periodos/-6/variaveis/9324?localidades=N6[${MUNICIPIO}]`, tabela: 'https://sidra.ibge.gov.br/tabela/6579', nome: 'estimativa da população' },
  censo: { url: `${API}/4709/periodos/-1/variaveis/93?localidades=N6[${MUNICIPIO}]`, tabela: 'https://sidra.ibge.gov.br/tabela/4709', nome: 'Censo' },
};
export const PAINEL_IBGE = 'https://cidades.ibge.gov.br/brasil/sp/salto/panorama';

// Resposta da API de agregados -> [{ ano, valor }] do município, do ano mais antigo para o mais novo.
// Valor que não é número ("-", "...") fica de fora. Formato desconhecido: lista vazia.
export function serieIbge(json, municipio = MUNICIPIO) {
  const series = (Array.isArray(json) ? json : []).flatMap((v) => ((v && v.resultados) || []).flatMap((r) => (r && r.series) || []));
  const s = series.find((x) => x && x.localidade && String(x.localidade.id) === municipio);
  return Object.entries((s && s.serie) || {})
    .filter(([a, v]) => /^\d{4}$/.test(a) && /^\d+$/.test(String(v)))
    .map(([a, v]) => ({ ano: Number(a), valor: Number(v) }))
    .sort((a, b) => a.ano - b.ano);
}

// Número mais novo entre estimativa e Censo. Mesmo ano: vale o Censo (contagem, não estimativa).
export function maisRecente(series) {
  let melhor = null;
  for (const tipo of ['estimativa', 'censo']) {
    const ultimo = (series[tipo] || []).at(-1);
    if (ultimo && (!melhor || ultimo.ano >= melhor.ano)) melhor = { ...ultimo, tipo };
  }
  return melhor;
}

export const fonteTexto = (ibge) => (ibge.tipo === 'censo' ? `IBGE, Censo ${ibge.ano}` : `IBGE, estimativa da população de ${ibge.ano}`);
export const linhaNova = (ibge) => `export const POPULACAO = { valor: ${ibge.valor}, ano: ${ibge.ano}, fonte: '${fonteTexto(ibge)}' };`;

// atual: POPULACAO de src/config.js ({ valor, fonte, ano? }); ibge: maisRecente(); linha: { numero, texto } da linha em config.js.
export function avaliarPopulacao({ atual, ibge, linha }) {
  if (!ibge) throw new Error('o IBGE não devolveu a população de Salto (formato da resposta mudou?)');
  const fonte = FONTES[ibge.tipo];
  const diferente = Number(atual && atual.valor) !== ibge.valor;
  const anoNovo = Boolean(atual && atual.ano) && ibge.ano > Number(atual.ano);
  const precisa = diferente || anoNovo;
  const resumo = `IBGE: ${numeroBR(ibge.valor)} habitantes (${fonte.nome}, ${ibge.ano}).`;
  if (!precisa) return { precisa, linhas: [`✅ A população no site (${numeroBR(atual.valor)}) é a mesma do IBGE.`, `- ${resumo}`, `- Fonte oficial: ${fonte.tabela}`] };
  return {
    precisa,
    linhas: [
      '⚠️ **A população de Salto no site não é a mais nova do IBGE.**',
      '',
      `- No site (src/config.js): ${numeroBR(atual.valor)} habitantes${atual.ano ? `, ${atual.ano}` : ''} (${atual.fonte}).`,
      `- ${resumo}`,
      `- Fonte oficial: ${fonte.tabela} e ${PAINEL_IBGE}`,
      `- Consulta usada: ${fonte.url}`,
      '',
      `**O que fazer:** em \`src/config.js\`${linha ? `, linha ${linha.numero}` : ''}, trocar`,
      '```js',
      linha ? linha.texto : '(linha "export const POPULACAO" não encontrada)',
      '```',
      'por',
      '```js',
      linhaNova(ibge),
      '```',
      'Esse número é o divisor do "por morador" do impostômetro. Depois da troca: `npm run checar` e a revisão de sempre.',
    ],
  };
}

async function principal() {
  const agora = agoraIso();
  const series = { estimativa: serieIbge(await buscarJson(FONTES.estimativa.url)) };
  try { series.censo = serieIbge(await buscarJson(FONTES.censo.url)); } catch (e) { console.log(`Censo não consultado (${e.message}); segue só com a estimativa.`); }
  const ibge = maisRecente(series);
  const texto = (await readFile('src/config.js', 'utf8')).split('\n');
  const i = texto.findIndex((l) => /^\s*export const POPULACAO\b/.test(l));
  const linha = i >= 0 ? { numero: i + 1, texto: texto[i].trim() } : null;
  const { precisa, linhas } = avaliarPopulacao({ atual: POPULACAO, ibge, linha });
  const corpo = montarCorpo(agora, linhas);
  console.log(corpo);
  await publicar({ nome: 'populacao', titulo: `Manutenção: população de Salto no IBGE mudou (${ibge.ano})`, texto: corpo, precisa, agora });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await principal();
