import { consultaCda } from './pentaho.js';
import { normalizarObras } from '../regras/obras.js';
import { IBGE_SALTO } from '../config.js';

const PAINEL = {
  base: 'https://paineldeobras.tce.sp.gov.br',
  painel: 'https://paineldeobras.tce.sp.gov.br/pentaho/api/repos/%3Apublic%3AObra%3Apainel_obras.wcdf/generatedContent?userid=anony&password=zero',
  path: '/public/Obra/painel_obras.cda',
};

// selPeriodo devolve [{ id: 1, descricao_periodo: 'Data Base: 17/10/2026' }]; o id vai em parampPeriodo (-1 devolve vazio).
export async function coletarObras({ prazoMs = 3 * 60 * 1000 } = {}) {
  const limite = Date.now() + prazoMs;
  const periodos = await consultaCda({ ...PAINEL, dataAccessId: 'selPeriodo', limite });
  const recente = periodos.sort((a, b) => Number(b.id) - Number(a.id))[0];
  if (!recente) throw new Error('selPeriodo sem períodos');
  const dataBase = String(recente.descricao_periodo).replace(/^Data Base:\s*/i, '').trim();
  const linhas = await consultaCda({
    ...PAINEL,
    dataAccessId: 'obrasTabela',
    limite,
    params: { parampMunicipio: IBGE_SALTO, parampPeriodo: recente.id, parampSituacao: -1, parampFonteRecurso: -1, parampContratante: -1, parampContratado: -1 },
  });
  if (!linhas.length) throw new Error(`Obras: obrasTabela sem linhas para Salto (período ${recente.id})`);
  return { dataBase, obras: normalizarObras(linhas) };
}
