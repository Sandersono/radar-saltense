# Medição de audiência — design

Data: 2026-11-16. Aprovado pelo usuário em conversa ("Os dois", "Cloudflare", "Aprovado").

## Objetivo

Saber quantas pessoas usam o Radar Saltense, de onde vêm, o que leem e se conferem as fontes oficiais, sem quebrar a confiança de um site de transparência e respeitando a LGPD.

## Camadas

### 1. Cloudflare Web Analytics (todo visitante, sem cookie)

- Script `https://static.cloudflareinsights.com/beacon.min.js` com `data-cf-beacon='{"token":"<TOKEN>"}'` em todas as páginas, via `layout()` em `src/site/base.js`.
- Sem cookie e sem aviso. O DNS fica em "DNS only", por isso o script é colocado manualmente com o token.
- Token em `src/config.js`: `MEDICAO.cloudflare`. Se estiver vazio, o script não entra na página.

### 2. Google Analytics 4 (só com consentimento)

- ID em `src/config.js`: `MEDICAO.ga4` (formato `G-XXXXXXX`). Se estiver vazio, não há barra nem GA.
- Barra de consentimento fixa no pé da tela, com o texto: "Usamos o Google Analytics para saber quais páginas ajudam mais. Só com o seu ok." e os botões **Aceitar** e **Agora não**.
  - Usa os tokens do DESIGN.md: fundo `--rio-escuro`, botão principal `--ambar`. É mobile-first e não cobre o conteúdo: o `body` ganha um respiro embaixo enquanto a barra aparece.
  - Marcação: `role="region"` e `aria-label="Cookies"`. Os botões são `<button>` de verdade e o foco é visível.
- O script do Google (`gtag.js`) só é carregado depois de **Aceitar**. Antes disso, não há nenhuma chamada ao Google e nenhum cookie.
- A escolha fica salva em `localStorage` com a chave `rs-cookies` e o valor `aceito` ou `recusado`. Todo acesso ao `localStorage` fica em try/catch; se ele falhar, a barra aparece de novo e nada é carregado.
- No rodapé, um botão "Cookies" reabre a barra. Se a pessoa recusar depois de ter aceitado, os cookies `_ga*` são apagados e o GA para de ser chamado a partir da próxima página.
- Sem JavaScript, não há barra nem GA (a barra começa escondida e só o script a mostra).
- A medição aprimorada do GA4 (rolagem, cliques externos, downloads) é ligada no painel do Google pelo usuário; não há código para isso.

### 3. Eventos (só GA4, só com consentimento)

Tudo é feito por delegação de clique e de mudança em `site/busca.js`, sem mexer em cada página.

| Evento | Quando | Parâmetros |
|---|---|---|
| `clique_fonte` | clique em `a.selo-fonte` ou em link externo para domínio oficial | `dominio` (só o host) |
| `busca` | busca de empresa ou de bairro, ao sair do campo ou com Enter, uma vez por termo | `tipo` (`empresa` ou `bairro`), `achou` (sim/não) |
| `troca_ano` | mudança no seletor de ano | `ano` |
| `rss` | clique no link do feed | (nenhum) |
| `menu` | clique em item do menu principal | `item` (texto do link) |

O texto digitado na busca nunca é enviado, porque pode conter o nome de uma pessoa.

### 4. Search Console e mapa do site

- `gerar-site` passa a escrever:
  - `sitemap.xml`, com todas as páginas `.html` geradas e o endereço `https://radarsaltense.com.br/`;
  - `robots.txt`, com `Allow: /` e a linha `Sitemap:`.
- A verificação do domínio é feita pelo usuário, com um registro TXT na Cloudflare.

### 5. Transparência

- Nova seção `#privacidade` em `fontes.html`, "Privacidade e audiência", com o chip correspondente no sumário. Ela diz:
  - o que a Cloudflare conta;
  - o que o Google mede, e só com o ok do visitante;
  - o que nunca é coletado: texto digitado, nome e documento;
  - como mudar a escolha.

## Fora do escopo

- Painel público de visitas.
- Consent Mode avançado do Google, que manda sinais antes do aceite.
- Pixel de anúncios.
- Mapas de calor.

## Checagem

`check/medicao.mjs` (node:assert), sobre funções puras:
- `dominioDe(url)` em `src/util/texto.js` ou junto do sitemap;
- `sitemapXml(paginas, endereco)`: XML válido com uma `<url>` por página e sem `index.html` duplicado.

## O que depende do usuário

1. ID do GA4 (`G-…`).
2. Token do Cloudflare Web Analytics.
3. Registro TXT do Search Console na Cloudflare e envio do sitemap.

Sem 1 e 2, o código vai para o ar desligado (config vazia) e não muda nada para o visitante.

## Ordem

Implementar depois da integração da onda 3, porque ela mexe em `base.js`, no menu e no `<head>`. A medição sai na mesma publicação da onda 3 ou logo depois.
