import { baixar } from './http.js';
import { paginas, baixarComTentativas, hojeSP } from './contratos.js';
import { esperar } from '../util/texto.js';
import { IBGE_SALTO } from '../config.js';
import {
  ORGAOS, INICIO_OBRAS, janelas, enxugarContratacao, enxugarContrato, guardarLeitura, podarReleitura, precisaConsultarCompra,
  enxugarProjeto, ultimaExecucao, precisaReconsultar, precisaExecucao, lerTabelaParalisadas,
} from '../regras/obras-cidade.js';

const PNCP = 'https://pncp.gov.br/api/consulta/v1';
const PREFEITURA = '46634507000106';
// O PNCP devolve 429 e 504 em horário de pico: espera cada vez mais antes de tentar de novo.
const ESPERAS_PNCP = [5000, 15000, 45000];
const MAX_COMPRAS_POR_DIA = 40;
const DIA = 86400000;

// Pedidos da leitura completa desde 2025, em janelas curtas (a API demora muito com janela grande).
function pedidosCompletos(hoje) {
  const lista = [];
  for (const [ini, fim] of janelas(INICIO_OBRAS, hoje, 12)) {
    for (const mod of [4, 5]) lista.push({ chave: `licitacoes-${mod}-${ini}`, tipo: 'c', caminho: `/contratacoes/publicacao?dataInicial=${ini}&dataFinal=${fim}&codigoModalidadeContratacao=${mod}&codigoMunicipioIbge=${IBGE_SALTO}`, tamanho: 50 });
  }
  for (const cnpj of Object.keys(ORGAOS)) {
    for (const [ini, fim] of janelas(INICIO_OBRAS, hoje, cnpj === PREFEITURA ? 3 : 12)) lista.push({ chave: `contratos-${cnpj}-${ini}`, tipo: 'k', caminho: `/contratos?dataInicial=${ini}&dataFinal=${fim}&cnpjOrgao=${cnpj}`, tamanho: 500 });
  }
  return lista;
}

const enxugar = (brutosC, brutos) => ({
  contratacoes: brutosC.filter((c) => c.orgaoEntidade && ORGAOS[c.orgaoEntidade.cnpj]).map(enxugarContratacao),
  contratos: brutos.map(enxugarContrato),
});

