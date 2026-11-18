// Verificação mensal dos arquivos de referência (sem rede: só o que está no repositório).
// a) códigos de fonte/CO da origem do dinheiro sem nome na tabela do Tesouro;
// b) bairros com página sem nome fixo ou sem conferência no cadastro oficial;
// c) idade da lista oficial de bairros (lembrete anual do pedido por LAI);
// d) contrato e placeholders do Entenda.
// Ver OPERACAO.md, seção 11.
import { fileURLToPath } from 'node:url';
import { resumirMsc, expandirMsc, codigosSemNome } from '../regras/origem.js';
import { montarBairros, bairrosComPagina } from '../regras/bairros.js';
import { indiceOficial, situacoesOficiais, avisosOficiais } from '../regras/bairros-oficiais.js';
import { validarEntenda } from '../site/entenda.js';
import { lerJson, montarCorpo, publicar, dataBR, agoraIso } from './comum.js';

export const DIAS_LEMBRETE_LAI = 365;

// a) [{ ano, codigos: ['fonte 999', 'CO 1234'] }] dos anos salvos em data/processado/origem.json.
export function codigosSemNomeOrigem(origem, ref) {
  const anos = (origem && origem.anos) || {};
  return Object.keys(anos).sort()
    .map((ano) => ({ ano, codigos: codigosSemNome(resumirMsc(expandirMsc(anos[ano] && anos[ano].linhas)), ref) }))
    .filter((x) => x.codigos.length);
}

// b) Mesma conta do gerador (src/gerar-site.js): bairro com página sem nome fixo, ou sem conferência no cadastro.
export function bairrosPendentes(proposituras, apelidosRef, oficiaisRef) {
  if (!Array.isArray(proposituras)) return { total: 0, avisos: ['data/processado/dados.json não foi lido: bairros não conferidos.'] };
  const ref = apelidosRef || {};
  const bairros = bairrosComPagina(montarBairros(proposituras, ref.apelidos || {}, ref.nomes || {}));
  const avisos = bairros.filter((b) => !b.fixo).map((b) => `Bairro com página e sem nome fixo: "${b.chave}" (${b.nome}). Registrar em data/referencia/bairros-apelidos.json (nomes).`);
  const { indice, erros } = indiceOficial(oficiaisRef);
  avisos.push(...erros.map((e) => `data/referencia/bairros-oficiais.json: ${e}`));
  if (indice.size) avisos.push(...avisosOficiais(bairros, situacoesOficiais(bairros, ref, indice)));
  return { total: bairros.length, avisos };
}

// c) Data mais nova entre o campo "data" da lista oficial e "lai_pedido_em" (último pedido por LAI). Lembra uma vez por ano.
export function idadeListaOficial(ref, agora) {
  const datas = [...String((ref && ref.data) || '').matchAll(/\d{4}-\d{2}-\d{2}/g)].map((m) => m[0]);
  if (ref && /^\d{4}-\d{2}-\d{2}$/.test(String(ref.lai_pedido_em || ''))) datas.push(ref.lai_pedido_em);
  const ultima = datas.sort().at(-1) || null;
  const dias = ultima ? Math.floor((Date.parse(agora) - Date.parse(`${ultima}T12:00:00Z`)) / 86400000) : null;
  return { ultima, dias, precisa: dias === null || dias >= DIAS_LEMBRETE_LAI };
}

// Junta tudo em seções do issue. Cada seção: ✅ (nada a fazer) ou ⚠️ (com o que fazer e os arquivos).
export function avaliarReferencias({ origem, fontes, proposituras, apelidos, oficiais, entenda, agora }) {
  const secoes = [];
  const secao = (ok, titulo, itens = [], fazer = '') => secoes.push({ ok, linhas: [`${ok ? '✅' : '⚠️'} **${titulo}**`, ...itens.map((i) => `- ${i}`), ...(ok || !fazer ? [] : [`- O que fazer: ${fazer}`]), ''] });

  const semNome = codigosSemNomeOrigem(origem, fontes);
  secao(!semNome.length, 'Origem do dinheiro: códigos sem nome',
    semNome.map((x) => `${x.ano}: ${x.codigos.join(', ')}`),
    'baixar a planilha de fontes do ano no Tesouro (links em `data/referencia/fontes-recursos.json`, campo `urls`) e acrescentar os códigos em `fontes` ou `complementos` do mesmo arquivo.');

  const b = bairrosPendentes(proposituras, apelidos, oficiais);
  secao(!b.avisos.length, `Bairros com página (${b.total})`, b.avisos,
    'seguir OPERACAO.md, seção 4 ("Bairro novo passou de 10 pedidos") e seção 8. Só registrar correspondência conferida em ato oficial.');

  const idade = idadeListaOficial(oficiais, agora);
  const anos = idade.dias === null ? null : Math.floor(idade.dias / 365);
  secao(!idade.precisa, 'Lista oficial de bairros',
    [idade.ultima ? `Data mais nova da lista (\`data\` ou \`lai_pedido_em\` em data/referencia/bairros-oficiais.json): ${dataBR(idade.ultima)}${anos ? ` (há mais de ${anos} ano${anos > 1 ? 's' : ''})` : ''}.` : 'data/referencia/bairros-oficiais.json sem data legível no campo `data`.'],
    'uma vez por ano, pedir por LAI (e-SIC da Prefeitura de Salto) a relação atual de bairros e loteamentos do cadastro imobiliário. Depois de pedir, gravar a data do pedido em `lai_pedido_em` (AAAA-MM-DD) em `data/referencia/bairros-oficiais.json`: o lembrete some por um ano. Quando a resposta chegar, atualizar a lista (OPERACAO.md, seção 8a).');

  const errosE = entenda ? validarEntenda(entenda) : ['data/referencia/entenda.json não foi lido.'];
  secao(!errosE.length, 'Entenda: contrato e placeholders', errosE,
    'corrigir `data/referencia/entenda.json` (placeholders válidos: lista `PLACEHOLDERS` em `src/site/entenda.js`) e rodar `npm run checar`.');

  return { precisa: secoes.some((s) => !s.ok), linhas: secoes.flatMap((s) => s.linhas).slice(0, -1) };
}

const lerOuNada = async (caminho) => { try { return await lerJson(caminho); } catch (e) { console.log(`${caminho} não lido (${e.message}).`); return null; } };

async function principal() {
  const agora = agoraIso();
  const dados = await lerOuNada('data/processado/dados.json');
  const r = avaliarReferencias({
    origem: await lerOuNada('data/processado/origem.json'),
    fontes: await lerOuNada('data/referencia/fontes-recursos.json'),
    proposituras: dados && dados.proposituras,
    apelidos: await lerOuNada('data/referencia/bairros-apelidos.json'),
    oficiais: await lerOuNada('data/referencia/bairros-oficiais.json'),
    entenda: await lerOuNada('data/referencia/entenda.json'),
    agora,
  });
  const corpo = montarCorpo(agora, r.linhas);
  console.log(corpo);
  await publicar({ nome: 'referencias', titulo: 'Manutenção: arquivos de referência precisam de atenção', texto: corpo, precisa: r.precisa, agora });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await principal();
