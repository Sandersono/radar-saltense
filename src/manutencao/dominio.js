// Verificação mensal: quando vence o domínio radarsaltense.com.br (RDAP do Registro.br)?
// Abre o issue se faltar menos de 60 dias, se a resposta não trouxer a data ou se o domínio não estiver ativo.
// Ver OPERACAO.md, seção 11.
import { fileURLToPath } from 'node:url';
import { buscarJson, montarCorpo, publicar, dataBR, diaSP, agoraIso } from './comum.js';

export const DOMINIO = 'radarsaltense.com.br';
export const URL_RDAP = `https://rdap.registro.br/domain/${DOMINIO}`;
export const LIMITE_DIAS = 60;

// Data de vencimento (ISO) do evento "expiration" do RDAP; null se não houver.
export function vencimento(rdap) {
  const e = ((rdap && rdap.events) || []).find((x) => x && x.eventAction === 'expiration');
  return e && !Number.isNaN(Date.parse(e.eventDate)) ? e.eventDate : null;
}

export function avaliarDominio(rdap, agora, limite = LIMITE_DIAS) {
  const vence = vencimento(rdap);
  const status = (rdap && rdap.status) || [];
  const renovar = `**O que fazer:** renovar no painel do Registro.br (https://registro.br), com a conta do titular. O pagamento é com o dono. Depois, a verificação do mês seguinte fecha este alerta sozinha.`;
  if (!vence) {
    return { precisa: true, vence: null, dias: null, linhas: [`⚠️ O RDAP do Registro.br não trouxe a data de vencimento de ${DOMINIO}. Conferir à mão em ${URL_RDAP} ou no painel do Registro.br.`] };
  }
  const dias = Math.floor((Date.parse(vence) - Date.parse(agora)) / 86400000);
  const ativo = status.includes('active');
  const resumo = `${DOMINIO} vence em ${dataBR(diaSP(vence))} (faltam ${dias} dias).`;
  const linhas = [];
  if (!ativo) linhas.push(`⚠️ O domínio não aparece como ativo no Registro.br (situação: ${status.join(', ') || 'nenhuma informada'}). Conferir no painel do Registro.br.`);
  if (dias < limite) linhas.push(`⚠️ **${resumo}**`, '', renovar);
  else linhas.push(`✅ ${resumo}`);
  linhas.push('', `Consulta: ${URL_RDAP}`);
  return { precisa: !ativo || dias < limite, vence, dias, linhas };
}

async function principal() {
  const agora = agoraIso();
  const rdap = await buscarJson(URL_RDAP, { aceitar: 'application/rdap+json' });
  const r = avaliarDominio(rdap, agora);
  console.log(r.vence ? `Domínio ${DOMINIO}: vence em ${dataBR(diaSP(r.vence))} (${r.dias} dias).` : `Domínio ${DOMINIO}: sem data de vencimento no RDAP.`);
  const corpo = montarCorpo(agora, r.linhas);
  console.log(corpo);
  await publicar({ nome: 'dominio', titulo: `Manutenção: domínio ${DOMINIO} ${r.vence ? `vence em ${dataBR(diaSP(r.vence))}` : 'sem data de vencimento'}`, texto: corpo, precisa: r.precisa, agora });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await principal();
