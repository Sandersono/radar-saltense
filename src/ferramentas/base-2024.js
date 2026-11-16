// Gera data/referencia/cnpjs-pagos-2024.json: CNPJs que receberam ("Valor Pago" > 0) em 2024.
// Base fixa para o ponto de atenção "novas com valor alto". Rodar: node src/ferramentas/base-2024.js
import { mkdir, writeFile } from 'node:fs/promises';
import { TCE_DESPESAS } from '../config.js';
import { baixar } from '../coleta/http.js';
import { cnpjDe } from '../regras/despesas.js';
import { valorBR } from '../regras/receitas.js';

const pago = new Map();
for (let mes = 1; mes <= 12; mes++) {
  const linhas = JSON.parse((await baixar(`${TCE_DESPESAS}/2024/${mes}`)).toString('utf8'));
  if (!Array.isArray(linhas) || !linhas.length) throw new Error(`2024/${mes}: sem dados no TCE-SP.`);
  for (const l of linhas) {
    const cnpj = cnpjDe(l.id_fornecedor);
    if (cnpj && l.evento === 'Valor Pago') pago.set(cnpj, (pago.get(cnpj) || 0) + valorBR(l.vl_despesa));
  }
  console.log(`2024/${mes}: ${linhas.length} linhas`);
}
const lista = [...pago].filter(([, v]) => v > 0).map(([c]) => c).sort();
await mkdir('data/referencia', { recursive: true });
await writeFile('data/referencia/cnpjs-pagos-2024.json', `${JSON.stringify(lista)}\n`);
console.log(`${lista.length} CNPJs pagos em 2024.`);
