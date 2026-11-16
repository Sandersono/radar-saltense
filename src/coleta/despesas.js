import { TCE_DESPESAS, ANO_INICIO } from '../config.js';
import { baixar, salvar } from './http.js';

// Todos os meses do mandato (o mês corrente nunca está publicado). Sempre baixa de novo: o TCE-SP corrige meses passados.
// Resposta [] = mês ainda não publicado (não é erro).
export async function coletarDespesas(anoAtual, mesAtual) {
  const porMes = {};
  for (let ano = ANO_INICIO; ano <= anoAtual; ano++) {
    const ultimoMes = ano === anoAtual ? mesAtual - 1 : 12;
    for (let mes = 1; mes <= ultimoMes; mes++) {
      const chave = `${ano}-${String(mes).padStart(2, '0')}`;
      const texto = (await baixar(`${TCE_DESPESAS}/${ano}/${mes}`)).toString('utf8');
      let linhas;
      try { linhas = JSON.parse(texto); } catch { throw new Error(`Despesas ${chave}: a resposta do TCE-SP não é JSON.`); }
      if (!Array.isArray(linhas)) throw new Error(`Despesas ${chave}: formato inesperado da API do TCE-SP.`);
      await salvar(`data/bruto/despesas/${chave}.json`, texto);
      if (linhas.length) porMes[chave] = linhas;
    }
  }
  return porMes;
}
