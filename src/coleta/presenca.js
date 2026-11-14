import { CAMARA } from '../config.js';
import { itensDoPdf } from '../pdf.js';
import { linkCategoriaAno, linksPdfPresenca, mesDoArquivo } from '../regras/presenca-html.js';
import { lerPresenca } from '../regras/presenca-pdf.js';
import { baixar, baixarComCache } from './http.js';

export async function coletarPresencas(anos, anoAtual) {
  const indice = (await baixar(`${CAMARA}/sessoes/presenca-dos-vereadores`)).toString('utf8');
  const lidas = [];
  for (const ano of anos) {
    const urlAno = linkCategoriaAno(indice, ano, CAMARA);
    if (!urlAno) {
      if (ano === anoAtual) continue; // ano recém-começado, ainda sem página
      throw new Error(`Não achei a página de presença de ${ano}`);
    }
    const html = (await baixar(urlAno)).toString('utf8');
    for (const url of linksPdfPresenca(html, CAMARA)) {
      const info = mesDoArquivo(url);
      if (!info || info.ano !== ano) continue;
      const arquivo = decodeURIComponent(url.split('/').pop());
      const buf = await baixarComCache(url, `data/bruto/presenca/${ano}/${arquivo}`, { renovar: ano === anoAtual });
      let achou = false;
      for (const itens of await itensDoPdf(buf)) {
        const r = lerPresenca(itens);
        if (!r.sessoes.length) continue;
        achou = true;
        lidas.push({ arquivo, url, ano, mes: info.mes, ...r });
      }
      if (!achou) lidas.push({ arquivo, url, ano, mes: info.mes, sessoes: [], linhas: [] }); // a barreira acusa
    }
  }
  return lidas;
}
