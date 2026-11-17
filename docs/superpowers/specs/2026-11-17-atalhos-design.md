# Atalhos para os tópicos — design

Data: 2026-11-17. Aprovado pelo usuário ("opções 1 e 2", "Aprovado").

## Objetivo

Encontrar a informação em um toque. Essa é a função principal do site.

## 1. Página inicial: "O que você quer saber?"

Uma grade de 10 botões no começo do conteúdo, logo abaixo do título. Cada botão tem um ícone SVG de traço na cor do site (sem emoji) e uma frase curta.

| Botão | Destino |
|---|---|
| Pedidos do meu bairro | `#bairro` |
| Seu vereador | `#vereadores` |
| Presença e votações | `votacoes.html` |
| Quanto custa a Câmara | `camara.html#custo` |
| Emendas dos vereadores | `camara.html#emendas` |
| Promessas do prefeito | `promessas.html` (só se a página existir) |
| Obras | `prefeitura.html#obras` |
| Impostos | `impostometro.html` (só se a página existir) |
| Onde a Prefeitura gasta | `gastos.html` (só se a página existir) |
| Resumo da semana | `semana.html` |

Layout: 2 colunas no celular e 5 a partir de 768px. Área de toque grande e foco visível.

## 2. Topo das páginas longas: fileira de atalhos

Usa o componente `.sumario` com `.chip`, que já existe na página de fontes. Um atalho só aparece se a seção existir na página, e a fileira só aparece se tiver dois ou mais atalhos.

- Câmara: Custo · Respostas · Emendas · Campanha
- Prefeitura: Promessas · Nota do TCE · Obras · Compras · Campanha
- Impostos: Impostos do ano · Mês a mês · De onde vem · Fontes. As seções ganham os ids `impostos-ano`, `mes-a-mes` e `origem`.
- Raio-X: Por ano · Ponto de atenção · Buscar empresa · Fontes. Ganham os ids `por-ano` e `novas`.

## 3. Medição

O clique num atalho gera o evento `atalho` no GA4, com `item` e `pagina`, só com consentimento.

## Fora do escopo

Barra fixa de atalhos e "Veja também" no fim das páginas.
