import { chromium } from 'playwright';
import { APEX, UA } from '../config.js';
import { aguardarVez, marcarFim } from './http.js';
import { lerRespostas } from '../regras/respostas.js';

const MAX_FALHAS_SEGUIDAS = 5;

// Abre a ficha oficial (P78) de cada requerimento e lê os anexos. Página que não mostra "Anexos" = falha (não grava).
// Para quando o orçamento de tempo acaba ou depois de 5 falhas seguidas; devolve o que já coletou.
export async function coletarRespostas(ids, hoje, orcamentoMs = 8 * 60 * 1000) {
  const estado = {};
  const falhas = [];
  let interrompido = null;
  if (!ids.length) return { estado, falhas, interrompido };
  const inicio = Date.now();
  let seguidas = 0;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ userAgent: UA });
    for (const id of ids) {
      if (Date.now() - inicio > orcamentoMs) { interrompido = 'tempo'; break; }
      await aguardarVez();
      try {
        await page.goto(`${APEX}?p=742:78:::::P78_ID_PROJETO:${id}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForFunction(() => /Anexos|Tipo Documento/.test(document.body.innerText), null, { timeout: 15000 });
        const texto = await page.evaluate(() => document.body.innerText);
        estado[id] = { ...lerRespostas(texto), conferidoEm: hoje };
        seguidas = 0;
      } catch {
        falhas.push(id);
        seguidas++;
      } finally {
        marcarFim();
      }
      if (seguidas >= MAX_FALHAS_SEGUIDAS) { interrompido = 'falhas'; break; }
    }
  } finally {
    await browser.close();
  }
  return { estado, falhas, interrompido };
}
