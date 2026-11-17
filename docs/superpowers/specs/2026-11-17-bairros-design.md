# Páginas por bairro — design

Data: 2026-11-17. Aprovado pelo usuário ("Aprovado").

## Objetivo

Responder às buscas locais ("buraco rua X Salto", "obra Jardim Y", "o que pediram pro meu bairro") com uma página por bairro, só com dado oficial.

## Dados

- `d.proposituras[].locais` traz `{ tipo: 'bairro' | 'rua', nome, chave }`. `d.locais` traz `{ nome, tipo, idx }`.
- 461 nomes de bairro diferentes, com variações: sufixo " - Salto/SP", prefixos "Loteamento", "Residencial" e "Jd."/"Jardim", acentos.
- **Unificação:**
  - Uma função pura `chaveBairro(nome)` normaliza: tira o sufixo de cidade, usa a `normalizar()` do projeto, padroniza "jd."/"jd" para "jardim" e "vl." para "vila".
  - Uma lista curada `data/referencia/bairros-apelidos.json`, `{ "apelido normalizado": "Nome canônico" }`, junta o que a normalização não resolve.
  - O implementador semeia essa lista só com variações óbvias, conferidas nos dados, e lista no relatório cada junção feita.
  - **Nunca** juntar bairros diferentes, por exemplo "Jardim Celani" com "Jardim Celani II". Na dúvida, ficam separados.
- **Corte:** página só para bairro com **10 propostas ou mais** (contando cada proposta uma vez por bairro). O corte fica numa constante.

## Página `bairro/<slug>.html`

Todas as páginas usam o prefixo `../` e entram pelo `pagina()` do gerador, que alimenta o sitemap.

- **Título:** "<Bairro>, Salto: pedidos dos vereadores, ruas e obras: Radar Saltense". O H1 é "<Bairro>".
- **Descrição gerada:** "Em <Bairro> (Salto/SP), os vereadores fizeram N pedidos desde 2025: veja os tipos de problema, as ruas mais citadas, os pedidos repetidos e as obras."
- **JSON-LD:** `Place` com `name`, `url`, e `containedInPlace` `City` Salto com `addressRegion` SP. Sem nada pessoal.

**Seções** (cada uma só aparece se tiver dado, sempre com fonte):

1. **Números.**
   - Total de propostas desde 2025.
   - Total por grupo, usando `GRUPOS`/`GRUPOS_PUBLICOS` do projeto: melhoria, cobrança, homenagem, lei e outros.
   - Os 5 vereadores que mais citaram o bairro, com link para `../vereador/<id>.html`. Vereador de fora da lista atual aparece pelo nome, sem link.
2. **Tipos de problema.** Contagem com a mesma classificação do "problema que não some" (`TIPOS_NOME` em `src/regras/local.js` e a função que classifica o tipo de pedido; reuse, não duplique). Os 8 maiores.
3. **Ruas mais citadas.** Ruas que aparecem nas mesmas propostas que o bairro. As 10 maiores, com contagem.
4. **O problema que não some.** Itens de `d.repetidos` cuja rua está entre as ruas ligadas ao bairro, com a mesma apresentação e o mesmo aviso da página inicial.
5. **Últimos pedidos.** Os 15 mais recentes, com data, autores, tipo e link "ficha oficial" (`fichaOficial(id)`), e o link "Ver todos na busca" → `../index.html#bairro`.
6. **Obras que citam o bairro.** Obras de `d.obras.lista` cujo título ou objeto contém o nome canônico do bairro, normalizado e com fronteira de palavra.
   - Excluir nomes genéricos e curtos: "Centro", "Vila Nova", e qualquer nome com uma palavra de até 6 letras. A lista de genéricos fica numa constante.
   - Cada obra mostra o título, o grupo e o link para `../obras.html#<id>`.
   - Texto: "Obras cuja descrição oficial cita o bairro".

**Avisos:** "Pedido não é obra feita." e "Pedido repetido não prova que a Prefeitura ignorou."

**Fontes:** seloFonte do portal de proposituras da Câmara e link para `../fontes.html#ruas`.

## Índice `bairros.html`

- **Título:** "Bairros de Salto: o que os vereadores pediram e as obras: Radar Saltense".
- Lista de A a Z dos bairros com página, com a contagem de propostas, e um campo de filtro (JS, como os filtros existentes). Sem JS, a lista toda aparece.
- Uma frase sobre os bairros com menos de 10 pedidos: eles ficam na busca da página inicial.
- **Página inicial:** a seção `#bairro` ganha o link "Ver a página do seu bairro" → `bairros.html`.

## Regras do projeto

- Só dado oficial, com fonte. Fato, nunca acusação.
- Sem CPF e sem nome de pessoa física. Nomes de rua e de bairro são permitidos, assim como os vereadores.
- `esc()` em todo texto vindo dos dados.
- Português simples.
- Celular primeiro, sem rolagem lateral de 320 a 1440 px.
- A vistoria precisa passar, com 0 bloqueios e 0 avisos.
- Checagens com node:assert em funções puras.

## Checagens (`check/bairros.mjs`, no `checar`)

- `chaveBairro`: sufixo de cidade, "Jd." vira "Jardim", acentos; "Jardim Celani" e "Jardim Celani II" ficam diferentes.
- Corte de 10.
- Casamento de obra: fronteira de palavra, e o nome genérico não casa.
- Apelidos: todo destino da lista existe entre os nomes vistos.
- Slug estável.
