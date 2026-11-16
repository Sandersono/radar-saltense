// Gera data/referencia/campanha-2024.json: receitas de campanha 2024 (TSE) por origem, dos vereadores e do prefeito.
// Baixa só a entrada de SP do zip (HTTP Range); o CSV com nomes e CPFs fica só na memória. Rodar uma vez: node src/ferramentas/campanha-2024.js
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import { UA } from '../config.js';
import { normalizar } from '../util/texto.js';
import { resumirCampanha, origemCampanha } from '../regras/campanha.js';
import { valorBR } from '../regras/receitas.js';

const ZIP = 'https://cdn.tse.jus.br/estatistica/sead/odsele/prestacao_contas/prestacao_de_contas_eleitorais_candidatos_2024.zip';
const ENTRADA = 'receitas_candidatos_2024_SP.csv';
const SG_UE = '70050';
const SQ_PREFEITO = '250001985008';
// Padrão de link da página do candidato no DivulgaCandContas (conferido no navegador; ver relatório).
const LINK = (sq) => `https://divulgacandcontas.tse.jus.br/divulga/#/candidato/SUDESTE/SP/2045202024/${sq}/2024/70050`;

async function faixa(ini, fim) {
  const r = await fetch(ZIP, { headers: { 'User-Agent': UA, Range: `bytes=${ini}-${fim}` }, signal: AbortSignal.timeout(300000) });
  if (r.status !== 206) throw new Error(`Range não aceito (HTTP ${r.status}).`);
  return Buffer.from(await r.arrayBuffer());
}

const head = await fetch(ZIP, { method: 'HEAD', headers: { 'User-Agent': UA } });
const tamanho = Number(head.headers.get('content-length'));
if (!tamanho) throw new Error('HEAD sem content-length.');
const cauda = await faixa(tamanho - 400 * 1024, tamanho - 1);
const eocd = cauda.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
if (eocd < 0) throw new Error('EOCD não encontrado nos últimos 400 KB.');
const nEntradas = cauda.readUInt16LE(eocd + 10);
const tamDir = cauda.readUInt32LE(eocd + 12);
const offDir = cauda.readUInt32LE(eocd + 16);
if (offDir === 0xffffffff || tamDir === 0xffffffff) throw new Error('ZIP64 no diretório central: tratar à mão.');
const dir = await faixa(offDir, offDir + tamDir - 1);

let alvo = null;
for (let p = 0, i = 0; i < nEntradas && dir.readUInt32LE(p) === 0x02014b50; i++) {
  const metodo = dir.readUInt16LE(p + 10);
  let csize = dir.readUInt32LE(p + 20);
  const nome = dir.toString('utf8', p + 46, p + 46 + dir.readUInt16LE(p + 28));
  const extra = dir.readUInt16LE(p + 30), coment = dir.readUInt16LE(p + 32);
  let off = dir.readUInt32LE(p + 42);
  if (nome === ENTRADA) {
    if (csize === 0xffffffff || off === 0xffffffff) throw new Error('ZIP64 na entrada: tratar à mão.');
    alvo = { metodo, csize, off };
    break;
  }
  p += 46 + dir.readUInt16LE(p + 28) + extra + coment;
}
if (!alvo) throw new Error(`${ENTRADA} não encontrado no zip.`);
console.log(`${ENTRADA}: offset ${alvo.off}, ${alvo.csize} bytes compactados.`);

const lh = await faixa(alvo.off, alvo.off + 29);
const ini = alvo.off + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28);
const comp = await faixa(ini, ini + alvo.csize - 1);
const bruto = alvo.metodo === 8 ? inflateRawSync(comp) : comp;
const texto = new TextDecoder('latin1').decode(bruto);

// CSV ";" com aspas. Só interessam as linhas de Salto; junta linhas quebradas dentro de aspas.
const campos = (l) => {
  const o = [];
  let c = '', q = false;
  for (let i = 0; i < l.length; i++) {
    const ch = l[i];
    if (q) { if (ch === '"') { if (l[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else if (ch === '"') q = true;
    else if (ch === ';') { o.push(c); c = ''; }
    else c += ch;
  }
  o.push(c);
  return o;
};
const fisicas = [];
let acum = '';
for (const l of texto.split('\n')) {
  acum = acum ? `${acum}\n${l}` : l;
  if ((acum.match(/"/g) || []).length % 2) continue;
  fisicas.push(acum.replace(/\r$/, ''));
  acum = '';
}
const cab = campos(fisicas[0]);
const salto = [];
for (const l of fisicas.slice(1)) {
  if (!l.includes(`"${SG_UE}"`)) continue;
  const f = campos(l);
  const o = Object.fromEntries(cab.map((k, i) => [k, f[i]]));
  if (o.SG_UE === SG_UE) salto.push(o);
}
console.log(`${salto.length} linhas de Salto.`);

const dados = JSON.parse(await readFile('data/processado/dados.json', 'utf8'));
const candidatos = {};
const faltou = [];
for (const v of dados.vereadores) {
  const linhas = salto.filter((l) => /vereador/i.test(l.DS_CARGO) && normalizar(l.NM_CANDIDATO) === normalizar(v.nome));
  if (!linhas.length) { faltou.push(v.nome); continue; }
  const sq = linhas[0].SQ_CANDIDATO;
  candidatos[v.id] = { nome: v.nome, partido: linhas[0].SG_PARTIDO, sq, ...resumirCampanha(linhas), link: LINK(sq) };
}
if (faltou.length) {
  const parecidos = (n) => [...new Set(salto.map((l) => l.NM_CANDIDATO))].filter((c) => normalizar(c).split(' ').some((w) => w.length > 3 && normalizar(n).includes(w)));
  throw new Error(faltou.map((n) => `Não casou: ${n}. Parecidos: ${parecidos(n).join(' | ')}`).join('\n'));
}
// Dinheiro que o resumo ignoraria em silêncio: origem sem mapeamento e valor positivo.
const interesse = [...Object.values(candidatos).map((c) => c.sq), SQ_PREFEITO];
const sem = new Map();
for (const l of salto.filter((x) => interesse.includes(x.SQ_CANDIDATO))) {
  if (origemCampanha(l.DS_ORIGEM_RECEITA) !== null) continue;
  const v = valorBR(l.VR_RECEITA);
  if (v > 0) sem.set(l.DS_ORIGEM_RECEITA, (sem.get(l.DS_ORIGEM_RECEITA) || 0) + v);
}
if (sem.size) throw new Error(`Origens sem mapeamento (ficariam fora do total): ${[...sem].map(([o, v]) => `"${o}" = ${v.toFixed(2)}`).join('; ')}`);
const pref = salto.filter((l) => l.SQ_CANDIDATO === SQ_PREFEITO);
if (!pref.length) throw new Error('Prefeito (SQ_CANDIDATO) sem linhas.');
candidatos.prefeito = { nome: 'José Geraldo Garcia', partido: pref[0].SG_PARTIDO, sq: SQ_PREFEITO, ...resumirCampanha(pref), link: LINK(SQ_PREFEITO) };

await mkdir('data/referencia', { recursive: true });
await writeFile('data/referencia/campanha-2024.json', `${JSON.stringify({ fonte: ZIP, geradoEm: new Date().toISOString(), candidatos }, null, 2)}\n`);
for (const [k, c] of Object.entries(candidatos)) console.log(k, c.partido, c.total, JSON.stringify(c.origens), c.doadoresPessoas);
console.log('Soma dos vereadores:', Math.round(Object.entries(candidatos).filter(([k]) => k !== 'prefeito').reduce((s, [, c]) => s + c.total, 0) * 100) / 100);
