// Sentinela: confere todo dia, depois do horário reserva, se as rotinas do Radar Saltense rodaram e se o site está certo.
// Se algo estiver errado, o workflow sentinela.yml abre (ou atualiza) um alerta no GitHub, que chega por e-mail ao dono.
// Ver OPERACAO.md.
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ENDERECO = 'https://radarsaltense.com.br/';
export const PAGINAS = ['', 'camara.html', 'prefeitura.html', 'obras.html', 'semana.html', 'bairros.html', 'impostometro.html', 'gastos.html', 'sitemap.xml', 'feed.xml'];
export const MIN_URLS_SITEMAP = 150;
const NOME_COMPLETA = 'Atualizar Radar Saltense';

export const diaSP = (instante) => new Date(instante).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const horaUTC = (instante) => new Date(instante).getUTCHours();
const dataBR = (iso) => iso.split('-').reverse().join('/');

// execucoes: gh run list (createdAt, event, conclusion, displayTitle, status); paginas: { caminho: { status, texto } };
// dados: data/processado/dados.json; agora: instante ISO. Devolve problemas (erro) e atencao (algo a fazer, sem erro).
export function avaliar({ execucoes, paginas, dados, agora }) {
  const problemas = [];
  const atencao = [];
  const hoje = diaSP(agora);
  const deHoje = (execucoes || []).filter((e) => e.displayTitle === NOME_COMPLETA && diaSP(e.createdAt) === hoje);
  const ok = deHoje.filter((e) => e.conclusion === 'success');
  const andando = deHoje.filter((e) => ['in_progress', 'queued', 'waiting', 'requested', 'pending'].includes(e.status));
  if (!ok.length && andando.length) {
    atencao.push('A atualização de hoje ainda está rodando (o GitHub atrasou o horário). A sentinela confere de novo amanhã; se quiser, veja a aba Actions mais tarde.');
  } else if (!ok.length) {
    const falhas = deHoje.filter((e) => e.status === 'completed' && e.conclusion && e.conclusion !== 'success' && e.conclusion !== 'skipped');
    problemas.push(`Nenhuma atualização completa deu certo hoje (${dataBR(hoje)}).${falhas.length ? ` ${falhas.length} tentativa(s) falharam: veja a aba Actions e o relatório "conferencia".` : ' Nenhuma tentativa foi registrada.'}`);
  } else if (!ok.some((e) => e.event === 'workflow_dispatch' && horaUTC(e.createdAt) < 7)) {
    atencao.push('A atualização de hoje não veio do despertador da VPS (03:00): rodou pela reserva do GitHub. Veja /var/log/radar-saltense-despertador.log na VPS.');
  }
  for (const [caminho, p] of Object.entries(paginas || {})) {
    if (!p || p.status !== 200) problemas.push(`Página ${caminho || 'inicial'} fora do ar (resposta ${p ? p.status : 'nenhuma'}).`);
  }
  const inicial = paginas && paginas[''];
  if (inicial && inicial.status === 200) {
    const m = inicial.texto.match(/Atualizado em (\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) problemas.push('A página inicial não mostra a data de atualização.');
    else if (ok.length && `${m[3]}-${m[2]}-${m[1]}` !== hoje) problemas.push(`O robô rodou hoje, mas o site publicado ainda mostra a atualização de ${m[1]}/${m[2]}/${m[3]}: a publicação pode ter falhado.`);
  }
  const mapa = paginas && paginas['sitemap.xml'];
  if (mapa && mapa.status === 200) {
    const n = (mapa.texto.match(/<url>/g) || []).length;
    if (n < MIN_URLS_SITEMAP) problemas.push(`O sitemap tem só ${n} páginas (esperado pelo menos ${MIN_URLS_SITEMAP}).`);
  }
  for (const a of (dados && dados.avisosManutencao) || []) {
    if (/\(0 dias?\)/.test(a)) continue; // dado do TCE do próprio dia: não é problema
    atencao.push(`Manutenção: ${a}`);
  }
  return { problemas, atencao };
}

export function relatorioSentinela({ problemas, atencao }, agora) {
  const l = [`Verificação de ${dataBR(diaSP(agora))}.`, ''];
  if (problemas.length) l.push('**Problemas (precisam de correção):**', ...problemas.map((p) => `- ${p}`), '');
  if (atencao.length) l.push('**Atenção (algo a fazer, o site está no ar):**', ...atencao.map((a) => `- ${a}`), '');
  if (!problemas.length && !atencao.length) l.push('Tudo certo.');
  l.push('', 'O que cada item significa e o que fazer: OPERACAO.md, no repositório.');
  return l.join('\n');
}

async function principal() {
  const agora = new Date().toISOString();
  const execucoes = JSON.parse(execFileSync('gh', ['run', 'list', '--workflow', 'atualizar.yml', '--limit', '30', '--json', 'createdAt,event,conclusion,displayTitle,status'], { encoding: 'utf8' }));
  const paginas = {};
  for (const caminho of PAGINAS) {
    try {
      const r = await fetch(`${ENDERECO}${caminho}?sentinela=${Date.now()}`, { signal: AbortSignal.timeout(30000), headers: { 'user-agent': 'radar-saltense-sentinela' } });
      paginas[caminho] = { status: r.status, texto: await r.text() };
    } catch (e) {
      paginas[caminho] = { status: `erro: ${e.message}`, texto: '' };
    }
  }
  let dados = null;
  try { dados = JSON.parse(await readFile('data/processado/dados.json', 'utf8')); } catch { /* sem dados: só os outros itens */ }
  const resultado = avaliar({ execucoes, paginas, dados, agora });
  await writeFile('sentinela.md', relatorioSentinela(resultado, agora));
  console.log(relatorioSentinela(resultado, agora));
  // "erro" = há problema; "atencao" = só itens de manutenção; "ok" = nada.
  const estado = resultado.problemas.length ? 'erro' : resultado.atencao.length ? 'atencao' : 'ok';
  if (process.env.GITHUB_OUTPUT) await writeFile(process.env.GITHUB_OUTPUT, `estado=${estado}\n`, { flag: 'a' });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await principal();
