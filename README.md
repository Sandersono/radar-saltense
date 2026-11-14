# Radar Saltense

O que cada vereador de Salto/SP fez desde a posse, só com dados oficiais da Câmara. Atualizado sozinho todo dia.

Projeto independente de Sanderson Oliveira (@sandersonoliveira1). Inspirado no radarptlandia.org.

## Como funciona

Todo dia às 03:00 (Brasília), o GitHub Actions:
1. coleta as proposituras, os PDFs de presença e os PDFs de votação da Câmara;
2. organiza os dados (`src/processar.js`);
3. confere os dados (`src/conferir.js`). Se algo parecer errado, **não publica**, e o site continua na última versão boa;
4. gera o site em `dist/` e publica no GitHub Pages.

O relatório `conferencia.md` de cada execução fica em Actions → execução → Artifacts.

## Comandos

```bash
npm install
npx playwright install chromium
npm run checar      # checagens das regras
npm run coletar     # só coleta (gera data/bruto/coleta.json)
npm run processar   # processa a última coleta e gera o site
npm run atualizar   # tudo: coleta, confere e gera
npm run ver         # abre dist/ em http://localhost:8080 (troque a porta em package.json se estiver ocupada)
```

## Publicar (uma vez)

1. Crie uma conta em github.com e um repositório **público** chamado `radar-saltense`.
2. No repositório, vá em Settings → Pages → Source e escolha **GitHub Actions**.
3. Envie este projeto para o repositório (`git remote add origin ...` e `git push -u origin main`).
4. Em Actions → "Atualizar Radar Saltense", clique em **Run workflow**.
5. Abra o `conferencia.md` da execução e confira 2 ou 3 vereadores na fonte oficial antes de divulgar.

Domínio próprio (opcional): em Settings → Pages → Custom domain, e cadastre as entradas de DNS no painel de onde você comprou o domínio.

## Plano B: a Câmara bloqueou o GitHub

Rode `npm run atualizar` no seu computador e depois `git add data && git commit -m "dados" && git push`. Em seguida, rode o workflow manualmente para publicar.
