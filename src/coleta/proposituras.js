import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { APEX, UA } from '../config.js';
import { existe, salvar, aguardarVez, marcarFim } from './http.js';

// O portal é Oracle APEX: a lista é uma região "Cards" carregada por AJAX.
// Pegamos o modelo da região e pedimos todos os registros (fetchAll), como o próprio portal faz ao paginar.
export async function coletarProposituras(anos, anoAtual) {
  const porAno = {};
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ userAgent: UA });
    for (const ano of anos) {
      const arquivo = `data/bruto/proposituras-${ano}.json`;
      if (ano !== anoAtual && (await existe(arquivo))) {
        porAno[ano] = JSON.parse(await readFile(arquivo, 'utf8'));
        continue;
      }
      await aguardarVez();
      await page.goto(`${APEX}?p=742:92::::92:P92_ANO:${ano}&tz=America/Sao_Paulo;-3:00`, { waitUntil: 'networkidle', timeout: 120000 });
      await page.waitForFunction(() => window.apex && window.apex.region, null, { timeout: 60000 });
      // fetchAll pagina pelos registros como o próprio portal faz ao rolar a lista (~30 requisições por ano).
      const { total, registros } = await page.evaluate(async () => {
        const el = [...document.querySelectorAll('[id]')].find((e) => apex.region.isRegion(e.id) && apex.region(e.id).type === 'Cards');
        if (!el) throw new Error('Região de cards não encontrada no portal');
        const m = apex.region(el.id).call('getModel');
        await new Promise((ok, falha) => {
          const t = setTimeout(() => falha(new Error('tempo esgotado no fetchAll')), 300000);
          m.fetchAll((s) => { if (s.done) { clearTimeout(t); ok(); } });
        });
        const registros = [];
        m.forEach((r) => registros.push({ id: String(m.getValue(r, 'ID')), titulo: String(m.getValue(r, 'CARD_TITLE')), texto: String(m.getValue(r, 'CARD_TEXT')) }));
        return { total: m.getTotalRecords(), registros };
      });
      marcarFim();
      if (registros.length !== total) throw new Error(`Proposituras ${ano}: vieram ${registros.length} de ${total}`);
      await salvar(arquivo, JSON.stringify(registros));
      porAno[ano] = registros;
    }
  } finally {
    await browser.close();
  }
  return porAno;
}
