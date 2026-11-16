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
import { lerCard } from './regras/apex.js';
import { mesclarFolha } from './regras/folha.js';
import { filaRespostas } from './regras/respostas.js';
import { anoMesBR } from './util/texto.js';

const ORCAMENTO_RESPOSTAS = 150;
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

export async function coletarTudo() {
  const lista = anos();
  const anoAtual = lista[lista.length - 1];
  const vereadores = await coletarVereadores();
  const { fotos, avisos: avisosFotos } = await coletarFotos(vereadores);
  const cardsPorAno = await coletarProposituras(lista, anoAtual);
  const presencas = await coletarPresencas(lista, anoAtual);
  const votacoes = await coletarVotacoes(lista, anoAtual);
  const hoje = anoMesBR();
  const receitas = await coletarReceitas(hoje.ano, hoje.mes);
  const despesas = await coletarDespesas(hoje.ano, hoje.mes);
  const siconfi = await coletarSiconfi(hoje.ano);
  const cnpjs2024 = JSON.parse(await readFile('data/referencia/cnpjs-pagos-2024.json', 'utf8'));
  const avisosFontes = [];
  const folhaSalva = await lerJson('data/processado/folha-camara.json', {}, avisosFontes);
  const respostasSalvas = await lerJson('data/processado/respostas.json', {}, avisosFontes);
  const campanha = await lerJson('data/referencia/campanha-2024.json', null, avisosFontes);
  const folhaCamara = await folhaDaCamara(vereadores.map(({ id, nome, apelido }) => ({ id, nome, apelido })), hoje, folhaSalva, avisosFontes);
  const respostas = await respostasDaCamara(cardsPorAno, respostasSalvas, avisosFontes);
  const coleta = { vereadores, cardsPorAno, presencas, votacoes, receitas, despesas, siconfi, cnpjs2024, fotos, avisosFotos, folhaCamara, respostas, campanha, avisosFontes, coletadoEm: new Date().toISOString() };
  await salvar('data/bruto/coleta.json', JSON.stringify(coleta));
  return coleta;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const c = await coletarTudo();
  console.log(`Vereadores: ${c.vereadores.length}`);
  for (const [ano, l] of Object.entries(c.cardsPorAno)) console.log(`Proposituras ${ano}: ${l.length}`);
  console.log(`Tabelas de presença: ${c.presencas.length} (linhas: ${[...new Set(c.presencas.map((p) => p.linhas.length))].join(', ')})`);
  for (const v of c.votacoes) console.log(`Votações ${v.ano}: ${v.blocos.length} projetos`);
  console.log(`Receitas: ${Object.keys(c.receitas).length} meses publicados`);
  console.log(`Despesas: ${Object.keys(c.despesas).length} meses publicados`);
  console.log(`SICONFI: ${Object.entries(c.siconfi).map(([a, s]) => `${a} bimestre ${s.bimestre}`).join(', ') || 'nada'}`);
  console.log(`Fotos: ${Object.keys(c.fotos).length} de ${c.vereadores.length}`);
  console.log(`Folha da Câmara: ${Object.keys(c.folhaCamara).length} meses; respostas conferidas: ${Object.keys(c.respostas).length}`);
  for (const a of c.avisosFontes) console.log(`Aviso: ${a}`);
}
