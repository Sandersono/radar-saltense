import { salvar } from '../coleta/http.js';
import { coletarIegm } from '../coleta/iegm.js';
import { coletarObras } from '../coleta/obras.js';

const json = (o) => `${JSON.stringify(o, null, 2)}\n`;

// Coleta tudo antes de gravar: se uma consulta falhar, nenhum arquivo é alterado.
const iegm = await coletarIegm();
const obras = await coletarObras();
await salvar('data/processado/iegm.json', json(iegm));
await salvar('data/processado/obras.json', json(obras));

for (const [ano, r] of Object.entries(iegm.anos).sort()) console.log(`IEGM ${ano}: Salto ${r.Salto?.iegm ?? '-'} (${Object.keys(r).length} municípios)`);
console.log(`Obras de Salto (base ${obras.dataBase}): ${obras.obras.length}`);
for (const o of obras.obras) console.log(`- ${o.situacao} | R$ ${o.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | ${o.contratado} | ${o.ano} | ${o.objeto.slice(0, 80)}`);
