import { consultaCda } from './pentaho.js';
import { resumirIegm } from '../regras/iegm.js';

const PAINEL = {
  base: 'https://painel.tce.sp.gov.br',
  painel: 'https://painel.tce.sp.gov.br/pentaho/api/repos/%3Apublic%3Aieg_m%3Aiegm.wcdf/generatedContent?userid=anony&password=zero',
  path: '/public/ieg_m/iegm.cda',
};

// exercicioDS devolve [{ exercicio: 2024, descricao: 'IEG-M 2025 (Ano Base: 2024)' }, ...]; o ano-base é `exercicio`.
// faixaTodosMunicipiosPeriodo recebe parampExercicio_mapa=<ano-base> e parampRegiao=-1 (todos os 644 municípios).
export const PRAZO_PENTAHO_MS = 3 * 60 * 1000;

export async function listarAnosIegm({ prazoMs = PRAZO_PENTAHO_MS } = {}) {
  return (await consultaCda({ ...PAINEL, dataAccessId: 'exercicioDS', limite: Date.now() + prazoMs })).map((l) => Number(l.exercicio)).sort((a, b) => b - a);
}

export async function coletarIegm(anos, { prazoMs = PRAZO_PENTAHO_MS } = {}) {
  const limite = Date.now() + prazoMs;
  const lista = anos || (await listarAnosIegm({ prazoMs }));
  if (!lista.length) throw new Error('IEGM: exercicioDS veio vazio');
  const out = {};
  for (const ano of lista) {
    const linhas = await consultaCda({ ...PAINEL, dataAccessId: 'faixaTodosMunicipiosPeriodo', params: { parampExercicio_mapa: ano, parampRegiao: -1 }, limite });
    if (!linhas.length) throw new Error(`IEGM ${ano}: consulta sem linhas`);
    const resumo = resumirIegm(linhas);
    if (!resumo.Salto) throw new Error(`IEGM ${ano}: Salto ausente na resposta`);
    out[ano] = resumo;
  }
  return { anos: out };
}
