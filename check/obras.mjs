import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ehObra, temPalavraObra, agruparPorProcesso, situacaoObra, juntarTce, lerTabelaParalisadas, resumirObjeto, validarLigacoes,
  numerosDePromessas, mesclarFontesObras, janelas, urlPncp, enxugarContrato, montarObras,
  guardarLeitura, podarReleitura, projetoPrincipal, execucaoMaisRecente,
} from '../src/regras/obras-cidade.js';

// Falsos positivos da revisão (compra de material, serviços em volta da obra).
assert.equal(ehObra('Aquisição de medicamentos para ampliação da rede de atendimento', 4), false);
assert.equal(ehObra('Fornecimento de brita para construção de calçadas', 4), false);
assert.equal(ehObra('Fornecimento de materiais e execução de rede coletora de esgoto e ampliação da E.E.E Rodésia', 4), true);
assert.equal(ehObra('Serviços de implantação, manutenção, monitoramento e consolidação da Restauração Ecológica da futura APP', 4), false);
assert.equal(ehObra('Serviços para execução de pesquisa de vazamentos com tecnologia de correlação', null, 9), false);
assert.equal(ehObra('Serviços de implantação de ações de perdas com setorização do setor 15', 4), false);
assert.equal(ehObra('Fornecimento e instalação de sistema de medição com macromedidores de vazão', 4), false);

// Releitura do PNCP: parcial nunca apaga o que já estava salvo; completa tira o que sumiu.
const lic = (id) => ({ id, cnpj: '46634507000106', processo: id, objeto: 'Construção de creche', modalidadeId: 4 });
const ctr = (id, compra) => ({ id, cnpj: '46634507000106', compra, objeto: 'Construção de creche', categoriaId: 7, tipo: 'Contrato' });
const salvo = { contratacoes: { L1: lic('L1'), L2: lic('L2') }, contratos: { K1: ctr('K1', 'L1'), K2: ctr('K2', 'L2') } };
const parcial = guardarLeitura({ ...salvo, vistosC: [], vistosK: [] }, { contratacoes: [lic('L1')], contratos: [ctr('K1', 'L1'), ctr('K3', 'L1')] });
assert.deepEqual(Object.keys(parcial.contratacoes).sort(), ['L1', 'L2']);
assert.deepEqual(Object.keys(parcial.contratos).sort(), ['K1', 'K2', 'K3']);
const podado = podarReleitura(parcial);
assert.deepEqual(Object.keys(podado.contratacoes), ['L1']);
assert.deepEqual(Object.keys(podado.contratos).sort(), ['K1', 'K3']);
// Contrato que deixou de ser candidato (virou empenho) sai na hora.
assert.equal(guardarLeitura(salvo, { contratos: [{ ...ctr('K2', 'L2'), tipo: 'Empenho' }] }).contratos.K2, undefined);

// Vários registros do Obrasgov.br: situação do mais grave, % do mais recente.
const regs = [{ id: 'a', situacao: 'Cadastrada', pct: 10, pctEm: '2026-01-01' }, { id: 'b', situacao: 'Inacabada', pct: 40, pctEm: '2026-06-01' }, { id: 'c', situacao: 'Em execução', pct: null }];
assert.equal(projetoPrincipal(regs).id, 'b');
assert.equal(projetoPrincipal(regs.filter((r) => r.id !== 'b')).id, 'c');
assert.equal(execucaoMaisRecente(regs).id, 'b');

// O que conta como obra (casos da pesquisa).
assert.equal(ehObra('Aquisição de material de escritório para a Secretaria de Saúde', 4), false); // "secretaria" não é ETA
assert.equal(ehObra('AQUISIÇÃO DE CADEIRAS PARA A SECRETARIA DE EDUCAÇÃO', 4), false);
assert.equal(ehObra('Reuso e destinação do lodo da ETA Bela Vista', 4), true);
assert.equal(ehObra('Elaboração de projeto executivo de drenagem urbana', 4), false); // só projeto fica fora
assert.equal(ehObra('Elaboração dos projetos básico e executivo, fornecimento de materiais, bem como a execução das obras da fase 1 da ETA Jundiaí', 4), true);
assert.equal(ehObra('Prestação de serviços de limpeza com fornecimento de mão de obra', null, 7), false);
assert.equal(ehObra('Construção de unidade básica de saúde', 6, 2), false); // pregão de compras: fora
assert.equal(ehObra('Reservação e sistema auxiliar da ETA Jundiaí', 8, 2, { codigo: 38, nome: 'Lei 14.133/2021, Art. 75, VIII' }), true);
assert.equal(ehObra('Reservação e sistema auxiliar da ETA Jundiaí', 8, 2, { codigo: 19, nome: 'Lei 14.133/2021, Art. 75, II' }), false);
assert.equal(ehObra('Pavimentação e drenagem do Jardim Santa Cruz', null, 8), false);
assert.equal(ehObra('Pavimentação e drenagem do Jardim Santa Cruz', null, 9), true);
assert.equal(ehObra('Recapeamento da Rua Sete de Setembro', 5), true);
assert.equal(ehObra('PRESTAÇÃO DE SERVIÇOS PROFISSIONAIS DE MANUTENÇÃO MECÂNICA NA ETA', 4), false);
assert.equal(ehObra('Revisão do plano municipal de saneamento', 4), false);
assert.equal(temPalavraObra('Contratação de agência de publicidade'), false);

