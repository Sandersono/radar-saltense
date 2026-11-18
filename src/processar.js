import { ANO_INICIO, OUTROS_NOMES, VEREADORES_ESPERADOS } from './config.js';
import { lerCard } from './regras/apex.js';
import { classificar, GRUPOS } from './regras/classificar.js';
import { extrairLocais, tiposPedido } from './regras/local.js';
import { criarCasador } from './regras/nomes.js';
import { normalizar, anoMesBR } from './util/texto.js';
import { resumirReceitas, montarImpostometro } from './regras/receitas.js';
import { resumirDespesas, areasSiconfi } from './regras/despesas.js';
import { resumoRespostas } from './regras/respostas.js';
import { resumirEmendas } from './regras/emendas.js';
import { validarPromessas, resumoPromessas, limparPromessas } from './regras/promessas.js';
import { montarObras, validarLigacoes, numerosDePromessas } from './regras/obras-cidade.js';
import { montarOrigem } from './regras/origem.js';

const doisDigitos = (n) => String(n).padStart(2, '0');
const DIAS_RESPOSTAS_RECENTES = 14;

// Emendas impositivas (data/referencia/emendas.json, gravado pela ferramenta). 2025 = execução, 2026 = planejado.
function montarEmendas(ref, vereadores, avisos) {
  if (!ref || (!ref['2025'] && !ref['2026'])) return null;
  const atuais = new Set(vereadores.map((v) => v.id));
  const anteriores = ref.vereadoresAnteriores || {};
  const saida = { anteriores };
  for (const ano of ['2025', '2026']) {
    const a = ref[ano];
    if (!a || !Array.isArray(a.emendas)) continue;
    const semCadastro = [...new Set(a.emendas.map((e) => e.vereador).filter((id) => !atuais.has(id) && !(id in anteriores)))];
    if (semCadastro.length) avisos.push(`Emendas de ${ano}: vereador que não é atual nem está em vereadoresAnteriores (${semCadastro.join(', ')}); confira data/referencia/emendas.json.`);
    const { arquivos, ...resto } = a;
    saida[ano] = { ...resto, resumo: resumirEmendas(a.emendas) };
  }
  return saida;
}

// Promessas (data/referencia/promessas.json, editado à mão). Item com status inválido ou sem prova aparece como "sem informação".
// Área sem itens ou item vazio: aviso e fica de fora (nunca derruba o robô).
function montarPromessas(ref, avisos) {
  if (!ref) return null;
  const problemas = validarPromessas(ref);
  if (problemas.length) avisos.push(`Promessas (data/referencia/promessas.json): ${problemas.length} ${problemas.length === 1 ? 'problema' : 'problemas'}; itens com problema aparecem como "sem informação" e partes sem formato ficam de fora: ${problemas.slice(0, 5).join('; ')}.`);
  const limpo = limparPromessas(ref);
  if (!limpo.areas.length) return null;
  const valido = (it) => validarPromessas({ areas: [{ itens: [it] }] }).length === 0;
  const areas = limpo.areas.map((a) => ({ ...a, itens: a.itens.map((it) => (valido(it) ? it : { ...it, status: 'sem informação', provas: [] })) }));
  const dados = { ...ref, areas };
  return { ...dados, resumo: resumoPromessas(dados) };
}

