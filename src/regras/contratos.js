export const MODALIDADES = {
  1: 'Leilão eletrônico', 2: 'Diálogo competitivo', 3: 'Concurso', 4: 'Concorrência eletrônica', 5: 'Concorrência presencial',
  6: 'Pregão eletrônico', 7: 'Pregão presencial', 8: 'Dispensa', 9: 'Inexigibilidade', 10: 'Manifestação de interesse',
  11: 'Pré-qualificação', 12: 'Credenciamento', 13: 'Leilão presencial',
};
export const SEM_DISPUTA = [8, 9];
const centavos = (v) => Math.round(v * 100) / 100;
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

export function resumirContratacoes(lista) {
  const porModalidade = {};
  const total = { quantidade: 0, valor: 0 };
  const semDisputa = { quantidade: 0, valor: 0 };
  let semHomologado = 0;
  for (const c of lista) {
    const id = Number(c.modalidadeId);
    // Só o valor homologado entra nos valores; sem homologação conta apenas na quantidade.
    const homologado = Number(c.valorTotalHomologado) > 0;
    const valor = homologado ? Number(c.valorTotalHomologado) : 0;
    if (!homologado) semHomologado++;
    const m = (porModalidade[id] ??= { nome: MODALIDADES[id] || c.modalidadeNome || `Modalidade ${id}`, quantidade: 0, valor: 0 });
    m.quantidade++; m.valor += valor;
    total.quantidade++; total.valor += valor;
    if (SEM_DISPUTA.includes(id)) { semDisputa.quantidade++; semDisputa.valor += valor; }
  }
  for (const m of Object.values(porModalidade)) m.valor = centavos(m.valor);
  return {
    porModalidade,
    total: { quantidade: total.quantidade, valor: centavos(total.valor) },
    semDisputa: { quantidade: semDisputa.quantidade, valor: centavos(semDisputa.valor), pctQuantidade: pct(semDisputa.quantidade, total.quantidade), pctValor: pct(semDisputa.valor, total.valor) },
    semHomologado: { quantidade: semHomologado },
  };
}

// Ranking só com CNPJ; fornecedor com CPF entra apenas nos totais.
export function resumirContratos(lista, n = 10) {
  const por = new Map();
  let valor = 0;
  let quantidade = 0;
  const empenhos = { quantidade: 0, valor: 0 };
  for (const c of lista) {
    const v = Number(c.valorGlobal) || 0;
    // Empenho não é contrato: fica fora do total e do ranking, em campo próprio.
    if (c.tipoContrato?.nome === 'Empenho') { empenhos.quantidade++; empenhos.valor += v; continue; }
    quantidade++;
    valor += v;
    const doc = String(c.niFornecedor ?? '').replace(/\D/g, '');
    if (doc.length !== 14) continue;
    const e = por.get(doc) ?? { cnpj: doc, nome: String(c.nomeRazaoSocialFornecedor ?? '').trim(), valor: 0, contratos: 0 };
    e.valor += v; e.contratos++;
    por.set(doc, e);
  }
  const top = [...por.values()].sort((a, b) => b.valor - a.valor).slice(0, n).map((e) => ({ ...e, valor: centavos(e.valor) }));
  return { quantidade, valor: centavos(valor), empenhos: { quantidade: empenhos.quantidade, valor: centavos(empenhos.valor) }, top };
}
