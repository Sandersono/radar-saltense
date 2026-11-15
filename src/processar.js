import { ANO_INICIO } from './config.js';
import { lerCard } from './regras/apex.js';
import { classificar, GRUPOS } from './regras/classificar.js';
import { extrairLocais, tiposPedido } from './regras/local.js';
import { criarCasador } from './regras/nomes.js';
import { normalizar } from './util/texto.js';
import { resumirReceitas, montarImpostometro } from './regras/receitas.js';

const doisDigitos = (n) => String(n).padStart(2, '0');

export function processar({ vereadores, cardsPorAno, presencas, votacoes, receitas, coletadoEm }) {
  const casar = criarCasador(vereadores);
  const inicio = `${ANO_INICIO}-01-01`;
  const naoAtribuidos = [];
  const avisos = [];

  // Proposituras
  const vistos = new Set();
  const proposituras = [];
  for (const cards of Object.values(cardsPorAno)) {
    for (const c of cards) {
      if (vistos.has(String(c.id))) continue;
      vistos.add(String(c.id));
      const p = lerCard(c);
      if (p.data && p.data < inicio) continue; // sem data: fica (aparece como "sem data" e no conferencia.md)
      proposituras.push({
        ...p,
        grupo: classificar(p.categoria, p.ementa),
        vereadores: [...new Set(p.autores.map(casar).filter(Boolean))],
        autoresTexto: p.autores.join(', '),
        locais: extrairLocais(p.ementa),
        tipos: tiposPedido(p.ementa),
      });
    }
  }
  proposituras.sort((a, b) => b.data.localeCompare(a.data) || Number(b.numero) - Number(a.numero));

  // Índice de ruas e bairros (para a busca)
  const mapaLocais = new Map();
  proposituras.forEach((p, i) => {
    if (p.grupo === 'administrativo') return;
    for (const l of p.locais) {
      const k = `${l.tipo}:${l.chave}`;
      if (!mapaLocais.has(k)) mapaLocais.set(k, { nome: l.nome, tipo: l.tipo, idx: [] });
      mapaLocais.get(k).idx.push(i);
    }
  });
  const locais = [...mapaLocais.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  // O problema que não some: mesmo tipo de pedido, mesma rua, 2 vezes ou mais
  const mapaRep = new Map();
  for (const p of proposituras) {
    if (p.grupo !== 'melhoria') continue;
    for (const l of p.locais.filter((x) => x.tipo === 'rua')) {
      for (const t of p.tipos) {
        const k = `${l.chave}|${t}`;
        if (!mapaRep.has(k)) mapaRep.set(k, { rua: l.nome, tipo: t, pedidos: [] });
        mapaRep.get(k).pedidos.push({ id: p.id, data: p.data, autores: p.autoresTexto });
      }
    }
  }
  const repetidos = [...mapaRep.values()]
    .filter((r) => r.pedidos.length >= 2)
    .sort((a, b) => b.pedidos.length - a.pedidos.length || a.rua.localeCompare(b.rua, 'pt-BR'));

  // Presença
  const presenca = Object.fromEntries(vereadores.map((v) => [v.id, { sessoes: [], P: 0, A: 0, AJ: 0 }]));
  const dataDoArquivo = new Map(); // a mesma data vinda de outro PDF (ex.: "agosto II") é ignorada
  const presentesNoMes = new Map(); // YYYY-MM -> ids com linha na tabela de presença do mês
  for (const arq of presencas) {
    const mes = `${arq.ano}-${doisDigitos(arq.mes)}`;
    const conhecidos = new Set();
    const fora = [];
    for (const l of arq.linhas) {
      const id = casar(l.nome);
      if (id) conhecidos.add(id); else fora.push(l.nome);
    }
    if (arq.linhas.length && conhecidos.size < vereadores.length / 2) {
      // Tabela de outro documento: não conta nada e não serve para conferir votações do mês.
      avisos.push(`${arq.arquivo}: a tabela oficial não corresponde aos vereadores atuais (só ${conhecidos.size} de ${vereadores.length} reconhecidos); o mês ficou fora da contagem de presença.`);
      continue;
    }
    if (arq.linhas.length) {
      if (conhecidos.size < vereadores.length) {
        avisos.push(`${arq.arquivo}: só ${conhecidos.size} de ${vereadores.length} vereadores reconhecidos na tabela (nomes de fora: ${fora.join(', ') || 'nenhum'}).`);
      }
      if (!presentesNoMes.has(mes)) presentesNoMes.set(mes, new Set());
      for (const id of conhecidos) presentesNoMes.get(mes).add(id);
    }
    arq.sessoes.forEach((dm, k) => {
      const [d, m] = dm.split('/').map(Number);
      const data = `${arq.ano}-${doisDigitos(arq.mes)}-${doisDigitos(d)}`; // o mês vem do nome do arquivo
      if (m !== arq.mes) avisos.push(`${arq.arquivo}: data '${dm}' lida com o mês do arquivo (${data}).`);
      if (data < inicio) return;
      if (dataDoArquivo.has(data) && dataDoArquivo.get(data) !== arq.arquivo) return;
      if (arq.linhas.every((l) => !l.marcas[k])) return; // sessão sem nenhum registro: dado ausente não é falta
      dataDoArquivo.set(data, arq.arquivo);
      for (const l of arq.linhas) {
        const id = casar(l.nome);
        if (!id) { naoAtribuidos.push({ fonte: `presença ${arq.arquivo}`, nome: l.nome }); continue; }
        const marca = l.marcas[k];
        presenca[id].sessoes.push({ data, marca, url: arq.url });
        if (marca) presenca[id][marca]++;
      }
    });
  }
  for (const p of Object.values(presenca)) p.sessoes.sort((a, b) => a.data.localeCompare(b.data));

  // Votações (o mesmo projeto pode aparecer nos PDFs de dois anos)
  // Mesmo rótulo em PDFs diferentes = o mesmo projeto. Mesmo rótulo dentro de um PDF = projetos diferentes.
  const projetos = new Map(); // rótulo normalizado -> lista de projetos
  for (const v of votacoes) {
    for (const b of v.blocos) {
      const k = normalizar(b.rotulo);
      if (!projetos.has(k)) projetos.set(k, []);
      const lista = projetos.get(k);
      let pj = lista.find((x) => !x.pdfs.has(v.url));
      if (!pj) {
        pj = { rotulo: b.rotulo, ementa: b.ementa, autor: b.autor, url: v.url, eventos: [], chaves: new Map(), pdfs: new Set() };
        lista.push(pj);
      }
      pj.pdfs.add(v.url);
      for (const e of b.eventos) {
        if (e.data < inicio) continue;
        // Só descarta a cópia vinda de OUTRO PDF; linhas parecidas do mesmo PDF são votações distintas.
        const lado = (l) => l.map(normalizar).sort().join(',');
        const ek = `${e.data}|${normalizar(e.turno)}|${normalizar(e.resultado)}|${lado(e.contra)}|${lado(e.ausentes)}`;
        if (pj.chaves.has(ek) && pj.chaves.get(ek) !== v.url) continue;
        pj.chaves.set(ek, v.url);
        const tabela = presentesNoMes.get(e.data.slice(0, 7)); // sem tabela no mês, não há como conferir
        const contra = [];
        const ausentes = [];
        for (const [lista, destino] of [[e.contra, contra], [e.ausentes, ausentes]]) {
          for (const n of lista) {
            const id = casar(n);
            if (!id) naoAtribuidos.push({ fonte: `votação ${b.rotulo} (${e.data})`, nome: n });
            else if (tabela && !tabela.has(id)) naoAtribuidos.push({ fonte: `votação ${b.rotulo} (${e.data}) — vereador fora da tabela de presença do mês`, nome: n });
            else destino.push(id);
          }
        }
        pj.eventos.push({ data: e.data, turno: e.turno, resultado: e.resultado, contra: [...new Set(contra)], ausentes: [...new Set(ausentes)], url: v.url });
      }
    }
  }
  const listaVotacoes = [...projetos.values()].flat()
    .filter((p) => p.eventos.length)
    .map(({ chaves, pdfs, ...p }) => ({ ...p, eventos: p.eventos.sort((a, b) => a.data.localeCompare(b.data)) }))
    .sort((a, b) => b.eventos[b.eventos.length - 1].data.localeCompare(a.eventos[a.eventos.length - 1].data));

  // Resumo por vereador
  const todosEventos = listaVotacoes.flatMap((pj) => pj.eventos);
  const resumo = vereadores.map((v) => {
    const props = proposituras.filter((p) => p.vereadores.includes(v.id));
    const porGrupo = Object.fromEntries(Object.keys(GRUPOS).map((g) => [g, props.filter((p) => p.grupo === g).length]));
    const pr = presenca[v.id];
    return {
      ...v,
      porGrupo,
      totalPropostas: props.length,
      presenca: { P: pr.P, A: pr.A, AJ: pr.AJ, total: pr.sessoes.length },
      votosContra: todosEventos.filter((e) => e.contra.includes(v.id)).length,
      ausenciasVotacao: todosEventos.filter((e) => e.ausentes.includes(v.id)).length,
    };
  });

  const resumoReceitas = receitas ? resumirReceitas(receitas) : null;
  const anoReceitas = new Date(coletadoEm || Date.now()).getUTCFullYear();

  const vistosNA = new Set();
  return {
    vereadores: resumo,
    proposituras,
    locais,
    repetidos,
    presenca,
    votacoes: listaVotacoes,
    naoAtribuidos: naoAtribuidos.filter((n) => {
      const k = `${n.fonte}|${n.nome}`;
      if (vistosNA.has(k)) return false;
      vistosNA.add(k);
      return true;
    }),
    avisos: [...new Set(avisos)],
    receitas: resumoReceitas ? montarImpostometro(resumoReceitas, anoReceitas) : null,
    presencasLidas: presencas.map((p) => ({ arquivo: p.arquivo, linhas: p.linhas.length })),
    votacoesLidas: votacoes.map((v) => ({ ano: v.ano, blocos: v.blocos.length, semEventos: v.blocos.filter((b) => !b.eventos.length).length })),
    meta: {
      atualizadoEm: coletadoEm || new Date().toISOString(),
      totalProposituras: proposituras.length,
      semLocal: proposituras.filter((p) => p.grupo === 'melhoria' && !p.locais.length).length,
      receitasMensais: resumoReceitas
        ? Object.fromEntries(Object.entries(resumoReceitas.meses).map(([m, x]) => [m, Math.round(x.impostos * 100) / 100]))
        : {},
    },
  };
}
