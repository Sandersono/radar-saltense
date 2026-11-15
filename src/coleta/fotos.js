import { readFile, rm } from 'node:fs/promises';
import { baixar, salvar, existe } from './http.js';

const PASTA = 'data/bruto/fotos';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function tipoImagem(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(PNG)) return 'png';
  return null;
}

// Baixa a foto oficial de cada vereador só quando a URL muda ou o arquivo não existe.
// Falha numa foto não para o robô: o vereador fica sem foto (o site mostra as iniciais) e entra um aviso.
export async function coletarFotos(vereadores) {
  let origem = {};
  try {
    origem = JSON.parse(await readFile(`${PASTA}/origem.json`, 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT' && !(e instanceof SyntaxError)) throw e;
    origem = {};
  }
  const fotos = {};
  const avisos = [];
  for (const v of vereadores) {
    if (!v.foto) {
      avisos.push(`Foto de ${v.nome}: não encontrada na página da Câmara. O site mostra as iniciais.`);
      continue;
    }
    const anterior = origem[v.id];
    if (anterior && anterior.url === v.foto && (await existe(`${PASTA}/${anterior.arquivo}`))) {
      fotos[v.id] = `fotos/${anterior.arquivo}`;
      continue;
    }
    try {
      const buf = await baixar(v.foto);
      const ext = tipoImagem(buf);
      if (!ext) throw new Error('o arquivo não é uma imagem JPG ou PNG');
      const arquivo = `${v.id}.${ext}`;
      await salvar(`${PASTA}/${arquivo}`, buf);
      if (anterior && anterior.arquivo && anterior.arquivo !== arquivo) await rm(`${PASTA}/${anterior.arquivo}`, { force: true });
      origem[v.id] = { url: v.foto, arquivo };
      fotos[v.id] = `fotos/${arquivo}`;
    } catch (e) {
      avisos.push(`Foto de ${v.nome}: não foi possível baixar (${e.message}). O site mostra as iniciais.`);
    }
  }
  await salvar(`${PASTA}/origem.json`, `${JSON.stringify(origem, null, 2)}\n`);
  return { fotos, avisos };
}
