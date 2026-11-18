// OpenStreetMap como referência AUXILIAR de bairros e ruas: serve para sugerir e conferir, nunca como fonte oficial.
// Funções puras: src/ferramentas/osm.js (npm run osm) baixa do Overpass, chama estas funções e grava os arquivos.
// Os dados OSM (© colaboradores do OpenStreetMap, ODbL 1.0) ficam em data/osm/, separados de data/referencia,
// e o site não mostra nada deles. Pesquisa: .superpowers/pesquisa/osm-bairros.md.

export const RELACAO_SALTO = 298520; // boundary=administrative, admin_level=8, IBGE:GEOCODIGO=3545209
export const LICENCA = 'Dados © colaboradores do OpenStreetMap, sob a Open Database License 1.0 (https://www.openstreetmap.org/copyright). Mantido separado de data/referencia por causa da ODbL. Referência auxiliar, não oficial: serve para sugerir e conferir, nunca para afirmar o bairro oficial de uma rua.';

// ---------- nomes

const semAcento = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
const ABREV = {
  jd: 'jardim', jdm: 'jardim', res: 'residencial', resid: 'residencial', cond: 'condominio', pq: 'parque', vl: 'vila',
  cj: 'conjunto', ch: 'chacara', chac: 'chacaras', distr: 'distrito', indl: 'industrial', sta: 'santa', sto: 'santo',
  lot: 'loteamento', n: 'nossa', sra: 'senhora',
};
const ROMANOS = { 1: 'i', 2: 'ii', 3: 'iii', 4: 'iv', 5: 'v' };
const GENERICOS = new Set(['bairro', 'jardim', 'jardins', 'vila', 'residencial', 'condominio', 'fechado', 'conjunto', 'habitacional',
  'loteamento', 'parque', 'chacara', 'chacaras', 'urbanizacao', 'de', 'da', 'do', 'das', 'dos', 'e', 'd', 'recreio']);

// Sem acento e caixa, abreviações desfeitas, pontuação vira espaço, "1".."5" viram romanos.
export function normNome(s) {
  return semAcento(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean)
    .map((w) => ABREV[w] || ROMANOS[w] || w).join(' ');
}
// Sem as palavras genéricas do começo ("Jardim", "Residencial", "Condomínio Fechado"...): "Jardim D'Icaraí" -> "icarai".
export function nucleoNome(s) {
  const w = normNome(s).split(' ');
  while (w.length > 1 && GENERICOS.has(w[0])) w.shift();
  return w.join(' ');
}
// Palavras genéricas do começo que não mudam o lugar ("Bairro Guaraú" = "Guaraú"); as outras ("Jardim", "Parque",
// "Vila", "Chácara") distinguem lugares: "Jardim Imperial" e "Parque Imperial" são dois loteamentos.
const NEUTROS = new Set(['bairro', 'residencial', 'condominio', 'fechado', 'conjunto', 'habitacional', 'loteamento', 'urbanizacao', 'recreio', 'de', 'da', 'do', 'das', 'dos', 'e', 'd']);
function prefixos(s) {
  const w = normNome(s).split(' ');
  const p = [];
  while (w.length > 1 && GENERICOS.has(w[0])) p.push(w.shift().replace(/s$/, ''));
  return new Set(p.filter((x) => !NEUTROS.has(x) && !NEUTROS.has(`${x}s`)));
}
const contem = (a, b) => [...b].every((x) => a.has(x));
const prefixosCompativeis = (a, b) => { const x = prefixos(a), y = prefixos(b); return contem(x, y) || contem(y, x); };
const semFaseI = (s) => s.replace(/ i$/, ''); // "Jardim Celani I" = "Jardim Celani"
const semCondominio = (s) => normNome(s).replace(/^condominio (fechado )?/, '');
const semRomanoFinal = (s) => s.replace(/ (i|ii|iii|iv|v)$/, '');
const numeros = (s) => s.split(' ').filter((w) => /^\d+$|^[ivx]+$/.test(w)).join(' ');

// Distância de edição com transposição (Gabrile -> Gabriel conta 1).
export function distancia(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[m][n];
}

