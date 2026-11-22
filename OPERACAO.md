# Operação do Radar Saltense

Registro de todas as rotinas que mantêm o site atualizado, de como cada uma é verificada e do que fazer quando algo dá errado. Mantenha este arquivo em dia sempre que uma rotina mudar.

## 1. Visão geral do dia

| Horário (Brasília) | O quê | Onde | Verificação |
|---|---|---|---|
| 03:00 | **Despertador** dispara o robô | VPS gbp-manager-vps, `/etc/cron.d/radar-saltense` | Registro em `/var/log/radar-saltense-despertador.log`; a sentinela avisa se o robô não veio dele |
| 03:00 | Horário agendado do GitHub (reserva 1) | `.github/workflows/atualizar.yml` | Só roda se nenhuma atualização completa deu certo no dia (job `hoje`) |
| 03:00–03:30 | **Robô** coleta, confere, gera e publica | GitHub Actions, "Atualizar Radar Saltense" | Barreira, vistoria e relatório `conferencia` (artefato da execução) |
| 11:00 | Horário reserva do GitHub (reserva 2) | `atualizar.yml` | Igual à reserva 1 |
| 12:30 | **Sentinela** confere tudo | `.github/workflows/sentinela.yml` | Abre alerta (issue "sentinela") por e-mail se algo estiver errado |
| Dia 15, 09:00 | **Rotina das promessas** procura provas oficiais | Rotina na nuvem do Claude (claude.ai/code/routines) | Abre PR em `promessas/AAAA-MM`; nada publica sozinha |
| Dia 5, 09:00 | **Manutenção: população** (IBGE) | `.github/workflows/populacao.yml` | Issue `manutencao-populacao` (seção 11) |
| Dia 6, 09:00 | **Manutenção: domínio** (vencimento no Registro.br) | `.github/workflows/dominio.yml` | Issue `manutencao-dominio` |
| Dia 7, 09:00 | **Manutenção: arquivos de referência** | `.github/workflows/referencias.yml` | Issue `manutencao-referencias` |
| 10 de janeiro, 09:00 | **Manutenção: virada do ano** | `.github/workflows/virada-do-ano.yml` | Sempre abre o issue `manutencao-virada-do-ano` com a lista de conferência |
| Uma vez por mês | **Dependabot** propõe atualizar dependências | `.github/dependabot.yml` | PR com o rótulo `dependencias` (seção 12) |

O GitHub atrasa horários agendados, às vezes por horas. Por isso existem o despertador e as reservas. As verificações de manutenção não têm reserva: se uma atrasar, roda mais tarde no mesmo dia, e nada depende dela.

## 2. O robô diário (`npm run atualizar`)

A ordem é: coletar → processar → conferir (barreira) → relatório → gerar o site → vistoria → salvar os dados no repositório → publicar no GitHub Pages.

### Fontes e o que acontece quando falham

Regra geral: fonte secundária que falha **não trava** o robô. O site mantém o último dado salvo e registra um aviso.

| Fonte | Prazo | Se falhar |
|---|---|---|
| Câmara: vereadores, proposituras, presença, votações (Playwright e PDFs) | — | **Trava**: a barreira não deixa publicar sem esses dados |
| Receitas do TCE-SP | 4 min | Repete o último dado e mostra "Dados do TCE-SP até dd/mm"; acima de 10 dias, também entra na manutenção |
| Despesas do TCE-SP | 6 min | Igual às receitas |
| SICONFI (áreas do gasto) | 3 min | Mantém o último dado |
| MSC do Tesouro (origem do dinheiro, `origem.html`) | 3 min, com nova tentativa | Mantém o último dado salvo em `data/processado/origem.json` e avisa. Ano corrente: a última matriz mensal, uma vez por dia. Ano fechado: continua com a última matriz mensal salva (a mais recente coletada naquele ano) enquanto a de encerramento (MSCE, mês 12) não sai; o robô tenta a MSCE todo dia e troca sozinho quando ela aparece, e daí em diante não consulta mais aquele ano. Cada ano é consultado à parte: erro em um não impede os outros |
| Folha da Câmara | — | Mantém o último dado |
| Respostas a requerimentos (até 150 fichas por dia) | Tempo reservado | Continua no dia seguinte |
| IEGM e Painel de Obras do TCE | 3 min cada | Mantém o último dado. Se o TCE desviar para a página "indisponibilidade temporária" (desde 20/11/2026 só para acessos de fora do Brasil, como o GitHub), o aviso diz isso |
| Compras no PNCP | 6 min | Mantém os anos salvos |
| Obras: PNCP | 6 min | Releitura em partes; nunca apaga o que já estava salvo |
| Obras: Obrasgov.br | 5 min, até 90 consultas por dia | Mantém o que já estava salvo |
| Obras: paralisadas da Prefeitura | — | Mantém o último dado |
| Emendas (PDF novo na Câmara?) | — | Só avisa |

