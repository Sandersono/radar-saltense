import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { anos, ANO_INICIO } from './config.js';
import { coletarVereadores } from './coleta/vereadores.js';
import { coletarProposituras } from './coleta/proposituras.js';
import { coletarPresencas } from './coleta/presenca.js';
import { coletarVotacoes } from './coleta/votacoes.js';
import { salvar, baixar } from './coleta/http.js';
import { coletarReceitas } from './coleta/receitas.js';
import { coletarDespesas } from './coleta/despesas.js';
import { coletarSiconfi } from './coleta/siconfi.js';
import { coletarMsc } from './coleta/msc.js';
import { mesclarOrigem } from './regras/origem.js';
import { coletarFotos } from './coleta/fotos.js';
import { coletarFolha } from './coleta/folha-camara.js';
import { coletarRespostas } from './coleta/respostas.js';
import { coletarIegm, listarAnosIegm } from './coleta/iegm.js';
import { coletarObras } from './coleta/obras.js';
import { coletarContratos } from './coleta/contratos.js';
import { coletarObrasPncp, coletarObrasgov, coletarParalisadas } from './coleta/obras-cidade.js';
import { mesclarIegm, mesclarContratos, escolherObras, dataBaseMaisVelha, anosParaColetar, decidirAnoContratos } from './regras/prefeitura.js';
import { lerCard } from './regras/apex.js';
import { mesclarFolha } from './regras/folha.js';
import { filaRespostas } from './regras/respostas.js';
import { anoMesBR, mensagemErro } from './util/texto.js';
import { nomesPdf, pdfsNovos } from './regras/emendas.js';

const ORCAMENTO_RESPOSTAS = 150;
const PRAZO_CONTRATOS_MS = 6 * 60 * 1000;
const PRAZO_PENTAHO_MS = 3 * 60 * 1000;
const PRAZO_RECEITAS_MS = 4 * 60 * 1000;
const PRAZO_DESPESAS_MS = 6 * 60 * 1000;
const PRAZO_SICONFI_MS = 3 * 60 * 1000;
const PRAZO_MSC_MS = 3 * 60 * 1000;
const PRAZO_OBRAS_PNCP_MS = 6 * 60 * 1000;
const PRAZO_OBRASGOV_MS = 5 * 60 * 1000;
// Mensagens do Playwright trazem o registro de chamadas em várias linhas; só a primeira vai para o site, em português.
const primeiraLinha = (m) => mensagemErro(m);
const doisDigitos = (n) => String(n).padStart(2, '0');

async function lerJson(caminho, padrao, avisos) {
  try { return JSON.parse(await readFile(caminho, 'utf8')); } catch (e) {
    if (e.code === 'ENOENT') return padrao;
    avisos.push(`${caminho} não pôde ser lido (${primeiraLinha(e.message)}); seguindo sem ele.`);
    return padrao;
  }
}

async function fonteTce(nome, coletar, avisos) {
  try { return await coletar(); } catch (e) {
    avisos.push(`${nome}: ${primeiraLinha(e.message)}; mantidos os dados da última atualização.`);
    return null;
  }
}

// Fonte secundária: se falhar, o robô segue com o último dado salvo e deixa um aviso (spec, seção 2).
async function folhaDaCamara(vereadores, hoje, salvo, avisos) {
  try {
    const mesAnterior = hoje.mes === 1 ? `${hoje.ano - 1}-12` : `${hoje.ano}-${doisDigitos(hoje.mes - 1)}`;
    const novos = await coletarFolha([mesAnterior, `${hoje.ano}-${doisDigitos(hoje.mes)}`], vereadores);
    for (const [mes, r] of Object.entries(novos)) {
      if (!r) continue;
      if (r.grupos.vereadores.pessoas === 0) r.parcial = true; // o portal publicou a folha incompleta
      const antigo = salvo[mes];
      if (r.parcial && antigo && !antigo.parcial) delete novos[mes]; // não troca um mês completo por um incompleto
    }
    return mesclarFolha(salvo, novos);
  } catch (e) {
    avisos.push(`Folha da Câmara: ${primeiraLinha(e.message)}; mantido o último dado salvo.`);
    return salvo;
  }
}