// Ordem de confiança dos casamentos. "contido" é fraco: só serve de pista.
export const NIVEIS = ['exato', 'nucleo', 'numeral', 'grafia', 'contido'];
const TESTES = {
  exato: (a, b) => normNome(a) === normNome(b) || semCondominio(a) === semCondominio(b),
  nucleo: (a, b) => semFaseI(nucleoNome(a)) === semFaseI(nucleoNome(b)) && prefixosCompativeis(a, b),
  numeral: (a, b) => semRomanoFinal(nucleoNome(a)) === semRomanoFinal(nucleoNome(b)) && prefixosCompativeis(a, b),
  grafia: (a, b) => {
    if (!prefixosCompativeis(a, b)) return false;
    const x = nucleoNome(a), y = nucleoNome(b);
    if (Math.min(x.length, y.length) < 6 || numeros(x) !== numeros(y)) return false;
    return distancia(x, y) <= (Math.min(x.length, y.length) < 10 ? 1 : 2);
  },
  contido: (a, b) => {
    const x = nucleoNome(a), y = nucleoNome(b);
    const dentro = (p, q) => p.length >= 6 && ` ${q} `.includes(` ${p} `);
    return dentro(x, y) || dentro(y, x);
  },
};

// Melhor correspondência de um nome numa lista: { nivel, com } ou null. No mesmo nível, o mais parecido por inteiro.
export function casarNome(nome, lista) {
  for (const nivel of NIVEIS) {
    const candidatos = lista.filter((x) => TESTES[nivel](nome, x));
    if (candidatos.length) {
      candidatos.sort((a, b) => distancia(normNome(a), normNome(nome)) - distancia(normNome(b), normNome(nome)));
      return { nivel, com: candidatos[0] };
    }
  }
  return null;
}
// Vários nomes do mesmo lugar (nome, alt_name...): fica o casamento de nível mais confiável.
export function casarAlgum(nomes, lista) {
  let melhor = null;
  for (const n of nomes) {
    const c = casarNome(n, lista);
    if (c && (!melhor || NIVEIS.indexOf(c.nivel) < NIVEIS.indexOf(melhor.nivel))) melhor = c;
  }
  return melhor;
}
// Mesmo nome escrito do mesmo jeito (ignora caixa, acento e pontuação, não ignora palavras).
const mesmaGrafia = (a, b) => normNome(a) === normNome(b);

// ---------- geometria (graus; a escala de um município permite cálculo plano)

const chavePonto = (p) => `${p.lat.toFixed(7)},${p.lon.toFixed(7)}`;
const fechado = (g) => g.length > 3 && chavePonto(g[0]) === chavePonto(g[g.length - 1]);

// Junta trechos de contorno em anéis fechados (sobras abertas são descartadas).
export function aneis(trechos) {
  const resto = trechos.map((t) => t.slice());
  const saida = [];
  while (resto.length) {
    let anel = resto.shift();
    let cresceu = true;
    while (!fechado(anel) && cresceu) {
      cresceu = false;
      for (let i = 0; i < resto.length; i++) {
        const t = resto[i];
        const fim = chavePonto(anel[anel.length - 1]), ini = chavePonto(anel[0]);
        if (chavePonto(t[0]) === fim) anel = anel.concat(t.slice(1));
        else if (chavePonto(t[t.length - 1]) === fim) anel = anel.concat(t.slice().reverse().slice(1));
        else if (chavePonto(t[t.length - 1]) === ini) anel = t.concat(anel.slice(1));
        else if (chavePonto(t[0]) === ini) anel = t.slice().reverse().concat(anel.slice(1));
        else continue;
        resto.splice(i, 1);
        cresceu = true;
        break;
      }
    }
    if (fechado(anel)) saida.push(anel);
  }
  return saida;
}

function dentroAnel(lat, lon, anel) {
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const a = anel[i], b = anel[j];
    if ((a.lat > lat) !== (b.lat > lat) && lon < ((b.lon - a.lon) * (lat - a.lat)) / (b.lat - a.lat) + a.lon) dentro = !dentro;
  }
  return dentro;
}
export const dentroPoligono = (lat, lon, pol) => pol.externos.some((r) => dentroAnel(lat, lon, r)) && !pol.internos.some((r) => dentroAnel(lat, lon, r));

