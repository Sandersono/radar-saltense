# SEO geral, seção "Entenda" e "Perguntas frequentes" — design

Data: 2026-11-17. Pedido do usuário: textos explicativos, FAQ e revisão geral de SEO com as melhores práticas. A base é a auditoria SEO de 17/11 (relatório do agente, resumido aqui) e o teste com curl:
- www e http fazem 301 para https://radarsaltense.com.br/ (ok);
- `/index.html` e `/camara` respondem 200 (o canonical cobre);
- **um endereço inexistente responde 503**, porque não há 404.html;
- cache de 600 s;
- previa.png pesa 141 KB.

São duas frentes que andam em paralelo, com contrato definido aqui:
- **A, SEO técnico e renderização:** mexe em código.
- **B, conteúdo:** escreve só `data/referencia/entenda.json`.

## Frente A — SEO técnico (código)

1. **Página 404** (crítico): gerar `dist/404.html` com `layout()` e `<meta name="robots" content="noindex">`, sem canonical. Usar caminhos absolutos (`/estilo.css`, `/marca/...`), porque o GitHub Pages serve essa página em qualquer profundidade. Texto simples com links para as seções. Fora do sitemap.
2. **Links internos para o canônico**: logo e menu apontam para `/` (ou `./` relativo à raiz, via prefixo), não para `index.html`; `#bairro` vira `/#bairro`. Varrer todos os templates.
3. **Títulos**:
   - Sufixo uniforme " | Radar Saltense", inclusive em câmara e prefeitura.
   - "Salto/SP" nos títulos das páginas de seção.
   - Bairro: "<Bairro>, Salto/SP: pedidos dos vereadores e obras | Radar Saltense", encurtado se passar de 65 caracteres.
   - O H1 da página de bairro vira "<Bairro>, Salto: o que os vereadores pediram".
   - **Não mudar o H1 da home**, que é escolha do dono.
4. **Navegação de rodapé** em `layout()`, com todas as seções:
   - Vereadores (`/#vereadores`), Câmara, Prefeitura, Obras, Gastos, De onde vem o dinheiro, Impostos, Promessas, Votações, Bairros, Resumo da semana;
   - Entenda, Perguntas frequentes, Sobre, Fontes.
