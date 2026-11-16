// Junta o que o robô coletou com o que já está salvo. Em empate, vale o segundo argumento.
export function mesclarIegm(a, b) {
  return { anos: { ...((a && a.anos) || {}), ...((b && b.anos) || {}) } };
}

// Cada ano fica com a coleta mais recente (coletadoEm).
export function mesclarContratos(a, b) {
  const out = { ...(a || {}) };
  for (const [ano, x] of Object.entries(b || {})) {
    if (!out[ano] || String(x.coletadoEm || '') >= String(out[ano].coletadoEm || '')) out[ano] = x;
  }
  return out;
}

const isoDataBase = (s) => String(s || '').split('/').reverse().join('-'); // dd/mm/aaaa -> aaaa-mm-dd

// Fica com o painel de data-base mais nova.
export function escolherObras(a, b) {
  if (!a || !a.obras) return b || null;
  if (!b || !b.obras) return a;
  return isoDataBase(b.dataBase) >= isoDataBase(a.dataBase) ? b : a;
}

export const dataBaseMaisVelha = (nova, salva) => Boolean(nova && salva && isoDataBase(nova.dataBase) < isoDataBase(salva.dataBase));

// Um ano recém-coletado não substitui um ano salvo com dados se vier vazio ou com menos da metade (o PNCP não perde registros).
// Devolve { manter, motivo }; `manter` = fica o ano salvo, sem renovar o coletadoEm.
export function decidirAnoContratos(antes, novo) {
  if (!antes || !novo) return { manter: false };
  const par = (x) => [(x.contratos && x.contratos.quantidade) || 0, (x.contratacoes && x.contratacoes.total && x.contratacoes.total.quantidade) || 0];
  const [ca, ta] = par(antes);
  const [cn, tn] = par(novo);
  const caiu = (a, n) => a > 0 && (n === 0 || n < a / 2);
  if (caiu(ca, cn)) return { manter: true, motivo: `os contratos caíram de ${ca} para ${cn}` };
  if (caiu(ta, tn)) return { manter: true, motivo: `as contratações caíram de ${ta} para ${tn}` };
  return { manter: false };
}

// Decide quais anos de contratos coletar hoje: o corrente a cada 7 dias; o anterior se faltar ou
// se foi coletado antes de 15 de janeiro do ano corrente (fechamento do ano, horário de São Paulo, UTC-3).
export function anosParaColetar(salvo, anoAtual, agora = Date.now()) {
  const s = salvo || {};
  const anos = [];
  // O ano corrente vem primeiro: se o prazo de 6 minutos acabar, ele não fica sem vez.
  const feito = Date.parse(s[anoAtual] && s[anoAtual].coletadoEm);
  if (!Number.isFinite(feito) || agora - feito > 7 * 24 * 3600 * 1000) anos.push(anoAtual);
  const ant = s[anoAtual - 1];
  const corte = Date.parse(`${anoAtual}-01-15T03:00:00Z`);
  if (!ant || !(Date.parse(ant.coletadoEm) >= corte)) anos.push(anoAtual - 1);
  return anos;
}