// Fila a partir dos próprios cartões coletados (mesmo filtro do processar: sem repetidos, desde o início do mandato).
async function respostasDaCamara(cardsPorAno, salvo, avisos) {
  try {
    const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    const vistos = new Set();
    const reqs = [];
    for (const cards of Object.values(cardsPorAno)) {
      for (const c of cards) {
        if (vistos.has(String(c.id))) continue;
        vistos.add(String(c.id));
        const p = lerCard(c);
        if (p.categoria === 'Requerimento' && p.data && p.data >= `${ANO_INICIO}-01-01`) reqs.push({ id: p.id, data: p.data });
      }
    }
    const fila = filaRespostas(salvo, reqs, hoje, ORCAMENTO_RESPOSTAS);
    const { estado, falhas, interrompido } = await coletarRespostas(fila, hoje);
    if (interrompido === 'tempo') avisos.push('Respostas a requerimentos: o tempo reservado acabou; o resto fica para a próxima atualização.');
    if (interrompido === 'falhas') avisos.push('Respostas a requerimentos: 5 páginas seguidas falharam; conferência interrompida (o portal está fora do ar ou mudou?).');
    if (falhas.length) avisos.push(`Respostas a requerimentos: ${falhas.length} de ${fila.length} páginas não puderam ser lidas; ficam para a próxima atualização.`);
    return { ...salvo, ...estado };
  } catch (e) {
    avisos.push(`Respostas a requerimentos: ${primeiraLinha(e.message)}; mantido o último dado salvo.`);
    return salvo;
  }
}

// Origem do dinheiro (MSC do Tesouro): ano fechado guardado; ano corrente uma vez por dia. Falha: fica o salvo e um aviso.
async function origemDoTesouro(salvo, hoje, avisos) {
  try {
    return mesclarOrigem(salvo, { anos: await coletarMsc(salvo, hoje, { prazoMs: PRAZO_MSC_MS }) });
  } catch (e) {
    const parciais = e.parciais || {};
    avisos.push(`MSC do Tesouro (origem do dinheiro): ${primeiraLinha(e.message)}; mantido o último dado salvo${Object.keys(parciais).length ? ` (anos atualizados: ${Object.keys(parciais).join(', ')})` : ''}.`);
    return mesclarOrigem(salvo, { anos: parciais });
  }
}

// Nota do TCE: o robô só refaz a lista de anos e o ano-base mais novo; os anos antigos ficam como estão.
async function iegmDoTce(salvo, avisos) {
  try {
    const limite = Date.now() + PRAZO_PENTAHO_MS; // um prazo só para a lista de anos e o ano mais novo
    const anos = await listarAnosIegm({ limite });
    if (!anos.length) throw new Error('lista de anos vazia');
    return mesclarIegm(salvo, await coletarIegm([anos[0]], { limite }));
  } catch (e) {
    avisos.push(`Nota do TCE (IEGM): ${primeiraLinha(e.message)}; mantido o último dado salvo.`);
    return salvo;
  }
}

async function obrasDoTce(salvo, avisos) {
  try {
    const novo = await coletarObras({ prazoMs: PRAZO_PENTAHO_MS });
    if (dataBaseMaisVelha(novo, salvo)) {
      avisos.push(`Obras do TCE: o painel veio com data-base ${novo.dataBase}, mais velha que a salva (${salvo.dataBase}); mantido o último dado salvo.`);
      return salvo;
    }
    return escolherObras(salvo, novo);
  } catch (e) {
    avisos.push(`Obras do TCE: ${primeiraLinha(e.message)}; mantido o último dado salvo.`);
    return salvo;
  }
}

// Compras no PNCP: o ano corrente a cada 7 dias (leva minutos); o anterior só se ainda não estiver salvo.
async function contratosDoPncp(salvo, hoje, avisos) {
  const anos = anosParaColetar(salvo, hoje.ano);
  if (!anos.length) return { contratos: salvo || {}, duracaoMs: null };
  const inicio = Date.now();
  let novos = {};
  try {
    novos = await coletarContratos(anos, { prazoMs: PRAZO_CONTRATOS_MS });
  } catch (e) {
    novos = e.anosCompletos || {};
    avisos.push(`Compras da Prefeitura (PNCP): ${primeiraLinha(e.message)}; mantido o último dado salvo${Object.keys(novos).length ? ` (anos atualizados: ${Object.keys(novos).join(', ')})` : ''}.`);
  }
  // Ano vazio (ou com menos da metade) não troca um ano salvo com dados: fica o salvo, sem renovar coletadoEm.
  for (const ano of Object.keys(novos)) {
    const d = decidirAnoContratos(salvo && salvo[ano], novos[ano]);
    if (!d.manter) continue;
    avisos.push(`Compras da Prefeitura (PNCP): em ${ano}, ${d.motivo}; o PNCP não costuma perder registros. Mantido o ano salvo.`);
    delete novos[ano];
  }
  return { contratos: mesclarContratos(salvo, novos), duracaoMs: Date.now() - inicio };
}

