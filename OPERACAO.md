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

O GitHub atrasa horários agendados, às vezes por horas. Por isso existem o despertador e as reservas.

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
| IEGM e Painel de Obras do TCE | 3 min cada | Mantém o último dado |
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
- houver número com formato de CPF em qualquer página ou arquivo de dados;
- faltar uma página obrigatória, ou ela estiver vazia.

**Avisa** sem bloquear quando há:
- link interno quebrado;
- "undefined", "NaN" ou "null" aparecendo para o leitor;
- valor negativo;
- página sem fonte oficial.

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
- avisos de manutenção do robô, incluindo obra pendente com possível licitação já na lista e bairro novo sem nome fixo.

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
| Bairro novo passou de 10 pedidos | Colocar o nome fixo em `data/referencia/bairros-apelidos.json` (`nomes`). |

## 5. Rotina mensal das promessas

- **Quando e onde:** dia 15, às 09:00 de Brasília, na rotina na nuvem `trig_01SH2Dn5tbXGfkyGwyRdcAjF`.
- **O que faz:**
 - procura provas oficiais de 2025 em diante;
 - nunca rebaixa status nem marca promessa como descumprida;
 - nunca mexe no main.
- **O que entrega:** um PR com tabela, provas e itens descartados. Ao juntar o PR, o robô publica no dia seguinte.
- **Se não aparecer nada no dia 15:** ver a execução em claude.ai/code/routines.

## 6. Ferramentas manuais (só quando um aviso pedir)

| Comando | Para quê |
|---|---|
| `npm run emendas` | Lê os PDFs de emendas da Câmara e gera `data/referencia/emendas.json`. Para em qualquer inconsistência. |
| `node src/ferramentas/promessas.js` | Reextrai o plano de governo (TSE). Não roda no dia a dia: o status é editado à mão ou pela rotina mensal. |
| `node src/ferramentas/campanha-2024.js` | Totais da campanha de 2024 (TSE). Dado fixo. |
| `node src/ferramentas/base-2024.js` | Base de 2024 do Raio-X (empresas "novas"). Dado fixo. |
| `node src/ferramentas/tce-paineis.js`, `contratos.js`, `folha-camara.js`, `respostas.js` | Cargas completas ou testes das fontes, fora do robô. |

## 7. Arquivos curados à mão (o robô só lê)

- `data/referencia/promessas.json`: status das promessas, sempre com prova oficial.
- `data/referencia/obras-ligacoes.json`: ligações entre obras do PNCP e do Obrasgov e as promessas. Uma ligação "pendente" pode ter um campo "buscar".
- `data/referencia/bairros-apelidos.json`: grafias juntadas e nomes fixos dos bairros com página.
- `data/referencia/emendas.json`: gerado pela ferramenta de emendas.
- `data/referencia/fontes-recursos.json`: tabela oficial de fontes de recursos e códigos de acompanhamento (CO) do Tesouro (Portaria STN 710/2021). Trocar quando sair a tabela de um ano novo (a de 2027 vem da Portaria STN/MF 1.986/2026).
- `src/config.js`: vereadores esperados, medição de audiência (Cloudflare e GA4), grafias de nomes nas votações.

## 8. Checagens antes de qualquer mudança

- `npm run checar` roda todas as checagens (node:assert): regras, folha, respostas, campanha, TCE, contratos, emendas, promessas, semana, medição, obras, vistoria, bairros, sentinela e origem do dinheiro. O robô também as roda antes de começar.
- **Processo de mudança:** um revisor separado lê o código; a vistoria e a conferência no navegador cobrem rolagem lateral (320 a 1440 px), âncoras e CPF; e só depois o dono dá o ok para publicar.

## 9. Acessos e chaves

- **GitHub Actions:** usa a chave automática do próprio GitHub. Nada para renovar.
- **Despertador:** chave fine-grained só para disparar o robô deste repositório, sem vencimento, em `/opt/radar-saltense/token` na VPS.
- **Domínio:** radarsaltense.com.br, registrado no Registro.br, com DNS na Cloudflare.
- **Medição:** Cloudflare Web Analytics e GA4 `G-MBXN096LL3`, este só com consentimento.
