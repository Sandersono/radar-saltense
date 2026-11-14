import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname } from 'node:path';
import { UA, ESPERA_MS } from '../config.js';
import { esperar } from '../util/texto.js';

let ultimo = 0;

export async function baixar(url) {
  const falta = ultimo + ESPERA_MS - Date.now();
  if (falta > 0) await esperar(falta);
  ultimo = Date.now();
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) {
    const erro = new Error(`HTTP ${r.status} em ${url}`);
    erro.status = r.status;
    throw erro;
  }
  return Buffer.from(await r.arrayBuffer());
}

export async function existe(caminho) {
  try { await access(caminho); return true; } catch { return false; }
}

export async function salvar(caminho, conteudo) {
  await mkdir(dirname(caminho), { recursive: true });
  await writeFile(caminho, conteudo);
}

export async function baixarComCache(url, caminho, { renovar = false } = {}) {
  if (!renovar && (await existe(caminho))) return readFile(caminho);
  const buf = await baixar(url);
  await salvar(caminho, buf);
  return buf;
}
