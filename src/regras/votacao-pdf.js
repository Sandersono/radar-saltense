import { agruparLinhas, textoDe } from './linhas.js';
import { dividirNomes } from './nomes.js';

const COL = { rotulo: [0, 100], ementa: [100, 250], autor: [250, 315], solucao: [575, 750] };
const naColuna = (i, [a, b]) => i.x >= a && i.x < b;
const CABECALHO = /^(n[º°o]\.?\s*da|propositura)$/i;
const INICIO = /^(projeto|veto|emenda|substitutivo|proposta|mo[cç][aã]o|requerimento)/i;
const DATA = /^(\d{2})\.(\d{2})\.(\d{4})\s*[–-]?\s*(.*)$/;
const RESULTADO = /(aprovad|rejeitad|retirad|arquivad|adiad|prejudicad|mantid|derrubad)/i;
const LISTA = /^(contra[^:]*|contr[aá]ri[oa]s?[^:]*|ausentes?[^:]*)\s*:\s*(.*)$/i;

// Bloco do projeto que contém a altura y: o de menor y que ainda está acima (com folga de 3).
// Antes do primeiro bloco da página, vale o último bloco da página anterior.
function blocoPara(blocos, pagina, y) {
  let escolhido = null;
  for (const b of blocos) {
    if (b.pagina < pagina) escolhido = b;
    else if (b.pagina === pagina && b.y >= y - 3) escolhido = b;
  }
  return escolhido;
}

export function lerVotacoes(paginas) {
  const blocos = [];
  const eventos = [];
  let ev = null;

  paginas.forEach((itens, p) => {
    let anteriorY = null;
    for (const l of agruparLinhas(itens.filter((i) => naColuna(i, COL.rotulo)))) {
      const t = textoDe(l.itens);
      if (CABECALHO.test(t)) continue;
      const atual = blocos[blocos.length - 1];
      const gap = anteriorY === null ? Infinity : anteriorY - l.y;
      if (INICIO.test(t) && (gap > 25 || !atual)) blocos.push({ pagina: p, y: l.y, rotulo: t, ementa: '', autor: '', eventos: [] });
      else if (atual) atual.rotulo += ` ${t}`;
      anteriorY = l.y;
    }

    for (const [campo, faixa] of [['ementa', COL.ementa], ['autor', COL.autor]]) {
      for (const l of agruparLinhas(itens.filter((i) => naColuna(i, faixa)))) {
        const b = blocoPara(blocos, p, l.y);
        if (b) b[campo] = `${b[campo]} ${textoDe(l.itens)}`.trim();
      }
    }

    for (const l of agruparLinhas(itens.filter((i) => naColuna(i, COL.solucao)))) {
      const t = textoDe(l.itens);
      const d = t.match(DATA);
      if (d) {
        ev = { data: `${d[3]}-${d[2]}-${d[1]}`, turno: d[4].replace(/^[–-]\s*/, '').trim(), resultado: '', contra: [], ausentes: [], pagina: p, yRef: l.y, lista: null, temResultado: false };
        eventos.push(ev);
        continue;
      }
      if (!ev) continue;
      const li = t.match(LISTA);
      if (li) {
        ev.lista = /^aus/i.test(li[1]) ? 'ausentes' : 'contra';
        ev[ev.lista].push(...dividirNomes(li[2]));
        continue;
      }
      if (RESULTADO.test(t) && !ev.temResultado) {
        ev.resultado = t;
        ev.temResultado = true;
        ev.pagina = p;
        ev.yRef = l.y;
        ev.lista = null;
        continue;
      }
      if (ev.lista) ev[ev.lista].push(...dividirNomes(t));
      else if (ev.temResultado) ev.resultado = `${ev.resultado} ${t}`;
    }
  });

  for (const e of eventos) {
    const b = blocoPara(blocos, e.pagina, e.yRef);
    if (b) b.eventos.push({ data: e.data, turno: e.turno, resultado: e.resultado, contra: e.contra, ausentes: e.ausentes });
  }
  return blocos.map(({ rotulo, ementa, autor, eventos }) => ({
    rotulo: rotulo.replace(/\s+\//g, '/').replace(/\s+/g, ' ').trim(),
    ementa,
    autor,
    eventos,
  }));
}