export function processar({ vereadores, cardsPorAno, presencas, votacoes, receitas, despesas, siconfi, origem, fontesRecursos, cnpjs2024, fotos, avisosFotos, folhaCamara, respostas, campanha, emendas, promessas, iegm, obras, contratos, duracaoPncpMs, obrasFontes, ligacoesObras, duracaoObrasMs, avisosFontes, avisosManutencao, coletadoEm }) {
  const casar = criarCasador(vereadores, OUTROS_NOMES);
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

  // Respostas a requerimentos (só quem já foi conferido no portal entra na conta)
  const estadoRespostas = respostas || {};
  for (const p of proposituras) {
    const e = p.categoria === 'Requerimento' ? estadoRespostas[p.id] : null;
    if (e && e.respondido && e.data) p.respondidoEm = e.data;
  }
  const requerimentos = proposituras.filter((p) => p.categoria === 'Requerimento').map((p) => ({ id: p.id, data: p.data, vereadores: p.vereadores }));
  const hojeISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(coletadoEm ? Date.parse(coletadoEm) : Date.now());
  const resumoResp = resumoRespostas(estadoRespostas, requerimentos);

  // Folha da Câmara
  const mesesFolha = folhaCamara || {};
  const completos = Object.keys(mesesFolha).filter((m) => !mesesFolha[m].parcial);
  const totalFolha = (r) => Math.round(Object.values(r.grupos).reduce((s, g) => s + g.total, 0) * 100) / 100;
  for (const [mes, r] of Object.entries(mesesFolha)) {
    if (r.parcial) avisos.push(`Folha da Câmara de ${mes}: o portal publicou o mês incompleto (sem os vereadores); fica de fora dos totais.`);
    else if (r.grupos.vereadores.pessoas !== VEREADORES_ESPERADOS) avisos.push(`Folha da Câmara de ${mes}: ${r.grupos.vereadores.pessoas} vereadores na folha (esperado ${VEREADORES_ESPERADOS}); pode haver suplente ou licença.`);
  }
  avisos.push(...(avisosFontes || []));

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
      fotoLocal: (fotos && fotos[v.id]) || null,
      porGrupo,
      totalPropostas: props.length,
      presenca: { P: pr.P, A: pr.A, AJ: pr.AJ, total: pr.sessoes.length },
      votosContra: todosEventos.filter((e) => e.contra.includes(v.id)).length,
      ausenciasVotacao: todosEventos.filter((e) => e.ausentes.includes(v.id)).length,
    };
  });

  const resumoReceitas = receitas ? resumirReceitas(receitas) : null;
  const { ano: anoReceitas, mes: mesReceitas } = anoMesBR(coletadoEm ? Date.parse(coletadoEm) : Date.now());
  const impostometro = resumoReceitas ? montarImpostometro(resumoReceitas, anoReceitas) : null;
  const resumoDespesas = despesas ? resumirDespesas(despesas, cnpjs2024 || []) : null;
  const gastos = resumoDespesas
    ? {
        anos: Object.fromEntries(Object.entries(resumoDespesas.anos).map(([ano, a]) => [ano, {
          ...a,
          areas: siconfi && siconfi[ano] ? { bimestre: siconfi[ano].bimestre, ...areasSiconfi(siconfi[ano].itens) } : null,
        }])),
        novas: resumoDespesas.novas,
        empresas: resumoDespesas.empresas,
      }
    : null;
  if (impostometro && mesReceitas >= 3 && impostometro.anoAnterior.mesesPublicados < 12) {
    avisos.push(`Receitas de ${impostometro.anoAnterior.ano}: só ${impostometro.anoAnterior.mesesPublicados} de 12 meses publicados pelo TCE-SP até agora.`);
  }

  const manutencao = [...(avisosManutencao || [])];
  const dadosEmendas = montarEmendas(emendas, vereadores, manutencao);
  const dadosPromessas = montarPromessas(promessas, manutencao);
  // Obras em Salto: lista montada com PNCP, Obrasgov.br, TCE e a página de paralisadas da Prefeitura (obras.html).
  const numerosPromessa = numerosDePromessas(promessas);
  if (ligacoesObras) {
    const prob = validarLigacoes(ligacoesObras, numerosPromessa);
    if (prob.length) manutencao.push(`Ligações de obras (data/referencia/obras-ligacoes.json): ${prob.length} ${prob.length === 1 ? 'problema' : 'problemas'}: ${prob.slice(0, 5).join('; ')}.`);
  }
  const fo = obrasFontes || {};
  const montadas = montarObras({ pncp: fo.pncp, obrasgov: fo.obrasgov, paralisadas: fo.paralisadas, tce: obras && obras.obras, tceDataBase: obras && obras.dataBase, ligacoes: ligacoesObras, numerosPromessa, hoje: hojeISO });
  manutencao.push(...montadas.manutencao);
  // Obra pendente (ex.: ETA João Jabour) com possível obra já na lista: alguém confere e liga à mão.
  for (const p of montadas.pendentes || []) {
    if (p.candidatos && p.candidatos.length) manutencao.push(`Obra pendente "${p.nome}": possível obra já na lista (${p.candidatos.join(', ')}). Conferir e colocar o número do PNCP/Obrasgov em data/referencia/obras-ligacoes.json.`);
  }
  if (fo.pncp && fo.pncp.comprasPendentes) manutencao.push(`Obras no PNCP: ${fo.pncp.comprasPendentes} contratações ainda sem modalidade conferida; ficam para as próximas atualizações.`);
  // Origem do dinheiro (MSC do Tesouro), conferida com as receitas e os pagamentos do TCE-SP no mesmo período.
  const dadosOrigem = montarOrigem({ origem, ref: fontesRecursos, receitasMeses: resumoReceitas ? resumoReceitas.meses : null, despesasMensais: resumoDespesas ? resumoDespesas.mensal : null });
  avisos.push(...dadosOrigem.avisos);
  manutencao.push(...dadosOrigem.manutencao);
  // Requerimentos respondidos nos últimos dias (para o resumo da semana).
  const desdeRecentes = new Date(Date.parse(hojeISO) - DIAS_RESPOSTAS_RECENTES * 86400000).toISOString().slice(0, 10);
  const respostasRecentes = proposituras
    .filter((p) => p.respondidoEm && p.respondidoEm >= desdeRecentes)
    .map((p) => ({ data: p.respondidoEm, vereadores: p.vereadores }));

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
    avisosManutencao: [...new Set(manutencao)],
    avisosFotos: avisosFotos || [],
    receitas: impostometro,
    gastos,
    presencasLidas: presencas.map((p) => ({ arquivo: p.arquivo, linhas: p.linhas.length })),
    votacoesLidas: votacoes.map((v) => ({ ano: v.ano, blocos: v.blocos.length, semEventos: v.blocos.filter((b) => !b.eventos.length).length })),
    camara: {
      folha: { meses: mesesFolha, ultimoMes: completos.length ? completos[completos.length - 1] : null },
      respostas: { geral: resumoResp.geral, porVereador: resumoResp.porVereador, pendentes: resumoResp.geral.feitos - resumoResp.geral.conferidos, conferidosHoje: Object.values(estadoRespostas).filter((e) => e.conferidoEm === hojeISO).length, recentes: respostasRecentes },
      campanha: { candidatos: (campanha && campanha.candidatos) || {} },
    },
    emendas: dadosEmendas,
    origem: dadosOrigem.dados,
    promessas: dadosPromessas,
    obras: montadas.lista.length || fo.pncp || fo.obrasgov ? { lista: montadas.lista, resumo: montadas.resumo, fontes: montadas.fontes, pendentes: montadas.pendentes } : null,
    prefeitura: {
      iegm: iegm && iegm.anos && Object.keys(iegm.anos).length ? iegm : null,
      obras: obras && obras.obras ? obras : null,
      contratos: contratos || {},
      campanhaPrefeito: (campanha && campanha.candidatos && campanha.candidatos.prefeito) || null,
    },
    meta: {
      atualizadoEm: coletadoEm || new Date().toISOString(),
      duracaoPncpMs: Number.isFinite(duracaoPncpMs) ? duracaoPncpMs : null,
      duracaoObrasMs: Number.isFinite(duracaoObrasMs) ? duracaoObrasMs : null,
      totalProposituras: proposituras.length,
      semLocal: proposituras.filter((p) => p.grupo === 'melhoria' && !p.locais.length).length,
      receitasMensais: resumoReceitas
        ? Object.fromEntries(Object.entries(resumoReceitas.meses).map(([m, x]) => [m, Math.round(x.impostos * 100) / 100]))
        : {},
      despesasMensais: resumoDespesas ? resumoDespesas.mensal : {},
      folhaMensal: Object.fromEntries(completos.map((m) => [m, totalFolha(mesesFolha[m])])),
    },
  };
}
