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

Instale o Node.js 22 ou mais novo (nodejs.org) antes de começar.

```bash
npm install
npx playwright install chromium
npm run checar      # checagens das regras
npm run coletar     # só coleta (gera data/bruto/coleta.json)
npm run processar   # processa a última coleta e gera o site (só funciona depois de npm run coletar)
npm run atualizar   # tudo: coleta, confere e gera
npm run ver         # abre dist/ em http://localhost:8080 (precisa de Python; troque a porta em package.json se estiver ocupada)
npx serve dist      # alternativa ao npm run ver, se você não tem Python
```

## Publicar (uma vez)

1. Crie uma conta em github.com e um repositório **público** chamado `radar-saltense`.
2. No repositório, vá em Settings → Pages → Source e escolha **GitHub Actions**.
3. Envie este projeto para o repositório:
   ```bash
   git switch main && git merge radar-v1
   git remote add origin https://github.com/SEU_USUARIO/radar-saltense.git
   git push -u origin main
   ```
4. Em Actions → "Atualizar Radar Saltense", clique em **Run workflow**.
5. Abra o `conferencia.md` da execução e confira 2 ou 3 vereadores na fonte oficial antes de divulgar. Leia também as seções "Avisos" e "Nomes não atribuídos" do `conferencia.md` antes de anunciar.

Domínio próprio (opcional): em Settings → Pages → Custom domain, e cadastre as entradas de DNS no painel de onde você comprou o domínio.

## Recebi e-mail de falha do robô

1. Abra Actions → a execução que falhou → Artifacts → `conferencia`.
2. Leia a seção "Barreira automática".
3. Se a Câmara realmente removeu propostas (o total caiu de forma legítima), edite `data/processado/meta.json` no github.com, baixando `totalProposituras` para o novo número, e rode o workflow de novo.
4. Se não for isso, espere (muitas vezes o site da Câmara está fora do ar por uns instantes) ou peça ajuda.

## Plano B: a Câmara bloqueou o GitHub

1. No seu computador, rode `npm run atualizar`.
2. Depois: `git pull`, `git add data`, `git commit -m "dados"` e `git push`.
3. Em Actions → "Atualizar Radar Saltense" → **Run workflow**, marque **Só publicar os dados já salvos no repositório (plano B)** e rode.
