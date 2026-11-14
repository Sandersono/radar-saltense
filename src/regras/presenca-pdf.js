import { agruparLinhas, textoDe } from './linhas.js';

const MARCA = /^(P|A|AJ)$/;
const DATA = /^\d{1,2}\/\d{1,2}$/;
const NOME = /^[\p{L}\s'.-]+$/u;
const FAIXA = 20;

const marcasDe = (l) => l.itens.filter((i) => MARCA.test(i.str.trim()));
const nomeDe = (l) => textoDe(l.itens.filter((i) => !MARCA.test(i.str.trim())));
const ehPessoa = (l) => {
  if (marcasDe(l).length) return true;
  const nome = nomeDe(l);
  return NOME.test(nome) && nome.split(' ').length >= 2;
};

export function lerPresenca(itens) {
  const linhas = agruparLinhas(itens);
  const iCab = linhas.findIndex((l) => l.itens.some((i) => /^VEREADOR$/i.test(i.str.trim())));
  if (iCab < 0) return { sessoes: [], linhas: [] };
  const yCab = linhas[iCab].y;
  const faixa = linhas.slice(0, iCab).filter((l) => l.y - yCab <= FAIXA);
  faixa.push(linhas[iCab]);
  const pessoas = [];
  let noCab = true;
  for (const l of linhas.slice(iCab + 1)) {
    if (/^LEGENDA/i.test(textoDe(l.itens))) break;
    if (ehPessoa(l)) { noCab = false; pessoas.push(l); } else if (noCab && yCab - l.y <= FAIXA) faixa.push(l);
  }
  const colunas = faixa
    .flatMap((l) => l.itens)
    .filter((i) => DATA.test(i.str.trim()))
    .map((i) => ({ data: i.str.trim(), x: i.x }))
    .sort((a, b) => a.x - b.x);
  const resultado = pessoas.map((l) => {
    const marcas = colunas.map(() => null);
    for (const i of marcasDe(l)) {
      let melhor = -1;
      let dist = Infinity;
      colunas.forEach((c, k) => {
        const d = Math.abs(c.x - i.x);
        if (d < dist) { dist = d; melhor = k; }
      });
      if (melhor >= 0 && dist < 25) marcas[melhor] = i.str.trim();
    }
    return { nome: nomeDe(l), marcas };
  });
  return { sessoes: colunas.map((c) => c.data), linhas: resultado };
}
