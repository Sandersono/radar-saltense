// Peças comuns das verificações de manutenção (OPERACAO.md, seção 11).
// Cada verificação roda no seu próprio workflow, com o seu horário e o seu rótulo de issue (manutencao-<nome>).
// Nenhuma delas mexe no site, nos dados ou no robô diário: só leem e abrem, comentam ou fecham um issue.
// DRY_RUN=1: mostra o corpo do issue em vez de chamar o gh.
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const AGENTE = 'radar-saltense-manutencao (+https://radarsaltense.com.br/sobre.html)';
export const diaSP = (instante) => new Date(instante).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
export const dataBR = (iso) => String(iso).slice(0, 10).split('-').reverse().join('/');
export const numeroBR = (n) => Number(n).toLocaleString('pt-BR');
export const lerJson = async (caminho) => JSON.parse(await readFile(caminho, 'utf8'));
export const agoraIso = () => process.env.AGORA || new Date().toISOString();

// Corpo do issue: a 1ª linha tem a data (fica de fora da comparação), depois o conteúdo.
export const montarCorpo = (agora, linhas) => [`Verificação de ${dataBR(diaSP(agora))}.`, '', ...linhas, '', 'O que fazer em cada caso: OPERACAO.md, seção 11.'].join('\n');

// O conteúdo mudou? Ignora a 1ª linha (data), as menções sozinhas na linha (@dono) e espaços nas pontas.
export function mudou(anterior, novo) {
  const limpar = (t) => String(t ?? '').replace(/\r/g, '').split('\n').slice(1).filter((l) => !/^@\S+$/.test(l.trim())).join('\n').trim();
  return limpar(anterior) !== limpar(novo);
}

// GET de JSON com prazo, identificação e uma nova tentativa (depois de uma espera) em erro de rede, 429 ou 5xx.
export async function buscarJson(url, { prazo = 30000, tentativas = 2, espera = 15000, aceitar = 'application/json' } = {}) {
  let ultimo;
  for (let t = 1; t <= tentativas; t++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(prazo), headers: { 'user-agent': AGENTE, accept: aceitar } });
      if (r.ok) return await r.json();
      ultimo = new Error(`${url} respondeu ${r.status}`);
      if (r.status !== 429 && r.status < 500) break;
    } catch (e) { ultimo = e; }
    if (t < tentativas) await new Promise((ok) => setTimeout(ok, espera));
  }
  throw ultimo;
}

const gh = (args) => execFileSync('gh', args, { encoding: 'utf8' });

// precisa = true: abre o issue (ou comenta no aberto, só se o conteúdo mudou). precisa = false: fecha o aberto, se houver.
export async function publicar({ nome, titulo, texto, precisa, agora }) {
  const rotulo = `manutencao-${nome}`;
  if (process.env.DRY_RUN) {
    console.log(`\n[DRY_RUN] rótulo ${rotulo}: ${precisa ? `abriria o issue "${titulo}" (ou comentaria no aberto, se o conteúdo mudou)` : 'fecharia o issue aberto, se houver'}.`);
    return;
  }
  gh(['label', 'create', rotulo, '--color', 'FBCA04', '--description', `Verificação de manutenção: ${nome}`, '--force']);
  const abertos = JSON.parse(gh(['issue', 'list', '--label', rotulo, '--state', 'open', '--json', 'number']));
  const aberto = abertos.length ? String(abertos[0].number) : null;
  if (!precisa) {
    // Fecha todos os abertos com o rótulo (pode haver um alerta e um "a verificação falhou").
    for (const i of abertos) gh(['issue', 'close', String(i.number), '--comment', `Tudo certo na verificação de ${dataBR(diaSP(agora))}. Encerrado.`]);
    return;
  }
  const arquivo = join(await mkdtemp(join(tmpdir(), 'manutencao-')), 'corpo.md');
  if (aberto) {
    const v = JSON.parse(gh(['issue', 'view', aberto, '--json', 'body,comments']));
    const anterior = v.comments && v.comments.length ? v.comments[v.comments.length - 1].body : v.body;
    if (mudou(anterior, texto)) {
      await writeFile(arquivo, texto);
      gh(['issue', 'comment', aberto, '--body-file', arquivo]);
    }
    gh(['issue', 'edit', aberto, '--title', titulo]);
  } else {
    const dono = process.env.DONO || process.env.GITHUB_REPOSITORY_OWNER;
    await writeFile(arquivo, dono ? `${texto}\n\n@${dono}\n` : texto);
    gh(['issue', 'create', '--title', titulo, '--label', rotulo, '--body-file', arquivo]);
  }
}