### Barreira (`src/conferir.js`): impede publicar se

- não vierem 11 vereadores, ou se um PDF de presença ou de votações não for lido;
- o total de proposituras cair;
- um mês de receita ou de despesa sumir, ou cair mais de 5%;
- a folha da Câmara cair mais de 20%;
- a soma das áreas do SICONFI não bater com o total.

A origem do dinheiro (MSC) não barra a publicação: se o total arrecadado ou pago diferir mais de 3% do TCE-SP, a página mostra um aviso e a manutenção registra a diferença.

Quando a barreira barra, o site fica na última versão boa.

### Vistoria do site pronto (`src/vistoria.js`)

**Bloqueia** a publicação se:
- houver número com formato de CPF (ou 11 dígitos logo depois de "CPF") em qualquer página ou arquivo publicado (`.html`, `.json`, `.xml`, `.txt`, `.csv`, `.webmanifest`);
- faltar uma página obrigatória, ou ela estiver vazia;
- aparecer "{{" em qualquer página (placeholder do Entenda que não foi trocado).

**Avisa** sem bloquear quando há:
- link interno quebrado;
- "undefined", "NaN" ou "null" aparecendo para o leitor;
- valor negativo;
- página sem fonte oficial;
- falta de `dados.html`, `llms.txt`, `.well-known/security.txt` ou `site.webmanifest`.

### Páginas geradas além dos dados

- `404.html`: o GitHub Pages a mostra para qualquer endereço que não existe (antes respondia 503). Usa caminhos absolutos (`/estilo.css`), tem `noindex` e fica fora do sitemap.
- `sobre.html`: quem faz, independência, como os dados são coletados e como pedir correção.
- `entenda.html`, `entenda/<slug>.html` e `perguntas-frequentes.html`: saem de `data/referencia/entenda.json`. Os números de Salto entram por placeholders (`{{custoCamaraMes}}` etc.), calculados dos dados do dia. Placeholder conhecido sem dado no dia: só a frase sai da página e a manutenção avisa ("Entenda: placeholder..."). Placeholder desconhecido (erro de digitação no arquivo) tira o texto inteiro e avisa; o `check/entenda.mjs` pega isso antes do commit. Sem o arquivo, ou com um texto fora do contrato, aquele texto não sai e a manutenção avisa; o resto do site é publicado.
- `marca/og/vereador-<id>.png`: prévia de link (1200x630) de cada vereador, com foto e nome. Se falhar, a página usa a prévia geral e a manutenção avisa.
- `favicon.ico`, gerado de `site/marca/icone-32.png`.
- Semana sem nenhum dado (0 propostas, 0 votações, 0 respostas, 0 novidades): a página existe, com `noindex`, e fica fora do sitemap.

### Dados abertos e arquivos para máquinas (refeitos a cada geração)

Saem de `src/site/dados-abertos.js`, chamado pelo gerador. Peça que falha não trava: sai desta vez e vira aviso de manutenção; a vistoria avisa (sem bloquear) se faltar `dados.html`, `llms.txt`, `.well-known/security.txt` ou `site.webmanifest`.

