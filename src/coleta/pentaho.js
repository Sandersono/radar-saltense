import { UA } from '../config.js';
import { aguardarVez, marcarFim } from './http.js';
import { linhasCda } from '../regras/pentaho.js';

// Uma sessão anônima por painel (cookie JSESSIONID obtido ao abrir a página pública do painel).
const sessoes = new Map();

async function pedir(url, cookie) {
  await aguardarVez();
  try {
    const headers = { 'User-Agent': UA };
    if (cookie) headers.Cookie = cookie;
    return await fetch(url, { headers, signal: AbortSignal.timeout(60000) });
  } finally {
    marcarFim();
  }
}

async function sessao(painel) {
  if (sessoes.has(painel)) return sessoes.get(painel);
  const r = await pedir(painel);
  if (!r.ok) throw new Error(`HTTP ${r.status} ao abrir o painel ${painel}`);
  const cookie = r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  await r.arrayBuffer();
  sessoes.set(painel, cookie);
  return cookie;
}

export async function consultaCda({ base, painel, path, dataAccessId, params = {} }) {
  const cookie = await sessao(painel);
  const q = new URLSearchParams({ path, dataAccessId, ...params });
  const url = `${base}/pentaho/plugin/cda/api/doQuery?${q}`;
  const r = await pedir(url, cookie);
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
  const texto = await r.text();
  let json;
  try { json = JSON.parse(texto); } catch { throw new Error(`Resposta não é JSON em ${url}: ${texto.slice(0, 80)}`); }
  return linhasCda(json);
}
