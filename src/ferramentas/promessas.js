// Baixa só o PDF do plano de governo do prefeito (TSE) por HTTP Range e gera um RASCUNHO em data/bruto/promessas-rascunho.json.
// O rascunho perde espaços e tem falhas de numeração: a revisão manual vira data/referencia/promessas.json.
// Rodar uma vez: node src/ferramentas/promessas.js
import { writeFile, mkdir } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import { UA } from '../config.js';
import { itensDoPdf } from '../pdf.js';

const ZIP = 'https://cdn.tse.jus.br/estatistica/sead/odsele/proposta_governo/proposta_governo_2024_SP.zip';
const ENTRADA = 'SP/2024SP250001985008_01.pdf';

async function faixa(ini, fim) {
  const r = await fetch(ZIP, { headers: { 'User-Agent': UA, Range: `bytes=${ini}-${fim}` }, signal: AbortSignal.timeout(300000) });
  if (r.status !== 206) throw new Error(`Range não aceito (HTTP ${r.status}).`);
  return Buffer.from(await r.arrayBuffer());
}

const head = await fetch(ZIP, { method: 'HEAD', headers: { 'User-Agent': UA } });
const tamanho = Number(head.headers.get('content-length'));
if (!tamanho) throw new Error('HEAD sem content-length.');
const cauda = await faixa(tamanho - 200 * 1024, tamanho - 1);
const eocd = cauda.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
if (eocd < 0) throw new Error('EOCD não encontrado.');
const nEntradas = cauda.readUInt16LE(eocd + 10);
const tamDir = cauda.readUInt32LE(eocd + 12);
const offDir = cauda.readUInt32LE(eocd + 16);
if (offDir === 0xffffffff || tamDir === 0xffffffff) throw new Error('ZIP64 no diretório central: tratar à mão.');
const dir = await faixa(offDir, offDir + tamDir - 1);

let alvo = null;
for (let p = 0, i = 0; i < nEntradas && dir.readUInt32LE(p) === 0x02014b50; i++) {
  const nl = dir.readUInt16LE(p + 28);
  const nome = dir.toString('utf8', p + 46, p + 46 + nl);
  if (nome === ENTRADA) {
    alvo = { metodo: dir.readUInt16LE(p + 10), csize: dir.readUInt32LE(p + 20), off: dir.readUInt32LE(p + 42) };
    break;
  }
  p += 46 + nl + dir.readUInt16LE(p + 30) + dir.readUInt16LE(p + 32);
}
if (!alvo) throw new Error(`${ENTRADA} não encontrado no zip.`);
if (alvo.csize === 0xffffffff || alvo.off === 0xffffffff) throw new Error('ZIP64 na entrada: tratar à mão.');
console.log(`${ENTRADA}: offset ${alvo.off}, ${alvo.csize} bytes.`);

const lh = await faixa(alvo.off, alvo.off + 29);
const ini = alvo.off + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28);
const comp = await faixa(ini, ini + alvo.csize - 1);
const pdf = alvo.metodo === 8 ? inflateRawSync(comp) : comp;

// Linhas por posição: agrupa trechos de mesma altura (y) e ordena por x; junta trechos com espaço só quando há folga.
const paginas = await itensDoPdf(pdf);
const linhas = [];
for (const [n, itens] of paginas.entries()) {
  const por = new Map();
  for (const it of itens) {
    const y = Math.round(it.y / 2) * 2;
    if (!por.has(y)) por.set(y, []);
    por.get(y).push(it);
  }
  for (const y of [...por.keys()].sort((a, b) => b - a)) {
    const t = por.get(y).sort((a, b) => a.x - b.x);
    linhas.push({ pagina: n + 1, y, texto: t.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim() });
  }
}

// Separa áreas ("1. NOME") e itens ("1.2 texto"); linhas sem número continuam o item anterior.
// Pula a introdução (antes da primeira área), números de página soltos e subtítulos de grupo (ex.: "4.1 Guarda Civil Municipal", seguido de 4.1.1).
const areas = [];
let area = null, item = null, grupo = null;
const textos = linhas.map((l) => l.texto);
for (const [n, texto] of textos.entries()) {
  if (/^\d{1,2}$/.test(texto)) continue;
  const a = texto.match(/^(\d{1,2})\s*[.\-)]\s*(\D.*)$/);
  const i = texto.match(/^(\d{1,2}(?:\.\d{1,2}){1,2})\.?\s+(.*)$/);
  if (i && textos[n + 1]?.startsWith(`${i[1]}.1 `)) { grupo = i[2]; item = null; }
  else if (i && area) { item = { numero: i[1], texto: i[2], ...(i[1].split('.').length === 3 ? { grupo } : {}) }; area.itens.push(item); }
  else if (a && a[2] === a[2].toUpperCase()) { area = { numero: a[1], area: a[2], itens: [] }; areas.push(area); item = null; grupo = null; }
  else if (item) item.texto += ` ${texto}`;
}
await mkdir('data/bruto', { recursive: true });
await writeFile('data/bruto/promessas-rascunho.json', `${JSON.stringify({ fonte: ZIP, pdf: ENTRADA, linhas, areas }, null, 2)}\n`);
console.log(`${linhas.length} linhas, ${areas.length} áreas, ${areas.reduce((s, x) => s + x.itens.length, 0)} itens (rascunho).`);
