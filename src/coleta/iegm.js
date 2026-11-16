import { consultaCda } from './pentaho.js';
import { resumirIegm } from '../regras/iegm.js';

const PAINEL = {
  base: 'https://painel.tce.sp.gov.br',
  painel: 'https://painel.tce.sp.gov.br/pentaho/api/repos/%3Apublic%3Aieg_m%3Aiegm.wcdf/generatedContent?userid=anony&password=zero',
  path: '/public/ieg_m/iegm.cda',
};

// exercicioDS devolve [{ exercicio: 2024, descricao: 'IEG-M 2025 (Ano Base: 2024)' }, ...]; o ano-base é `exercicio`.
// faixaTodosMunicipiosPeriodo recebe parampExercicio_mapa=<ano-base> e parampRegiao=-1 (todos os 644 municípios).
export async function coletarIegm(anos) {
  const lista = anos || (await consultaCda({ ...PAINEL, dataAccessId: 'exercicioDS' })).map((l) => Number(l.exercicio)).sort((a, b) => b - a);
  if (!lista.length) throw new Error('IEGM: exercicioDS veio vazio');
  const out = {};
  for (const ano of lista) {
    const linhas = await consultaCda({ ...PAINEL, dataAccessId: 'faixaTodosMunicipiosPeriodo', params: { parampExercicio_mapa: ano, parampRegiao: -1 } });
    if (!linhas.length) throw new Error(`IEGM ${ano}: consulta sem linhas`);
    const resumo = resumirIegm(linhas);
    if (!resumo.Salto) throw new Error(`IEGM ${ano}: Salto ausente na resposta`);
    out[ano] = resumo;
  }
  return { anos: out };
}
