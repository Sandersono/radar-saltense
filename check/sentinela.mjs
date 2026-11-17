import assert from 'node:assert/strict';
import { avaliar, PAGINAS } from '../src/sentinela.js';

const agora = '2026-11-18T15:30:00Z'; // 12:30 em Brasília, 18/11
const site = (data = '18/11/2026', urls = 200) => Object.fromEntries(PAGINAS.map((p) => [p, {
  status: 200,
  texto: p === '' ? `<p>Atualizado em ${data}, 03:20</p>` : p === 'sitemap.xml' ? '<url></url>'.repeat(urls) : 'ok',
}]));
const execDespertador = { createdAt: '2026-11-18T06:00:30Z', event: 'workflow_dispatch', conclusion: 'success', status: 'completed', displayTitle: 'Atualizar Radar Saltense' };

// Dia normal: despertador rodou, site atualizado, nada a fazer
assert.deepEqual(avaliar({ execucoes: [execDespertador], paginas: site(), dados: { avisosManutencao: ['Receitas do TCE-SP: o site repete os dados de 18/11/2026 (0 dias).'] }, agora }), { problemas: [], atencao: [] });

// Sem atualização completa hoje (só a de ontem e um "só publicar" de hoje): problema
const ontem = { ...execDespertador, createdAt: '2026-11-17T06:00:30Z' };
const soPublicar = { ...execDespertador, createdAt: '2026-11-18T10:00:00Z', displayTitle: 'Só publicar Radar Saltense' };
assert.equal(avaliar({ execucoes: [ontem, soPublicar], paginas: site(), dados: null, agora }).problemas.length, 1);

// Rodou só pela reserva do GitHub: atenção (despertador falhou), sem problema
const reserva = { ...execDespertador, createdAt: '2026-11-18T14:05:00Z', event: 'schedule' };
const r = avaliar({ execucoes: [reserva], paginas: site(), dados: null, agora });
assert.equal(r.problemas.length, 0);
assert.ok(r.atencao[0].includes('despertador'));

// Robô rodou mas o site mostra data antiga: publicação falhou
assert.ok(avaliar({ execucoes: [execDespertador], paginas: site('17/11/2026'), dados: null, agora }).problemas[0].includes('publicação'));

// Página fora do ar e sitemap encolhido
const p = site('18/11/2026', 40);
p['obras.html'] = { status: 404, texto: '' };
assert.equal(avaliar({ execucoes: [execDespertador], paginas: p, dados: null, agora }).problemas.length, 2);

// Aviso de manutenção real vira atenção
assert.equal(avaliar({ execucoes: [execDespertador], paginas: site(), dados: { avisosManutencao: ['Há PDF novo de emendas de 2026 na Câmara'] }, agora }).atencao.length, 1);
console.log('sentinela: ok');