// Republicações: um grupo por órgão e processo; vale a publicação mais recente.
const C = (id, processo, publicacao, cnpj = '46634507000106') => ({ id, cnpj, processo, publicacao });
const g = agruparPorProcesso([
  C('46634507000106-1-000452/2025', '3733/2025', '2025-07-30'),
  C('46634507000106-1-000165/2026', '3733/2025', '2026-03-20'),
  C('46634507000106-1-000599/2025', '3733/2025', '2025-09-01'),
  C('11065186000183-1-000014/2026', '3733/2025', '2026-02-01', '11065186000183'),
]);
assert.equal(g.length, 2);
const escola = g.find((x) => x.chave.startsWith('46634507000106'));
assert.equal(escola.atual.id, '46634507000106-1-000165/2026');
assert.equal(escola.ids.length, 3);

// Grupo da obra.
const H = '2026-11-17';
assert.equal(situacaoObra({ contrato: { fimVigencia: '2028-03-16' }, obrasgov: { situacao: 'Cadastrada' } }, H), 'execucao');
assert.equal(situacaoObra({ contrato: { fimVigencia: '2026-04-30' } }, H), 'encerrada');
assert.equal(situacaoObra({ contrato: { fimVigencia: '2026-04-30' }, tce: { situacao: 'Em execução - no prazo' } }, H), 'execucao');
assert.equal(situacaoObra({ contrato: { fimVigencia: '2027-01-01' }, prefeitura: { paralisada: true } }, H), 'paralisada');
assert.equal(situacaoObra({ tce: { situacao: 'Paralisada', paralisada: true } }, H), 'paralisada');
assert.equal(situacaoObra({ licitacao: { situacao: 'Divulgada no PNCP', homologado: 100 } }, H), 'licitacao');
assert.equal(situacaoObra({ licitacao: { situacao: 'Revogada' } }, H), null);
assert.equal(situacaoObra({ obrasgov: { situacao: 'Cadastrada', cadastro: '2025-05-20', fimPrevisto: '2028-09-30' } }, H), 'federal');
assert.equal(situacaoObra({ obrasgov: { situacao: 'Cadastrada', cadastro: '2026-09-18', fimPrevisto: '2012-06-06' } }, H), null); // registro velho
assert.equal(situacaoObra({ obrasgov: { situacao: 'Concluída', fimPrevisto: '2025-04-01' } }, H), 'encerrada');
assert.equal(situacaoObra({ obrasgov: { situacao: 'Concluída', fimPrevisto: '2022-12-23' } }, H), null);
assert.equal(situacaoObra({ obrasgov: { situacao: 'Em execução' } }, H), 'execucao');

// Junção com o TCE: CNPJ do contratado + ano; com dois candidatos, o de valor igual.
const ob = (id, cnpj, ano, valor) => ({ id, fornecedorCnpj: cnpj, anoContrato: ano, valor, tce: null });
const j = juntarTce(
  [ob('a', '43898972000158', 2025, 4500000), ob('b', '11111111000111', 2026, 100), ob('c', '11111111000111', 2026, 9000000)],
  [
    { cnpj: '43898972000158', ano: 2025, valor: 4500000, situacao: 'Em execução - no prazo', paralisada: false },
    { cnpj: '11111111000111', ano: 2026, valor: 9000001, situacao: 'Paralisada', paralisada: true },
    { cnpj: '22222222000122', ano: 2023, valor: 1, situacao: 'Em execução - no prazo', paralisada: false },
    { cnpj: '11111111000111', ano: 2026, valor: 1800000, situacao: 'Paralisada', paralisada: true }, // só sobra 'b' (R$ 100): valor muito diferente, outro contrato
  ],
);
assert.equal(j.obras[0].tce.situacao, 'Em execução - no prazo');
assert.equal(j.obras[1].tce, null);
assert.equal(j.obras[2].tce.paralisada, true);
assert.equal(j.sobra.length, 2);
assert.equal(ehObra('Serviços de engenharia para acompanhamento técnico da obra da barragem', null, 9), false);
assert.equal(resumirObjeto('- Contratação de empresa especializada para a implantação de obra de infraestrutura da ETA Barnabé').titulo, 'Implantação de obra de infraestrutura da ETA Barnabé');

