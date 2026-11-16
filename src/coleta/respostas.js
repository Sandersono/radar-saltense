import { chromium } from 'playwright';
import { APEX, UA } from '../config.js';
import { aguardarVez, marcarFim } from './http.js';
import { lerRespostas } from '../regras/respostas.js';

// Abre a ficha oficial (P78) de cada requerimento e lê os anexos. Sem a seção "Anexos" = falha (não grava).
export async function coletarRespostas(ids, hoje) {
  const estado = {};
  const falhas = [];
  if (!ids.length) return { estado, falhas };
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ userAgent: UA });
    for (const id of ids) {
      await aguardarVez();
      try {
        await page.goto(`${APEX}?p=742:78:::::P78_ID_PROJETO:${id}`, { waitUntil: 'networkidle', timeout: 60000 });
        const texto = await page.evaluate(() => document.body.innerText);
        if (!/Anexos/.test(texto)) falhas.push(id);
        else estado[id] = { ...lerRespostas(texto), conferidoEm: hoje };
      } catch {
        falhas.push(id);
      } finally {
        marcarFim();
      }
    }
  } finally {
    await browser.close();
  }
  if (falhas.length > ids.length / 2) throw new Error(`Respostas: ${falhas.length} de ${ids.length} páginas falharam; o portal mudou?`);
  return { estado, falhas };
}