// Polígono de um elemento do Overpass ("out geom"): way fechado ou relação com membros. null se não fechar.
export function poligonoDe(e) {
  if (e.type === 'way') return e.geometry && fechado(e.geometry) ? { externos: [e.geometry], internos: [] } : null;
  if (e.type === 'relation' && Array.isArray(e.members)) {
    const ways = e.members.filter((m) => m.type === 'way' && Array.isArray(m.geometry));
    const externos = aneis(ways.filter((m) => m.role !== 'inner').map((m) => m.geometry));
    const internos = aneis(ways.filter((m) => m.role === 'inner').map((m) => m.geometry));
    return externos.length ? { externos, internos } : null;
  }
  return null;
}

// Centróide ponderado pela área (área em graus², só para comparar tamanhos).
export function centroide(pol) {
  let area = 0, lat = 0, lon = 0;
  for (const r of pol.externos) {
    let a = 0, x = 0, y = 0;
    for (let i = 0; i < r.length - 1; i++) {
      const p = r[i], q = r[i + 1];
      const f = p.lon * q.lat - q.lon * p.lat;
      a += f; x += (p.lon + q.lon) * f; y += (p.lat + q.lat) * f;
    }
    a /= 2;
    if (!a) continue;
    area += Math.abs(a); lat += (y / (6 * a)) * Math.abs(a); lon += (x / (6 * a)) * Math.abs(a);
  }
  return area ? { lat: lat / area, lon: lon / area, area } : null;
}

export function metros(a, b) {
  const r = Math.PI / 180;
  return 6371000 * Math.hypot((b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r), (b.lat - a.lat) * r);
}

// Ponto no meio do comprimento de uma linha, e o comprimento em metros.
export function pontoMedio(g) {
  const partes = [];
  let total = 0;
  for (let i = 1; i < g.length; i++) { const d = metros(g[i - 1], g[i]); partes.push(d); total += d; }
  let feito = 0;
  for (let i = 0; i < partes.length; i++) {
    if (feito + partes[i] >= total / 2) {
      const f = partes[i] ? (total / 2 - feito) / partes[i] : 0;
      return { lat: g[i].lat + (g[i + 1].lat - g[i].lat) * f, lon: g[i].lon + (g[i + 1].lon - g[i].lon) * f, comprimento: total };
    }
    feito += partes[i];
  }
  return { lat: g[0].lat, lon: g[0].lon, comprimento: total };
}

// ---------- montagem do arquivo data/osm/salto.json

const r5 = (x) => Math.round(x * 1e5) / 1e5;
const idOsm = (e) => `${e.type[0]}${e.id}`;
const ordemPt = (a, b) => a.localeCompare(b, 'pt');

function tipoLugar(t) {
  if (t.place) return `place=${t.place}`;
  if (t.boundary) return `admin_level=${t.admin_level}`;
  return `landuse=residential${t.residential ? `/${t.residential}` : ''}`;
}

