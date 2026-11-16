import { valorBR } from './receitas.js';
import { limparNomeEmpresa } from '../util/texto.js';

const SIGLAS = new Set(['SP', 'ABNT', 'ETE', 'ETA', 'UBS', 'UPA', 'EMEI', 'EMEF', 'CEMEI', 'SAAE', 'BR', 'CER', 'PPP', 'CNPJ']);
// Frase com só a primeira letra maiúscula; siglas conhecidas ficam como estão.
export function frase(txt) {
  const t = String(txt ?? '').trim().replace(/\s+/g, ' ');
  if (!t) return '';
  const baixa = t.toLocaleLowerCase('pt-BR').replace(/[\p{L}\d]+/gu, (p, i) => (SIGLAS.has(p.toUpperCase()) && t.slice(i, i + p.length) === p.toUpperCase() ? p.toUpperCase() : p));
  return baixa.charAt(0).toLocaleUpperCase('pt-BR') + baixa.slice(1);
}

const valor = (v) => (typeof v === 'number' ? v : String(v ?? '').trim() ? valorBR(String(v).trim()) : 0);

export function normalizarObras(linhas) {
  return linhas.map((l) => {
    const doc = String(l.doc ?? '').replace(/\D/g, '');
    const cnpj = doc.length === 14;
    // Nome só aparece com CNPJ completo; qualquer outro documento é tratado como pessoa física.
    const contratado = cnpj ? limparNomeEmpresa(l.nome) : doc.length ? 'Pessoa física' : 'Não informado';
    return {
      situacao: String(l.ds_situacao ?? '').trim(),
      paralisada: /paralisad/i.test(String(l.ds_situacao ?? '')),
      valor: valor(l.vl_ajuste),
      contratado,
      cnpj: cnpj ? doc : null,
      contratante: String(l.ds_entidade ?? '').trim(),
      ano: Number(l.ano_ajuste) || null,
      objeto: frase(l.objeto_ajuste),
    };
  }).sort((a, b) => (Number(b.paralisada) - Number(a.paralisada)) || (b.valor - a.valor));
}