| Arquivo | O que é |
|---|---|
| `dados.html` | Página "Dados abertos": para cada arquivo, descrição, dicionário de campos, frequência de atualização, fonte oficial, tamanho e licença (uso livre citando "Radar Saltense (radarsaltense.com.br)" e a fonte oficial; compilação em CC BY 4.0). JSON-LD `DataCatalog` com um `Dataset` por arquivo. Está no rodapé, no sitemap, em `fontes.html` e no `llms.txt`. |
| `dados/vereadores.json` | Partido, presença (P/A/AJ/total), propostas por grupo, votos contra, links do site e da Câmara. |
| `dados/proposituras.csv` | Propostas desde 2025 (sem os atos administrativos, que citam servidores pelo nome): data, tipo, número, grupo, vereadores autores, ementa com CPF/RG já trocados por [omitido], bairros, ruas e ficha oficial. |
| `dados/votacoes.csv` | Projeto, ementa, data, turno, resultado, quem votou contra e o PDF. |
| `dados/gastos-por-ano.json` | Totais por órgão, por tipo de quem recebeu e por área; as maiores empresas, só com CNPJ (pessoa física só nos totais). |
| `dados/obras.json` | As obras de `obras.html`, com a situação como aparece no site e os links oficiais. Contratado sem CNPJ sai como "pessoa física". |
| `dados/origem.json`, `dados/emendas.json`, `dados/promessas.json` | O que aparece em `origem.html`, nas emendas (Câmara e vereadores) e em `promessas.html`. |
| `llms.txt` | Resumo do site para assistentes de IA (formato llmstxt.org), com links absolutos e a data da última atualização. |
| `.well-known/security.txt` | RFC 9116: contato (Instagram), `Expires` um ano depois da data dos dados, `Policy` aponta para `sobre.html` ("Achou um dado pessoal ou uma falha?"). |
| `site.webmanifest` | Manifesto do site (ícones de 192 e 512 px; o de 512 é ampliado do de 192 na geração, porque não há fonte vetorial). |

CSV: UTF-8 com BOM, separador `;`, aspas quando preciso, CRLF (abre direto no Excel). Os arquivos `dados/busca.json` e `dados/empresas.json` continuam como eram (uso interno do site).

O GitHub Pages só recebe a pasta `.well-known` porque o `upload-pages-artifact` roda com `include-hidden-files: true` em `atualizar.yml` (sem isso, ele deixa de fora tudo que começa com ponto). O `.nojekyll` continua sendo gerado.

### Data real de mudança (`data/processado/lastmod.json`)

Para cada página do sitemap, o gerador guarda o hash do conteúdo principal (`<main>`, sem "Atualizado em", datas de coleta e os números do contador), a data da última mudança (`quando`) e a da primeira vez que a página saiu (`criado`). A data só muda quando o hash muda; semana fechada usa o domingo. O sitemap usa essa data no `lastmod`, e os textos do Entenda e as semanas a usam no `dateModified`. O arquivo vai no commit diário (`git add data`). Se ele sumir ou estragar, as datas recomeçam do dia e nada trava.

### Relatório `conferencia.md`

Fica no artefato "conferencia" de cada execução do robô, na aba Actions. As seções são:
- barreira;
- avisos públicos (que aparecem em fontes.html);
- **Manutenção** (só ali, não vai para o site);
- vistoria.

## 3. Sentinela diária (`src/sentinela.js`)

Às 12:30 de Brasília ela confere:

**Problemas** (abrem alerta de problema):
- nenhuma atualização completa deu certo hoje;
- alguma página principal fora do ar;
- o robô rodou, mas o site publicado ainda mostra a data antiga;
- o sitemap encolheu (menos de 150 páginas).

**Atenção** (abrem alerta de "algo a fazer"):
- a atualização não veio do despertador da VPS;
- a atualização ainda está rodando às 12:30, porque o GitHub atrasou;
- avisos de manutenção do robô, incluindo obra pendente com possível licitação já na lista e bairro novo sem nome fixo ou sem conferência no cadastro oficial.

Os alertas são issues com o rótulo `sentinela` no repositório e chegam por e-mail ao dono. Se já houver um alerta aberto, ela comenta nele, mas só quando o conteúdo muda, para não repetir e-mail todo dia. Quando tudo volta ao normal, ela fecha o alerta. Se a própria sentinela falhar, ela abre um alerta dizendo isso.

## 4. O que fazer em cada alerta

