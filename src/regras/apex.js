import { normalizar, limparHtml } from '../util/texto.js';
import { dividirNomes } from './nomes.js';

// titulo: "<strong>Categoria:</strong> X</br><strong>Número do Documento:</strong> N</br><strong>Autor(es):</strong> A</br><strong> Data:</strong> dd/mm/aaaa hh:mm:ss"
export function lerCard({ id, titulo, texto }) {
  const campos = {};
  for (const parte of String(titulo ?? '').split(/<\/?br\s*\/?>/i)) {
    const m = parte.match(/<strong>\s*([^<:]+):\s*<\/strong>\s*(.*)$/i);
    if (m) campos[normalizar(m[1])] = limparHtml(m[2]);
  }
  const partes = String(texto ?? '').split(/<strong>\s*Solu[çc][ãa]o Final\s*:?/i);
  const [d, m, a] = (campos['data'] || '').split(' ')[0].split('/');
  return {
    id: String(id),
    categoria: campos['categoria'] || '',
    numero: campos['numero do documento'] || '',
    autores: dividirNomes(campos['autor(es)'] || ''),
    data: a ? `${a}-${m}-${d}` : '',
    ementa: limparHtml(partes[0]),
    solucao: limparHtml(partes[1] || ''),
  };
}
