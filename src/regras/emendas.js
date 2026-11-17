import { normalizar } from '../util/texto.js';

const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

export function iniciaisDe(nome) {
  return normalizar(nome)
    .replace(/[^a-z ]/g, ' ')
    .split(/\s+/)
    .filter((p) => p && !PARTICULAS.has(p))
    .map((p) => p[0].toUpperCase())
    .join('');
}

// confirmadas: { INICIAIS: id } conferido à mão (vale antes da regra). Iniciais que servem a mais de um vereador: null.
export function casarIniciais(iniciais, vereadores, confirmadas = {}) {
  const k = String(iniciais || '').toUpperCase();
  if (confirmadas[k]) return confirmadas[k];
  const achados = vereadores.filter((v) => iniciaisDe(v.nome) === k);
  return achados.length === 1 ? achados[0].id : null;
}

export function resumirEmendas(emendas) {
  const porVereador = {};
  const situacoes = {};
  let total = 0;
  let pago = 0;
  for (const e of emendas) {
    const v = (porVereador[e.vereador] ||= { total: 0, pago: 0, quantidade: 0, situacoes: {} });
    const valor = e.valor || 0;
    const pg = e.pago || 0;
    v.total += valor;
    v.pago += pg;
    v.quantidade += 1;
    total += valor;
    pago += pg;
    if (e.situacao) {
      v.situacoes[e.situacao] = (v.situacoes[e.situacao] || 0) + 1;
      situacoes[e.situacao] = (situacoes[e.situacao] || 0) + 1;
    }
  }
  const r2 = (n) => Math.round(n * 100) / 100;
  for (const v of Object.values(porVereador)) { v.total = r2(v.total); v.pago = r2(v.pago); }
  return { porVereador, total: r2(total), pago: r2(pago), situacoes };
}