| Alerta | O que fazer |
|---|---|
| Nenhuma atualização deu certo | Abrir Actions → "Atualizar Radar Saltense" → a execução que falhou → artefato `conferencia` e log. Se foi a barreira, ler o motivo: em geral uma fonte mudou ou o dado caiu de verdade. Se foi a vistoria e havia CPF, achar a origem e corrigir a regra de ocultar. Depois de corrigir, rodar de novo pelo botão "Run workflow". |
| Página fora do ar | Ver githubstatus.com (Pages). Ver se a última publicação deu certo. Ver o DNS na Cloudflare (registros A/AAAA e CNAME, em "DNS only"). |
| Site com data antiga | A publicação falhou depois do robô: rodar "Run workflow" com "Só publicar". |
| Sitemap encolheu | Ver se alguma página deixou de ser gerada: dados ausentes ou erro no arquivo semanal ou nos bairros. |
| Despertador não disparou | Na VPS: `tail /var/log/radar-saltense-despertador.log`. Testar com `/opt/radar-saltense/despertar.sh teste`. HTTP 401 significa chave inválida: gerar outra no GitHub (fine-grained, só o repositório, Actions: read and write) e colar em `/opt/radar-saltense/token`. |
| PDF novo de emendas | Rodar `npm run emendas` (ver seção 6) e conferir `data/referencia/emendas.json`. |
| Licitação da ETA João Jabour apareceu | Colocar o número do PNCP em `data/referencia/obras-ligacoes.json` (ligação `eta-joao-jabour`) e tirar o "pendente". |
| Origem do dinheiro: MSC × TCE-SP acima de 3% | Abrir a consulta da MSC citada na manutenção e o TCE-SP do mesmo período. Se a Prefeitura reenviou a matriz, a próxima atualização corrige sozinha; se não, a diferença fica explicada na página. |
| Origem do dinheiro: código sem nome | Baixar a planilha de fontes do ano no Tesouro (link em `data/referencia/fontes-recursos.json`) e acrescentar o código que faltou. |
| Bairro novo passou de 10 pedidos | Colocar o nome fixo em `data/referencia/bairros-apelidos.json` (`nomes`). Depois, procurar o nome em `data/referencia/bairros-oficiais.json` e registrar em `oficial` (chave → nome oficial; `[]` se não consta) ou em `oficial_ligados` (quando o cadastro divide a área em vários nomes). Só registrar correspondência conferida. Em dúvida, seção 8. |
| Bairros oficiais: arquivo não lido ou com erro | As páginas saem sem a linha do nome oficial. Corrigir o JSON de `data/referencia/bairros-oficiais.json` (ver seção 7). |
| Issue `manutencao-*` | Ver a seção 11: cada verificação diz no próprio issue o que fazer e em qual arquivo. |
| "Manutenção, …: a verificação falhou" | A própria verificação quebrou (ex.: IBGE ou Registro.br fora do ar). Abrir o log pelo link do issue; se foi a rede, rodar de novo pelo botão "Run workflow" do workflow e fechar o issue. O site não é afetado. |

## 5. Rotina mensal das promessas

- **Quando e onde:** dia 15, às 09:00 de Brasília, na rotina na nuvem `trig_01SH2Dn5tbXGfkyGwyRdcAjF`.
- **O que faz:**
 - procura provas oficiais de 2025 em diante;
 - nunca rebaixa status nem marca promessa como descumprida;
 - nunca mexe no main.
- **O que entrega:** um PR com tabela, provas e itens descartados. Ao juntar o PR, o robô publica no dia seguinte.
- **Se não aparecer nada no dia 15:** ver a execução em claude.ai/code/routines.

### 5b. Outras rotinas na nuvem do Claude (cada uma com disparo próprio, sem conectores)

| Rotina | Quando (Brasília) | O que faz | O que entrega |
|---|---|---|---|
| Revisão semanal do site (`trig_018Fb3LRdAqgF4c4v81d5WeG`) | Segundas, 10:00 | Só lê o site no ar: números que não batem entre páginas, saltos estranhos, datas paradas, seções vazias, links oficiais quebrados, texto que soe como acusação, gênero de pessoa, CPF. Não muda nada. | Relatório na sessão; issue `revisao-semanal` se o GitHub CLI estiver disponível (fecha quando tudo certo). |
| Revisão anual dos textos Entenda (`trig_01YZZNbcnarGgsUicTnugwuV`) | 10 de fevereiro, 09:00 | Confere na fonte oficial cada lei citada em `data/referencia/entenda.json` (reforma tributária, CF 29-A, 166, 212, Fundeb, LAI, Lei Orgânica e Regimento de Salto). | Se algo mudou: PR no ramo `entenda/<ano>` para aprovação; se nada mudou: "Nada mudou nas leis citadas". Nunca publica sozinha. |

