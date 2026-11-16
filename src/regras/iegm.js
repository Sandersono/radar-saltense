import { normalizar } from '../util/texto.js';

export const FAIXAS_IEGM = { 'A': 'Altamente efetiva', 'B+': 'Muito efetiva', 'B': 'Efetiva', 'C+': 'Em fase de adequação', 'C': 'Baixo nível de adequação' };
// Rótulos das dimensões: conferir com o manual/painel do TCE e ajustar só o texto se o nome oficial for outro.
export const DIMENSOES_IEGM = { iegm: 'Nota geral', plan: 'Planejamento', fisc: 'Gestão fiscal', educ: 'Educação', saude: 'Saúde', amb: 'Meio ambiente', cidade: 'Proteção da cidade', gov: 'Governança de TI' };
export const MUNICIPIOS_IEGM = ['Salto', 'Itu', 'Indaiatuba', 'Itupeva', 'Cabreúva', 'Sorocaba'];
const CAMPOS = { iegm: 'iegm', plan: 'iplanejamento', fisc: 'ifiscal', educ: 'ieduc', saude: 'isaude', amb: 'iamb', cidade: 'icidade', gov: 'igov' };

export function resumirIegm(linhas) {
  const alvo = new Map(MUNICIPIOS_IEGM.map((m) => [normalizar(m), m]));
  const out = {};
  for (const l of linhas) {
    const m = alvo.get(normalizar(l.nome));
    if (!m) continue;
    out[m] = Object.fromEntries(Object.entries(CAMPOS).map(([k, c]) => [k, String(l[c] ?? '').trim() || null]));
  }
  return out;
}
