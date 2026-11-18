import { createHash } from 'node:crypto';

// Data real de mudança de cada página (lastmod do sitemap e dateModified dos textos).
// O hash é só do conteúdo principal (<main>), sem o que muda todo dia sem mudar o conteúdo:
// "Atualizado em", a data de coleta e os números que o contador de impostos recalcula no navegador.
export function conteudoPrincipal(html) {
  const m = String(html).match(/<main[^>]*>([\s\S]*?)<\/main>/);
  return (m ? m[1] : String(html))
    .replace(/<p class="[^"]*\batualizado\b[^"]*">[\s\S]*?<\/p>/g, '')
    .replace(/\sdata-(?:oficial|ritmo|inicio|fim|mensal|populacao)="[^"]*"/g, '')
    .replace(/Dados coletados em [^<]*/g, '')
    .replace(/ Dados de \d{2}\/\d{2}\/\d{4}\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const hashConteudo = (html) => createHash('sha256').update(conteudoPrincipal(html)).digest('hex').slice(0, 16);

// anterior: { caminho: { hash, quando, criado } } (data/processado/lastmod.json); agora: ISO com fuso.
// A data só muda quando o hash muda. fixa: data imposta (semana fechada usa o domingo).
export function registrarLastmod(anterior, caminho, hash, agora, fixa = null) {
  const a = anterior && anterior[caminho];
  const quando = fixa || (a && a.hash === hash && a.quando ? a.quando : agora);
  return { hash, quando, criado: (a && a.criado) || quando };
}

export const diaDe = (quando) => String(quando).slice(0, 10);

// JSON estável (chaves em ordem) para o commit diário mudar só o que mudou.
export const serializarLastmod = (lastmod) =>
  `${JSON.stringify(Object.fromEntries(Object.keys(lastmod).sort().map((k) => [k, lastmod[k]])), null, 1)}\n`;
