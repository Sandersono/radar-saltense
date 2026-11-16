import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname } from 'node:path';
import { UA, ESPERA_MS } from '../config.js';
import { esperar } from '../util/texto.js';

let ultimo = 0;

export async function aguardarVez() {
  const falta = ultimo + ESPERA_MS - Date.now();
  if (falta > 0) await esperar(falta);
}

export function marcarFim() {
  ultimo = Date.now();
}

// Tempo de cada pedido: no máximo 60 s e nunca além do limite (instante absoluto em ms). Esgotado, lança erro com "prazo".
export function tempoDoPedido(limite, rotulo = 'coleta') {
  const resta = limite === undefined ? 60000 : limite - Date.now();
  if (resta <= 0) throw new Error(`${rotulo}: prazo de coleta esgotado.`);
  return Math.min(60000, resta);
}

export async function baixar(url, { limite, rotulo } = {}) {
  await aguardarVez();
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(tempoDoPedido(limite, rotulo)) });
    if (!r.ok) {
      const erro = new Error(`HTTP ${r.status} em ${url}`);
      erro.status = r.status;
      throw erro;
    }
    return Buffer.from(await r.arrayBuffer());
  } finally {
    marcarFim();
  }
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
