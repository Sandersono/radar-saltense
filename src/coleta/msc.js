import { SICONFI_MSC, IBGE_SALTO, ANO_INICIO } from '../config.js';
import { baixar } from './http.js';
import { esperar } from '../util/texto.js';
import { primeiroComDados, compactarMsc, consultadoHoje } from '../regras/origem.js';

const ROTULO = 'MSC do Tesouro';
const TENTATIVAS = 3;

// Consulta da MSC orçamentária (classe 6, saldo final = acumulado do ano até o mês).
export const urlMsc = (ano, mes, tipo, offset = 0) =>
  `${SICONFI_MSC}?id_ente=${IBGE_SALTO}&an_referencia=${ano}&me_referencia=${mes}&co_tipo_matriz=${tipo}&classe_conta=6&id_tv=ending_balance${offset ? `&offset=${offset}` : ''}`;

// Uma página, com nova tentativa (5 s, depois 15 s) para erro de rede ou do servidor; nunca passa do prazo.
async function pagina(url, limite) {
  for (let t = 1; ; t++) {
    try {
      const texto = (await baixar(url, { limite, rotulo: ROTULO })).toString('utf8');
      let json;
      try { json = JSON.parse(texto); } catch { throw Object.assign(new Error(`${ROTULO}: a resposta não é JSON.`), { definitivo: true }); }
      if (!Array.isArray(json.items)) throw Object.assign(new Error(`${ROTULO}: formato inesperado (sem "items").`), { definitivo: true });
      return json;
    } catch (e) {
      const definitivo = e.definitivo || /prazo/.test(e.message) || (e.status && e.status < 500 && e.status !== 429);
      const pausa = 5000 * 3 ** (t - 1);
      if (definitivo || t >= TENTATIVAS || Date.now() + pausa >= limite) throw e;
      await esperar(pausa);
    }
  }
}

// Todas as linhas de uma matriz (páginas de 5000, enquanto hasMore).
async function matriz(ano, mes, tipo, limite) {
  const itens = [];
  let offset = 0;
  for (let n = 0; n < 40; n++) {
    const j = await pagina(urlMsc(ano, mes, tipo, offset), limite);
    itens.push(...j.items);
    if (!j.hasMore) return itens;
    const passo = Number(j.count) || j.items.length;
    if (!passo) throw new Error(`${ROTULO}: paginação sem itens.`);
    offset += passo;
  }
  throw new Error(`${ROTULO}: paginação longa demais.`);
}

const registro = (ano, mes, tipo, itens) => ({ tipo, mes, url: urlMsc(ano, mes, tipo), consultadoEm: new Date().toISOString(), linhas: compactarMsc(itens) });

// salvo: data/processado/origem.json. Devolve só os anos novos ({ ano: registro }).
// Ano fechado: matriz de encerramento (MSCE, mês 12), consultada até aparecer; enquanto não sai, fica o que estava salvo.
// Ano corrente: uma vez por dia, a última MSC mensal publicada (tenta o mês atual e volta).
// Erro no meio: o erro leva em `parciais` os anos já prontos.
export async function coletarMsc(salvo, hoje, { prazoMs }) {
  const limite = Date.now() + prazoMs;
  const anos = (salvo && salvo.anos) || {};
  const novos = {};
  try {
    for (let ano = ANO_INICIO; ano < hoje.ano; ano++) {
      const s = anos[ano];
      if (s && s.tipo === 'MSCE') continue;
      const encerramento = await matriz(ano, 12, 'MSCE', limite);
      if (encerramento.length) { novos[ano] = registro(ano, 12, 'MSCE', encerramento); continue; }
      if (s) continue;
      // Sem nada salvo: a última mensal até novembro (a de dezembro não é usada; ver a spec).
      const achado = await primeiroComDados([11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1], (m) => matriz(ano, m, 'MSCC', limite));
      if (achado) novos[ano] = registro(ano, achado.mes, 'MSCC', achado.itens);
    }
    const atual = anos[hoje.ano];
    if (!(atual && consultadoHoje(atual.consultadoEm, new Date().toISOString()))) {
      const meses = Array.from({ length: hoje.mes }, (_, k) => hoje.mes - k);
      const achado = await primeiroComDados(meses, (m) => matriz(hoje.ano, m, 'MSCC', limite));
      if (achado) novos[hoje.ano] = registro(hoje.ano, achado.mes, 'MSCC', achado.itens);
    }
  } catch (e) {
    e.parciais = novos;
    throw e;
  }
  return novos;
}
