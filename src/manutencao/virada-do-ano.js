// Verificação anual (10 de janeiro): a virada do ano chegou a todos os dados? Sempre abre um issue com a lista
// de conferência (✅ ok, ⚠️ olhar) e os lembretes do ano. Sem rede: só os arquivos do repositório.
// Ver OPERACAO.md, seção 11. AGORA=AAAA-MM-DDTHH:MM:SSZ simula outra data.
import { fileURLToPath } from 'node:url';
import { lerJson, montarCorpo, publicar, dataBR, diaSP, agoraIso } from './comum.js';

const NOMES_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const mesesDo = (mensais, ano) => Object.keys(mensais || {}).filter((k) => k.startsWith(`${ano}-`)).sort();
const nomeMes = (chave) => NOMES_MES[Number(chave.slice(5, 7)) - 1];

// Semana (segunda a domingo) que contém 1º de janeiro: segunda entre 26/12 e 01/01.
export function semanaDaVirada(semanas, ano) {
  const chave = Object.keys(semanas || {}).sort().find((k) => k >= `${ano - 1}-12-26` && k <= `${ano}-01-01`);
  return chave ? { chave, ...semanas[chave] } : null;
}

// ano: o ano que começou. Devolve { itens: [{ ok, texto }], lembretes: [texto] }.
export function avaliarVirada({ ano, dados, meta, semanas, origem, emendas, fontes }) {
  const anterior = ano - 1;
  const itens = [];
  const item = (ok, texto) => itens.push({ ok, texto });

  // Robô rodando no ano novo
  const ultima = meta && meta.atualizadoEm;
  item(Boolean(ultima) && diaSP(ultima).startsWith(`${ano}-`), ultima ? `Última atualização do robô: ${dataBR(diaSP(ultima))}.` : 'data/processado/meta.json sem a data da última atualização.');

  // Ano novo: receitas e despesas do TCE-SP (sem mês oficial ainda é normal no começo do ano)
  for (const [nome, chave] of [['Receitas', 'receitasMensais'], ['Despesas', 'despesasMensais']]) {
    const meses = mesesDo(meta && meta[chave], ano);
    item(true, meses.length
      ? `${nome} de ${ano} (TCE-SP): já há dados até ${nomeMes(meses.at(-1))}.`
      : `${nome} de ${ano} (TCE-SP): ainda sem mês oficial. É normal: o TCE-SP publica cada mês depois que ele termina, e o robô pega sozinho.`);
  }

  // Ano anterior fechado
  const rec = mesesDo(meta && meta.receitasMensais, anterior);
  const recAnt = dados && dados.receitas && dados.receitas.anoAnterior;
  const recFechado = rec.length === 12 || Boolean(recAnt && recAnt.ano === anterior && recAnt.fechado);
  item(recFechado, recFechado
    ? `Receitas de ${anterior}: ano fechado (12 meses).`
    : `Receitas de ${anterior}: ${rec.length} de 12 meses. Se faltar só dezembro, é normal até o TCE-SP publicar; o robô completa sozinho. Se em março ainda faltar, ver a seção 2 do OPERACAO.md.`);
  const gas = dados && dados.gastos && dados.gastos.anos && dados.gastos.anos[anterior];
  const gasMeses = gas ? Number(gas.mesesPublicados) || 0 : mesesDo(meta && meta.despesasMensais, anterior).length;
  item(gasMeses === 12, gasMeses === 12
    ? `Gastos de ${anterior}: 12 meses publicados.`
    : `Gastos de ${anterior}: ${gasMeses} de 12 meses. Mesmo caso das receitas: o robô completa quando o TCE-SP publicar.`);
  const msc = origem && origem.anos && origem.anos[anterior];
  item(Boolean(msc && msc.tipo === 'MSCE'), !msc
    ? `Origem do dinheiro de ${anterior}: ano ausente em data/processado/origem.json. Ver a manutenção do conferencia.md.`
    : msc.tipo === 'MSCE'
      ? `Origem do dinheiro de ${anterior}: matriz de encerramento (MSCE) já salva.`
      : `Origem do dinheiro de ${anterior}: ainda com a matriz mensal de ${nomeMes(`${anterior}-${String(msc.mes).padStart(2, '0')}`)}. Pendente e normal: o robô tenta a de encerramento (MSCE) todo dia e troca sozinho quando ela sair.`);

  // Arquivo semanal da 1ª semana do ano
  const sem = semanaDaVirada(semanas, ano);
  item(Boolean(sem), sem
    ? `Resumo da semana de ${dataBR(sem.inicio || sem.chave)} a ${dataBR(sem.fim || sem.domingo || sem.chave)} (virada do ano) arquivado${sem.completa === false ? ', ainda aberto' : ''}.`
    : `Resumo da semana da virada (com 1º/01/${ano}) não está em data/processado/semanas.json. Ver se o robô rodou nessa semana (aba Actions).`);

  // Emendas do ano novo
  const temEmendas = Boolean(emendas && emendas[String(ano)]);
  item(temEmendas, temEmendas
    ? `Emendas impositivas de ${ano} já em data/referencia/emendas.json.`
    : `Emendas impositivas de ${ano}: ainda não estão em data/referencia/emendas.json. Quando a Câmara publicar o PDF de ${ano} (página de emendas impositivas), rodar \`npm run emendas\` e conferir o arquivo (seção 6 do OPERACAO.md).`);

  // Promessas e obras
  const prom = dados && dados.promessas && dados.promessas.resumo;
  item(Boolean(prom && prom.total > 0), prom && prom.total > 0 ? `Promessas: ${prom.total} na página.` : 'Promessas: nenhuma nos dados. Ver data/referencia/promessas.json.');
  const obras = dados && dados.obras && Array.isArray(dados.obras.lista) ? dados.obras.lista.length : 0;
  item(obras > 0, obras > 0 ? `Obras: ${obras} na lista.` : 'Obras: lista vazia nos dados. Ver a manutenção do conferencia.md.');

  // Tabela de fontes do Tesouro do ano novo
  const tabelaOk = Boolean(fontes && ((fontes.urls && fontes.urls[`tabela${ano}`]) || new RegExp(`Tabela ${ano}\\b`).test(String(fontes.versao || ''))));
  item(tabelaOk, tabelaOk
    ? `Tabela de fontes do Tesouro de ${ano} já em data/referencia/fontes-recursos.json.`
    : `Tabela de fontes do Tesouro de ${ano}: data/referencia/fontes-recursos.json ainda é de outro ano. Baixar a tabela de ${ano} (página do Tesouro no campo \`urls.pagina\`) e trocar (seção 7 do OPERACAO.md).`);

  const lembretes = [
    `População: a verificação mensal "manutencao-populacao" compara com o IBGE; se houver issue aberto, trocar o número em src/config.js.`,
    'Domínio: a verificação mensal "manutencao-dominio" avisa 60 dias antes do vencimento; confirmar a renovação no Registro.br.',
    `Tabela de fontes do Tesouro: conferir se saiu portaria nova para ${ano} (data/referencia/fontes-recursos.json).`,
    'Entenda: revisão jurídica anual dos textos (rotina na nuvem de fevereiro): leis, valores e links citados em data/referencia/entenda.json.',
    'Bairros: pedido anual por LAI da lista do cadastro (verificação mensal "manutencao-referencias").',
  ];
  return { itens, lembretes };
}

