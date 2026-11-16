import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { anos, ANO_INICIO } from './config.js';
import { coletarVereadores } from './coleta/vereadores.js';
import { coletarProposituras } from './coleta/proposituras.js';
import { coletarPresencas } from './coleta/presenca.js';
import { coletarVotacoes } from './coleta/votacoes.js';
import { salvar } from './coleta/http.js';
import { coletarReceitas } from './coleta/receitas.js';
import { coletarDespesas } from './coleta/despesas.js';
import { coletarSiconfi } from './coleta/siconfi.js';
import { coletarFotos } from './coleta/fotos.js';
import { coletarFolha } from './coleta/folha-camara.js';
import { coletarRespostas } from './coleta/respostas.js';
import { coletarIegm, listarAnosIegm } from './coleta/iegm.js';
import { coletarObras } from './coleta/obras.js';
import { coletarContratos } from './coleta/contratos.js';
import { mesclarIegm, mesclarContratos, escolherObras, dataBaseMaisVelha, anosParaColetar, decidirAnoContratos } from './regras/prefeitura.js';
import { lerCard } from './regras/apex.js';
import { mesclarFolha } from './regras/folha.js';
import { filaRespostas } from './regras/respostas.js';
import { anoMesBR } from './util/texto.js';

const ORCAMENTO_RESPOSTAS = 150;
const PRAZO_CONTRATOS_MS = 6 * 60 * 1000;
const PRAZO_PENTAHO_MS = 3 * 60 * 1000;
const PRAZO_RECEITAS_MS = 4 * 60 * 1000;
const PRAZO_DESPESAS_MS = 6 * 60 * 1000;
const PRAZO_SICONFI_MS = 3 * 60 * 1000;
// Mensagens do Playwright trazem o registro de chamadas em várias linhas; só a primeira vai para o site.
const primeiraLinha = (m) => String(m).split('\n')[0].trim();
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

// Nota do TCE: o robô só refaz a lista de anos e o ano-base mais novo; os anos antigos ficam como estão.
async function iegmDoTce(salvo, avisos) {
  try {
    const anos = await listarAnosIegm({ prazoMs: PRAZO_PENTAHO_MS });
    if (!anos.length) throw new Error('lista de anos vazia');
    return mesclarIegm(salvo, await coletarIegm([anos[0]], { prazoMs: PRAZO_PENTAHO_MS }));
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
  const cnpjs2024 = JSON.parse(await readFile('data/referencia/cnpjs-pagos-2024.json', 'utf8'));
  const folhaSalva = await lerJson('data/processado/folha-camara.json', {}, avisosFontes);
  const respostasSalvas = await lerJson('data/processado/respostas.json', {}, avisosFontes);
  const campanha = await lerJson('data/referencia/campanha-2024.json', null, avisosFontes);
  const iegmSalvo = await lerJson('data/processado/iegm.json', null, avisosFontes);
  const obrasSalvas = await lerJson('data/processado/obras.json', null, avisosFontes);
  const contratosSalvos = await lerJson('data/processado/contratos.json', {}, avisosFontes);
  const iegm = await iegmDoTce(iegmSalvo, avisosFontes);
  const obras = await obrasDoTce(obrasSalvas, avisosFontes);
  const { contratos, duracaoMs: duracaoPncpMs } = await contratosDoPncp(contratosSalvos, hoje, avisosFontes);
  const folhaCamara = await folhaDaCamara(vereadores.map(({ id, nome, apelido }) => ({ id, nome, apelido })), hoje, folhaSalva, avisosFontes);
  const respostas = await respostasDaCamara(cardsPorAno, respostasSalvas, avisosFontes);
  const coleta = { vereadores, cardsPorAno, presencas, votacoes, receitas, despesas, siconfi, cnpjs2024, fotos, avisosFotos, folhaCamara, respostas, campanha, iegm, obras, contratos, duracaoPncpMs, avisosFontes, coletadoEm: new Date().toISOString() };
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
  console.log(`Fotos: ${Object.keys(c.fotos).length} de ${c.vereadores.length}`);
  console.log(`Folha da Câmara: ${Object.keys(c.folhaCamara).length} meses; respostas conferidas: ${Object.keys(c.respostas).length}`);
  console.log(`Prefeitura: IEGM ${c.iegm ? Object.keys(c.iegm.anos).length : 0} anos; obras ${c.obras ? c.obras.obras.length : 0}; contratos ${Object.keys(c.contratos).join(', ') || 'nenhum'}`);
  for (const a of c.avisosFontes) console.log(`Aviso: ${a}`);
}