// Obras em Salto (obras.html): três fontes independentes; a que falhar fica com o último dado salvo e gera aviso.
async function obrasDaCidade(salvo, ligacoes, avisos, manutencao) {
  const s = salvo || {};
  const saida = { pncp: s.pncp || null, obrasgov: s.obrasgov || null, paralisadas: s.paralisadas || null };
  const manter = new Set(((ligacoes && Array.isArray(ligacoes.ligacoes)) ? ligacoes.ligacoes : []).flatMap((l) => (l && Array.isArray(l.pncp) ? l.pncp : [])));
  try {
    saida.pncp = await coletarObrasPncp(s.pncp, { manter, prazoMs: PRAZO_OBRAS_PNCP_MS });
    if (saida.pncp.incompleto) avisos.push(`Obras no PNCP: a primeira leitura completa ainda não terminou (${saida.pncp.semente.feitas.length} partes prontas${saida.pncp.erro ? `; ${primeiraLinha(saida.pncp.erro)}` : ''}); a lista pode estar incompleta e continua na próxima atualização.`);
  } catch (e) {
    avisos.push(`Obras no PNCP: ${primeiraLinha(e.message)}; mantido o último dado salvo.`);
  }
  try {
    saida.obrasgov = await coletarObrasgov(s.obrasgov, { prazoMs: PRAZO_OBRASGOV_MS });
    if (saida.obrasgov.esgotado) avisos.push('Obras no Obrasgov.br: o tempo reservado acabou; parte das obras ficou com o dado da coleta anterior.');
    if (saida.obrasgov.adiados) manutencao.push(`Obras no Obrasgov.br: limite diário de consultas atingido; ${saida.obrasgov.adiados} projetos ficam para a próxima atualização.`);
  } catch (e) {
    avisos.push(`Obras no Obrasgov.br: ${primeiraLinha(e.message)}; mantido o último dado salvo.`);
  }
  try {
    saida.paralisadas = await coletarParalisadas();
  } catch (e) {
    avisos.push(`Consulta de Obras Paralisadas (Prefeitura): ${primeiraLinha(e.message)}; mantido o último dado salvo.`);
  }
  return saida;
}

// Emendas: o robô não lê os PDFs (a ferramenta é rodada à mão); só avisa quando a Câmara publica PDF novo
// nas categorias de 2025 e 2026. Aviso de manutenção: vai para o conferencia.md, não para o site.
async function emendasNaCamara(emendas, avisos) {
  for (const ano of ['2025', '2026']) {
    const a = emendas && emendas[ano];
    if (!a || !a.pagina) continue;
    try {
      const nomes = nomesPdf((await baixar(`${a.pagina}?limit=0`, { rotulo: `Emendas de ${ano}` })).toString('utf8'));
      if (!nomes.length) throw new Error('nenhum PDF na página da categoria (o site da Câmara mudou?)');
      const novos = pdfsNovos(nomes, a);
      if (novos.length) avisos.push(`Há PDF novo de emendas de ${ano} na Câmara (${novos.map((n) => n.split('/').pop()).join(' | ')}); rodar a ferramenta (npm run emendas) e conferir data/referencia/emendas.json.`);
    } catch (e) {
      avisos.push(`Emendas de ${ano}: não deu para conferir se a Câmara publicou PDF novo (${primeiraLinha(e.message)}); seguem os dados salvos.`);
    }
  }
}