// Página "Consulta de Obras Paralisadas" (formato de 26/05/2026).
const html = '<table><thead><tr><th>Obra</th><th>Data de Início</th><th>Previsão de Término</th><th>Valor Contratado</th><th>Percentual Executado</th><th>Status</th></tr></thead><tbody><tr><td><a href="https://salto.sp.gov.br/obra-centro-comunitario-jardim-uniao/">Centro Comunitário Jardim União</a></td><td>28/01/2026</td><td>28/07/2026</td><td>R$ 186.500,00</td><td>Aproximadamente 3,00%</td><td style="color:#b30000">Obra Paralisada</td></tr></tbody></table>';
assert.deepEqual(lerTabelaParalisadas(html), [{ nome: 'Centro Comunitário Jardim União', link: 'https://salto.sp.gov.br/obra-centro-comunitario-jardim-uniao/', inicio: '2026-01-28', termino: '2026-07-28', valor: 186500, pct: 3, status: 'Obra Paralisada', paralisada: true }]);
assert.deepEqual(lerTabelaParalisadas('<table><tr><th>Obra</th></tr></table>'), []);
assert.throws(() => lerTabelaParalisadas('<p>sem tabela</p>'));

// Objeto curto.
assert.equal(resumirObjeto('Contratação de empresa para execução de obra de construção da escola em tempo integral de 13 salas no Jardim Barnabé, com o fornecimento de mão de obra, materiais e equipamentos').titulo, 'Obra de construção da escola em tempo integral de 13 salas no Jardim Barnabé');
assert.equal(resumirObjeto('Execução de obra de forma indireta de construção de uma nova clínica de saúde, com o fornecimento de mão de obra').titulo, 'Obra de construção de uma nova clínica de saúde');
assert.equal(resumirObjeto('Recapeamento Asfáltico na Rua 24 de Outubro').titulo, 'Recapeamento Asfáltico na Rua 24 de Outubro');
assert.equal(resumirObjeto('CONSTRUÇÃO DE UNIDADE BÁSICA DE SAÚDE').titulo, 'Construção de unidade básica de saúde');
assert.ok(resumirObjeto('Obra '.repeat(80)).titulo.endsWith('…'));

// Ligações curadas: o arquivo real passa; formato e promessas são conferidos.
const promessas = JSON.parse(readFileSync(new URL('../data/referencia/promessas.json', import.meta.url), 'utf8'));
const ligacoes = JSON.parse(readFileSync(new URL('../data/referencia/obras-ligacoes.json', import.meta.url), 'utf8'));
const numeros = numerosDePromessas(promessas);
assert.deepEqual(validarLigacoes(ligacoes, numeros), []);
assert.equal(validarLigacoes({ ligacoes: [{ id: 'x', pncp: ['46634507000106-2-000646/2025'], promessas: ['99.99'] }] }, numeros).length, 1);
assert.equal(validarLigacoes({ ligacoes: [{ id: 'X Y', pncp: ['2025/646'], promessas: [] }] }, numeros).length, 2);
assert.equal(validarLigacoes({ ligacoes: [{ id: 'a', pncp: [], promessas: [] }] }, numeros).length, 1);
assert.equal(validarLigacoes({ ligacoes: [{ id: 'a', obrasgov: ['1.35-00'], promessas: [] }, { id: 'a', obrasgov: ['1.35-00'], promessas: [] }] }, numeros).length, 2);
assert.deepEqual(validarLigacoes({}, numeros), ['o arquivo não tem a lista "ligacoes"']);

// Fontes: cada uma fica com a coleta mais nova.
const m = mesclarFontesObras({ pncp: { coletadoEm: '2026-11-17' }, obrasgov: { coletadoEm: '2026-11-10' } }, { pncp: { coletadoEm: '2026-11-16' }, obrasgov: { coletadoEm: '2026-11-17' }, paralisadas: null });
assert.equal(m.pncp.coletadoEm, '2026-11-17');
assert.equal(m.obrasgov.coletadoEm, '2026-11-17');
assert.equal(m.paralisadas, null);

assert.deepEqual(janelas('2025-01-01', '2026-02-10', 12), [['20250101', '20251231'], ['20260101', '20260210']]);
assert.equal(janelas('2025-01-01', '2026-11-17', 3).length, 8);
assert.equal(urlPncp('46634507000106-2-000646/2025'), 'https://pncp.gov.br/app/contratos/46634507000106/2025/646');
assert.equal(urlPncp('11065186000183-1-000136/2026'), 'https://pncp.gov.br/app/editais/11065186000183/2026/136');

