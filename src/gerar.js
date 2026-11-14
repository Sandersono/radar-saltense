import { readFile } from 'node:fs/promises';
import { gerarSite } from './gerar-site.js';

const dados = JSON.parse(await readFile('data/processado/dados.json', 'utf8'));
await gerarSite(dados, 'dist');
console.log('Site gerado em dist/');
