import { baixar } from './http.js';
import { esperar } from '../util/texto.js';
import { resumirContratacoes, resumirContratos } from '../regras/contratos.js';

const BASE = 'https://pncp.gov.br/api/consulta/v1';
export const CNPJ_ORGAO = '46634507000106';
// Link público (não verificado como estável): https://pncp.gov.br/app/orgaos/46634507000106 (página do órgão no portal do PNCP).
const ESPERAS_MS = [5000, 15000];
const MAX_PAGINAS = { 50: 200, 500: 20 };

const hojeSP = (agora) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora);

// A API do PNCP oscila (504, demoras de 20 a 70 s): até 3 tentativas com espera de 5 s e 15 s em 5xx, 429 ou tempo esgotado.
async function baixarComTentativas(url) {
  for (let t = 0; ; t++) {
    try { return await baixar(url); } catch (e) {
      const transitorio = e.name === 'TimeoutError' || e.name === 'AbortError' || e.status === 429 || e.status >= 500;
      if (!transitorio || t >= ESPERAS_MS.length) throw e;
      await esperar(ESPERAS_MS[t]);
    }
  }
}

// 204 na primeira página = sem itens. Qualquer inconsistência lança: nunca devolve lista incompleta.
async function paginas(caminho, tamanho, verificarPrazo) {
  const porId = new Map();
  let total = null;
  for (let pagina = 1; ; pagina++) {
    if (pagina > MAX_PAGINAS[tamanho]) throw new Error(`PNCP ${caminho}: páginas demais (limite ${MAX_PAGINAS[tamanho]}).`);
    verificarPrazo();
    const buf = await baixarComTentativas(`${BASE}${caminho}&pagina=${pagina}&tamanhoPagina=${tamanho}`);
    if (!buf.length) {
      if (pagina > 1) throw new Error(`PNCP ${caminho}: página ${pagina} vazia no meio da paginação.`);
      break;
    }
    let json;
    try { json = JSON.parse(buf.toString('utf8')); } catch { throw new Error(`PNCP ${caminho}: resposta não é JSON.`); }
    if (!Array.isArray(json.data)) throw new Error(`PNCP ${caminho}: formato inesperado.`);
    if (Number.isFinite(json.totalRegistros)) total = json.totalRegistros;
    for (const item of json.data) porId.set(item.numeroControlePNCP ?? `sem-id-${porId.size}`, item);
    if (!json.paginasRestantes || !json.data.length) break;
  }
  if (total !== null && porId.size !== total) throw new Error(`PNCP ${caminho}: recebidos ${porId.size} de ${total} registros.`);
  return [...porId.values()];
}

// Tudo ou nada por ano. Se o prazo estourar (ou algo falhar), o erro leva em `anosCompletos` o que já ficou pronto.
export async function coletarContratos(anos, { prazoMs = Infinity, agora = new Date() } = {}) {
  const limite = Date.now() + prazoMs;
  const verificarPrazo = () => { if (Date.now() > limite) throw new Error('PNCP: prazo de coleta esgotado.'); };
  const hoje = hojeSP(agora);
  const saida = {};
  try {
    for (const ano of anos) {
      const ini = `${ano}0101`;
      const fim = ano === Number(hoje.slice(0, 4)) ? hoje.replaceAll('-', '') : `${ano}1231`;
      const contratacoes = [];
      for (let mod = 1; mod <= 13; mod++) {
        const lista = await paginas(`/contratacoes/publicacao?dataInicial=${ini}&dataFinal=${fim}&codigoModalidadeContratacao=${mod}&cnpj=${CNPJ_ORGAO}`, 50, verificarPrazo);
        contratacoes.push(...lista.filter((c) => (c.orgaoEntidade?.cnpj ?? CNPJ_ORGAO) === CNPJ_ORGAO));
      }
      const contratos = await paginas(`/contratos?dataInicial=${ini}&dataFinal=${fim}&cnpjOrgao=${CNPJ_ORGAO}`, 500, verificarPrazo);
      saida[ano] = {
        contratacoes: resumirContratacoes(contratacoes),
        contratos: resumirContratos(contratos),
        coletadoEm: agora.toISOString(),
      };
    }
  } catch (e) {
    e.anosCompletos = saida;
    throw e;
  }
  return saida;
}
