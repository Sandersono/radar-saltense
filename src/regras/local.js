import { normalizar } from '../util/texto.js';

// Minúsculas e sem acento, com o MESMO comprimento do original, para os índices baterem.
const semAcento = (s) => s.split('').map((c) => c.normalize('NFD')[0]).join('').toLowerCase();

const PREFIXO_RUA = {
  rua: 'Rua', ruas: 'Rua', avenida: 'Avenida', avenidas: 'Avenida', av: 'Avenida',
  travessa: 'Travessa', estrada: 'Estrada', alameda: 'Alameda', praca: 'Praça', rodovia: 'Rodovia',
};
const PREFIXO_BAIRRO = {
  bairro: '', jardim: 'Jardim', jd: 'Jardim', vila: 'Vila', parque: 'Parque', residencial: 'Residencial',
  chacara: 'Chácara', chacaras: 'Chácaras', condominio: 'Condomínio', loteamento: 'Loteamento',
};

const RUA = /\b(ruas|rua|avenidas|avenida|av|travessa|estrada|alameda|praca|rodovia)\.?\s+(.+?)(?=\s*[,;.()]|\s+(?:no|na|nos|nas|em|ate|entre|esquina|proximo|altura|ao lado|desde|sentido|bairro|jardim|jd|vila|parque)\b|\s+e\s+(?:rua|ruas|av|avenida|avenidas|na|no|nas|nos)\b|$)/g;
const BAIRRO = /\b(bairro|jardim|jd|vila|parque|residencial|chacaras|chacara|condominio|loteamento)\.?\s+(.+?)(?=\s*[,;.()]|\s+(?:e|no|na|nos|nas|em|ate|entre|proximo|especialmente|sentido|onde|para|com|que)\b|$)/g;
const CENTRO = /\b(no|na) centro\b(?!\s+de\b)/;

const TITULO_ABREVIADO = /\b(?:dr|dra|prof|profa|pe|cel|gal|eng|des|ver|sto|sta|mal|cap|ten|maj)\./gi;

const maiuscula =(c) => !!c && c !== c.toLowerCase();
const digito = (c) => /\d/.test(c || '');

function coletar(re, prefixos, tipo, original, base, achados) {
  for (const m of base.matchAll(re)) {
    const ini = m.index;
    const fim = ini + m[0].length;
    const nomeOriginal = original.slice(fim - m[2].length, fim).trim();
    // Aceita se o prefixo está em maiúscula ("Rua", "Jardim") ou se o nome começa com maiúscula ou número.
    if (!maiuscula(original[ini]) && !maiuscula(nomeOriginal[0]) && !digito(nomeOriginal[0])) continue;
    const plural = m[1] === 'ruas' || m[1] === 'avenidas';
    for (const parte of plural ? nomeOriginal.split(/\s+e\s+/) : [nomeOriginal]) {
      const limpo = parte.trim().replace(/\s+/g, ' ');
      if (limpo.length < 2) continue;
      const prefixo = prefixos[m[1]];
      const nome = prefixo ? `${prefixo} ${limpo}` : limpo;
      achados.push({ pos: ini, tipo, nome, chave: normalizar(nome) });
    }
  }
}

export function extrairLocais(ementa) {
  // "Rua Dr. Barros": o ponto da abreviação vira espaço (mesmo comprimento) para não cortar o nome.
  const semPontoDeTitulo = (s) => s.replace(TITULO_ABREVIADO, (m) => `${m.slice(0, -1)} `);
  const original = semPontoDeTitulo(String(ementa ?? ''));
  const base = semPontoDeTitulo(semAcento(original));
  const achados = [];
  coletar(RUA, PREFIXO_RUA, 'rua', original, base, achados);
  coletar(BAIRRO, PREFIXO_BAIRRO, 'bairro', original, base, achados);
  const c = base.search(CENTRO);
  if (c >= 0) achados.push({ pos: c, tipo: 'bairro', nome: 'Centro', chave: 'centro' });
  achados.sort((a, b) => a.pos - b.pos);
  const vistos = new Set();
  return achados
    .filter((a) => {
      const k = `${a.tipo}:${a.chave}`;
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    })
    .map(({ tipo, nome, chave }) => ({ tipo, nome, chave }));
}

// Todas as alternativas começam em limite de palavra; as curtas também terminam nele
// (mato não casa em "formato", poste não casa em "posterior").
const TIPOS = [
  ['buraco', /\b(buraco|tamponamento|cratera)/],
  ['asfalto', /\b(asfalt|pavimenta|recape|paralelepipedo|nivelamento)/],
  ['iluminacao', /\b(ilumina|lampada|postes?\b)/],
  ['limpeza', /\b(limpeza|matos?\b|capina|rocada|entulho)/],
  ['drenagem', /\b(bueiro|boca de lobo|drenagem|galeria pluvial|alagamento)/],
  ['sinalizacao', /\b(sinaliza|lombada|faixa de pedestre|redutor de velocidade|semaforo)/],
  ['arvore', /\b(poda|arvore|galhos)/],
  ['lixo', /\b(coleta de lixo|lixos?\b|conteiner|cacamba|residuos)/],
];

export const TIPOS_NOME = {
  buraco: 'buracos', asfalto: 'asfalto e pavimentação', iluminacao: 'iluminação', limpeza: 'limpeza e mato',
  drenagem: 'bueiros e drenagem', sinalizacao: 'sinalização', arvore: 'poda de árvores', lixo: 'lixo e coleta',
};

export function tiposPedido(ementa) {
  const e = normalizar(ementa);
  return TIPOS.filter(([, re]) => re.test(e)).map(([t]) => t);
}