// PNCP: a primeira leitura (e uma por mês) lê tudo desde 2025, guardando o progresso por janela: se o prazo acabar,
// a próxima atualização continua de onde parou. Nos outros dias só pede o que foi atualizado desde a última coleta.
// A releitura parte do que já está salvo e só apaga o que sumiu quando termina inteira; se nada foi lido nesta
// rodada, lança erro (quem chama mantém o último dado salvo e avisa). `incompleto` = releitura ainda não terminou.
export async function coletarObrasPncp(salvo, { manter = new Set(), prazoMs = 6 * 60 * 1000, agora = new Date() } = {}) {
  const limite = Date.now() + prazoMs;
  const hoje = hojeSP(agora);
  const s = salvo && salvo.contratos ? salvo : null;
  const emSemente = Boolean(s && s.semente);
  const incremental = !emSemente && Boolean(s && s.completoEm && agora - Date.parse(s.completoEm) < 30 * DIA && s.atualizadoAte && agora - Date.parse(s.atualizadoAte) < 300 * DIA);
  const base = { contratacoes: (s && s.contratacoes) || {}, contratos: (s && s.contratos) || {} };
  let contratacoes;
  let contratos;
  let semente = null;
  let parou = null;
  if (incremental) {
    const ini = hojeSP(new Date(Date.parse(s.atualizadoAte) - DIA)).replaceAll('-', '');
    const fim = hoje.replaceAll('-', '');
    const brutosC = [];
    const brutos = [];
    for (const mod of [4, 5]) brutosC.push(...await paginas(`/contratacoes/atualizacao?dataInicial=${ini}&dataFinal=${fim}&codigoModalidadeContratacao=${mod}&codigoMunicipioIbge=${IBGE_SALTO}`, 50, limite, ESPERAS_PNCP));
    for (const cnpj of Object.keys(ORGAOS)) brutos.push(...await paginas(`/contratos/atualizacao?dataInicial=${ini}&dataFinal=${fim}&cnpjOrgao=${cnpj}`, 500, limite, ESPERAS_PNCP));
    ({ contratacoes, contratos } = guardarLeitura(base, enxugar(brutosC, brutos), manter));
  } else {
    const ant = emSemente ? s.semente : { inicio: agora.toISOString(), feitas: [], vistosC: [], vistosK: [] };
    let estado = { ...base, vistosC: ant.vistosC || [], vistosK: ant.vistosK || [] };
    const feitas = [...ant.feitas];
    // Licitações primeiro: decidem quais contratos são candidatos.
    let lidas = 0;
    for (const p of pedidosCompletos(hoje).filter((x) => !feitas.includes(x.chave))) {
      try {
        const itens = await paginas(p.caminho, p.tamanho, limite, ESPERAS_PNCP);
        estado = guardarLeitura(estado, enxugar(p.tipo === 'c' ? itens : [], p.tipo === 'k' ? itens : []), manter);
        feitas.push(p.chave);
        lidas++;
      } catch (e) {
        parou = e;
        break;
      }
    }
    if (parou && !lidas) throw parou;
    const terminou = pedidosCompletos(hoje).every((p) => feitas.includes(p.chave));
    ({ contratacoes, contratos } = terminou ? podarReleitura(estado) : estado);
    if (!terminou) semente = { inicio: ant.inicio, feitas, vistosC: estado.vistosC, vistosK: estado.vistosK };
  }
  const completa = !semente;
  // Contrato que pode ser obra, vindo de contratação que não é concorrência: modalidade e amparo da contratação, uma vez só.
  const compras = { ...((s && s.compras) || {}) };
  const faltam = [...new Set(Object.values(contratos).filter((c) => precisaConsultarCompra(c, contratacoes, compras)).map((c) => c.compra))];
  let consultadas = 0;
  for (const id of parou ? [] : faltam.slice(0, MAX_COMPRAS_POR_DIA)) {
    const m = /^(\d{14})-1-0*(\d+)\/(\d{4})$/.exec(id);
    if (!m) { compras[id] = { modalidadeId: null, amparo: null }; consultadas++; continue; }
    try {
      const j = JSON.parse((await baixarComTentativas(`${PNCP}/orgaos/${m[1]}/compras/${m[3]}/${m[2]}`, limite, ESPERAS_PNCP)).toString('utf8'));
      compras[id] = { modalidadeId: Number(j.modalidadeId) || null, amparo: j.amparoLegal ? { codigo: j.amparoLegal.codigo ?? null, nome: j.amparoLegal.nome || '' } : null };
    } catch (e) {
      if (e.status === 404) compras[id] = { modalidadeId: null, amparo: null };
      else break; // fica para a próxima atualização
    }
    consultadas++;
  }
  return {
    contratacoes, contratos, compras,
    // A próxima leitura por atualização começa daqui (na releitura completa, do início dela).
    completoEm: incremental ? s.completoEm : completa ? (emSemente ? s.semente.inicio : agora.toISOString()) : (s && s.completoEm) || null,
    atualizadoAte: incremental ? agora.toISOString() : completa ? (emSemente ? s.semente.inicio : agora.toISOString()) : (s && s.atualizadoAte) || null,
    ...(completa ? {} : { semente }),
    coletadoEm: agora.toISOString(),
    comprasPendentes: Math.max(0, faltam.length - consultadas),
    incompleto: !completa,
    erro: parou ? parou.message : null,
  };
}

const OBRASGOV = 'https://api-publica.obrasgov.gestao.gov.br/obras';
const MAX_PROJETOS_POR_DIA = 90;

