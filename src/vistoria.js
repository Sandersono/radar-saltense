import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

// Vistoria do site pronto (dist/), feita todo dia antes de publicar.
// Bloqueio = o site não é publicado e fica na última versão boa. Aviso = vai para conferencia.md, não para o site.
export const OBRIGATORIAS = ['index.html', 'camara.html', 'prefeitura.html', 'votacoes.html', 'semana.html', 'fontes.html'];
// Não pega número de processo/protocolo com mais grupos (ex.: 1.234.567.890-12).
const CPF = /(?<![\d.])\d{3}\.\d{3}\.\d{3}-\d{2}(?![\d-])/;
const EXTERNO = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

// Texto que o leitor vê: sem scripts, estilos e tags.
export const textoVisivel = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ');

const ids = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

// paginas: [{ caminho: 'obras.html', html }]; arquivos: todos os caminhos de dist/ (com '/');
// dados: outros arquivos de texto publicados (.json, .xml, .txt) [{ caminho, conteudo }], só para a busca de CPF.
export function vistoriar(paginas, arquivos, dados = []) {
  const bloqueios = [];
  const avisos = [];
  const porCaminho = new Map(paginas.map((p) => [p.caminho, p.html]));
  const existe = new Set(arquivos);
  for (const obrig of OBRIGATORIAS) {
    const html = porCaminho.get(obrig);
    if (!html) bloqueios.push(`${obrig}: página obrigatória não foi gerada.`);
    else if (!/<h1[\s>]/.test(html) || textoVisivel(html).length < 500) bloqueios.push(`${obrig}: página vazia ou sem título.`);
  }
  const idsDe = new Map();
  const idsDaPagina = (c) => { if (!idsDe.has(c)) idsDe.set(c, ids(porCaminho.get(c) || '')); return idsDe.get(c); };
  // CPF no arquivo inteiro (texto, atributos, scripts e dados), não só no que aparece na tela.
  for (const { caminho, conteudo } of [...paginas.map((p) => ({ caminho: p.caminho, conteudo: p.html })), ...dados]) {
    const cpf = conteudo.match(CPF);
    if (cpf) bloqueios.push(`${caminho}: número com formato de CPF (${cpf[0].slice(0, 4)}…).`);
  }
  for (const { caminho, html } of paginas) {
    const texto = textoVisivel(html);
    const ruim = texto.match(/\b(undefined|NaN)\b|(?:^|[\s:(])null(?=[\s,.)]|$)/);
    if (ruim) avisos.push(`${caminho}: texto "${ruim[0].trim()}" aparece para o leitor.`);
    if (/R\$\s*-\s*\d/.test(texto)) avisos.push(`${caminho}: valor em reais negativo.`);
    const quebrados = new Set();
    for (const m of html.matchAll(/href="([^"]*)"/g)) {
      const href = m[1].replace(/&amp;/g, '&');
      if (!href || EXTERNO.test(href)) continue;
      const [alvo, ancora] = href.split('?')[0].split('#');
      const destino = alvo ? path.posix.normalize(path.posix.join(path.posix.dirname(caminho), alvo)) : caminho;
      if (alvo && !existe.has(destino)) { quebrados.add(href); continue; }
      if (ancora && destino.endsWith('.html') && porCaminho.has(destino) && !idsDaPagina(destino).has(ancora)) quebrados.add(href);
    }
    if (quebrados.size) avisos.push(`${caminho}: link interno quebrado: ${[...quebrados].slice(0, 5).join(', ')}${quebrados.size > 5 ? ` (+${quebrados.size - 5})` : ''}.`);
  }
  return { bloqueios, avisos };
}

export async function vistoriarPasta(pasta) {
  const arquivos = (await readdir(pasta, { recursive: true, withFileTypes: true }))
    .filter((e) => e.isFile())
    .map((e) => path.relative(pasta, path.join(e.parentPath ?? e.path, e.name)).split(path.sep).join('/'));
  const paginas = await Promise.all(arquivos.filter((a) => a.endsWith('.html'))
    .map(async (caminho) => ({ caminho, html: await readFile(path.join(pasta, caminho), 'utf8') })));
  const dados = await Promise.all(arquivos.filter((a) => /\.(json|xml|txt)$/.test(a))
    .map(async (caminho) => ({ caminho, conteudo: await readFile(path.join(pasta, caminho), 'utf8') })));
  return vistoriar(paginas, arquivos, dados);
}

// Texto para o fim de conferencia.md.
export const relatorioVistoria = ({ bloqueios, avisos }) => [
  '', '## Vistoria do site pronto', '',
  ...(bloqueios.length ? ['**Bloqueado: o site não foi publicado.**', ...bloqueios.map((b) => `- ⛔ ${b}`)] : ['- ✅ Nada que impeça publicar.']),
  ...avisos.map((a) => `- ⚠️ ${a}`),
  '',
].join('\n');