export async function coletarTudo() {
  const lista = anos();
  const anoAtual = lista[lista.length - 1];
  const vereadores = await coletarVereadores();
  const { fotos, avisos: avisosFotos } = await coletarFotos(vereadores);
  const cardsPorAno = await coletarProposituras(lista, anoAtual);
  const presencas = await coletarPresencas(lista, anoAtual);
  const votacoes = await coletarVotacoes(lista, anoAtual);
  const hoje = anoMesBR();
  const avisosFontes = [];
  // TCE-SP e SICONFI fora do ar não param o robô: fonte não coletada vira null e o último resultado é mantido (src/regras/tce-anterior.js).
  const receitas = await fonteTce('Receitas do TCE-SP', () => coletarReceitas(hoje.ano, hoje.mes, { prazoMs: PRAZO_RECEITAS_MS }), avisosFontes);
  const despesas = await fonteTce('Despesas do TCE-SP', () => coletarDespesas(hoje.ano, hoje.mes, { prazoMs: PRAZO_DESPESAS_MS }), avisosFontes);
  const siconfi = await fonteTce('SICONFI', () => coletarSiconfi(hoje.ano, { prazoMs: PRAZO_SICONFI_MS }), avisosFontes);
  const origem = await origemDoTesouro(await lerJson('data/processado/origem.json', null, avisosFontes), hoje, avisosFontes);
  const fontesRecursos = await lerJson('data/referencia/fontes-recursos.json', null, avisosFontes);
  const cnpjs2024 = JSON.parse(await readFile('data/referencia/cnpjs-pagos-2024.json', 'utf8'));
  const folhaSalva = await lerJson('data/processado/folha-camara.json', {}, avisosFontes);
  const respostasSalvas = await lerJson('data/processado/respostas.json', {}, avisosFontes);
  const campanha = await lerJson('data/referencia/campanha-2024.json', null, avisosFontes);
  const emendas = await lerJson('data/referencia/emendas.json', null, avisosFontes);
  const promessas = await lerJson('data/referencia/promessas.json', null, avisosFontes);
  const avisosManutencao = [];
  await emendasNaCamara(emendas, avisosManutencao);
  const iegmSalvo = await lerJson('data/processado/iegm.json', null, avisosFontes);
  const obrasSalvas = await lerJson('data/processado/obras.json', null, avisosFontes);
  const contratosSalvos = await lerJson('data/processado/contratos.json', {}, avisosFontes);
  const iegm = await iegmDoTce(iegmSalvo, avisosFontes);
  const obras = await obrasDoTce(obrasSalvas, avisosFontes);
  const { contratos, duracaoMs: duracaoPncpMs } = await contratosDoPncp(contratosSalvos, hoje, avisosFontes);
  const ligacoesObras = await lerJson('data/referencia/obras-ligacoes.json', null, avisosFontes);
  const inicioObras = Date.now();
  const obrasFontes = await obrasDaCidade(await lerJson('data/processado/obras-fontes.json', null, avisosFontes), ligacoesObras, avisosFontes, avisosManutencao);
  const duracaoObrasMs = Date.now() - inicioObras;
  const folhaCamara = await folhaDaCamara(vereadores.map(({ id, nome, apelido }) => ({ id, nome, apelido })), hoje, folhaSalva, avisosFontes);
  const respostas = await respostasDaCamara(cardsPorAno, respostasSalvas, avisosFontes);
  const coleta = { vereadores, cardsPorAno, presencas, votacoes, receitas, despesas, siconfi, origem, fontesRecursos, cnpjs2024, fotos, avisosFotos, folhaCamara, respostas, campanha, emendas, promessas, iegm, obras, contratos, duracaoPncpMs, obrasFontes, ligacoesObras, duracaoObrasMs, avisosFontes, avisosManutencao, coletadoEm: new Date().toISOString() };
  await salvar('data/bruto/coleta.json', JSON.stringify(coleta));
  return coleta;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const c = await coletarTudo();
  console.log(`Vereadores: ${c.vereadores.length}`);
  for (const [ano, l] of Object.entries(c.cardsPorAno)) console.log(`Proposituras ${ano}: ${l.length}`);
  console.log(`Tabelas de presença: ${c.presencas.length} (linhas: ${[...new Set(c.presencas.map((p) => p.linhas.length))].join(', ')})`);
  for (const v of c.votacoes) console.log(`Votações ${v.ano}: ${v.blocos.length} projetos`);
  console.log(`Receitas: ${c.receitas ? `${Object.keys(c.receitas).length} meses publicados` : 'não coletadas'}`);
  console.log(`Despesas: ${c.despesas ? `${Object.keys(c.despesas).length} meses publicados` : 'não coletadas'}`);
  console.log(`SICONFI: ${c.siconfi ? Object.entries(c.siconfi).map(([a, s]) => `${a} bimestre ${s.bimestre}`).join(', ') || 'nada' : 'não coletado'}`);
  console.log(`Origem do dinheiro (MSC): ${Object.entries(c.origem.anos).map(([a, x]) => `${a} ${x.tipo} mês ${x.mes}`).join(', ') || 'nada'}`);
  console.log(`Fotos: ${Object.keys(c.fotos).length} de ${c.vereadores.length}`);
  console.log(`Folha da Câmara: ${Object.keys(c.folhaCamara).length} meses; respostas conferidas: ${Object.keys(c.respostas).length}`);
  console.log(`Prefeitura: IEGM ${c.iegm ? Object.keys(c.iegm.anos).length : 0} anos; obras ${c.obras ? c.obras.obras.length : 0}; contratos ${Object.keys(c.contratos).join(', ') || 'nenhum'}`);
  const of = c.obrasFontes || {};
  console.log(`Obras: PNCP ${of.pncp ? `${Object.keys(of.pncp.contratacoes).length} licitações, ${Object.keys(of.pncp.contratos).length} contratos candidatos` : 'sem dado'}; Obrasgov.br ${of.obrasgov ? Object.keys(of.obrasgov.projetos).length : 0} projetos; paralisadas na Prefeitura ${of.paralisadas ? of.paralisadas.obras.length : 0} (${Math.round(c.duracaoObrasMs / 1000)} s)`);
  for (const a of c.avisosFontes) console.log(`Aviso: ${a}`);
  for (const a of c.avisosManutencao) console.log(`Manutenção: ${a}`);
}