// lugares: elementos da consulta de bairros; limiteRuas: relação do município + ruas; enderecos: elementos com addr:suburb.
// Lança erro se o limite do município não vier (sem ele nada pode ser filtrado).
export function montarSalto({ lugares, limiteRuas, enderecos = [], extraidoEm }) {
  const rel = limiteRuas.find((e) => e.type === 'relation' && e.id === RELACAO_SALTO);
  const limite = rel && poligonoDe(rel);
  if (!limite) throw new Error(`limite do município (relação ${RELACAO_SALTO}) não veio ou não fecha.`);
  const emSalto = (p) => dentroPoligono(p.lat, p.lon, limite);

  const itens = [];
  const foraDoLimite = [];
  const semNome = [];
  const abertos = [];
  for (const e of lugares) {
    const t = e.tags || {};
    if (t.boundary === 'administrative' && t.admin_level === '9') continue; // distrito-sede: o município inteiro
    if (!t.name) { semNome.push(idOsm(e)); continue; }
    let geom, c, pol = null;
    if (e.type === 'node') { geom = 'ponto'; c = { lat: e.lat, lon: e.lon }; }
    else if ((pol = poligonoDe(e))) { geom = 'poligono'; c = centroide(pol); }
    else {
      geom = 'linha';
      const g = e.geometry || [];
      c = g.length ? g[Math.floor(g.length / 2)] : null;
      abertos.push(`${idOsm(e)} ${t.name}`);
    }
    if (!c) continue;
    if (!emSalto(c)) {
      const g = e.geometry || [];
      foraDoLimite.push({ nome: t.name, osm: idOsm(e), vertices_dentro: g.length ? `${g.filter(emSalto).length}/${g.length}` : null });
      continue;
    }
    const alt = [t.alt_name, t.short_name, t.old_name].filter(Boolean).flatMap((x) => x.split(';').map((s) => s.trim())).filter(Boolean);
    itens.push({ nome: t.name, alt, tipo: tipoLugar(t), geom, c, pol, area: pol ? c.area : 0, osm: idOsm(e) });
  }

  // Ponto e polígono do mesmo lugar viram um registro (chave: nome sem "Condomínio (Fechado)").
  const grupos = new Map();
  for (const it of itens) {
    const k = semCondominio(it.nome);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(it);
  }
  const bairros = [...grupos.values()].map((v) => {
    const principal = v.find((x) => x.geom === 'poligono') || v.find((x) => x.geom === 'ponto') || v[0];
    const alt = [...new Set(v.flatMap((x) => [x.nome, ...x.alt]))].filter((n) => n !== principal.nome);
    const b = { nome: principal.nome };
    if (alt.length) b.alt = alt;
    return Object.assign(b, {
      tipo: [...new Set(v.map((x) => x.tipo))].sort().join('|'),
      geom: principal.geom,
      centro: [r5(principal.c.lat), r5(principal.c.lon)],
      osm: v.map((x) => x.osm).sort(),
    });
  }).sort((a, b) => ordemPt(a.nome, b.nome));

  // Rua -> bairro: ponto médio de cada trecho dentro de um polígono (admin_level=10 primeiro, depois o menor).
  // Prédios (residential=apartments) não contam como bairro.
  const poligonos = itens.filter((x) => x.geom === 'poligono' && !/apartments/.test(x.tipo));
  const bairroDoPonto = (p) => {
    let melhor = null;
    for (const b of poligonos) {
      if (!dentroPoligono(p.lat, p.lon, b.pol)) continue;
      const prioridade = b.tipo.startsWith('admin') ? 0 : 1;
      if (!melhor || prioridade < melhor.prioridade || (prioridade === melhor.prioridade && b.area < melhor.b.area)) melhor = { b, prioridade };
    }
    return melhor && melhor.b;
  };
  const referencias = bairros.filter((b) => b.geom !== 'linha').map((b) => ({ nome: b.nome, c: { lat: b.centro[0], lon: b.centro[1] } }));
  const maisPerto = (p) => {
    let melhor = null;
    for (const r of referencias) { const d = metros(p, r.c); if (!melhor || d < melhor.d) melhor = { d, nome: r.nome }; }
    return melhor;
  };
  const ruas = new Map();
  let trechos = 0, trechosComBairro = 0;
  for (const w of limiteRuas) {
    if (w.type !== 'way' || !w.tags || !w.tags.name || !Array.isArray(w.geometry) || w.geometry.length < 2) continue;
    const m = pontoMedio(w.geometry);
    if (!emSalto(m)) continue;
    trechos++;
    const nome = w.tags.name;
    if (!ruas.has(nome)) ruas.set(nome, { nome, p: m, maior: 0, bairros: {}, perto: {} });
    const r = ruas.get(nome);
    if (m.comprimento > r.maior) { r.maior = m.comprimento; r.p = m; }
    const b = bairroDoPonto(m);
    if (b) { trechosComBairro++; r.bairros[b.nome] = (r.bairros[b.nome] || 0) + m.comprimento; }
    else { const q = maisPerto(m); if (q) r.perto[q.nome] = (r.perto[q.nome] || 0) + m.comprimento; }
  }
  const porComprimento = (o) => Object.entries(o).sort((a, b) => b[1] - a[1] || ordemPt(a[0], b[0])).map((x) => x[0]);
  const listaRuas = [...ruas.values()].sort((a, b) => ordemPt(a.nome, b.nome)).map((r) => {
    const o = { nome: r.nome, p: [r5(r.p.lat), r5(r.p.lon)] };
    const bs = porComprimento(r.bairros);
    if (bs.length) o.bairros = bs;
    else if (Object.keys(r.perto).length) o.perto = porComprimento(r.perto)[0];
    return o;
  });

  const enderecosPorBairro = {};
  for (const e of enderecos) {
    const s = e.tags && e.tags['addr:suburb'];
    if (s) enderecosPorBairro[s] = (enderecosPorBairro[s] || 0) + 1;
  }

  return {
    licenca: LICENCA,
    fonte: 'OpenStreetMap via Overpass API (npm run osm)',
    extraido_em: extraidoEm || null,
    relacao_municipio: RELACAO_SALTO,
    legenda: {
      geom: 'poligono | ponto | linha (contorno aberto, sem área)',
      centro: '[lat, lon]: centróide do polígono ou posição do ponto',
      ruas_p: '[lat, lon]: ponto médio do trecho mais longo',
      ruas_bairros: 'bairros OSM cujo polígono contém o ponto médio de algum trecho (do maior comprimento para o menor). Só a parte coberta por polígono conta: rua longa que passa por área sem polígono (ex.: Centro) pode sair com o bairro errado',
      ruas_perto: 'sem polígono: lugar OSM mais próximo (palpite fraco, não usar como bairro)',
      addr_suburb: 'quantos elementos OSM trazem esse bairro no endereço',
    },
    resumo: {
      bairros: bairros.length,
      com_poligono: bairros.filter((b) => b.geom === 'poligono').length,
      so_ponto: bairros.filter((b) => b.geom === 'ponto').length,
      ruas: listaRuas.length,
      ruas_com_bairro: listaRuas.filter((r) => r.bairros).length,
      trechos,
      trechos_com_bairro: trechosComBairro,
    },
    problemas: {
      sem_nome: semNome.sort(),
      contorno_aberto: abertos.sort(ordemPt),
      fora_do_limite: foraDoLimite.sort((a, b) => ordemPt(a.nome, b.nome)),
    },
    addr_suburb: Object.fromEntries(Object.entries(enderecosPorBairro).sort((a, b) => b[1] - a[1] || ordemPt(a[0], b[0]))),
    bairros,
    ruas: listaRuas,
  };
}

