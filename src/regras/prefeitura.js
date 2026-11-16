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

// Decide quais anos de contratos coletar hoje: o corrente a cada 7 dias; o anterior só se faltar.
export function anosParaColetar(salvo, anoAtual, agora = Date.now()) {
  const s = salvo || {};
  const anos = [];
  if (!s[anoAtual - 1]) anos.push(anoAtual - 1);
  const feito = Date.parse(s[anoAtual] && s[anoAtual].coletadoEm);
  if (!Number.isFinite(feito) || agora - feito > 7 * 24 * 3600 * 1000) anos.push(anoAtual);
  return anos;
}
