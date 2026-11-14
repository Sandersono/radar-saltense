# Radar Saltense — Design

Data: 2026-11-14 · Autor do projeto: Sanderson Oliveira (@sandersonoliveira1)
Inspiração: radarptlandia.org (Hortolândia-SP) e o manual "Como criar o Radar da sua cidade", de Gabriel Damasceno.

## 1. Objetivo

Um site que mostra, só com dados oficiais da Câmara Municipal de Salto/SP, o que cada um dos 11 vereadores da 19ª Legislatura (2025–2028) fez desde a posse, em 1º/01/2025: presença nas sessões, propostas apresentadas, pedidos por bairro e como votou. É feito para o morador comum, no celular, em linguagem simples. Não dá nota nem opinião, só mostra o dado com link para a fonte.

O site é atualizado sozinho, todo dia de madrugada, sem custo.

## 2. Fontes de dados (verificadas em 2026-11-14)

A Câmara de Salto **não usa o SAPL**, ao contrário de Hortolândia. Os dados estão em três lugares.

| Dado | Fonte | Formato | Observações |
|---|---|---|---|
| Vereadores (nome, partido) | Página inicial de www.camarasalto.sp.gov.br | HTML | São 11 na legislatura atual. |
| Proposituras | Portal Oracle APEX: `https://cmsalto.sisvetor.com.br/ords/cmsalto/f?p=742:92::::92:P92_ANO:<ano>` | Região "Cards" do APEX, carregada por AJAX | Em 2026 eram 2.880. Campos: categoria, número, autor(es), data, ementa e um ID estável. A ficha oficial fica em `f?p=742:78:::::P78_ID_PROJETO:<ID>`. O carregamento completo foi testado com `apex.region(id).call('getModel')` e paginação. |
| Presença | PDF mensal: `/pdf/presenca-dos-vereadores/<ano>/presenca-reunioes-<mes>-<ano>.pdf`, listado em `/sessoes/presenca-dos-vereadores` | PDF com texto (gerado a partir do Excel) | Tabela de vereador × data da sessão, com P, A ou AJ. Sessões extraordinárias aparecem destacadas em amarelo ("sem remuneração"). |
| Votações | PDF anual: `/pdf/tramitacao-votacao-dos-projetos/votacao-dos-projetos-<ano>.pdf` | PDF com texto em tabela livre | Para cada projeto: data, resultado ("aprovado por unanimidade / por maioria") e os nomes de quem votou contra ou faltou, às vezes só o primeiro nome ("Contra: Rogério"). |

Diferenças de grafia já vistas entre as fontes: "Antonio" e "Antônio", "Izidoro" e "Izidório", "Edemilson dos Santos", "Edival Pereira Rosa Preto" e "Luzia de Fatima I. Vidal". Por isso o autor é ligado ao vereador pelo **primeiro nome**, sem acento. Os 11 primeiros nomes são diferentes entre si, e o sistema para com erro se algum dia dois vereadores tiverem o mesmo. Comissões, Mesa, Frente Parlamentar e Prefeitura não batem com nenhum vereador e não contam para ninguém.

Em 2025 o portal tinha 3.302 proposituras. O carregamento completo levou cerca de 37 segundos.

## 3. Arquitetura

Todo dia de madrugada, um robô no GitHub Actions faz:

1. **Coleta.** O Playwright, um navegador sem tela, abre o portal de proposituras e baixa os PDFs de presença e de votação. Tudo fica guardado em `data/bruto/`. O histórico desde 2025 é baixado uma vez só; depois o robô baixa apenas o que é novo.
2. **Organização.** Classifica as proposituras, extrai rua e bairro, junta presença e votos por vereador. O resultado vai para `data/processado/*.json`.
3. **Conferência.** Se algum item da seção 6 falhar, o robô **não publica** e o site continua com a última versão boa.
4. **Publicação.** Gera páginas estáticas em `dist/` e publica no GitHub Pages.

Escolhas e alternativas descartadas:
- **Playwright, e não reproduzir as chamadas AJAX do APEX.** As chamadas dependem de identificadores e de sessão, que quebram com qualquer mudança no portal.
- **Coleta no computador do usuário** fica como plano B, só para o caso de a Câmara bloquear os IPs do GitHub.
- **Site estático sem banco de dados.** A busca roda no navegador, sobre um JSON enxuto.