// Privacidade: contratado pessoa física vira "pessoa física", sem nome nem CPF, até o fim da montagem.
const pf = enxugarContrato({ numeroControlePNCP: '46634507000106-2-000001/2026', orgaoEntidade: { cnpj: '46634507000106' }, niFornecedor: '12345678901', nomeRazaoSocialFornecedor: 'Fulano de Tal', objetoContrato: 'Reforma da cantina, CPF 123.456.789-01', categoriaProcesso: { id: 7 }, tipoContrato: { nome: 'Contrato' }, valorGlobal: 50000, dataAssinatura: '2026-02-01', dataVigenciaFim: '2027-02-01' });
const pj = enxugarContrato({ numeroControlePNCP: '46634507000106-2-000002/2026', orgaoEntidade: { cnpj: '46634507000106' }, niFornecedor: '43898972000158', nomeRazaoSocialFornecedor: 'CONSTRUTORA ROY LTDA', objetoContrato: 'Construção da clínica de saúde', categoriaProcesso: { id: 7 }, tipoContrato: { nome: 'Contrato' }, valorGlobal: 4500000, dataAssinatura: '2025-07-07', dataVigenciaFim: '2027-08-10' });
const r = montarObras({
  pncp: { contratacoes: {}, contratos: { [pf.id]: pf, [pj.id]: pj }, compras: {}, coletadoEm: H },
  tce: [{ cnpj: '43898972000158', ano: 2025, valor: 4500000, situacao: 'Em execução - no prazo', paralisada: false, contratante: 'PREFEITURA MUNICIPAL DE SALTO', objeto: 'x' }],
  ligacoes: { ligacoes: [{ id: 'clinica', pncp: [pj.id], promessas: ['6.1', '99.9'] }] }, numerosPromessa: numeros, hoje: H,
});
const texto = JSON.stringify(r);
assert.ok(!texto.includes('Fulano') && !texto.includes('12345678901') && !texto.includes('123.456.789-01'));
assert.equal(r.lista.find((o) => o.contrato.id === pf.id).empresa, 'pessoa física');
const clinica = r.lista.find((o) => o.id === 'clinica');
assert.equal(clinica.tce.situacao, 'Em execução - no prazo');
assert.deepEqual(clinica.promessas, ['6.1']);
assert.equal(r.resumo.total, 2);
assert.equal(r.resumo.valorContratado, 4550000);

// Paralisada da Prefeitura só casa com valor igual E pelo menos 2 palavras em comum; sem isso, entra sozinha.
const ctCentro = enxugarContrato({ numeroControlePNCP: '46634507000106-2-000010/2026', orgaoEntidade: { cnpj: '46634507000106' }, niFornecedor: '11111111000111', nomeRazaoSocialFornecedor: 'REVIDE LTDA', objetoContrato: 'Construção de um centro comunitário no bairro Jd. União', categoriaProcesso: { id: 7 }, tipoContrato: { nome: 'Contrato' }, valorGlobal: 186500, dataAssinatura: '2026-01-20', dataVigenciaFim: '2027-01-20' });
const ctOutro = { ...ctCentro, id: '46634507000106-2-000011/2026', objeto: 'Reforma da cozinha da escola municipal' };
const par = (contratos) => montarObras({ pncp: { contratacoes: {}, contratos, compras: {} }, paralisadas: { obras: [{ nome: 'Centro Comunitário Jardim União', valor: 186500, pct: 3, paralisada: true }] }, numerosPromessa: numeros, hoje: H });
assert.ok(par({ [ctCentro.id]: ctCentro }).lista.find((o) => o.contrato && o.prefeitura));
const semPar = par({ [ctOutro.id]: ctOutro }).lista;
assert.ok(!semPar.find((o) => o.contrato && o.prefeitura));
assert.equal(semPar.filter((o) => o.prefeitura).length, 1);

// Ids estáveis: dois contratos da mesma licitação ganham o número do contrato, em qualquer ordem de entrada.
const lic9 = { id: '46634507000106-1-000009/2026', cnpj: '46634507000106', processo: '99/2026', objeto: 'Construção de praças', modalidadeId: 4, situacao: 'Divulgada', homologado: 0 };
const k1 = { ...ctCentro, id: '46634507000106-2-000021/2026', compra: lic9.id, objeto: 'Construção de praça A' };
const k2 = { ...ctCentro, id: '46634507000106-2-000020/2026', compra: lic9.id, objeto: 'Construção de praça B' };
const ids = (ordem) => montarObras({ pncp: { contratacoes: { [lic9.id]: lic9 }, contratos: Object.fromEntries(ordem.map((k) => [k.id, k])), compras: {} }, numerosPromessa: numeros, hoje: H }).lista.map((o) => `${o.id}=${o.contrato.id}`).sort();
assert.deepEqual(ids([k1, k2]), ids([k2, k1]));
assert.ok(ids([k1, k2])[0].startsWith('prefeitura-99-2026-contrato-2026-20='));
console.log('ok: obras');
