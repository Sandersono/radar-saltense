# Obras em Salto: página própria — design

Data: 2026-11-17. Aprovado pelo usuário: "Página própria de obras". A pesquisa está em `.superpowers/pesquisa/obras-fontes.md`, com endpoints, filtros, armadilhas e a lista de 29 obras confirmadas, que serve de gabarito.

## Problema

O site mostra só as 5 obras do Painel de Obras do TCE-SP. A Prefeitura declara esse painel por semestre, ele exclui obras abaixo de R$ 96.050, e o SAAE nunca declarou nenhuma. Ficam de fora a creche, a escola, a duplicação do Lajeado, as adutoras, as ETAs e as redes do SAAE.

## Fontes (só oficiais e automáticas)

1. **PNCP, a base da lista.**
   - Contratações por município: `contratacoes/publicacao`, `codigoMunicipioIbge=3545209`, modalidades 4 e 5, a partir de 2025-01-01.
   - Contratos por CNPJ: Prefeitura `46634507000106`, SAAE `11065186000183` e Consórcio Piraí `07078236000190`.
   - O que conta como obra (a pesquisa explica a regra): critério de modalidade, categoria ou dispensa art. 75, VIII, **e** palavras no objeto, **menos** as exclusões.
   - "ETA" só em maiúsculas, com `\b`.
   - Republicações são agrupadas pelo número do processo.
   - Respeitar o 429 com espera e repetição.
2. **Obrasgov.br**, em `api-publica.obrasgov.gestao.gov.br/obras`:
   - `geometria?cod_ibge=3545209`, depois `projeto-investimento` e `execucao-fisica`;
   - cache por id: só reconsultar o que mudou;
   - dá o % executado, a fonte do dinheiro federal e as obras de outros entes.
3. **Painel do TCE**, que já é coletado: dá a situação (no prazo, atrasada, paralisada), cruzada pelo CNPJ do contratado mais o ano.
4. **Página "Consulta de Obras Paralisadas" da Prefeitura**, pela API do WordPress em `pages?slug=consulta-de-obras-paralisadas`: marca as paralisadas que a própria Prefeitura declara.

Falha de qualquer fonte: mantém o último dado salvo e gera aviso. Nunca trava o robô.

## Ligações curadas à mão

Fica em `data/referencia/obras-ligacoes.json`. O robô só lê esse arquivo. Ele liga:
- uma contratação ou contrato do PNCP a um projeto do Obrasgov, quando o casamento automático não é seguro;
- uma obra a uma ou mais promessas.

Valores iniciais, da pesquisa:

| Obra | Promessas |
|---|---|
| creche Constelações | 6.1 |
| escola Barnabé | 6.4 |
| Lajeado | 13.8 e 13.3 |
| ETA Jundiaí (contratações 2026/592 e 2026/112) | 15.2 |
| ETA Buru / João Jabour | 15.1 |
| Santa Lúcia e rede PEAD do SAAE | 15.5 |
| tapa-buracos | 13.9 |
| painéis com inversores | 15.8 |

## Página `obras.html`

**Título:** "Obras em Salto".

**Texto de abertura:** "Lista montada todo dia com as licitações e contratos de obras que a Prefeitura e o SAAE publicam no Portal Nacional de Contratações Públicas (PNCP) e com as obras que recebem dinheiro federal no Obrasgov.br. O TCE-SP só classifica (no prazo, atrasada, paralisada) as obras que a Prefeitura declarou ao Tribunal."

**Números no topo:** total de obras, valor contratado e quantas estão paralisadas.

**Grupos, nesta ordem:**
1. Paralisadas.
2. Em execução ou contratadas: contrato em vigência.
3. Em licitação: edital aberto, ou homologada sem contrato publicado. Nesse segundo caso, dizer "contrato não publicado no PNCP", que é um fato.
4. Dinheiro federal registrado, obra não iniciada no sistema: Obrasgov "Cadastrada", sem par no PNCP.
5. Encerradas em 2025–2026, num `details` fechado.

**Cada obra mostra:**
- objeto (resumido e limpo);
- órgão;
- empresa contratada (pessoa jurídica, passando por `limparNomeEmpresa` e `ocultarDocumentos`; contratado pessoa física aparece como "pessoa física", sem nome);
- valor;
- datas de assinatura e de fim da vigência;
- % executado (Obrasgov) e situação no TCE, quando houver;
- links oficiais: PNCP, Obrasgov, painel do TCE;
- "Promessa x.y" ligando para `promessas.html`.

**Na página de promessas:** cada promessa ligada mostra "Obras ligadas: …", com link para `obras.html#<id>`.

**Celular primeiro.** Usar o padrão `.tabela-empilha` ou uma lista de cartões, com os tokens do DESIGN.md. Nenhuma rolagem lateral de 320 a 1440 px.

**Navegação:**
- o botão "Obras" da página inicial passa a apontar para `obras.html`;
- a seção de obras da página da Prefeitura vira um cartão-resumo com link para `obras.html`;
- a página de fontes ganha a entrada "Obras" com as quatro fontes;
- o sitemap inclui `obras.html` sozinho.

## Checagens (node:assert, funções puras)

- `ehObra(objeto, modalidade, categoria, amparo)`: casos da pesquisa, incluindo "secretaria" não casar com ETA e "elaboração de projeto" ficar fora.
- `agruparPorProcesso`.
- `situacaoObra(...)`, que decide o grupo.
- Junção com o TCE.
- Validação de `obras-ligacoes.json`: ids de promessa que existem e formato correto.

## Fora do escopo

Mapa. Notícias usadas como fonte de obra nova: as notícias só entram à mão, como link de prova, se for o caso.
