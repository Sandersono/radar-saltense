const DIA = 86400000;
const dias = (de, ate) => Math.round((Date.parse(ate) - Date.parse(de)) / DIA);
const mediana = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

// Texto da página oficial (P78): resposta = anexo "Resposta Requerimento"; vale a data mais antiga.
export function lerRespostas(texto) {
  const datas = [];
  let respondido = false;
  for (const parte of String(texto ?? '').split(/Tipo Documento:/).slice(1)) {
    const tipo = parte.split(/\n|\|/)[0].trim();
    if (!/^Resposta Requerimento/i.test(tipo)) continue;
    respondido = true;
    const m = parte.match(/Data Documento:\s*(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) datas.push(`${m[3]}-${m[2]}-${m[1]}`);
  }
  datas.sort();
  return { respondido, data: datas[0] || null };
}

// Ordem: nunca conferidos (mais novos primeiro); depois sem resposta, de até 180 dias, conferidos há mais tempo (não hoje).
export function filaRespostas(estado, requerimentos, hoje, limite = 150) {
  const nunca = requerimentos.filter((r) => !estado[r.id])
    .sort((a, b) => (b.data || '').localeCompare(a.data || '') || String(b.id).localeCompare(String(a.id)));
  const pendentes = requerimentos.filter((r) => {
    const e = estado[r.id];
    return e && !e.respondido && r.data && dias(r.data, hoje) <= 180 && e.conferidoEm < hoje;
  }).sort((a, b) => estado[a.id].conferidoEm.localeCompare(estado[b.id].conferidoEm) || String(a.id).localeCompare(String(b.id)));
  return [...nunca, ...pendentes].slice(0, limite).map((r) => r.id);
}

// Percentual e tempo típico só valem quando quase todos os requerimentos já foram conferidos.
export const amostraBoa = (x) => x.conferidos > 0 && x.conferidos >= 0.8 * x.feitos;

// Um registro por linha, na ordem dos ids, para o git não brigar numa linha gigante.
export function serializarRespostas(estado) {
  const ids = Object.keys(estado).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  if (!ids.length) return '{}\n';
  return `{\n${ids.map((id) => `${JSON.stringify(id)}:${JSON.stringify(estado[id])}`).join(',\n')}\n}\n`;
}

export function resumoRespostas(estado, requerimentos) {
  const novo = () => ({ feitos: 0, conferidos: 0, respondidos: 0, dias: [] });
  const geral = novo();
  const porVereador = {};
  for (const r of requerimentos) {
    const e = estado[r.id];
    for (const alvo of [geral, ...r.vereadores.map((v) => (porVereador[v] ??= novo()))]) {
      alvo.feitos++;
      if (!e) continue;
      alvo.conferidos++;
      if (!e.respondido) continue;
      alvo.respondidos++;
      if (e.data && r.data) alvo.dias.push(Math.max(0, dias(r.data, e.data)));
    }
  }
  const fechar = (a) => ({ feitos: a.feitos, conferidos: a.conferidos, respondidos: a.respondidos, percentual: a.conferidos ? Math.round((a.respondidos / a.conferidos) * 100) : 0, medianaDias: mediana(a.dias) });
  return { geral: fechar(geral), porVereador: Object.fromEntries(Object.entries(porVereador).map(([k, v]) => [k, fechar(v)])) };
}