Tecnologia: Node.js (LTS), Playwright, pdfjs-dist para ler os PDFs (dá o texto com a posição de cada pedaço, o que permite remontar as tabelas) e um gerador de HTML simples em Node, sem framework de front-end.

### Estrutura do repositório

```
src/coleta/ proposituras.js · presenca.js · votacoes.js · vereadores.js
src/regras/ classificar.js · local.js (rua/bairro) · nomes.js (casar nomes) · presenca-pdf.js · votacao-pdf.js
src/conferir.js barreira de publicação
src/gerar-site.js gera dist/ a partir de data/processado/
site/ modelos HTML, CSS e o JS da busca
data/bruto/ cache do que foi baixado (vai para o repositório)
data/processado/ JSON usado pelo site
check/ checagens pequenas em node (funções puras de src/regras/)
.github/workflows/atualizar.yml cron diário às 06:00 UTC (03:00 em Brasília) + execução manual
```

## 4. Páginas e seções

Uma página principal, de rolagem, mais uma página por vereador.

1. **Topo.** Nome, a frase "O que cada vereador de Salto fez desde a posse, atualizado todo dia" e a data e hora da última atualização. O **contador de salário** só entra se houver fonte oficial do valor do subsídio (lei de fixação ou Portal da Transparência). Sem fonte oficial, ele fica de fora.
2. **"O que pediram pro seu bairro?"** Busca por bairro ou rua. Para cada pedido encontrado, mostra quem pediu, a data, a ementa e o link para a ficha oficial.
3. **"O problema que não some".** Pedidos do mesmo tipo para a mesma rua, com a contagem e as datas. Sempre acompanhado do aviso: "Pedido repetido não prova que a Prefeitura ignorou."
4. **"Homenagem ou trabalho?"** Grupos de propostas com a mesma regra para todos (seção 5.1). Cada grupo pode ser aberto, com a lista de propostas uma a uma.
5. **"Os 11 vereadores".** Cartões com busca por nome e filtro por partido. Ordenação: nome; quem mais faltou; mais propostas de lei; mais homenagens; mais pedidos para os bairros; quem mais votou contra.
6. **Página do vereador.** Presença sessão a sessão (P, A, AJ), propostas por grupo, votações em que votou contra ou faltou, e o link para a fonte oficial.
7. **Votações.** Cada projeto com a data, o resultado e quem votou contra ou faltou. Leva o selo "leitura do documento oficial".
8. **"De onde vêm os números".** Explica cada fonte e cada regra, diz o que é estimativa e lembra que "dado ausente não é falta".
9. **Rodapé.** "Radar Saltense é um projeto independente de Sanderson Oliveira (@sandersonoliveira1), feito por morador, sem vínculo com a Câmara, com a Prefeitura ou com partido. Achou um erro? Me chama no Instagram."

Visual: fundo branco, linguagem simples, pensado primeiro para o celular. Todo número tem link para a fonte.

## 5. Regras

### 5.1 Classificação das proposituras

A regra é aplicada na ordem abaixo e publicada no site.

| Categoria no portal | Grupo |
|---|---|
| Indicação | Pedidos de melhoria nos bairros |
| Requerimento | Perguntas e cobranças |
| Moção cuja ementa tem aplauso, congratula, parabeniza, pesar, homenage ou reconhecimento | Homenagens |
| Moção (outras: apelo, repúdio, apoio) | Outros |
| Decreto Legislativo com título de cidadão, honra ao mérito, honraria, medalha, comenda ou diploma | Homenagens |
| Lei Ordinária, Lei Complementar, Resolução ou Decreto Legislativo cuja ementa tem denomina, dá denominação ou institui o dia/a semana/data comemorativa/calendário oficial | Homenagens |
| Lei Ordinária, Lei Complementar, Emenda à Lei Orgânica, Resolução, Decreto Legislativo (demais), Iniciativa popular | Propostas de lei |
| Ato da Presidência, Atos da Mesa, Portaria | Não contam por vereador (são atos administrativos) |

