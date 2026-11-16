import { readFile, rm } from 'node:fs/promises';
import { chromium } from 'playwright';
import { UA } from '../config.js';
import { aguardarVez, marcarFim } from './http.js';
import { lerCsvFolha, resumirFolha } from '../regras/folha.js';

const URL_RH = 'https://cmsalto.sisvetor.com.br/ords/cmsalto/f?p=839:8';

// Seletores do Portal da Transparência da Câmara (Oracle APEX, app 839, página 8 "Recursos Humanos"):
//   #GLOBAL_EXERCICIO  ano (a mudança recarrega a página)
//   #P8_MES            mês, valores "1".."12"
//   #P8_TIPO_INFO      "3" = Geral
//   #B137830017131526819  botão "Pesquisar" (único id fixo; os demais controles são achados pelo texto)
//   link "Detalhar"    abre o detalhamento (folha completa do mês) numa janela sobre a página
//   link "CSV"         exportação do relatório de detalhe (o último da página é o do detalhe)
const BOTAO_PESQUISAR = '#B137830017131526819';
const LINK_DETALHAR = ['a', { hasText: /^\s*detalhar\s*$/i }];
const LINK_CSV = ['a', { hasText: /^\s*CSV\s*$/ }];

async function carregar(p) {
  await aguardarVez();
  try {
    await p.goto(URL_RH, { waitUntil: 'networkidle', timeout: 60000 });
  } finally {
    marcarFim();
  }
  // O portal lembra a última pesquisa na sessão e reabre o detalhe: fechar para liberar o formulário.
  const fechar = p.getByText('Fechar', { exact: true }).first();
  if (await fechar.isVisible().catch(() => false)) {
    await fechar.click();
    await p.waitForTimeout(800);
  }
}

async function selecionar(p, seletor, valor, recarrega = false) {
  if (recarrega) await p.evaluate(() => { window.__folhaMarca = 1; });
  await p.selectOption(seletor, valor);
  if (recarrega) await p.waitForFunction(() => !window.__folhaMarca, null, { timeout: 30000 });
  await p.waitForLoadState('networkidle');
  const atual = await p.locator(seletor).inputValue();
  if (atual !== valor) throw new Error(`Portal da Câmara: ${seletor} ficou em "${atual}" em vez de "${valor}"`);
}

function decodificar(buf) {
  const utf8 = buf.toString('utf8');
  return utf8.includes(String.fromCharCode(0xfffd)) ? buf.toString('latin1') : utf8;
}

const SEM_DADOS = /dados n[aã]o encontrados/i;

// Clica e espera a página de fato recarregar (a marca em window some quando o APEX recarrega o documento).
async function clicarERecarregar(p, loc) {
  await p.evaluate(() => { window.__folhaMarca = 1; });
  await loc.click();
  await p.waitForFunction(() => !window.__folhaMarca, null, { timeout: 30000 });
  await p.waitForLoadState('networkidle');
}

// Espera um dos dois desfechos; lança se nenhum aparecer (falha/timeout não é "sem folha").
async function desfecho(p, alvo, rotulo) {
  const achou = await Promise.race([
    alvo.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'ok', () => null),
    p.getByText(SEM_DADOS).first().waitFor({ state: 'visible', timeout: 20000 }).then(() => 'vazio', () => null),
  ]);
  if (achou) return achou;
  throw new Error(`nem ${rotulo} nem a mensagem de "dados não encontrados" apareceram em 20 s`);
}

// Devolve o texto do CSV da folha do mês, ou null se o portal diz "dados não encontrados".
async function csvDoMes(p, ano, mes) {
  await carregar(p);
  await selecionar(p, '#GLOBAL_EXERCICIO', String(ano), true);
  await selecionar(p, '#P8_MES', String(mes));
  await selecionar(p, '#P8_TIPO_INFO', '3');
  for (const [sel, v] of [['#GLOBAL_EXERCICIO', ano], ['#P8_MES', mes], ['#P8_TIPO_INFO', 3]]) {
    const atual = await p.locator(sel).inputValue();
    if (atual !== String(v)) throw new Error(`${sel} ficou em "${atual}" em vez de "${v}" antes de pesquisar`);
  }
  await aguardarVez();
  try {
    await clicarERecarregar(p, p.locator(BOTAO_PESQUISAR));
    const detalhar = p.locator(...LINK_DETALHAR).first();
    if ((await desfecho(p, detalhar, 'o link Detalhar')) === 'vazio') return null;
    await clicarERecarregar(p, detalhar);
    const csv = p.locator(...LINK_CSV).last();
    if ((await desfecho(p, csv, 'o link CSV')) === 'vazio') return null;
    const [download] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), csv.click()]);
    const arquivo = await download.path();
    try {
      return decodificar(await readFile(arquivo));
    } finally {
      await rm(arquivo, { force: true }); // o arquivo tem nomes de pessoas: não fica em disco
    }
  } finally {
    marcarFim();
  }
}

export async function coletarFolha(meses, vereadores) {
  const navegador = await chromium.launch({ headless: true });
  const resultado = {};
  try {
    const p = await navegador.newPage({ userAgent: UA, acceptDownloads: true });
    for (const aaaamm of meses) {
      const [ano, mes] = aaaamm.split('-').map(Number);
      let texto;
      try {
        texto = await csvDoMes(p, ano, mes);
      } catch (e) {
        throw new Error(`Folha da Câmara ${aaaamm}: formulário do portal mudou ou não respondeu (${e.message})`);
      }
      const linhas = texto ? lerCsvFolha(texto) : [];
      const fora = linhas.find((l) => String(l['Ano']).trim() !== String(ano));
      if (fora) throw new Error(`Folha da Câmara ${aaaamm}: o CSV veio com Ano "${fora['Ano']}" em vez de ${ano}`);
      resultado[aaaamm] = linhas.length ? resumirFolha(linhas, vereadores) : null;
      console.error(`folha ${aaaamm}: ${linhas.length ? linhas.length + ' linhas' : 'sem folha'}`);
    }
  } finally {
    await navegador.close();
  }
  return resultado;
}
