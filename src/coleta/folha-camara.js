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

async function selecionar(p, seletor, valor) {
  await p.selectOption(seletor, valor);
  await p.waitForLoadState('networkidle');
  await p.waitForTimeout(1500);
  const atual = await p.locator(seletor).inputValue();
  if (atual !== valor) throw new Error(`Portal da Câmara: ${seletor} ficou em "${atual}" em vez de "${valor}"`);
}

const aparece = (loc) => loc.waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false);

function decodificar(buf) {
  const utf8 = buf.toString('utf8');
  return utf8.includes('�') ? buf.toString('latin1') : utf8;
}

// Devolve o texto do CSV da folha do mês, ou null se o mês não tem folha publicada.
async function csvDoMes(p, ano, mes) {
  await carregar(p);
  await selecionar(p, '#GLOBAL_EXERCICIO', String(ano));
  await selecionar(p, '#P8_MES', String(mes));
  await selecionar(p, '#P8_TIPO_INFO', '3');
  await aguardarVez();
  try {
    await p.click(BOTAO_PESQUISAR);
    await p.waitForLoadState('networkidle');
    await p.waitForTimeout(1500);
    const detalhar = p.locator(...LINK_DETALHAR).first();
    if (!(await aparece(detalhar))) return null;
    await detalhar.click();
    await p.waitForLoadState('networkidle');
    await p.waitForTimeout(2000);
    const csv = p.locator(...LINK_CSV).last();
    if (!(await aparece(csv))) return null;
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
      resultado[aaaamm] = linhas.length ? resumirFolha(linhas, vereadores) : null;
      console.error(`folha ${aaaamm}: ${linhas.length ? linhas.length + ' linhas' : 'sem folha'}`);
    }
  } finally {
    await navegador.close();
  }
  return resultado;
}