// JSON legível no diff: listas de objetos com um item por linha.
export function jsonCompacto(obj) {
  const linhas = ['{'];
  const chaves = Object.keys(obj);
  chaves.forEach((k, i) => {
    const v = obj[k];
    const fim = i < chaves.length - 1 ? ',' : '';
    if (Array.isArray(v) && v.length && v.every((x) => x && typeof x === 'object')) {
      linhas.push(`  ${JSON.stringify(k)}: [`);
      v.forEach((x, j) => linhas.push(`    ${JSON.stringify(x)}${j < v.length - 1 ? ',' : ''}`));
      linhas.push(`  ]${fim}`);
    } else {
      linhas.push(`  ${JSON.stringify(k)}: ${JSON.stringify(v)}${fim}`);
    }
  });
  linhas.push('}');
  return `${linhas.join('\n')}\n`;
}

// ---------- comparação com o site e com a lista oficial

// Palavras dos nomes OSM que parecem erro de digitação: não aparecem em nenhum nome oficial nem do site,
// mas ficam a uma letra (ou um acento) de uma palavra que aparece. Ex.: "Ciudade" -> "Cidade", "Gabrile" -> "Gabriel".
export function errosDigitacao(nomesOsm, vocabulario) {
  const palavras = (s) => String(s).split(/[\s'’/(),.-]+/).filter(Boolean);
  const voc = new Map();
  const vezes = new Map();
  for (const n of vocabulario) for (const p of palavras(n)) { const b = p.toLowerCase(); voc.set(b, p); vezes.set(b, (vezes.get(b) || 0) + 1); }
  const vistos = new Set();
  const saida = [];
  for (const nome of nomesOsm) {
    for (const p of palavras(nome)) {
      const baixa = p.toLowerCase();
      if (baixa.length < 4 || voc.has(baixa) || GENERICOS.has(semAcento(baixa))) continue;
      let melhor = null;
      for (const [v, original] of voc) {
        if (v.length < 4) continue;
        const d = semAcento(v) === semAcento(baixa) ? 0.5 : distancia(semAcento(v), semAcento(baixa));
        // Uma letra de diferença só vale em palavra longa, ou em palavra curta muito comum ("Vile" -> "Vila").
        if (d === 1 && baixa.length < 6 && (vezes.get(v) || 0) < 3) continue;
        if (d <= 1 && (!melhor || d < melhor.d)) melhor = { d, original };
      }
      const chave = `${nome}|${p}`;
      if (melhor && !vistos.has(chave)) {
        vistos.add(chave);
        saida.push({ nome, palavra: p, sugestao: melhor.original, so_acento: melhor.d === 0.5 });
      }
    }
  }
  return saida;
}

// salto: data/osm/salto.json; apelidos: data/referencia/bairros-apelidos.json; oficiais: data/referencia/bairros-oficiais.json.
export function compararOsm({ salto, apelidos, oficiais }) {
  const listaOficial = [
    ...((oficiais && oficiais.bairros) || []).map((b) => b.nome),
    ...((oficiais && oficiais.loteamentos_posteriores && oficiais.loteamentos_posteriores.itens) || []).map((i) => i.nome),
  ].filter(Boolean);
  const nomes = (apelidos && apelidos.nomes) || {};
  const conferido = (chave) => [...((apelidos.oficial || {})[chave] || []), ...((apelidos.oficial_ligados || {})[chave] || [])];
  const paginas = Object.entries(nomes).map(([chave, nome]) => ({ chave, nome, oficiais: conferido(chave) }));
  const lugares = salto.bairros.filter((b) => !/apartments/.test(b.tipo) || /\|/.test(b.tipo));
  const predios = salto.bairros.filter((b) => !lugares.includes(b));
  const nomesDoLugar = (b) => [b.nome, ...(b.alt || [])];
  const todosNomesOsm = lugares.flatMap(nomesDoLugar);
  const lugarDoNome = (n) => lugares.find((b) => nomesDoLugar(b).includes(n));

  // Página -> lugar OSM. Um lugar com nome exato de uma página não é dado a outra página por nível mais fraco.
  const exatos = new Set();
  for (const p of paginas) {
    for (const n of [p.nome, ...p.oficiais]) {
      const c = casarNome(n, todosNomesOsm);
      if (c && c.nivel === 'exato') exatos.add(lugarDoNome(c.com).nome);
    }
  }
  const paginaOsm = paginas.map((p) => {
    let achado = null;
    for (const n of [p.nome, ...p.oficiais]) {
      for (const lugar of lugares) {
        const c = casarAlgum([n], nomesDoLugar(lugar));
        if (!c) continue;
        if (c.nivel !== 'exato' && exatos.has(lugar.nome)) continue;
        if (!achado || NIVEIS.indexOf(c.nivel) < NIVEIS.indexOf(achado.nivel)) achado = { nivel: c.nivel, lugar, com: c.com };
      }
    }
    return { ...p, osm: achado };
  });

  // 1. Grafias divergentes entre página, nome oficial conferido e OSM.
  // Só entram os nomes oficiais que são o mesmo nome escrito de outro jeito (não os "ligados" de outra área).
  const parecido = (a, b) => { const x = casarNome(a, [b]); return x && x.nivel !== 'contido'; };
  // Divergência de grafia: o miolo do nome muda (prefixo "Bairro"/"Jardim da" e fase "I" não contam).
  const miolo = (n) => semRomanoFinal(semFaseI(nucleoNome(n)));
  const divergencias = paginaOsm.map((p) => {
    const oficiais = p.oficiais.filter((o) => parecido(p.nome, o));
    const casou = p.osm && p.osm.nivel !== 'contido' ? p.osm : null;
    const osm = casou ? (casou.com === casou.lugar.nome ? casou.lugar.nome : `${casou.lugar.nome} (${casou.com})`) : null;
    const formas = [...oficiais, ...(casou ? [casou.com] : [])];
    return { pagina: p.nome, chave: p.chave, oficiais: p.oficiais, osm, nivel: casou ? casou.nivel : null, diverge: formas.some((f) => miolo(f) !== miolo(p.nome)) };
  }).filter((d) => d.diverge).map(({ diverge, ...d }) => d);

  // 2. OSM × lista oficial: mesmo lugar, grafia diferente.
  const osmOficial = lugares.map((b) => ({ b, c: casarAlgum(nomesDoLugar(b), listaOficial) }));
  const grafiaOficial = osmOficial
    .filter(({ b, c }) => c && c.nivel === 'grafia' && !nomesDoLugar(b).some((n) => mesmaGrafia(n, c.com)))
    .map(({ b, c }) => ({ osm: b.nome, oficial: c.com, nivel: c.nivel }));
  // Mesmo miolo, outro prefixo: provavelmente o mesmo lugar, mas conferir ("Jardim do Bosque" × "Residencial do Bosque").
  const prefixoOficial = osmOficial
    .filter(({ b, c }) => c && c.nivel === 'nucleo' && !nomesDoLugar(b).some((n) => mesmaGrafia(n, c.com)) && prefixos(b.nome).size !== prefixos(c.com).size)
    .map(({ b, c }) => ({ osm: b.nome, oficial: c.com }));

  // 3. Só no OSM: sem nenhum nome oficial correspondente. Fila de investigação (conferir em decreto antes de virar página).
  const nomesPaginas = paginas.map((p) => p.nome);
  const soNoOsm = osmOficial.filter(({ c }) => !c || c.nivel === 'contido').map(({ b, c }) => {
    const pag = casarAlgum(nomesDoLugar(b), nomesPaginas);
    return { nome: b.nome, geom: b.geom, centro: b.centro, osm: b.osm, talvez_oficial: c ? c.com : null, pagina: pag && pag.nivel !== 'contido' ? pag.com : null };
  });

  // 4. Páginas sem nada no OSM (com a pista do addr:suburb, quando houver).
  const suburbios = Object.keys(salto.addr_suburb || {});
  const semOsm = paginaOsm.filter((p) => !p.osm || p.osm.nivel === 'contido').map((p) => {
    const e = casarAlgum([p.nome, ...p.oficiais], suburbios);
    return { pagina: p.nome, chave: p.chave, pista: p.osm ? p.osm.lugar.nome : null, enderecos: e && e.nivel !== 'contido' ? `${e.com} (${salto.addr_suburb[e.com]})` : null };
  });
  const foraDoLimite = (salto.problemas.fora_do_limite || []).map((f) => ({ ...f, pagina: (casarNome(f.nome, nomesPaginas) || {}).com || null }));

  // 5. Correções que valem a pena no próprio OSM.
  const vocabulario = [...listaOficial, ...nomesPaginas];
  const digitacao = errosDigitacao(lugares.map((b) => b.nome), vocabulario);

  return {
    contagem: {
      paginas: paginas.length,
      paginas_com_osm: paginaOsm.filter((p) => p.osm && p.osm.nivel !== 'contido').length,
      oficiais: listaOficial.length,
      lugares_osm: lugares.length,
      predios_osm: predios.length,
    },
    divergencias, grafiaOficial, prefixoOficial, soNoOsm, semOsm, foraDoLimite, digitacao,
    predios: predios.map((b) => b.nome),
    problemas: salto.problemas,
  };
}

// ---------- relatório (relatorio-osm.md, fora do repositório)

const celula = (s) => String(s == null || s === '' ? '—' : s).replace(/\|/g, '/');
const tabela = (cab, linhas) => (linhas.length
  ? [`| ${cab.join(' | ')} |`, `|${cab.map(() => '---').join('|')}|`, ...linhas.map((l) => `| ${l.map(celula).join(' | ')} |`)].join('\n')
  : '_Nada._');

export function relatorioMarkdown(cmp, { extraidoEm, geradoEm, resumo } = {}) {
  const c = cmp.contagem;
  const partes = [
    '# Relatório OpenStreetMap: bairros',
    '',
    `Gerado em ${geradoEm || '—'} por \`npm run osm\`. Base OSM: ${extraidoEm || '—'}.`,
    '',
    'O OpenStreetMap é **referência auxiliar**: serve para sugerir e conferir, nunca para afirmar o nome oficial. Toda mudança em `data/referencia/bairros-apelidos.json` precisa de ato oficial (decreto, lei, PGV) ou de conferência manual registrada (OPERACAO.md, "Bairros: conferência"). Dados OSM © colaboradores do OpenStreetMap (ODbL).',
    '',
    `Resumo: ${c.paginas_com_osm} de ${c.paginas} páginas de bairro têm lugar correspondente no OSM; o OSM tem ${c.lugares_osm} lugares (mais ${c.predios_osm} prédios)` +
      (resumo ? `, ${resumo.com_poligono} com polígono; ${resumo.ruas_com_bairro} de ${resumo.ruas} nomes de rua caem em algum polígono.` : '.'),
    '',
    '## 1. Grafias divergentes (página × oficial × OSM)',
    '',
    'Decidir se a página ou o apelido muda. O nome oficial manda; o OSM só aponta a diferença.',
    '',
    tabela(['Página', 'Oficial conferido', 'OSM', 'Casamento'], cmp.divergencias.map((d) => [d.pagina, d.oficiais.join(', '), d.osm, d.nivel])),
    '',
    '## 2. OSM × lista oficial: mesmo lugar, outra grafia',
    '',
    tabela(['OSM', 'Lista oficial'], cmp.grafiaOficial.map((g) => [g.osm, g.oficial])),
    '',
    'Mesmo nome com outro prefixo (provavelmente o mesmo lugar; conferir):',
    '',
    tabela(['OSM', 'Lista oficial'], cmp.prefixoOficial.map((g) => [g.osm, g.oficial])),
    '',
    '## 3. Loteamentos só no OSM (fila de investigação)',
    '',
    'Sem nome correspondente na PGV nem nos atos de loteamento. Procurar o decreto na Imprensa Oficial antes de criar página ou ligar a uma página. "Talvez" é casamento fraco (nome contido).',
    '',
    tabela(['Nome no OSM', 'Geometria', 'Centro', 'Elemento', 'Talvez oficial', 'Página do site'],
      cmp.soNoOsm.map((s) => [s.nome, s.geom, s.centro.join(', '), s.osm.join(' '), s.talvez_oficial, s.pagina])),
    '',
    `Prédios e condomínios verticais (não são bairros, ignorar): ${cmp.predios.length ? cmp.predios.join(', ') : 'nenhum'}.`,
    '',
    '## 4. Páginas do site sem nada no OSM',
    '',
    tabela(['Página', 'Pista fraca no OSM', 'Aparece em endereços (addr:suburb)'], cmp.semOsm.map((s) => [s.pagina, s.pista, s.enderecos])),
    '',
    'Lugares do OSM fora do limite do município (o polígono quase todo do lado de fora):',
    '',
    tabela(['Nome', 'Elemento', 'Vértices dentro', 'Página'], cmp.foraDoLimite.map((f) => [f.nome, f.osm, f.vertices_dentro, f.pagina])),
    '',
    '## 5. Correções que valem a pena no OSM',
    '',
    'Conferir antes de editar no openstreetmap.org: às vezes o OSM está certo e a grafia oficial é a antiga (ex.: Lajeado × Lageado).',
    '',
    tabela(['Nome no OSM', 'Palavra', 'Provável', 'Tipo'], cmp.digitacao.map((d) => [d.nome, d.palavra, d.sugestao, d.so_acento ? 'acento' : 'letra'])),
    '',
    `Contornos abertos (boundary sem área): ${cmp.problemas.contorno_aberto.length ? cmp.problemas.contorno_aberto.join('; ') : 'nenhum'}.`,
    '',
    `Elementos sem nome: ${cmp.problemas.sem_nome.length ? cmp.problemas.sem_nome.join(', ') : 'nenhum'}.`,
    '',
  ];
  return partes.join('\n');
}
