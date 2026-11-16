import { baixar } from './http.js';
import { resumirContratacoes, resumirContratos } from '../regras/contratos.js';

const BASE = 'https://pncp.gov.br/api/consulta/v1';
export const CNPJ_ORGAO = '46634507000106';
// Link público (não verificado como estável): https://pncp.gov.br/app/orgaos/46634507000106 (página do órgão no portal do PNCP).

// A API do PNCP oscila (504 e demoras de 20 a 70 s): até 3 tentativas em 5xx ou tempo esgotado.
async function baixarComTentativas(url) {
  for (let t = 1; ; t++) {
    try { return await baixar(url); } catch (e) {
      const transitorio = e.name === 'TimeoutError' || e.name === 'AbortError' || e.status >= 500;
      if (!transitorio || t >= 3) throw e;
    }
  }
}

// 204 = sem itens (corpo vazio). Qualquer outro erro HTTP lança.
async function paginas(caminho, tamanho) {
  const itens = [];
  for (let pagina = 1; ; pagina++) {
    const buf = await baixarComTentativas(`${BASE}${caminho}&pagina=${pagina}&tamanhoPagina=${tamanho}`);
    if (!buf.length) break;
    let json;
    try { json = JSON.parse(buf.toString('utf8')); } catch { throw new Error(`PNCP ${caminho}: resposta não é JSON.`); }
    if (!Array.isArray(json.data)) throw new Error(`PNCP ${caminho}: formato inesperado.`);
    itens.push(...json.data);
    if (!json.paginasRestantes || !json.data.length) break;
  }
  return itens;
}

export async function coletarContratos(anos, hoje = new Date()) {
  const saida = {};
  for (const ano of anos) {
    const ini = `${ano}0101`;
    const fim = ano === hoje.getFullYear() ? hoje.toISOString().slice(0, 10).replaceAll('-', '') : `${ano}1231`;
    const contratacoes = [];
    for (let mod = 1; mod <= 13; mod++) {
      const lista = await paginas(`/contratacoes/publicacao?dataInicial=${ini}&dataFinal=${fim}&codigoModalidadeContratacao=${mod}&cnpj=${CNPJ_ORGAO}`, 50);
      contratacoes.push(...lista.filter((c) => (c.orgaoEntidade?.cnpj ?? CNPJ_ORGAO) === CNPJ_ORGAO));
    }
    const contratos = await paginas(`/contratos?dataInicial=${ini}&dataFinal=${fim}&cnpjOrgao=${CNPJ_ORGAO}`, 500);
    saida[ano] = {
      contratacoes: resumirContratacoes(contratacoes),
      contratos: resumirContratos(contratos),
      coletadoEm: hoje.toISOString(),
    };
  }
  return saida;
}
