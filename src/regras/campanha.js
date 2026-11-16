import { normalizar } from '../util/texto.js';
import { valorBR } from './receitas.js';

export const ORIGENS_CAMPANHA = { partido: 'Partido (inclui fundo eleitoral)', pessoas: 'Pessoas físicas', proprios: 'Recursos próprios', coletivo: 'Financiamento coletivo', outros: 'Outros candidatos' };
const centavos = (v) => Math.round(v * 100) / 100;

export function origemCampanha(ds) {
  const o = normalizar(ds);
  if (/partido/.test(o)) return 'partido';
  if (/pessoas fisicas/.test(o)) return 'pessoas';
  if (/proprios/.test(o)) return 'proprios';
  if (/financiamento coletivo/.test(o)) return 'coletivo';
  if (/outros candidatos/.test(o)) return 'outros';
  return null;
}

// Só totais e a quantidade de doadores pessoa física; nenhum nome ou CPF sai daqui.
export function resumirCampanha(linhas) {
  const origens = Object.fromEntries(Object.keys(ORIGENS_CAMPANHA).map((k) => [k, 0]));
  const doadores = new Set();
  let total = 0;
  for (const l of linhas) {
    const o = origemCampanha(l.DS_ORIGEM_RECEITA);
    if (!o) continue;
    const v = valorBR(l.VR_RECEITA);
    total += v;
    origens[o] += v;
    if (o === 'pessoas') doadores.add(String(l.NR_CPF_CNPJ_DOADOR));
  }
  return { total: centavos(total), origens: Object.fromEntries(Object.entries(origens).map(([k, v]) => [k, centavos(v)])), doadoresPessoas: doadores.size };
}
