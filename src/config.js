export const CAMARA = 'https://www.camarasalto.sp.gov.br';
export const APEX = 'https://cmsalto.sisvetor.com.br/ords/cmsalto/f';
export const UA = 'RadarSaltense/1.0 (projeto civico independente; contato: instagram.com/sandersonoliveira1)';
export const ANO_INICIO = 2025;
export const VEREADORES_ESPERADOS = 11;
export const ESPERA_MS = 2000;
export const AUTOR = { nome: 'Sanderson Oliveira', instagram: 'sandersonoliveira1' };
// Só preencher com fonte oficial (lei de fixação do subsídio ou Portal da Transparência):
// export const SALARIO = { valorMensal: 0, fonte: 'https://...' };
export const SALARIO = null;
// Grafias erradas nos PDFs de votação, ligadas ao vereador após conferência com o autor do site (2026-11-15).
// O apelido oficial vem sozinho da página de cada vereador; aqui ficam só os erros de digitação.
export const OUTROS_NOMES = {
  'edival-pereira-rosa': ['Preo'],
  'arildo-guadagnini': ['Rildo'],
  'michel-oliveira-rodrigues-da-silva': ['Chel'],
};
export const TCE_RECEITAS = 'https://transparencia.tce.sp.gov.br/api/json/receitas/salto';
export const TCE_DESPESAS = 'https://transparencia.tce.sp.gov.br/api/json/despesas/salto';
export const SICONFI_RREO = 'https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rreo';
export const IBGE_SALTO = 3545209;
// Onde o morador confere nomes de quem recebeu (o site não mostra nome de pessoa física).
export const LINKS_CREDOR = {
  prefeitura: 'https://salto.obaratec.com.br/ords/salto02/f?p=839:7',
  tce: 'https://transparencia.tce.sp.gov.br/despesas-fornecedor',
};
export const POPULACAO = { valor: 141988, fonte: 'IBGE, informada pela Prefeitura ao Tesouro Nacional (RREO 2025)' };

export function anos() {
  const fim = new Date().getFullYear();
  const lista = [];
  for (let a = ANO_INICIO; a <= fim; a++) lista.push(a);
  return lista;
}

export const fichaOficial = (id) => `${APEX}?p=742:78:::::P78_ID_PROJETO:${id}`;
