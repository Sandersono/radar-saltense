import { valorBR } from './receitas.js';

const valor = (v) => (typeof v === 'number' ? v : String(v ?? '').trim() ? valorBR(String(v).trim()) : 0);

export function normalizarObras(linhas) {
  return linhas.map((l) => {
    const doc = String(l.doc ?? '').replace(/\D/g, '');
    const pf = doc.length === 11;
    return {
      situacao: String(l.ds_situacao ?? '').trim(),
      paralisada: /paralisad/i.test(String(l.ds_situacao ?? '')),
      valor: valor(l.vl_ajuste),
      contratado: pf ? 'Pessoa física' : String(l.nome ?? '').trim(),
      cnpj: !pf && doc.length === 14 ? doc : null,
      contratante: String(l.ds_entidade ?? '').trim(),
      ano: Number(l.ano_ajuste) || null,
      objeto: String(l.objeto_ajuste ?? '').trim(),
    };
  }).sort((a, b) => (Number(b.paralisada) - Number(a.paralisada)) || (b.valor - a.valor));
}
