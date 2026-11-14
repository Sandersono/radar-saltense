import { normalizar } from '../util/texto.js';

export const GRUPOS = {
  melhoria: 'Pedidos de melhoria nos bairros',
  cobranca: 'Perguntas e cobranças',
  homenagem: 'Homenagens',
  lei: 'Propostas de lei',
  outros: 'Outros',
  administrativo: 'Atos administrativos (não contam por vereador)',
};

const HOMENAGEM_MOCAO = /\b(aplauso|congratula|parabeniza|pesar\b|homenage|reconhecimento)/;
const HONRARIA = /\b(titulo de cidadao|cidadao (salteense|honorario|emerito)|honra ao merito|honraria|medalha|comenda\b|diploma\b)/;
const NOME_OU_DATA = /\b(denomina|institui (o|a) (dia|semana|mes)\b|data comemorativa|calendario oficial)/;
const ADMINISTRATIVO = ['ato da presidencia', 'atos da mesa', 'portaria'];
const PODE_SER_HOMENAGEM = ['lei ordinaria', 'lei complementar', 'resolucao', 'decreto legislativo'];
const LEI = ['lei ordinaria', 'lei complementar', 'ementa lei organica', 'resolucao', 'decreto legislativo', 'iniciativa popular'];

export function classificar(categoria, ementa) {
  const c = normalizar(categoria);
  const e = normalizar(ementa);
  if (c === 'indicacao') return 'melhoria';
  if (c === 'requerimento') return 'cobranca';
  if (c === 'mocao') return HOMENAGEM_MOCAO.test(e) ? 'homenagem' : 'outros';
  if (ADMINISTRATIVO.includes(c)) return 'administrativo';
  if (c === 'decreto legislativo' && HONRARIA.test(e)) return 'homenagem';
  if (PODE_SER_HOMENAGEM.includes(c) && NOME_OU_DATA.test(e)) return 'homenagem';
  if (LEI.includes(c)) return 'lei';
  return 'outros';
}
