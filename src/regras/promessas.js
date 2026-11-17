export const STATUS_PROMESSA = ['sem informação', 'em andamento', 'cumprida'];

const contar = (itens) => {
  const porStatus = Object.fromEntries(STATUS_PROMESSA.map((s) => [s, 0]));
  for (const it of itens) if (it.status in porStatus) porStatus[it.status]++;
  return porStatus;
};

export function validarPromessas(dados) {
  const problemas = [];
  const vistos = new Set();
  for (const { itens } of dados.areas) {
    for (const it of itens) {
      if (!STATUS_PROMESSA.includes(it.status)) problemas.push(`${it.numero}: status inválido "${it.status}"`);
      else if (it.status !== 'sem informação' && !(it.provas || []).some((p) => p && p.titulo && /^https:\/\//.test(p.url || ''))) {
        problemas.push(`${it.numero}: status "${it.status}" sem prova com link https`);
      }
      if (vistos.has(it.numero)) problemas.push(`${it.numero}: número repetido`);
      vistos.add(it.numero);
    }
  }
  return problemas;
}

export function resumoPromessas(dados) {
  const todos = dados.areas.flatMap((a) => a.itens);
  return {
    total: todos.length,
    porStatus: contar(todos),
    porArea: dados.areas.map((a) => ({ area: a.area, total: a.itens.length, porStatus: contar(a.itens) })),
  };
}
