import { salvar } from '../coleta/http.js';
import { coletarContratos } from '../coleta/contratos.js';

const hoje = new Date();
const anos = [...new Set([2025, hoje.getFullYear()])];
const t0 = Date.now();
const dados = await coletarContratos(anos, hoje);
await salvar('data/processado/contratos.json', `${JSON.stringify(dados, null, 2)}\n`);
for (const [ano, d] of Object.entries(dados)) {
  const { total, semDisputa, porModalidade } = d.contratacoes;
  console.log(`${ano}: ${total.quantidade} contratações (R$ ${total.valor}); sem disputa ${semDisputa.pctQuantidade}% da qtd, ${semDisputa.pctValor}% do valor; ${d.contratos.quantidade} contratos (R$ ${d.contratos.valor})`);
  console.log('  ', Object.entries(porModalidade).map(([id, m]) => `${m.nome} ${m.quantidade}`).join(', '));
}
console.log(`${Math.round((Date.now() - t0) / 1000)}s`);
