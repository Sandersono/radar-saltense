import { CAMARA } from '../config.js';
import { lerVereadores } from '../regras/vereadores-html.js';
import { baixar, salvar } from './http.js';

export async function coletarVereadores() {
  const html = (await baixar(`${CAMARA}/`)).toString('utf8');
  await salvar('data/bruto/home.html', html);
  return lerVereadores(html, CAMARA);
}