5. **Trilha de navegação**: `layout({ trilha: [{nome, caminho}] })` gera a trilha visível `<nav aria-label="Você está em">` e o JSON-LD `BreadcrumbList`. Usar em vereador, bairro, semana, entenda/*, origem, obras, promessas, gastos, impostômetro e votações.
6. **Página `sobre.html`**:
   - quem faz (o autor que já aparece no rodapé);
   - por que o site existe;
   - independência: sem ligação com a Câmara, a Prefeitura ou partidos;
   - como os dados são coletados (link para fontes.html);
   - política de correção: "achou erro? Instagram; o site se corrige quando a fonte corrige";
   - histórico curto do que o site cobre.

   O JSON-LD `Organization` "Radar Saltense" (url, logo, sameAs Instagram, founder Person) entra na home e no Sobre. No `WebSite` da home, o `publisher` aponta para essa Organization.
7. **Estrutura de dados**:
   - Câmara e Prefeitura viram `WebPage` com `about` = GovernmentOrganization; o site não se declara órgão.
   - Vereador vira `ProfilePage` com `mainEntity` = Person, sem jobTitle e sem gênero.
   - Article das semanas:
     - `author` e `publisher` = Organization com logo;
     - datas ISO completas com fuso;
     - `dateModified` real.
   - Place do bairro: tirar o `address` de dentro de City.
   - Dataset de origem: `creator`/`publisher`, `dateModified`, `distribution` (link para o endpoint do SICONFI), `keywords`.
8. **`lastmod` real no sitemap**:
   - guardar em `data/processado/lastmod.json` o hash do conteúdo principal (`<main>`, sem rodapé nem datas de geração) de cada página;
   - a data só muda quando o hash muda;
   - semana fechada usa o domingo.

   O robô grava esse arquivo no commit diário.
9. **Semanas sem nenhum dado** (0 propostas, 0 votações, 0 respostas, 0 novidades): `noindex,follow` e fora do sitemap.
10. **Links entre entidades**:
    - Vereador: "Bairros mais citados por <nome>", com 5 links para `bairro/*.html` (só bairros com página), e "Outros vereadores".
    - Semana: os nomes de bairros com página viram link.
11. **Desempenho**:
    - `preload` das fontes Inter 400 e Nunito 800;
    - `previa.png` recomprimida para menos de 60 KB, mantendo 1200x630;
    - foto do topo da página do vereador sem `loading=lazy` e com `fetchpriority=high`;
    - `og:image` por vereador: card 1200x630 gerado com sharp (foto e nome; sem gênero, sem cargo), em `dist/marca/og/vereador-<id>.png`;
    - `og:type=article` e `article:*` nas semanas e nos textos do Entenda;
    - `twitter:title`, `twitter:description` e `twitter:image`.
12. **Favicon**: gerar `favicon.ico` (32 px) na raiz e `<link rel="icon" href="/favicon.ico" sizes="any">`.
13. **Data de atualização visível** perto do H1 nas páginas de dados: "Atualizado em dd/mm/aaaa".
14. **Renderização do Entenda e do FAQ** (contrato abaixo): `entenda.html` (índice), `entenda/<slug>.html` (artigos) e `perguntas-frequentes.html`.
    - Cada pergunta é um `<h2>`/`<h3>` com a resposta curta logo abaixo.
    - JSON-LD: `Article` em cada texto e `FAQPage` **só** em `perguntas-frequentes.html`, gerado das mesmas perguntas visíveis.
    - O rich result de FAQ não aparece para este site; a marcação é só semântica.
    - Placeholders `{{chave}}` são trocados por números dos dados, formatados e com a data de referência. Placeholder desconhecido ou sem dado: o gerador avisa (manutenção) e omite a frase que o contém. Nunca publica "{{".
15. **Vistoria**: passa a bloquear "{{" no HTML publicado e mantém a regra de fonte oficial por página.

## Frente B — conteúdo (`data/referencia/entenda.json`)

```json
{
  "artigos": [{
    "slug": "o-que-faz-um-vereador",
    "titulo": "O que faz um vereador em Salto",
    "descricao": "até 155 caracteres",
    "resumo": "2–3 frases que respondem a pergunta logo de cara",
    "secoes": [{ "titulo": "…", "paragrafos": ["… {{numeroVereadores}} …"] }],
    "perguntas": [{ "pergunta": "…?", "resposta": "1–3 frases" }],
    "fontes": [{ "titulo": "Constituição Federal, art. 29", "url": "https://www.planalto.gov.br/…" }],
    "relacionados": ["camara.html", "votacoes.html"]
  }],
  "faq": [{ "grupo": "Câmara", "pergunta": "…?", "resposta": "…", "link": "camara.html#custo" }]
}
```

**Os 10 artigos:**
1. O que faz um vereador (e o que não faz).
2. Quanto custa a Câmara e quanto ganha um vereador de Salto.
3. Indicação, requerimento e moção: o que é cada um e o que a Prefeitura deve responder.
4. Emenda impositiva (dos vereadores) e emenda parlamentar (de deputados e senadores).
5. De onde vem o dinheiro da Prefeitura (IPTU, ISS, ICMS, FPM, Fundeb).
6. Dinheiro livre e carimbado: os mínimos de 25% na educação e 15% na saúde.
7. Empenho, liquidação e pagamento.
8. Como acompanhar uma obra pública em Salto (PNCP, TCE, Obrasgov).
9. O que é a nota do TCE (IEGM).
10. Como pedir informação à Prefeitura pela Lei de Acesso à Informação.

**FAQ:** de 20 a 30 perguntas que as pessoas buscam (lista de lacunas da auditoria), cada uma com resposta curta e link para a página de dados.

**Regras do conteúdo:**
- **Exatidão jurídica:** só afirmar o que a lei ou a fonte oficial diz, com link para o texto oficial (planalto.gov.br, a Lei Orgânica e o Regimento Interno da Câmara de Salto no site da Câmara, o portal do TCE-SP, o Tesouro, a LAI e o e-SIC da Prefeitura). Conferir cada citação abrindo a fonte.
- **Números de Salto:** sempre por placeholder, nunca escritos à mão. Placeholders permitidos (a Frente A os implementa a partir de `dados.json`):
  - `numeroVereadores`, `custoCamaraMes`, `salarioVereador` (só se houver dado oficial; senão, a frase fica de fora);
  - `arrecadacaoAno`, `pagoAno`, `percentualLivre`;
  - `emendas2026Total`, `emendasPorVereador2026`;
  - `obrasEmExecucao`, `obrasParalisadas`;
  - `notaIegm`, `anoIegm`, `promessasEmAndamento`;
  - `dataAtualizacao`.

  Precisando de outro, pedir ao controlador.
- **Tom:** português simples, neutro, sem opinião sobre políticos, sem acusação e sem gênero para pessoas.

## Checagens

- `check/entenda.mjs`: valida `entenda.json` (campos obrigatórios, slugs únicos, links https, descrição de até 155 caracteres, placeholders conhecidos, relacionados existentes).
- `check/seo.mjs`: `lastmod` por hash; placeholder desconhecido; BreadcrumbList; título com sufixo e até 70 caracteres.
- Vistoria com 0 bloqueios e 0 avisos, inclusive para a 404.
