import sharp from 'sharp';
import { esc } from '../util/texto.js';
import { iniciais, geometriaRecorte } from './util.js';

// Cartão de prévia (1200x630) por vereador: foto, nome completo, apelido e "Câmara de Salto".
// Sem cargo e sem gênero. Fontes do sistema (o SVG é desenhado pelo sharp/librsvg).
export const LARGURA = 1200;
export const ALTURA = 630;
const FOTO = { x: 70, y: 115, lado: 400 };
const FONTE = "Nunito, 'DejaVu Sans', 'Segoe UI', Arial, sans-serif";

// Quebra um texto em linhas de até `max` caracteres, sem cortar palavras.
export function quebrarLinhas(texto, max) {
  const linhas = [];
  for (const p of String(texto).trim().split(/\s+/)) {
    const ult = linhas[linhas.length - 1];
    if (ult !== undefined && `${ult} ${p}`.length <= max) linhas[linhas.length - 1] = `${ult} ${p}`;
    else linhas.push(p);
  }
  return linhas;
}

export function svgCartaoVereador(v, temFoto) {
  let tamanho = 54;
  let linhas = quebrarLinhas(v.nome, 19);
  if (linhas.length > 3) { tamanho = 46; linhas = quebrarLinhas(v.nome, 24); }
  const x = 530;
  let y = 250;
  const nome = linhas.map((l, i) => `<text x="${x}" y="${y + i * (tamanho + 10)}" font-size="${tamanho}" fill="#FFFFFF">${esc(l)}</text>`).join('');
  y += linhas.length * (tamanho + 10) + 4;
  const apelido = v.apelido ? `<text x="${x}" y="${y}" font-size="42" fill="#FFC20E">“${esc(v.apelido)}”</text>` : '';
  const semFoto = temFoto ? '' : `<rect x="${FOTO.x}" y="${FOTO.y}" width="${FOTO.lado}" height="${FOTO.lado}" rx="40" fill="#E6F2FA"/><text x="${FOTO.x + FOTO.lado / 2}" y="${FOTO.y + FOTO.lado / 2 + 50}" font-size="150" font-family="${FONTE}" font-weight="800" fill="#0B2545" text-anchor="middle">${esc(iniciais(v.nome))}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LARGURA}" height="${ALTURA}" viewBox="0 0 ${LARGURA} ${ALTURA}">
<rect width="${LARGURA}" height="${ALTURA}" fill="#0B2545"/>
<rect width="${LARGURA}" height="14" fill="#FFC20E"/>
<rect x="${FOTO.x - 6}" y="${FOTO.y - 6}" width="${FOTO.lado + 12}" height="${FOTO.lado + 12}" rx="46" fill="#FFC20E"/>
${semFoto}
<g font-family="${FONTE}" font-weight="800">
<text x="${x}" y="170" font-size="36" fill="#E7EEF5">Câmara de Salto</text>
${nome}
${apelido}
<text x="${x}" y="560" font-size="34" fill="#FFC20E">Radar Saltense</text>
</g>
<g font-family="${FONTE}"><text x="${x}" y="600" font-size="26" fill="#E7EEF5">radarsaltense.com.br</text></g>
</svg>`;
}

// Gera o PNG. entradaFoto: foto oficial (data/bruto/...) ou null.
export async function gerarCartaoVereador(v, entradaFoto, saida) {
  const camadas = [];
  if (entradaFoto) {
    const { width, height } = await sharp(entradaFoto).metadata();
    const g = geometriaRecorte(width, height);
    const mascara = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${FOTO.lado}" height="${FOTO.lado}"><rect width="${FOTO.lado}" height="${FOTO.lado}" rx="40" fill="#fff"/></svg>`);
    const foto = await sharp(entradaFoto)
      .extract({ left: g.esquerda, top: 0, width: g.lado, height: g.alturaCorpo })
      .extend({ top: g.folga, extendWith: 'copy' })
      .png()
      .toBuffer();
    // O sharp redimensiona antes de estender: o quadrado é montado primeiro e só depois reduzido.
    const quadrada = await sharp(foto)
      .resize(FOTO.lado, FOTO.lado)
      .ensureAlpha()
      .png()
      .toBuffer();
    const recortada = await sharp(quadrada)
      .composite([{ input: mascara, blend: 'dest-in' }])
      .png()
      .toBuffer();
    camadas.push({ input: recortada, left: FOTO.x, top: FOTO.y });
  }
  await sharp(Buffer.from(svgCartaoVereador(v, Boolean(entradaFoto))))
    .composite(camadas)
    .flatten({ background: '#0B2545' })
    .png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 })
    .toFile(saida);
}

// favicon.ico com uma imagem PNG dentro (formato aceito por todos os navegadores atuais).
export function icoDePng(png, lado = 32) {
  const cabecalho = Buffer.alloc(6);
  cabecalho.writeUInt16LE(0, 0);
  cabecalho.writeUInt16LE(1, 2);
  cabecalho.writeUInt16LE(1, 4);
  const entrada = Buffer.alloc(16);
  entrada.writeUInt8(lado >= 256 ? 0 : lado, 0);
  entrada.writeUInt8(lado >= 256 ? 0 : lado, 1);
  entrada.writeUInt16LE(1, 4);
  entrada.writeUInt16LE(32, 6);
  entrada.writeUInt32LE(png.length, 8);
  entrada.writeUInt32LE(22, 12);
  return Buffer.concat([cabecalho, entrada, png]);
}
