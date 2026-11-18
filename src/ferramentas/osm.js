// npm run osm — baixa bairros, ruas e endereços de Salto do OpenStreetMap (Overpass) e grava:
//   data/osm/salto.json  — dados OSM compactos (ODbL, separados de data/referencia; o site não lê);
//   relatorio-osm.md     — divergências com as páginas e a lista oficial (fora do repositório, .gitignore).
// Rodar à mão, uma vez por mês ou antes de revisar bairros. NÃO faz parte do robô diário.
// Referência auxiliar: o relatório sugere; quem decide é a conferência com ato oficial (OPERACAO.md, "Bairros: conferência").
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { esperar } from '../util/texto.js';
import { RELACAO_SALTO, montarSalto, jsonCompacto, compararOsm, relatorioMarkdown } from '../regras/osm.js';

const OVERPASS = 'https://overpass-api.de/api/interpreter';
const UA = 'radar-saltense (civic project)';
const AREA = 3600000000 + RELACAO_SALTO;
const SAIDA = 'data/osm/salto.json';
const RELATORIO = 'relatorio-osm.md';

// Consultas exatas (pesquisa em .superpowers/pesquisa/osm-bairros.md).
const CONSULTAS = {
  lugares: `[out:json][timeout:90];
area(id:${AREA})->.salto;
(
  nwr["boundary"="administrative"]["admin_level"~"^(9|10)$"](area.salto);
  nwr["place"~"^(suburb|neighbourhood|quarter|village|hamlet|locality|isolated_dwelling)$"](area.salto);
  nwr["landuse"="residential"]["name"](area.salto);
);
out geom;`,
  limiteRuas: `[out:json][timeout:120];
rel(${RELACAO_SALTO});
out geom;
area(id:${AREA})->.salto;
way["highway"]["name"](area.salto);
out tags geom;`,
  enderecos: `[out:json][timeout:90];
area(id:${AREA})->.salto;
nwr["addr:suburb"](area.salto);
out tags;`,
};

// Educado com o servidor: User-Agent próprio, prazo, nova tentativa com espera dobrada em 429/5xx (15 s, 30 s, 60 s).
async function consultar(nome, q) {
  let espera = 15000;
  for (let tentativa = 1; tentativa <= 4; tentativa++) {
    let status = 0;
    try {
      const r = await fetch(OVERPASS, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(q)}`,
        signal: AbortSignal.timeout(180000),
      });
      status = r.status;
      const texto = await r.text();
      if (r.ok && texto.trim().startsWith('{')) {
        const json = JSON.parse(texto);
        console.log(`${nome}: ${json.elements.length} elementos (${Math.round(texto.length / 1024)} KB)`);
        return json;
      }
      if (![429, 502, 503, 504].includes(status)) throw new Error(`HTTP ${status} em ${nome}`);
    } catch (e) {
      if (status && ![429, 502, 503, 504].includes(status)) throw e;
      if (tentativa === 4) throw e;
    }
    if (tentativa === 4) break;
    console.log(`${nome}: resposta ${status || 'sem conexão'}, nova tentativa em ${espera / 1000} s`);
    await esperar(espera);
    espera *= 2;
  }
  throw new Error(`Overpass não respondeu para ${nome} depois de 4 tentativas.`);
}

const lerJson = async (arq) => JSON.parse(await readFile(arq, 'utf8'));

const lugares = await consultar('bairros', CONSULTAS.lugares);
await esperar(5000);
const limiteRuas = await consultar('limite e ruas', CONSULTAS.limiteRuas);
await esperar(5000);
const enderecos = await consultar('endereços', CONSULTAS.enderecos);

const salto = montarSalto({
  lugares: lugares.elements,
  limiteRuas: limiteRuas.elements,
  enderecos: enderecos.elements,
  extraidoEm: lugares.osm3s && lugares.osm3s.timestamp_osm_base,
});
// Resposta suspeita (Overpass incompleto): não troca o arquivo bom.
if (salto.bairros.length < 50 || salto.ruas.length < 500) {
  throw new Error(`resposta suspeita: ${salto.bairros.length} bairros e ${salto.ruas.length} ruas. ${SAIDA} não foi trocado.`);
}
await mkdir('data/osm', { recursive: true });
await writeFile(SAIDA, jsonCompacto(salto));

const cmp = compararOsm({
  salto,
  apelidos: await lerJson('data/referencia/bairros-apelidos.json'),
  oficiais: await lerJson('data/referencia/bairros-oficiais.json'),
});
const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
await writeFile(RELATORIO, relatorioMarkdown(cmp, { extraidoEm: salto.extraido_em, geradoEm, resumo: salto.resumo }));

const r = salto.resumo;
console.log(`${SAIDA}: ${r.bairros} lugares (${r.com_poligono} com polígono), ${r.ruas} ruas (${r.ruas_com_bairro} com bairro).`);
console.log(`${RELATORIO}: ${cmp.divergencias.length} grafias divergentes, ${cmp.soNoOsm.length} só no OSM, ${cmp.semOsm.length} páginas sem OSM, ${cmp.digitacao.length} correções sugeridas no OSM.`);
