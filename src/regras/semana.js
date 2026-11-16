const DIA = 86400000;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

// Dia de hoje em São Paulo (AAAA-MM-DD) a partir de um instante ISO.
export const hojeSP = (instante) => new Date(instante).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

// 7 dias terminando em hoje (hoje conta).
export function janelaSemana(hojeISO) {
  return { inicio: iso(Date.parse(hojeISO) - 6 * DIA), fim: hojeISO };
}

const dentro = (data, j) => Boolean(data) && data >= j.inicio && data <= j.fim;
const contar = (itens) => {
  const m = new Map();
  for (const k of itens) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'pt-BR'));
};

const chaveObra = (o) => `${o.cnpj}|${o.ano}|${String(o.objeto ?? '').slice(0, 80)}`;

// Fotografia dos dados oficiais; a execução seguinte compara com ela para achar novidades.
export function marcos(d) {
  const anos = Object.keys(d.gastos?.anos ?? {}).sort();
  const iegm = Object.keys(d.prefeitura?.iegm?.anos ?? {}).sort();
  return {
    receitas: d.receitas?.ultimoMesOficial ?? null,
    gastos: anos.length ? d.gastos.anos[anos.at(-1)].ultimoMes ?? null : null,
    folha: d.camara?.folha?.ultimoMes ?? null,
    iegm: iegm.at(-1) ?? null,
    obras: Object.fromEntries((d.prefeitura?.obras?.obras ?? []).map((o) => [chaveObra(o), o.situacao])),
  };
}

function novidades(atual, anterior) {
  if (!anterior) return [];
  const t = [];
  if (atual.receitas && atual.receitas !== anterior.receitas) t.push(`Saiu um novo mês de receitas da Prefeitura no TCE-SP: ${atual.receitas.split('-').reverse().join('/')}.`);
  if (atual.gastos && atual.gastos !== anterior.gastos) t.push(`Saiu um novo mês de gastos da Prefeitura no TCE-SP: ${atual.gastos.split('-').reverse().join('/')}.`);
  if (atual.folha && atual.folha !== anterior.folha) t.push(`A Câmara publicou a folha de ${atual.folha.split('-').reverse().join('/')}.`);
  if (atual.iegm && atual.iegm !== anterior.iegm) t.push(`O TCE-SP publicou a nota do IEGM de ${atual.iegm}.`);
  const antes = anterior.obras ?? {};
  const mudou = Object.entries(atual.obras).filter(([k, s]) => k in antes && antes[k] !== s).length;
  if (mudou) t.push(`${mudou === 1 ? 'Uma obra mudou' : `${mudou} obras mudaram`} de situação.`);
  return t;
}

export function resumoSemana(d, hojeISO, anterior = null) {
  const j = janelaSemana(hojeISO);
  const nome = Object.fromEntries(d.vereadores.map((v) => [v.id, v.nome]));
  const porVer = (listas) => contar(listas.flat()).map(([id, total]) => ({ id, nome: nome[id] ?? id, total }));
  const props = (d.proposituras ?? []).filter((p) => dentro(p.data, j));
  const votacoes = [];
  for (const v of d.votacoes ?? []) {
    for (const e of v.eventos ?? []) {
      if (dentro(e.data, j)) votacoes.push({ rotulo: v.rotulo, data: e.data, resultado: e.resultado, contra: (e.contra ?? []).map((id) => nome[id] ?? id) });
    }
  }
  votacoes.sort((a, b) => a.data.localeCompare(b.data) || a.rotulo.localeCompare(b.rotulo, 'pt-BR', { numeric: true }));
  const resp = (d.camara?.respostas?.recentes ?? []).filter((r) => dentro(r.data, j));
  return {
    ...j,
    proposituras: {
      total: props.length,
      porVereador: porVer(props.map((p) => p.vereadores ?? [])),
      bairros: contar(props.flatMap((p) => [...new Set((p.locais ?? []).filter((l) => l.tipo === 'bairro').map((l) => l.nome))]))
        .slice(0, 3).map(([n, total]) => ({ nome: n, total })),
    },
    votacoes,
    respondidos: { total: resp.length, porVereador: porVer(resp.map((r) => r.vereadores ?? [])) },
    novidades: novidades(marcos(d), anterior),
  };
}

const dm = (iso8) => iso8.slice(5).split('-').reverse().join('/');
export const tituloSemana = (r) => `Resumo da semana de ${dm(r.inicio)} a ${dm(r.fim)}`;

// No máximo 4 linhas de resumo, mais o link.
export function textoWhatsApp(r, url) {
  const l = [`${tituloSemana(r)} em Salto:`];
  if (r.proposituras.total) l.push(`${r.proposituras.total} propostas novas na Câmara${r.proposituras.bairros.length ? `, mais citados: ${r.proposituras.bairros.map((b) => b.nome).join(', ')}` : ''}.`);
  if (r.votacoes.length) l.push(`${r.votacoes.length} ${r.votacoes.length === 1 ? 'votação' : 'votações'} de projetos.`);
  if (r.respondidos.total) l.push(`${r.respondidos.total} ${r.respondidos.total === 1 ? 'requerimento respondido' : 'requerimentos respondidos'} pela Prefeitura.`);
  if (r.novidades.length) l.push(r.novidades[0]);
  if (l.length === 1) l.push('Sem novidades nesta semana.');
  return [...l.slice(0, 4), url].join('\n');
}
