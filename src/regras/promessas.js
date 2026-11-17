export const STATUS_PROMESSA = ['sem informação', 'em andamento', 'cumprida'];

const contar = (itens) => {
  const porStatus = Object.fromEntries(STATUS_PROMESSA.map((s) => [s, 0]));
  for (const it of itens) if (it.status in porStatus) porStatus[it.status]++;
  return porStatus;
};

// Formato torto (área sem lista de itens, item vazio) vira problema, nunca erro.
export function validarPromessas(dados) {
  const problemas = [];
  const vistos = new Set();
  if (!dados || !Array.isArray(dados.areas)) return ['o arquivo não tem a lista "areas"'];
  for (const a of dados.areas) {
    if (!a || !Array.isArray(a.itens)) { problemas.push(`área "${(a && a.area) || '?'}" sem lista de itens`); continue; }
    for (const it of a.itens) {
      if (!it || typeof it !== 'object') { problemas.push(`área "${a.area || '?'}": item vazio`); continue; }
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

// Só conta áreas com lista de itens e itens que são objetos.
export function limparPromessas(dados) {
  const areas = (dados && Array.isArray(dados.areas) ? dados.areas : [])
    .filter((a) => a && Array.isArray(a.itens))
    .map((a) => ({ ...a, itens: a.itens.filter((it) => it && typeof it === 'object') }));
  return { ...dados, areas };
}

export function resumoPromessas(dados) {
  const { areas } = limparPromessas(dados);
  const todos = areas.flatMap((a) => a.itens);
  return {
    total: todos.length,
    porStatus: contar(todos),
    porArea: areas.map((a) => ({ area: a.area, total: a.itens.length, porStatus: contar(a.itens) })),
  };
}
