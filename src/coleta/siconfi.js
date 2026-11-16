import { SICONFI_RREO, IBGE_SALTO, ANO_INICIO } from '../config.js';
import { baixar } from './http.js';

const COLUNA = 'DESPESAS LIQUIDADAS ATÉ O BIMESTRE (d)';
const ROTULO = 'Total das Despesas Exceto Intra-Orçamentárias';

// Para cada ano do mandato, o último bimestre do RREO Anexo 02 (despesa por função) já publicado.
export async function coletarSiconfi(anoAtual, { prazoMs } = {}) {
  const limite = prazoMs === undefined ? undefined : Date.now() + prazoMs;
  const porAno = {};
  for (let ano = ANO_INICIO; ano <= anoAtual; ano++) {
    for (let bimestre = 6; bimestre >= 1; bimestre--) {
      const url = `${SICONFI_RREO}?an_exercicio=${ano}&nr_periodo=${bimestre}&co_tipo_demonstrativo=RREO&no_anexo=RREO-Anexo%2002&id_ente=${IBGE_SALTO}`;
      const texto = (await baixar(url, { limite, rotulo: 'SICONFI' })).toString('utf8');
      let json;
      try { json = JSON.parse(texto); } catch { throw new Error(`SICONFI ${ano}/${bimestre}: a resposta não é JSON.`); }
      const itens = Array.isArray(json.items) ? json.items : null;
      if (!itens) throw new Error(`SICONFI ${ano}/${bimestre}: formato inesperado.`);
      if (!itens.length) continue;
      const filtrados = itens.filter((i) => i.coluna === COLUNA && i.rotulo === ROTULO);
      if (filtrados.length === 0) throw new Error(`SICONFI ${ano}/${bimestre}: nenhuma linha de "${ROTULO}" / "${COLUNA}" (o formato mudou?).`);
      porAno[ano] = { bimestre, itens: filtrados };
      break;
    }
  }
  return porAno;
}