Gerenciar (pausar, rodar agora, mudar horário): claude.ai/code/routines.

## 6. Ferramentas manuais (só quando um aviso pedir)

| Comando | Para quê |
|---|---|
| `npm run emendas` | Lê os PDFs de emendas da Câmara e gera `data/referencia/emendas.json`. Para em qualquer inconsistência. |
| `node src/ferramentas/promessas.js` | Reextrai o plano de governo (TSE). Não roda no dia a dia: o status é editado à mão ou pela rotina mensal. |
| `npm run osm` | Uma vez por mês: compara as páginas de bairro e a lista oficial com o OpenStreetMap (seção 8). Não faz parte do robô. |
| `node src/ferramentas/campanha-2024.js` | Totais da campanha de 2024 (TSE). Dado fixo. |
| `node src/ferramentas/base-2024.js` | Base de 2024 do Raio-X (empresas "novas"). Dado fixo. |
| `node src/ferramentas/tce-paineis.js`, `contratos.js`, `folha-camara.js`, `respostas.js` | Cargas completas ou testes das fontes, fora do robô. |

## 7. Arquivos curados à mão (o robô só lê)

- `data/referencia/promessas.json`: status das promessas, sempre com prova oficial.
- `data/referencia/obras-ligacoes.json`: ligações entre obras do PNCP e do Obrasgov e as promessas. Uma ligação "pendente" pode ter um campo "buscar".
- `data/referencia/bairros-apelidos.json`: grafias juntadas, nomes fixos dos bairros com página e a conferência com o cadastro oficial (`oficial` e `oficial_ligados`).
- `data/referencia/bairros-oficiais.json`: nomes oficiais de bairros e loteamentos. Base: Anexo I da Planta Genérica de Valores (Lei 3.227/2013, consolidada até a Lei 3.683/2017), coluna "Bairro", com a grafia literal em `nome_na_lei`; mais os loteamentos de decretos e leis de 2015 a 2021 (`loteamentos_posteriores`, cada um com o ato e o link). Salto não tem bairros no IBGE (Censo 2022). Campo opcional `lai_pedido_em` (AAAA-MM-DD): data do último pedido por LAI da lista do cadastro; a verificação mensal de referências lembra o pedido quando a data mais nova (`data` ou `lai_pedido_em`) passa de um ano. Para atualizar: procurar na Imprensa Oficial (imprensaoficialmunicipal.com.br/salto) "loteamento denominado", "Valor Básico Unitário da Face de Quadra" e "denominação das ruas do loteamento", e acrescentar o loteamento novo com o ato e o link; se sair nova Planta Genérica de Valores, refazer a lista. Outro caminho: pedir por LAI (e-SIC) à Prefeitura a relação de bairros e loteamentos do cadastro imobiliário. Pesquisa completa em `.superpowers/pesquisa/bairros-oficiais.md`.
- `data/referencia/emendas.json`: gerado pela ferramenta de emendas.
- `data/referencia/entenda.json`: textos do Entenda e perguntas frequentes. Os números de Salto só por placeholder (lista em `src/site/entenda.js`, `PLACEHOLDERS`); `npm run checar` confere o contrato (`check/entenda.mjs`).
- `data/referencia/fontes-recursos.json`: tabela oficial de fontes de recursos e códigos de acompanhamento (CO) do Tesouro (Portaria STN 710/2021). Trocar quando sair a tabela de um ano novo (a de 2027 vem da Portaria STN/MF 1.986/2026).
- `src/config.js`: vereadores esperados, medição de audiência (Cloudflare e GA4), grafias de nomes nas votações e a população (`POPULACAO`, divisor do "por morador" do impostômetro; o campo `ano` é opcional e serve à verificação mensal da população).

## 8. Bairros: conferência

O nome oficial de um bairro só vem de ato oficial. O OpenStreetMap e o Google Maps ajudam a achar o que conferir, mas nunca viram afirmação no site.

### a) Lista oficial e como atualizar

