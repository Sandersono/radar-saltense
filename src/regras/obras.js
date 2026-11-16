import { valorBR } from './receitas.js';

const valor = (v) => (typeof v === 'number' ? v : String(v ?? '').trim() ? valorBR(String(v).trim()) : 0);

export function normalizarObras(linhas) {
  return linhas.map((l) => {
    const doc = String(l.doc ?? '').replace(/\D/g, '');
    const cnpj = doc.length === 14;
    // Nome só aparece com CNPJ completo; qualquer outro documento é tratado como pessoa física.
    const contratado = cnpj ? String(l.nome ?? '').trim() : doc.length ? 'Pessoa física' : 'Não informado';
    return {
      situacao: String(l.ds_situacao ?? '').trim(),
      paralisada: /paralisad/i.test(String(l.ds_situacao ?? '')),
      valor: valor(l.vl_ajuste),
      contratado,
      cnpj: cnpj ? doc : null,
      contratante: String(l.ds_entidade ?? '').trim(),
      ano: Number(l.ano_ajuste) || null,
      objeto: String(l.objeto_ajuste ?? '').trim(),
    };
  }).sort((a, b) => (Number(b.paralisada) - Number(a.paralisada)) || (b.valor - a.valor));
}
