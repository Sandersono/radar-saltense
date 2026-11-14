import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export async function itensDoPdf(buffer) {
  const tarefa = getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, isEvalSupported: false, verbosity: 0 });
  const paginas = [];
  try {
    const doc = await tarefa.promise;
    for (let i = 1; i <= doc.numPages; i++) {
      const pagina = await doc.getPage(i);
      const { items } = await pagina.getTextContent();
      paginas.push(
        items
          .filter((it) => it.str && it.str.trim())
          .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5] })),
      );
    }
  } finally {
    await tarefa.destroy();
  }
  return paginas;
}
