import { normalizar, limparHtml } from '../util/texto.js';
import { dividirNomes } from './nomes.js';

// titulo: "<strong>Categoria:</strong> X</br><strong>Número do Documento:</strong> N</br><strong>Autor(es):</strong> A</br><strong> Data:</strong> dd/mm/aaaa hh:mm:ss"
export function lerCard({ id, titulo, texto }) {
  // Com vários autores, o portal separa os nomes por </br> dentro do campo "Autor(es)":
  // uma parte sem rótulo continua o campo anterior (cada nome vira um item da lista).
  const campos = {};
  let ultimo = null;
  for (const parte of String(titulo ?? '').split(/<\/?br\s*\/?>/i)) {
    const m = parte.match(/<strong>\s*([^<:]+):\s*<\/strong>\s*(.*)$/i);
    if (m) {
      ultimo = normalizar(m[1]);
      campos[ultimo] = limparHtml(m[2]);
    } else if (ultimo && limparHtml(parte)) {
      campos[ultimo] = `${campos[ultimo]}, ${limparHtml(parte)}`;
    }
  }
  const partes = String(texto ?? '').split(/<strong>\s*Solu[çc][ãa]o Final\s*:?/i);
  const dt = (campos['data'] || '').split(' ')[0].match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return {
    id: String(id),
    categoria: campos['categoria'] || '',
    numero: campos['numero do documento'] || '',
    autores: dividirNomes(campos['autor(es)'] || ''),
    data: dt ? `${dt[3]}-${dt[2].padStart(2, '0')}-${dt[1].padStart(2, '0')}` : '',
    ementa: limparHtml(partes[0]),
    solucao: limparHtml(partes[1] || ''),
  };
}