- Base: `data/referencia/bairros-oficiais.json` (PGV da Lei 3.227/2013, consolidada até 2017, mais os loteamentos de decretos e leis posteriores, cada um com o ato e o link). Detalhes na seção 7.
- Atualizar: procurar na Imprensa Oficial (imprensaoficialmunicipal.com.br/salto) os decretos de loteamento ("loteamento denominado", "Valor Básico Unitário da Face de Quadra", "denominação das ruas do loteamento") e acrescentar o loteamento com o ato e o link. Outro caminho: pedir por LAI (e-SIC) à Prefeitura a relação de bairros e loteamentos do cadastro imobiliário.
- A conferência de cada página fica em `data/referencia/bairros-apelidos.json`: `oficial` (chave → nomes oficiais; `[]` = conferido e não consta), `oficial_ligados` e o registro em `_leia_oficial`.

### b) OpenStreetMap, uma vez por mês (`npm run osm`)

- Rodar à mão (uma vez por mês, ou antes de revisar bairros). Não faz parte do robô diário e não trava nada.
- Faz 3 consultas ao Overpass (com identificação, prazo e nova tentativa com espera em 429/5xx) e grava:
 - `data/osm/salto.json`: lugares (nome, tipo, polígono ou ponto, centróide), problemas do OSM, contagem de `addr:suburb` e ruas (bairro quando o ponto médio cai num polígono; senão só "perto"). Vai para o repositório, separado de `data/referencia` por causa da licença ODbL (campo `licenca`). O site não lê esse arquivo; os centróides ficam para um mapa futuro, que então precisará mostrar "© colaboradores do OpenStreetMap" com link para openstreetmap.org/copyright.
 - `relatorio-osm.md` na raiz (fora do repositório): grafias divergentes entre página, nome oficial e OSM; OSM × lista oficial; loteamentos só no OSM (fila de investigação: conferir no decreto antes de qualquer página); páginas sem nada no OSM; correções que valem a pena no próprio OSM (ex.: "Jardim da Ciudade II").
- Ler o relatório e decidir o que muda em `bairros-apelidos.json`. Só muda com ato oficial ou com a conferência manual (item c) registrada. Nunca copiar nome, rua → bairro ou coordenada do OSM para `data/referencia`.
- Se o Overpass falhar, rodar de novo outro dia: o arquivo anterior fica como está. Resposta suspeita (poucos lugares ou ruas) também não troca o arquivo.

### c) Conferência manual no navegador (quando houver dúvida)

- Quando: a sentinela ou a manutenção do `conferencia.md` avisam bairro sem correspondência oficial, ou o `relatorio-osm.md` mostra o oficial e o OSM discordando.
- Como: abrir uma sessão do Claude e pedir para "conferir bairros em dúvida". O Claude abre o Google Maps e as fontes oficiais (Imprensa Oficial, PGV, decretos) no navegador embutido, decide caso a caso e registra só a decisão e a data em `_leia_oficial` e no mapeamento (`oficial` / `oficial_ligados`). Nada é copiado do Google (os termos de uso proíbem): nem nome, nem coordenada, nem traçado.
- Exemplo (18/11/2026): "Jardim Alvorada" → Residencial Alvorada, confirmado pelo Google Maps e ligado; "Jardim Iracema" e "Barnabé" ficaram sem confirmação e seguem sem correspondência.

## 9. Checagens antes de qualquer mudança

- `npm run checar` roda todas as checagens (node:assert): regras, folha, respostas, campanha, TCE, contratos, emendas, promessas, semana, medição, obras, vistoria, bairros, sentinela, origem do dinheiro, Entenda (contrato do `entenda.json`) e SEO (lastmod, placeholders, trilha, títulos com " | Radar Saltense" e até 70 caracteres, 404) e as regras de comparação com o OpenStreetMap (`check/osm.mjs`, só com dados inventados) e as regras das verificações de manutenção (`check/manutencao.mjs`, só com dados inventados) e os dados abertos (`check/dados-abertos.mjs`: CSV com BOM, ";" e aspas; `Expires` do security.txt; llms.txt; empresa só com CNPJ; CPF em CSV). O robô também as roda antes de começar.
- **Processo de mudança:** um revisor separado lê o código; a vistoria e a conferência no navegador cobrem rolagem lateral (320 a 1440 px), âncoras e CPF; e só depois o dono dá o ok para publicar.

## 10. Acessos e chaves

