export function normalizar(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function limparHtml(s) {
  return String(s ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slug(s) {
  return normalizar(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Ano e mês do calendário em Brasília (o servidor roda em UTC).
export function anoMesBR(instante = Date.now()) {
  const [a, m] = new Date(instante).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).split('-').map(Number);
  return { ano: a, mes: m };
}

export const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

// Documentos pessoais nunca aparecem no site, mesmo quando o texto oficial os traz (ex.: portarias de nomeação).
// Troca o número do CPF e do RG por "[omitido]" e mantém o resto do texto. "CPFL" e outros números não são tocados.
export function ocultarDocumentos(s) {
  return String(s ?? '')
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[omitido]')
    .replace(/(CPF(?:\/MF)?\s*(?:n[º°o.]*)?\s*:?\s*)\d{11}\b/gi, '$1[omitido]')
    .replace(/(\bRG\s*(?:n[º°o.]*)?\s*:?\s*)\d[\d.]{4,11}(?:-?[\dXx])?/g, '$1[omitido]');
}
