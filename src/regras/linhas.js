export function agruparLinhas(itens, tol = 2) {
  const linhas = [];
  for (const it of [...itens].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const linha = linhas.find((l) => Math.abs(l.y - it.y) <= tol);
    if (linha) linha.itens.push(it);
    else linhas.push({ y: it.y, itens: [it] });
  }
  for (const l of linhas) l.itens.sort((a, b) => a.x - b.x);
  return linhas.sort((a, b) => b.y - a.y);
}

export const textoDe = (itens) => itens.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
