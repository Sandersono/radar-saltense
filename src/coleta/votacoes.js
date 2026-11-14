import { CAMARA } from '../config.js';
import { itensDoPdf } from '../pdf.js';
import { lerVotacoes } from '../regras/votacao-pdf.js';
import { baixarComCache } from './http.js';

export async function coletarVotacoes(anos, anoAtual) {
  const lidas = [];
  for (const ano of anos) {
    const url = `${CAMARA}/pdf/tramitacao-votacao-dos-projetos/votacao-dos-projetos-${ano}.pdf`;
    let buf;
    try {
      buf = await baixarComCache(url, `data/bruto/votacoes/votacao-dos-projetos-${ano}.pdf`, { renovar: ano >= anoAtual - 1 });
    } catch (e) {
      if (e.status === 404 && ano === anoAtual) continue;
      throw e;
    }
    lidas.push({ ano, url, blocos: lerVotacoes(await itensDoPdf(buf)) });
  }
  return lidas;
}
