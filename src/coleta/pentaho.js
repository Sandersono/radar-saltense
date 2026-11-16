import { UA } from '../config.js';
import { aguardarVez, marcarFim, tempoDoPedido } from './http.js';
import { linhasCda } from '../regras/pentaho.js';

// Uma sessão anônima por painel (cookie JSESSIONID obtido ao abrir a página pública do painel).
const sessoes = new Map();

async function pedir(url, cookie, limite) {
  await aguardarVez();
  try {
    const headers = { 'User-Agent': UA };
    if (cookie) headers.Cookie = cookie;
    return await fetch(url, { headers, signal: AbortSignal.timeout(tempoDoPedido(limite, 'Painel do TCE')) });
  } finally {
    marcarFim();
  }
}

async function sessao(painel, renovar, limite) {
  if (!renovar && sessoes.has(painel)) return sessoes.get(painel);
  const r = await pedir(painel, undefined, limite);
  if (!r.ok) throw new Error(`HTTP ${r.status} ao abrir o painel ${painel}`);
  const cookie = r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  await r.arrayBuffer();
  if (!cookie) throw new Error(`Painel sem cookie de sessão anônima: ${painel}`);
  sessoes.set(painel, cookie);
  return cookie;
}

async function tentar(url, painel, renovar, limite) {
  const r = await pedir(url, await sessao(painel, renovar, limite), limite);
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
  const texto = await r.text();
  try { return JSON.parse(texto); } catch { return { naoJson: texto.slice(0, 80) }; }
}

// `limite`: instante absoluto (ms) em que a coleta do painel inteiro precisa terminar.
export async function consultaCda({ base, painel, path, dataAccessId, params = {}, limite }) {
  const q = new URLSearchParams({ path, dataAccessId, ...params });
  const url = `${base}/pentaho/plugin/cda/api/doQuery?${q}`;
  let json = await tentar(url, painel, false, limite);
  if (json.naoJson !== undefined) json = await tentar(url, painel, true, limite); // sessão expirada: renova uma vez
  if (json.naoJson !== undefined) throw new Error(`Resposta não é JSON em ${url}: ${json.naoJson}`);
  return linhasCda(json);
}