- **Coautoria:** a proposta conta para cada um dos autores. A página explica isso.
- **Autor que não é vereador** (Prefeitura, Mesa, iniciativa popular): aparece nas listas e nas votações, mas não conta para nenhum vereador.

### 5.2 Rua e bairro

São extraídos da ementa por padrões como "Rua / Avenida / Av. / Travessa / Estrada X" e "no Bairro / Jardim / Jd. / Vila / Parque / Residencial / Chácara Y". Os nomes são normalizados (sem acento, caixa baixa, "Jd." vira "Jardim"). Uma ementa pode citar vários lugares, e cada um é indexado. Quando nenhum lugar é identificado, o pedido fica no site, mas fora da busca por bairro.

"Mesmo tipo de pedido" é definido por palavras-chave na ementa: buraco/tamponamento, asfalto/pavimentação, iluminação, limpeza/mato, bueiro/drenagem, sinalização/lombada, poda/árvore, coleta de lixo. Um problema "não some" quando o mesmo tipo é pedido 2 vezes ou mais para a mesma rua.

### 5.3 Presença

- Contam P, A e AJ. "Quem mais faltou" ordena pelas ausências **A**. A ausência justificada (AJ) é mostrada à parte e não conta como falta.
- Célula vazia não é falta. Se ninguém tem registro numa sessão, a sessão é ignorada.
- Sessões extraordinárias são separadas quando o PDF permitir identificar a coluna destacada. Se não der, a página avisa que estão misturadas com as ordinárias.

### 5.4 Votações

- Do PDF saem o projeto, a data de cada votação ou turno, o resultado e as listas de "Contra" e "Ausente".
- O primeiro nome é ligado ao vereador ignorando acentos. Hoje os 11 primeiros nomes são todos diferentes. Um nome que não bate com ninguém, ou que bate com mais de um, **não é atribuído** e fica registrado no relatório de conferência.
- O site não deduz votos a favor. Mostra só quem votou contra e quem faltou, exatamente como está no documento.

## 6. Conferência e tratamento de falhas

**Barreira automática** (`src/conferir.js`). Só publica se tudo isto for verdade:
- vieram 11 vereadores;
- cada PDF de presença foi lido com 11 linhas;
- o total de proposituras não caiu em relação ao último dado publicado;
- o PDF de votação de cada ano rendeu pelo menos um projeto (projetos sem nenhuma votação lida vão para o relatório de conferência);
- nenhum JSON processado está vazio.

Se algo falhar, o workflow termina com erro, o GitHub manda e-mail ao dono do repositório e o site fica como estava.

**Conferência inicial (obrigatória antes de divulgar).** Um relatório `conferencia.md` compara os números calculados com as fontes oficiais. Mostra o que bate, o que não bate e por quê, e lista tudo o que é estimativa ou nome não atribuído. Depois disso, o usuário confere à mão 2 ou 3 vereadores.

**Coleta educada.** O robô se identifica como `RadarSaltense/1.0 (projeto civico independente; contato: instagram.com/sandersonoliveira1)`, espera alguns segundos entre requisições e baixa o histórico uma vez só.

**Riscos:**
- A Câmara muda o sistema: o robô para e o código é ajustado.
- A Câmara bloqueia o GitHub: entra o plano B (coleta local, depois `git push`).
- Limite de tráfego do GitHub Pages: as páginas são leves, e o JSON da busca é separado e compactado.

## 7. Checagens

Ficam em `check/` e rodam com `node`. São poucas asserções sobre as funções puras de `src/regras/`: classificação, extração de rua e bairro, leitura de uma linha de presença e ligação do primeiro nome ao vereador (incluindo a recusa de nomes ambíguos). Não há framework de testes.

## 8. Publicação

1. O usuário cria uma conta no GitHub e um repositório público `radar-saltense`, e em Settings → Pages → Source escolhe "GitHub Actions".
2. Primeira execução manual do workflow, seguida da conferência da seção 6.
3. Domínio próprio é opcional e fica para depois.

## 9. Fora do escopo desta versão

Obras e gastos da Prefeitura, notas ou rankings de opinião, contato pessoal de vereadores (só canais oficiais do gabinete), e legislaturas anteriores a 2025.
