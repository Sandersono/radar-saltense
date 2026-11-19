import { AUTOR, CAMARA, fichaOficial } from '../config.js';
import { esc, ocultarDocumentos } from '../util/texto.js';
import { layout, ENDERECO, DESCRICAO, ORGANIZACAO, dataBR, diaSP, isoSP, paginaAusente } from './base.js';
import { situacao } from './obras.js';
import { nomeProprio } from './emendas.js';

// Página "Dados abertos" (dados.html), os arquivos de dist/dados/ e os arquivos para máquinas
// (llms.txt, .well-known/security.txt, site.webmanifest). Tudo refeito a cada geração do site.
// Privacidade: nenhum CPF/RG; empresa só com CNPJ completo (pessoa física só nos totais). Ementas = texto oficial da Câmara
// (podem citar homenageados, como no site da Câmara), com CPF e RG trocados por [omitido]; atos administrativos ficam de fora.

export const LICENCA = 'https://creativecommons.org/licenses/by/4.0/';
export const CITACAO = 'Radar Saltense (radarsaltense.com.br)';
const PORTAL_PROPOSITURAS = 'https://cmsalto.sisvetor.com.br/ords/cmsalto/f?p=742:92';

// Fontes oficiais citadas no llms.txt e nos conjuntos de dados.
export const FONTES_OFICIAIS = {
  tce: ['https://transparencia.tce.sp.gov.br/', 'TCE-SP: Portal da Transparência Municipal (receitas e despesas de Salto)'],
  camara: [CAMARA, 'Câmara Municipal de Salto: vereadores, presença, votações e emendas'],
  proposituras: [PORTAL_PROPOSITURAS, 'Câmara Municipal de Salto: portal de proposituras'],
  siconfi: ['https://siconfi.tesouro.gov.br/', 'Tesouro Nacional (SICONFI): áreas do gasto e Matriz de Saldos Contábeis'],
  pncp: ['https://pncp.gov.br/', 'PNCP: Portal Nacional de Contratações Públicas (licitações e contratos)'],
  obrasgov: ['https://api-publica.obrasgov.gestao.gov.br/obras/docs', 'Obrasgov.br: obras com dinheiro federal'],
  tceObras: ['https://paineldeobras.tce.sp.gov.br/', 'TCE-SP: Painel de Obras'],
  tse: ['https://divulgacandcontas.tse.jus.br/divulga/', 'TSE: DivulgaCandContas (plano de governo e campanhas de 2024)'],
  ibge: ['https://cidades.ibge.gov.br/brasil/sp/salto', 'IBGE Cidades: Salto/SP'],
};

