import { agruparLinhas, textoDe } from './linhas.js';
import { dividirNomes } from './nomes.js';

const COL = { rotulo: [0, 100], ementa: [100, 250], autor: [250, 315], solucao: [575, 750] };
const naColuna = (i, [a, b]) => i.x >= a && i.x < b;
const CABECALHO = /^(n[º°o]\.?\s*da|propositura)$/i;
const INICIO = /^(projeto|veto|emenda|substitutivo|proposta|mo[cç][aã]o|requerimento)/i;
const DATA = /^(\d{2})\.(\d{2})\.(\d{4})\s*[–-]?\s*(.*)$/;
const RESULTADO = /(aprovad|rejeitad|retirad|arquivad|adiad|prejudicad|mantid|derrubad)/i;
const ROTULO_LISTA = /\b(contra|contr[aá]ri[oa]s?[^:]*?|ausentes?)\s*:/gi;
const FIM_NUMERO = /\d+\/\d{4}\s*$/;

// Linha de continuação de lista só vale se todo pedaço parece um nome.
function soNomes(t) {
  const nomes = dividirNomes(t);
  return nomes.length > 0 && nomes.every((n) => n.split(/\s+/).length <= 3 && !/\d/.test(n) && !RESULTADO.test(n));
}

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
      const fechado = atual && FIM_NUMERO.test(atual.rotulo.replace(/\s+\//g, '/'));
      const novo = anteriorY === null ? !atual || FIM_NUMERO.test(atual.rotulo) : gap > 25 || (INICIO.test(t) && fechado);
      if (INICIO.test(t) && (novo || !atual)) blocos.push({ pagina: p, y: l.y, rotulo: t, ementa: '', autor: '', eventos: [] });
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

      const texto = (txt) => {
        txt = txt.trim();
        if (!txt) return;
        if (RESULTADO.test(txt)) {
          if (ev.temResultado) {
            ev = { data: ev.data, turno: ev.turno, resultado: txt, contra: [], ausentes: [], pagina: p, yRef: l.y, lista: null, temResultado: true };
            eventos.push(ev);
          } else {
            ev.resultado = txt;
            ev.temResultado = true;
            ev.pagina = p;
            ev.yRef = l.y;
          }
        } else if (ev.temResultado) ev.resultado = `${ev.resultado} ${txt}`;
      };

      const marcas = [...t.matchAll(ROTULO_LISTA)];
      if (!marcas.length) {
        if (ev.lista && soNomes(t)) ev[ev.lista].push(...dividirNomes(t));
        else {
          ev.lista = null;
          texto(t);
        }
        continue;
      }
      ev.lista = null;
      texto(t.slice(0, marcas[0].index));
      marcas.forEach((m, k) => {
        ev.lista = /^aus/i.test(m[1]) ? 'ausentes' : 'contra';
        const fim = k + 1 < marcas.length ? marcas[k + 1].index : t.length;
        ev[ev.lista].push(...dividirNomes(t.slice(m.index + m[0].length, fim)));
      });
    }
  });

  for (const e of eventos) {
    if (!e.resultado && !e.contra.length && !e.ausentes.length) continue;
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
