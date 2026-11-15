import { CAMARA } from '../config.js';
import { lerVereadores, lerApelido } from '../regras/vereadores-html.js';
import { baixar, salvar } from './http.js';

export async function coletarVereadores() {
  const html = (await baixar(`${CAMARA}/`)).toString('utf8');
  await salvar('data/bruto/home.html', html);
  const lista = lerVereadores(html, CAMARA);
  for (const v of lista) {
    try {
      v.apelido = lerApelido((await baixar(v.url)).toString('utf8'), v.nome);
    } catch (e) {
      v.apelido = null; // sem a página, o vereador continua sendo achado pelo nome
      console.warn(`Apelido de ${v.nome}: ${e.message}`);
    }
  }
  return lista;
}
