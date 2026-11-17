# SEO das páginas e arquivo semanal — design

Data: 2026-11-17. Aprovado pelo usuário ("Aprovado").

## Objetivo

Alcance e posicionamento no Google com o que o site já tem: dado oficial atualizado. Sem textos de opinião.

## 1. SEO das páginas existentes

### `layout()` em src/site/base.js

Recebe três parâmetros opcionais:
- `descricao`: vai para `<meta name="description">` e `og:description`. O padrão é a DESCRICAO de hoje.
- `caminho`: caminho relativo da página, por exemplo `vereador/x.html` ou `index.html`. Gera `<link rel="canonical">` e `og:url` absolutos com ENDERECO; `index.html` vira a raiz.
- `jsonld`: um objeto ou uma lista, que vira `<script type="application/ld+json">` com `JSON.stringify`, escapando `</` como `<\/`.

### Títulos com "Salto" e descrições próprias

As descrições são frases curtas, com até cerca de 155 caracteres.

**Índice:** mantém o título e a descrição de hoje. JSON-LD `WebSite` com `name`, `url`, `inLanguage` pt-BR e `description`.

**Vereador:**
- Título: "<Nome> na Câmara de Salto: presença, votos e propostas".
- Descrição: "<Nome> (<partido>), vereador da legislatura 2025–2028..." **não** vale, porque não se escreve gênero. Use algo como "Presença nas sessões, votos, propostas, requerimentos respondidos e emendas de <Nome> (<partido>) na Câmara de Salto/SP. Dados oficiais." e inclua o apelido quando houver.
- JSON-LD `Person`:
  - `name`, `alternateName` (apelido), `image` (foto absoluta, se existir), `url` (página no site), `sameAs` (página oficial na Câmara, `v.url`);
  - `memberOf`: `GovernmentOrganization` "Câmara Municipal de Salto", url camarasalto;
  - `affiliation`: `PoliticalParty` com o nome do partido;
  - **sem** `jobTitle` e **sem** `gender`.

**Câmara:** "A Câmara de Salto: custo, emendas e requerimentos". Descrição: quanto custa, salários e folha, requerimentos respondidos pela Prefeitura, emendas dos vereadores e campanhas de 2024. JSON-LD `GovernmentOrganization` da Câmara, com `url` e `sameAs` do site oficial.

**Prefeitura:** "A Prefeitura de Salto: promessas, obras, compras e nota do TCE". Descrição equivalente, com JSON-LD `GovernmentOrganization` da Prefeitura.

**Demais páginas:**

| Página | Título |
|---|---|
| votações | "Votações da Câmara de Salto" |
| promessas | "Promessas do prefeito de Salto" |
| obras | "Obras em Salto" (já está assim) |
| impostômetro | "Impostômetro de Salto" (já está assim) |
| gastos | "Raio-X dos gastos de Salto" |
| semana | "Resumo da semana em Salto" |
| fontes | "De onde vêm os números do Radar Saltense" |

Todas mantêm o sufixo ": Radar Saltense" e cada uma ganha descrição própria e `caminho`.

## 2. Arquivo semanal

### Semana de calendário

A semana vai de segunda a domingo, no fuso de São Paulo, e é identificada pela segunda-feira (`segundaDaSemana`).

Função pura nova em src/regras/semana.js:

```
resumoSemanaCalendario(d, segundaISO, ateISO, novidadesDaSemana = [])
```

- A janela vai da segunda até o menor entre o domingo e `ateISO` (hoje).
- Propostas por vereador, bairros, votações e respondidos seguem a mesma regra de `resumoSemana`, mas com essa janela.
- `novidades` são as de `meta.novidadesRecentes` com data dentro da janela.
- Retorna também `completa` (o domingo já passou) e `segunda`/`domingo`.

### Requerimentos respondidos no histórico

A fonte é `data/processado/respostas.json`, com a data da resposta, se existir. Leia o formato antes; ele é serializado por src/regras/respostas.js. Se não houver data de resposta confiável para semanas antigas, mostre "respondidos" só a partir da semana em que a informação existe, e diga isso na página: "contagem de respostas disponível a partir de dd/mm/aaaa".

### Gravação

Em `data/processado/semanas.json`, um arquivo só, `{ "AAAA-MM-DD": resumo, ... }`, o que é mais simples para o git e para o gerador.

- Todo dia o robô (src/atualizar.js) recalcula a semana corrente e grava por cima dela.
- Semanas já completas não são reescritas, salvo se o arquivo ainda não as tiver.
- Na primeira execução, ou quando o arquivo não existe, o robô preenche o histórico desde a semana de 2025-01-01 (a segunda-feira 2024-12-30) até a semana passada, com os dados atuais.
- Novidades antigas não existem e ficam vazias.

### Páginas

**`semana/AAAA-MM-DD.html`**, uma por semana. Use `pagina()` do gerador, com prefixo `../`:
- Título: "Semana de dd/mm a dd/mm/aaaa em Salto: Radar Saltense".
- H1: "Semana de dd a dd de <mês> de aaaa em Salto".
- Seções iguais às de `paginaSemana`, com fontes e links. Os links de vereador apontam para `../vereador/x.html`.
- Botão de WhatsApp com o link permanente da semana.
- Navegação "← Semana anterior | Próxima semana →" e o link "Todas as semanas".
- Semana corrente: aviso "Semana em andamento: atualizada todo dia até domingo."
- Semana sem nada: "Nada de novo nos dados oficiais desta semana."
- Descrição gerada: "Em Salto, de dd/mm a dd/mm/aaaa: N propostas novas na Câmara, N votações, N requerimentos respondidos."
- JSON-LD `Article` com `headline`, `datePublished` (a segunda), `dateModified` (atualizadoEm, ou o domingo se a semana estiver completa), `inLanguage`, `about` "Salto (SP)" e `publisher` WebSite Radar Saltense.

**`semana.html`**, os últimos 7 dias:
- Mantém o conteúdo atual.
- Ganha link para a página da semana corrente.
- Ganha "Semanas anteriores": lista de links em `details` por ano, o ano mais recente aberto, cada item com "dd/mm a dd/mm: N propostas, N votações".

**Feed:** os itens são as últimas 8 semanas do arquivo, a mais recente primeiro.
- `link` e `guid` (permalink) apontam para o endereço absoluto da página da semana.
- `pubDate` é o domingo às 12:00 de São Paulo se a semana estiver completa; senão, atualizadoEm.
- A descrição segue o formato de hoje.

**Sitemap:** inclui todas as semanas, via `pagina()`.

## Regras do projeto

- Só dado oficial, com fonte.
- Sem CPF e sem nome de pessoa física.
- Texto em pt-BR simples.
- Celular primeiro, sem rolagem lateral.
- Checagens só com node:assert em funções puras.
- A vistoria precisa passar, com 0 bloqueios e 0 avisos.
- Fonte que falha não trava o robô.

## Checagens (check/semana.mjs e outra que couber)

- `resumoSemanaCalendario`: janela segunda–domingo; semana corrente cortada em hoje; `completa`.
- Preenchimento do histórico: começa em 2024-12-30 e não reescreve semana completa já salva.
- `layout`: canonical correto para `index.html` e para `vereador/x.html`; JSON-LD escapado com `</`.
- Feed: 8 itens, guids estáveis e únicos.

## Fora do escopo

Páginas por bairro (o item 2 da conversa) e textos explicativos (o item 4).