- **GitHub Actions:** usa a chave automática do próprio GitHub. Nada para renovar.
- **Despertador:** chave fine-grained só para disparar o robô deste repositório, sem vencimento, em `/opt/radar-saltense/token` na VPS.
- **Domínio:** radarsaltense.com.br, registrado no Registro.br, com DNS na Cloudflare.
- **Medição:** Cloudflare Web Analytics e GA4 `G-MBXN096LL3`, este só com consentimento.

## 11. Verificações de manutenção (mensais e anuais)

Cada verificação é um workflow separado, com horário e rótulo de issue próprios. Nenhuma mexe no site, nos dados ou no robô diário: só leem e abrem, comentam ou fecham um issue. Usam só a chave automática do GitHub (`GITHUB_TOKEN`).

| Verificação | Quando (Brasília) | Script e workflow | Abre o issue quando |
|---|---|---|---|
| População | Dia 5, 09:00 (12:00 UTC) | `src/manutencao/populacao.js`, `populacao.yml` | A população do IBGE (estimativa, tabela 6579, ou Censo, tabela 4709, o que for mais novo) é diferente de `POPULACAO` em `src/config.js`, ou é de um ano mais novo que `POPULACAO.ano`. O issue traz o número, o ano, o link oficial e a linha exata a trocar. |
| Domínio | Dia 6, 09:00 (12:00 UTC) | `src/manutencao/dominio.js`, `dominio.yml` | Faltam menos de 60 dias para o vencimento de radarsaltense.com.br (RDAP do Registro.br), o RDAP não traz a data ou o domínio não está ativo. A data de vencimento sai sempre no log. |
| Arquivos de referência | Dia 7, 09:00 (12:00 UTC) | `src/manutencao/referencias.js`, `referencias.yml` | (a) código de fonte ou CO em `data/processado/origem.json` sem nome em `data/referencia/fontes-recursos.json`; (b) bairro com página sem nome fixo ou sem conferência no cadastro oficial (`bairros-apelidos.json`); (c) a lista oficial de bairros (`bairros-oficiais.json`) passou de um ano sem pedido por LAI registrado em `lai_pedido_em`; (d) erro de contrato ou placeholder desconhecido em `data/referencia/entenda.json`. Sem rede. |
| Virada do ano | 10 de janeiro, 09:00 (12:00 UTC) | `src/manutencao/virada-do-ano.js`, `virada-do-ano.yml` | Sempre: lista de conferência com ✅ e ⚠️ (robô rodando no ano novo; receitas e despesas do ano novo, onde "ainda sem mês oficial" é normal; ano anterior fechado nas receitas, nos gastos e na origem, onde a MSCE pendente é normal; resumo da semana de 1º de janeiro; emendas do ano novo, com `npm run emendas` quando a Câmara publicar; promessas e obras; tabela de fontes do Tesouro do ano) e os lembretes do ano: população, tabela do Tesouro, renovação do domínio, revisão jurídica anual do Entenda (rotina na nuvem de fevereiro) e pedido por LAI dos bairros. Sem rede. |

**Como o issue funciona** (igual à sentinela): rótulo `manutencao-<nome>`, menção ao dono na abertura, e chega por e-mail. Se já houver um aberto, só comenta quando o conteúdo muda (a data da 1ª linha não conta). Quando tudo volta ao normal, a verificação do mês seguinte fecha o issue. Se a própria verificação quebrar, o workflow abre um issue "a verificação falhou" com o link do log (seção 4).

**Rodar à mão:** botão "Run workflow" do workflow na aba Actions; ou, no computador, `DRY_RUN=1 node src/manutencao/<nome>.js` mostra o corpo do issue sem chamar o GitHub. Na virada do ano, `AGORA=2027-01-10T12:00:00Z` simula a data.

## 12. Dependências (Dependabot)

- `.github/dependabot.yml`: uma vez por mês, um PR para as dependências do npm (raiz) e outro para as ações do GitHub (cada um agrupado), no máximo 2 abertos de cada, com o rótulo `dependencias`. Criar o rótulo uma vez no repositório (`gh label create dependencias`), senão o Dependabot abre o PR sem ele.
- **Nunca juntar sozinho (sem auto-merge).** Antes de juntar: o PR precisa passar no `npm run checar` e ser revisado (o que mudou na dependência e se o robô e o site continuam iguais, seção 9). Mudança de versão principal (Playwright, pdfjs-dist, sharp) pede uma execução do robô com "Run workflow" depois de juntar.