async function pedirObrasgov(caminho, limite) {
  for (let t = 0; ; t++) {
    try {
      return JSON.parse((await baixar(`${OBRASGOV}${caminho}`, { limite, rotulo: 'Obrasgov.br' })).toString('utf8'));
    } catch (e) {
      const transitorio = e.status === 429 || e.status >= 500 || e.name === 'TimeoutError';
      if (!transitorio || t >= 2) throw e;
      await esperar([5000, 20000][t]);
    }
  }
}

// Obrasgov.br (api-publica): ids de Salto pela geometria; cada projeto guardado e reconferido 1 vez por semana.
export async function coletarObrasgov(salvo, { prazoMs = 5 * 60 * 1000, agora = new Date() } = {}) {
  const limite = Date.now() + prazoMs;
  const antes = (salvo && salvo.projetos) || {};
  const base = await pedirObrasgov('/data-atualizacao', limite);
  const ids = new Set();
  for (let pagina = 1; pagina <= 20; pagina++) {
    const j = await pedirObrasgov(`/geometria?cod_ibge=${IBGE_SALTO}&pagina=${pagina}&tamanho_da_pagina=100`, limite);
    if (!Array.isArray(j.data)) throw new Error('Obrasgov.br: formato inesperado na lista de geometrias');
    for (const g of j.data) if (g.id_projeto_investimento) ids.add(g.id_projeto_investimento);
    if (!j.total_pages || pagina >= j.total_pages) break;
  }
  if (!ids.size) throw new Error('Obrasgov.br: nenhuma obra de Salto na lista de geometrias');
  const projetos = {};
  let consultas = 0;
  let falhas = 0;
  let esgotado = false;
  let adiados = 0;
  for (const id of [...ids].sort()) {
    const ant = antes[id];
    if (esgotado || !precisaReconsultar(ant, agora)) { if (ant) projetos[id] = ant; continue; }
    // Limite diário: o resto fica para amanhã (com o dado anterior, se houver).
    if (consultas >= MAX_PROJETOS_POR_DIA) { adiados++; if (ant) projetos[id] = ant; continue; }
    consultas++;
    try {
      const p = ((await pedirObrasgov(`/projeto-investimento?id_projeto_investimento=${encodeURIComponent(id)}`, limite)).data || [])[0];
      if (!p) { if (ant) projetos[id] = ant; continue; }
      const novo = { ...enxugarProjeto(p, agora.toISOString()), execucao: (ant && ant.execucao) || null };
      if (precisaExecucao(ant, novo)) novo.execucao = ultimaExecucao((await pedirObrasgov(`/execucao-fisica?id_projeto_investimento=${encodeURIComponent(id)}`, limite)).data) || novo.execucao;
      projetos[id] = novo;
    } catch (e) {
      if (ant) projetos[id] = ant;
      if (/prazo/.test(e.message)) { esgotado = true; continue; }
      if (++falhas > 10) throw new Error(`Obrasgov.br: mais de 10 projetos falharam (${e.message})`);
    }
  }
  return { dataAtualizacao: (base && base.data_ultima_atualizacao) || null, projetos, coletadoEm: agora.toISOString(), falhas, esgotado, adiados, incompleto: esgotado || adiados > 0 };
}

const PAGINA_PARALISADAS = 'https://salto.sp.gov.br/wp-json/wp/v2/pages?slug=consulta-de-obras-paralisadas&_fields=modified,link,content';

export async function coletarParalisadas({ agora = new Date() } = {}) {
  const j = JSON.parse((await baixar(PAGINA_PARALISADAS, { rotulo: 'Consulta de Obras Paralisadas' })).toString('utf8'));
  const p = Array.isArray(j) ? j[0] : null;
  if (!p || !p.content) throw new Error('a página "Consulta de Obras Paralisadas" não foi encontrada');
  return { modificado: p.modified || null, link: p.link || 'https://salto.sp.gov.br/consulta-de-obras-paralisadas/', obras: lerTabelaParalisadas(p.content.rendered), coletadoEm: agora.toISOString() };
}