// --- CSV: UTF-8 com BOM (o Excel reconhece os acentos), separador ";", aspas quando preciso, fim de linha CRLF. ---
const celula = (v) => {
  let s = v === null || v === undefined ? '' : String(v);
  // Texto que começa com = + - @ seria lido pelo Excel como fórmula: um apóstrofo na frente desarma.
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[;"\r\n]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const BOM = String.fromCharCode(0xfeff);
export const csv = (colunas, linhas) => `${BOM}${[colunas, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n')}\r\n`;

// Empresa só aparece com CNPJ completo (14 dígitos); qualquer outro contratado vira "pessoa física".
export const cnpjValido = (c) => /^\d{14}$/.test(String(c || '').replace(/\D/g, ''));
export const empresaPublica = (nome, cnpj) => (!nome ? null : cnpjValido(cnpj) ? nome : 'pessoa física');
export const soEmpresas = (lista = []) => lista.filter((e) => cnpjValido(e.cnpj)).map((e) => ({ cnpj: e.cnpj, nome: e.nome, total: e.total }));

// --- Arquivos para máquinas ---

// security.txt (RFC 9116): vale um ano a partir da geração. Data em ISO 8601 UTC, sem milissegundos.
export function expiraEm(instante) {
  const d = new Date(instante);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
export const securityTxt = (instante) => [
  `Contact: https://instagram.com/${AUTOR.instagram}`,
  `Expires: ${expiraEm(instante)}`,
  'Preferred-Languages: pt-BR',
  `Canonical: ${ENDERECO}.well-known/security.txt`,
  `Policy: ${ENDERECO}sobre.html`,
  '',
].join('\n');

export const manifesto = () => `${JSON.stringify({
  name: 'Radar Saltense',
  short_name: 'Radar Saltense',
  description: DESCRICAO,
  lang: 'pt-BR',
  dir: 'ltr',
  id: '/',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  theme_color: '#0B2545',
  background_color: '#FFF7EA',
  icons: [
    { src: '/marca/icone-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/marca/icone-512.png', sizes: '512x512', type: 'image/png' },
  ],
}, null, 2)}\n`;

// Páginas principais do llms.txt: [caminho, nome, descrição de uma linha].
export const PAGINAS_LLMS = [
  ['camara.html', 'Câmara', 'Custo da Câmara (folha e salários), requerimentos respondidos, emendas dos vereadores e campanhas de 2024.'],
  ['prefeitura.html', 'Prefeitura', 'Promessas do plano de governo, obras, compras no PNCP e a nota do TCE-SP (IEGM).'],
  ['obras.html', 'Obras', 'Obras da Prefeitura e do SAAE: licitações, contratos, obras federais e paralisadas, com a fonte de cada situação.'],
  ['impostometro.html', 'Impostos', 'Quanto Salto arrecada no ano, mês a mês, pelos dados do TCE-SP.'],
  ['gastos.html', 'Gastos', 'Raio-X dos gastos: por órgão, por área e as empresas que mais receberam.'],
  ['origem.html', 'De onde vem o dinheiro', 'Receita por fonte de recurso (livre ou carimbado) e onde foi gasta, pela MSC do Tesouro Nacional.'],
  ['promessas.html', 'Promessas', 'Plano de governo do prefeito registrado no TSE, com o status de cada promessa e a prova oficial.'],
  ['votacoes.html', 'Votações', 'Resultado das votações da Câmara e quem votou contra, pelos PDFs oficiais.'],
  ['bairros.html', 'Bairros', 'O que os vereadores pediram para cada bairro de Salto.'],
  ['semana.html', 'Resumo da semana', 'O que mudou nos dados oficiais na semana (também em feed RSS).'],
  ['entenda.html', 'Entenda', 'Textos curtos que explicam orçamento, Câmara e Prefeitura com os números de Salto.'],
  ['perguntas-frequentes.html', 'Perguntas frequentes', 'Respostas curtas sobre a Câmara, a Prefeitura e o dinheiro da cidade.'],
  ['sobre.html', 'Sobre', 'Quem faz o site, independência, como os dados são coletados e como pedir correção.'],
  ['fontes.html', 'Fontes', 'As fontes oficiais e as regras usadas para contar propostas, presença, votações, impostos e gastos.'],
];

// llms.txt (llmstxt.org): H1, resumo em citação e seções de links absolutos com uma linha de descrição.
// existe(caminho): a página saiu nesta geração; conjuntos: [{ arquivo, nome, descricao }].
export function llmsTxt({ atualizadoEm, conjuntos = [], existe = () => true }) {
  const item = (url, nome, texto) => `- [${nome}](${url}): ${texto}`;
  const dia = atualizadoEm ? dataBR(diaSP(atualizadoEm)) : '';
  return [
    '# Radar Saltense',
    '',
    '> Site cívico independente de transparência de Salto/SP. Mostra o que fazem os 11 vereadores e a Prefeitura, quanto a cidade arrecada e onde gasta, só com dados oficiais e link para a fonte. Um robô atualiza tudo todo dia. Sem ligação com a Câmara, a Prefeitura ou partidos.',
    '',
    `Última atualização dos dados: ${dia || 'sem data'}. CPFs não aparecem no site; nos gastos e nas obras, empresas só aparecem com CNPJ e pessoas físicas só nos totais.`,
    '',
    '## Páginas principais',
    '',
    item(ENDERECO, 'Início', 'Os 11 vereadores (presença, propostas, votos contra) e a busca por bairro ou rua.'),
    ...PAGINAS_LLMS.filter(([c]) => existe(c)).map(([c, nome, texto]) => item(`${ENDERECO}${c}`, nome, texto)),
    '',
    '## Dados abertos',
    '',
    item(`${ENDERECO}dados.html`, 'Dados abertos', `Descrição, dicionário de campos e licença de cada arquivo. Uso livre citando "${CITACAO}" e a fonte oficial (CC BY 4.0).`),
    ...conjuntos.map((c) => item(`${ENDERECO}${c.arquivo}`, c.nome, c.descricao)),
    '',
    '## Fontes oficiais',
    '',
    ...['tce', 'camara', 'siconfi', 'pncp', 'obrasgov', 'tse', 'ibge'].map((k) => item(FONTES_OFICIAIS[k][0], FONTES_OFICIAIS[k][1].split(':')[0], FONTES_OFICIAIS[k][1].split(': ').slice(1).join(': '))),
    '',
  ].join('\n');
}

// --- Conjuntos de dados (dist/dados/) ---

const GRUPOS = { melhoria: 'pedidos de melhoria nos bairros (indicações)', cobranca: 'perguntas e cobranças (requerimentos)', homenagem: 'homenagens', lei: 'propostas de lei', outros: 'outros (moções de apelo, repúdio ou apoio)' };
const GRUPOS_PUBLICOS = Object.keys(GRUPOS);
const json = (x) => `${JSON.stringify(x, null, 1)}\n`;
const lista = (xs) => (xs || []).filter(Boolean).join(' | ');

// Todos os conjuntos que têm dado nesta rodada: [{ id, arquivo, nome, descricao, formato, frequencia, fontes, campos, conteudo }].
export function conjuntosDeDados(d) {
  const nomeVereador = new Map((d.vereadores || []).map((v) => [v.id, v.nome]));
  const anteriores = (d.emendas && d.emendas.anteriores) || {};
  const nomeDe = (id) => nomeVereador.get(id) || (anteriores[id] ? nomeProprio(anteriores[id]) : id);
  const out = [];

  out.push({
    id: 'vereadores', arquivo: 'dados/vereadores.json', formato: 'application/json', nome: 'Vereadores',
    descricao: 'Os 11 vereadores de Salto: partido, presença nas sessões, propostas por grupo e votos contra.',
    frequencia: 'Todo dia; a presença muda quando a Câmara publica o PDF do mês.',
    fontes: [FONTES_OFICIAIS.camara, FONTES_OFICIAIS.proposituras],
    campos: [
      ['id', 'identificador do vereador no site'], ['nome', 'nome oficial'], ['apelido', 'apelido oficial na página da Câmara'], ['partido', 'sigla do partido'],
      ['presenca', 'marcas nos PDFs de presença desde 2025: P (presença), A (ausência), AJ (ausência justificada) e total de sessões'],
      ['propostas', `quantidade de propostas por grupo (${GRUPOS_PUBLICOS.join(', ')}) e total`],
      ['votos_contra', 'votos contra registrados nos PDFs de votação'], ['ausencias_votacao', 'votações em que o PDF registra o vereador como ausente'],
      ['pagina', 'página do vereador no Radar Saltense'], ['pagina_oficial', 'página do vereador no site da Câmara'],
    ],
    conteudo: json((d.vereadores || []).map((v) => {
      const propostas = Object.fromEntries(GRUPOS_PUBLICOS.map((g) => [g, (v.porGrupo && v.porGrupo[g]) || 0]));
      return {
        id: v.id, nome: v.nome, apelido: v.apelido || null, partido: v.partido || null,
        presenca: { P: v.presenca?.P ?? null, A: v.presenca?.A ?? null, AJ: v.presenca?.AJ ?? null, total: v.presenca?.total ?? null },
        propostas: { ...propostas, total: Object.values(propostas).reduce((s, n) => s + n, 0) },
        votos_contra: v.votosContra, ausencias_votacao: v.ausenciasVotacao ?? null,
        pagina: `${ENDERECO}vereador/${v.id}.html`, pagina_oficial: v.url,
      };
    })),
  });

  // Atos administrativos (portarias, atos da Mesa e da Presidência) ficam de fora: citam servidores pelo nome e não contam para vereador.
  const props = (d.proposituras || []).filter((p) => GRUPOS_PUBLICOS.includes(p.grupo));
  out.push({
    id: 'proposituras', arquivo: 'dados/proposituras.csv', formato: 'text/csv', nome: 'Propostas dos vereadores',
    descricao: 'Todas as propostas desde 2025 (indicações, requerimentos, moções, projetos de lei), com autores, ruas e bairros citados e o link da ficha oficial.',
    frequencia: 'Todo dia.',
    fontes: [FONTES_OFICIAIS.proposituras],
    campos: [
      ['id', 'número da ficha no portal da Câmara'], ['data', 'data da proposta (AAAA-MM-DD)'], ['tipo', 'tipo de documento (Indicação, Requerimento, Moção…)'], ['numero', 'número da proposta no ano'],
      ['grupo', Object.entries(GRUPOS).map(([k, v]) => `${k} = ${v}`).join('; ')], ['autores_vereadores', 'vereadores autores, separados por " | " (vazio quando o autor é comissão, Mesa ou Prefeitura)'],
      ['ementa', 'resumo oficial da proposta (CPF e RG trocados por [omitido])'], ['bairros', 'bairros citados no texto, separados por " | "'], ['ruas', 'ruas citadas no texto, separadas por " | "'],
      ['ficha_oficial', 'link da ficha no portal da Câmara'],
    ],
    conteudo: csv(['id', 'data', 'tipo', 'numero', 'grupo', 'autores_vereadores', 'ementa', 'bairros', 'ruas', 'ficha_oficial'],
      props.map((p) => {
        const locais = (t) => lista([...new Set((p.locais || []).filter((l) => l.tipo === t).map((l) => l.nome))]);
        return [p.id, p.data, p.categoria, p.numero, p.grupo, lista((p.vereadores || []).map(nomeDe)), ocultarDocumentos(p.ementa), locais('bairro'), locais('rua'), fichaOficial(p.id)];
      })),
  });

  out.push({
    id: 'votacoes', arquivo: 'dados/votacoes.csv', formato: 'text/csv', nome: 'Votações da Câmara',
    descricao: 'Resultado de cada votação dos PDFs anuais da Câmara e os vereadores que votaram contra.',
    frequencia: 'Todo dia; muda quando a Câmara atualiza o PDF do ano.',
    fontes: [FONTES_OFICIAIS.camara],
    campos: [
      ['projeto', 'projeto votado, como escrito no PDF'], ['ementa', 'resumo do projeto'], ['data', 'data da votação (AAAA-MM-DD)'], ['turno', 'turno, quando o PDF informa'],
      ['resultado', 'resultado escrito no PDF'], ['votaram_contra', 'vereadores que votaram contra, separados por " | ". O site não deduz votos a favor'], ['fonte', 'PDF oficial da votação'],
    ],
    conteudo: csv(['projeto', 'ementa', 'data', 'turno', 'resultado', 'votaram_contra', 'fonte'],
      (d.votacoes || []).flatMap((v) => (v.eventos || []).map((e) => [v.rotulo, ocultarDocumentos(v.ementa), e.data, e.turno, e.resultado, lista((e.contra || []).map(nomeDe)), e.url || v.url]))),
  });

  if (d.gastos && d.gastos.anos) {
    out.push({
      id: 'gastos', arquivo: 'dados/gastos-por-ano.json', formato: 'application/json', nome: 'Gastos por ano',
      descricao: 'Total pago por ano em Salto, por órgão, por tipo de quem recebeu e por área, e as 20 empresas que mais receberam (só empresas com CNPJ).',
      frequencia: 'Todo dia; o TCE-SP publica um mês fechado por vez e o SICONFI, um bimestre.',
      fontes: [FONTES_OFICIAIS.tce, FONTES_OFICIAIS.siconfi],
      campos: [
        ['ano', 'ano dos gastos'], ['ultimo_mes', 'último mês publicado pelo TCE-SP'], ['meses_publicados', 'quantos meses o TCE-SP já publicou no ano'], ['total', 'total pago no ano, em reais'],
        ['por_orgao', 'total por órgão: prefeitura, camara, saae'], ['por_grupo', 'total por quem recebeu: empresas, publicos (órgãos públicos) e pessoas (pessoas físicas, só o total)'],
        ['pessoas_fisicas', 'total pago a pessoas físicas e quantas são; nomes e CPFs não saem do TCE-SP'],
        ['areas', 'gasto por área (Saúde, Educação…) no último bimestre do SICONFI'], ['top_empresas', 'as empresas que mais receberam: cnpj, nome e total'],
        ['concentracao', 'quanto as 10 maiores somam, o total pago a empresas e o percentual'], ['anulado', 'total de pagamentos anulados e as empresas com mais anulações'],
      ],
      conteudo: json(Object.entries(d.gastos.anos).map(([ano, g]) => ({
        ano: Number(ano), ultimo_mes: g.ultimoMes, meses_publicados: g.mesesPublicados, total: g.total,
        por_orgao: g.porOrgao, por_grupo: g.porGrupo, pessoas_fisicas: g.pessoasFisicas ? { total: g.pessoasFisicas.total, quantidade: g.pessoasFisicas.quantidade } : null,
        areas: g.areas ? { bimestre: g.areas.bimestre, total: g.areas.total, lista: g.areas.lista } : null,
        top_empresas: soEmpresas(g.topEmpresas), concentracao: g.concentracao || null,
        anulado: g.anulado ? { total: g.anulado.total, top: soEmpresas(g.anulado.top) } : null,
      }))),
    });
  }

  if (d.obras && d.obras.lista) {
    const tceBase = d.obras.fontes && d.obras.fontes.tceDataBase;
    out.push({
      id: 'obras', arquivo: 'dados/obras.json', formato: 'application/json', nome: 'Obras',
      descricao: 'As obras da página Obras: licitações, contratos, obras com dinheiro federal e paralisadas, com a situação e a fonte de cada uma.',
      frequencia: 'Todo dia.',
      fontes: [FONTES_OFICIAIS.pncp, FONTES_OFICIAIS.obrasgov, FONTES_OFICIAIS.tceObras, ['https://salto.sp.gov.br/consulta-de-obras-paralisadas/', 'Prefeitura de Salto: obras paralisadas']],
      campos: [
        ['id', 'identificador da obra no site'], ['titulo', 'título curto'], ['objeto', 'descrição oficial completa'], ['orgao', 'Prefeitura, SAAE ou consórcio'],
        ['empresa', 'empresa contratada (só com CNPJ); contratado pessoa física aparece como "pessoa física"'], ['cnpj', 'CNPJ da empresa'],
        ['valor', 'valor em reais'], ['tipo_valor', 'contrato, homologado, estimado ou previsto (Obrasgov.br)'], ['assinatura', 'data de assinatura do contrato'], ['fim_vigencia', 'fim da vigência do contrato'],
        ['grupo', 'paralisada, execucao, licitacao, federal ou encerrada'], ['situacao', 'situação como aparece no site, sempre com quem disse'],
        ['executado', 'percentual executado informado ao Obrasgov.br e a data'], ['promessas', 'números das promessas ligadas à mão'], ['links', 'links oficiais: contrato e licitação no PNCP, Obrasgov.br, TCE-SP, Prefeitura'],
      ],
      conteudo: json(d.obras.lista.map((o) => {
        let texto = null;
        try { texto = situacao(o); } catch { texto = null; }
        const cnpj = cnpjValido(o.fornecedorCnpj) ? o.fornecedorCnpj : null;
        return {
          id: o.id, titulo: o.titulo, objeto: ocultarDocumentos(o.objeto), orgao: o.orgao, empresa: empresaPublica(o.empresa, o.fornecedorCnpj), cnpj,
          valor: o.valor ?? null, tipo_valor: o.tipoValor || null, assinatura: o.assinatura || null, fim_vigencia: o.fimVigencia || null,
          grupo: o.grupo, situacao: texto, situacao_tce: o.tce ? { situacao: o.tce.situacao, data_base: tceBase || null } : null,
          executado: o.execucao ? { percentual: o.execucao.pct, em: o.execucao.em || null } : null,
          promessas: o.promessas || [],
          links: {
            contrato_pncp: (o.contrato && o.contrato.url) || null, licitacao_pncp: (o.licitacao && o.licitacao.url) || null,
            obrasgov: (o.obrasgov || []).map((p) => p.url).filter(Boolean),
            tce: o.tce ? FONTES_OFICIAIS.tceObras[0] : null, prefeitura: (o.prefeitura && o.prefeitura.link) || null,
          },
        };
      })),
    });
  }

  if (d.origem && d.origem.anos) {
    out.push({
      id: 'origem', arquivo: 'dados/origem.json', formato: 'application/json', nome: 'De onde vem e para onde vai o dinheiro',
      descricao: 'Por ano: a receita de Salto por origem (impostos, repasses, Fundeb…), o dinheiro livre e carimbado e onde cada destino foi gasto.',
      frequencia: 'Todo dia; ano corrente pela última matriz mensal, ano fechado pela matriz de encerramento.',
      fontes: [FONTES_OFICIAIS.siconfi, [d.origem.paginaFontes || 'https://www.gov.br/tesouronacional/pt-br/contabilidade-e-custos/federacao/fonte-ou-destinacao-de-recursos', 'Tesouro Nacional: tabela de fontes de recursos']],
      campos: [
        ['ano', 'ano'], ['matriz', 'MSC (mensal) ou MSCE (encerramento) e o mês'], ['consulta', 'consulta oficial da matriz no Tesouro'],
        ['receita', 'receita bruta, deduções (Fundeb e outras), intraorçamentária, líquida e total, em reais'],
        ['origem', 'receita por origem: grupo, rótulo e valor'], ['livre', 'dinheiro sem destino fixo'], ['carimbado', 'dinheiro com destino fixo por lei ou convênio'], ['tarifas', 'tarifas (ex.: água e esgoto do SAAE)'],
        ['destino', 'por destino: quanto entrou, foi liquidado e pago, as áreas do gasto e as principais fontes de recurso'],
        ['despesa', 'despesa empenhada, liquidada e paga'], ['emendas', 'emendas parlamentares recebidas (União e Estado) e onde foram gastas'],
      ],
      conteudo: json(Object.entries(d.origem.anos).map(([ano, o]) => ({
        ano: Number(ano), matriz: { tipo: o.tipo, mes: o.mes }, consulta: o.url, receita: o.receita, origem: o.origem,
        livre: o.livre, carimbado: o.carimbado, tarifas: o.tarifas ?? null, destino: o.destino, despesa: o.despesa, emendas: o.emendas || null,
      }))),
    });
  }

  if (d.emendas) {
    const anos = Object.keys(d.emendas).filter((k) => /^\d{4}$/.test(k));
    out.push({
      id: 'emendas', arquivo: 'dados/emendas.json', formato: 'application/json', nome: 'Emendas impositivas dos vereadores',
      descricao: 'Para onde cada vereador indicou a parte do orçamento que a lei reserva a ele (emendas impositivas), com valor e, quando a Câmara publica, quanto foi pago.',
      frequencia: 'Quando a Câmara publica um PDF novo de emendas (o robô avisa e a ferramenta é rodada à mão).',
      fontes: [['https://www.camarasalto.sp.gov.br/orcamento-publico/emendas-impositivas', 'Câmara Municipal de Salto: emendas impositivas']],
      campos: [
        ['ano', 'ano do orçamento'], ['fonte', 'PDF oficial'], ['atualizado_em', 'data do PDF'],
        ['emendas', 'uma linha por emenda: vereador (id e nome), entidade, projeto ou objeto, secretaria, tipo (livre ou saúde, em 2026), valor, pago e situação (em 2025)'],
        ['resumo', 'por vereador: total, pago, quantidade e situações'],
      ],
      conteudo: json(anos.map((ano) => {
        const a = d.emendas[ano];
        return {
          ano: Number(ano), fonte: a.fonte, pagina: a.pagina || null, atualizado_em: a.atualizadoEm || null,
          emendas: (a.emendas || []).map((e) => ({
            vereador_id: e.vereador, vereador: nomeDe(e.vereador), entidade: e.entidade ? ocultarDocumentos(e.entidade) : null,
            projeto: e.projeto ? ocultarDocumentos(e.projeto) : e.objeto ? ocultarDocumentos(e.objeto) : null, secretaria: e.secretaria || null,
            tipo: e.tipo || null, valor: e.valor ?? null, pago: e.pago ?? null, situacao: e.situacao || null,
          })),
          resumo: a.resumo ? { total: a.resumo.total, pago: a.resumo.pago, por_vereador: a.resumo.porVereador } : null,
        };
      })),
    });
  }

  if (d.promessas && d.promessas.areas) {
    const obrasPorPromessa = new Map();
    for (const o of (d.obras && d.obras.lista) || []) for (const n of o.promessas || []) obrasPorPromessa.set(String(n), [...(obrasPorPromessa.get(String(n)) || []), o.id]);
    out.push({
      id: 'promessas', arquivo: 'dados/promessas.json', formato: 'application/json', nome: 'Promessas do plano de governo',
      descricao: 'As promessas do plano de governo registrado no TSE em 2024, com o status e a prova oficial de cada uma.',
      frequencia: 'Uma vez por mês (dia 15), só com prova oficial; nunca rebaixa status.',
      fontes: [FONTES_OFICIAIS.tse],
      campos: [
        ['area', 'área do plano'], ['numero', 'número da promessa no plano'], ['texto', 'texto da promessa'],
        ['status', '"sem informação" (ainda sem prova), "em andamento" ou "cumprida"'], ['provas', 'provas oficiais: título, link e data'], ['obras', 'obras ligadas (id em obras.json)'],
      ],
      conteudo: json({
        fonte: d.promessas.fonte, titulo: d.promessas.titulo, resumo: d.promessas.resumo,
        areas: d.promessas.areas.map((a) => ({
          area: a.area,
          itens: (a.itens || []).map((it) => ({
            numero: it.numero, grupo: it.grupo || null, texto: it.texto, status: it.status,
            provas: (it.provas || []).filter((p) => p && p.url).map((p) => ({ titulo: p.titulo || null, url: p.url, data: p.data || null })),
            obras: obrasPorPromessa.get(String(it.numero)) || [],
          })),
        })),
      }),
    });
  }
  return out;
}

// "12 KB", "1,4 MB"
export const tamanho = (bytes) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);
const rotuloFormato = (f) => (f === 'text/csv' ? 'CSV' : 'JSON');

export function paginaDados(d, conjuntos) {
  const modificado = isoSP(d.meta.atualizadoEm);
  const licencaHtml = `Uso livre, citando "${esc(CITACAO)}" e a fonte oficial. A compilação do site está sob a licença <a href="${LICENCA}">CC BY 4.0</a>; os dados oficiais continuam públicos na fonte.`;
  const secoes = conjuntos.map((c) => {
    const bytes = Buffer.byteLength(c.conteudo);
    return `<section id="${esc(c.id)}" class="secao cartao">
<h2>${esc(c.nome)}</h2>
<p>${esc(c.descricao)}</p>
<p><a class="botao" href="${esc(c.arquivo)}" download>Baixar ${rotuloFormato(c.formato)} (${tamanho(bytes)})</a></p>
<ul>
<li><strong>Atualização:</strong> ${esc(c.frequencia)}</li>
<li><strong>Fonte oficial:</strong> ${c.fontes.map(([url, texto]) => `<a href="${esc(url)}">${esc(texto)}</a>`).join('; ')}</li>
<li><strong>Licença:</strong> ${licencaHtml}</li>
</ul>
<details><summary>O que tem em cada campo</summary>
<dl>${c.campos.map(([k, v]) => `<dt><code>${esc(k)}</code></dt><dd>${esc(v)}</dd>`).join('')}</dl>
</details>
</section>`;
  }).join('\n');
  const corpo = `<h1>Dados abertos do Radar Saltense</h1>
<p>Os números do site também estão em arquivos para baixar, abrir no Excel ou usar em outro programa. São refeitos todo dia, junto com o site, a partir das fontes oficiais.</p>
${conjuntos.length > 1 ? `<nav class="sumario" aria-label="Nesta página">${conjuntos.map((c) => `<a class="chip" href="#${esc(c.id)}">${esc(c.nome)}</a>`).join('')}<a class="chip" href="#como-usar">Como usar</a></nav>` : ''}
<section id="como-usar" class="secao cartao">
<h2>Como usar</h2>
<ul>
<li><strong>Licença:</strong> ${licencaHtml}</li>
<li><strong>CSV:</strong> separado por ponto e vírgula (;), em UTF-8, abre direto no Excel. Listas dentro de uma célula vêm separadas por " | ".</li>
<li><strong>JSON:</strong> valores em reais como número (ponto como separador decimal) e datas no formato AAAA-MM-DD.</li>
<li><strong>Privacidade:</strong> nenhum arquivo traz CPF. Nos gastos e nas obras, empresas só aparecem com CNPJ e quem recebeu como pessoa física entra só nos totais. As ementas são o texto oficial da Câmara, com CPF e RG trocados por [omitido]; atos administrativos, que citam servidores, ficam de fora.</li>
<li><strong>Para conferir:</strong> cada arquivo diz de qual fonte oficial veio. As regras de contagem estão em <a href="fontes.html">De onde vêm os números</a>.</li>
</ul>
</section>
${secoes}`;
  const fontesDe = (c) => c.fontes.map(([url]) => url);
  return layout({
    titulo: 'Dados abertos do Radar Saltense',
    descricao: 'Baixe em JSON e CSV os dados de Salto/SP usados no site: vereadores, propostas, votações, gastos, obras, emendas e promessas. Uso livre com citação.',
    caminho: 'dados.html',
    mostrarAtualizado: true,
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'DataCatalog',
      name: 'Dados abertos do Radar Saltense',
      description: 'Dados oficiais de Salto/SP compilados pelo Radar Saltense, refeitos todo dia.',
      url: `${ENDERECO}dados.html`,
      inLanguage: 'pt-BR',
      license: LICENCA,
      creator: ORGANIZACAO,
      publisher: ORGANIZACAO,
      dateModified: modificado,
      dataset: conjuntos.map((c) => ({
        '@type': 'Dataset',
        name: c.nome,
        description: c.descricao,
        url: `${ENDERECO}dados.html#${c.id}`,
        encodingFormat: c.formato,
        license: LICENCA,
        creator: { '@type': 'Organization', name: 'Radar Saltense', url: ENDERECO },
        dateModified: modificado,
        isAccessibleForFree: true,
        isBasedOn: fontesDe(c),
        spatialCoverage: 'Salto, São Paulo, Brasil',
        distribution: [{ '@type': 'DataDownload', encodingFormat: c.formato, contentUrl: `${ENDERECO}${c.arquivo}` }],
      })),
    },
    corpo,
    atualizadoEm: d.meta.atualizadoEm,
  });
}

// Para quem chama o llms.txt: só páginas que saíram nesta rodada.
export const paginaExiste = (c) => !paginaAusente(c);