export function linhasVirada(ano, { itens, lembretes }) {
  return [
    `**Virada para ${ano}: lista de conferência.** ✅ = ok; ⚠️ = olhar.`,
    '',
    ...itens.map((i) => `- ${i.ok ? '✅' : '⚠️'} ${i.texto}`),
    '',
    '**Lembretes do ano:**',
    ...lembretes.map((l) => `- [ ] ${l}`),
  ];
}

const lerOuNada = async (caminho) => { try { return await lerJson(caminho); } catch (e) { console.log(`${caminho} não lido (${e.message}).`); return null; } };

async function principal() {
  const agora = agoraIso();
  const ano = Number(diaSP(agora).slice(0, 4));
  const r = avaliarVirada({
    ano,
    dados: await lerOuNada('data/processado/dados.json'),
    meta: await lerOuNada('data/processado/meta.json'),
    semanas: await lerOuNada('data/processado/semanas.json'),
    origem: await lerOuNada('data/processado/origem.json'),
    emendas: await lerOuNada('data/referencia/emendas.json'),
    fontes: await lerOuNada('data/referencia/fontes-recursos.json'),
  });
  const corpo = montarCorpo(agora, linhasVirada(ano, r));
  console.log(corpo);
  // Sempre abre (uma vez por ano): é a lista de conferência de janeiro.
  await publicar({ nome: 'virada-do-ano', titulo: `Manutenção: virada do ano ${ano} (lista de conferência)`, texto: corpo, precisa: true, agora });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await principal();
