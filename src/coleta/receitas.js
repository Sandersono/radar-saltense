import { TCE_RECEITAS, ANO_INICIO } from '../config.js';
import { baixar, salvar } from './http.js';

// Baixa as receitas do ano anterior (12 meses) e do ano atual (até o mês corrente).
// Sempre baixa de novo: o TCE-SP corrige meses passados. Resposta [] = mês ainda não publicado.
export async function coletarReceitas(anoAtual, mesAtual) {
  const porMes = {};
  for (const ano of [anoAtual - 1, anoAtual]) {
    if (ano < ANO_INICIO) continue;
    const ultimoMes = ano === anoAtual ? mesAtual : 12;
    for (let mes = 1; mes <= ultimoMes; mes++) {
      const chave = `${ano}-${String(mes).padStart(2, '0')}`;
      const texto = (await baixar(`${TCE_RECEITAS}/${ano}/${mes}`)).toString('utf8');
      let linhas;
      try { linhas = JSON.parse(texto); } catch { throw new Error(`Receitas ${chave}: a resposta do TCE-SP não é JSON.`); }
      if (!Array.isArray(linhas)) throw new Error(`Receitas ${chave}: formato inesperado da API do TCE-SP.`);
      await salvar(`data/bruto/receitas/${chave}.json`, texto);
      if (linhas.length) porMes[chave] = linhas;
    }
  }
  return porMes;
}
