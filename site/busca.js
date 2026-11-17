(() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const dataBR = (d) => (d ? d.split('-').reverse().join('/') : 'sem data');
  const ficha = (id) => `https://cmsalto.sisvetor.com.br/ords/cmsalto/f?p=742:78:::::P78_ID_PROJETO:${esc(id)}`;
  // Medição de audiência (spec 2026-11-16). A Cloudflare conta sem cookie e não passa por aqui.
  // O Google Analytics só é carregado depois do "Aceitar" (LGPD); a escolha fica no navegador da pessoa.
  const barra = document.getElementById('barra-cookies');
  const GA = barra ? barra.dataset.ga : '';
  const lerEscolha = () => { try { return localStorage.getItem('rs-cookies'); } catch { return null; } };
  const gravarEscolha = (v) => { try { localStorage.setItem('rs-cookies', v); } catch { /* sem armazenamento: a barra volta na próxima página */ } };
  let gaLigado = false;
  const ligarGa = () => {
    if (gaLigado || !GA) return;
    gaLigado = true;
    window[`ga-disable-${GA}`] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA);
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA)}`;
    document.head.appendChild(s);
  };
  const evento = (nome, params = {}) => { if (gaLigado && window.gtag) window.gtag('event', nome, params); };
  const apagarCookiesGa = () => {
    const dominio = location.hostname.replace(/^www\./, '');
    for (const c of document.cookie.split(';')) {
      const nome = c.split('=')[0].trim();
      if (!/^_ga/.test(nome)) continue;
      for (const d of ['', `; domain=${dominio}`, `; domain=.${dominio}`]) document.cookie = `${nome}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d}`;
    }
  };
  if (GA) {
    const mostrarBarra = (sim) => { barra.hidden = !sim; document.body.classList.toggle('com-barra-cookies', sim); };
    const escolha = lerEscolha();
    if (escolha === 'aceito') ligarGa();
    else if (escolha !== 'recusado') mostrarBarra(true);
    barra.querySelector('[data-cookies="aceitar"]').addEventListener('click', () => { gravarEscolha('aceito'); mostrarBarra(false); ligarGa(); });
    barra.querySelector('[data-cookies="recusar"]').addEventListener('click', () => {
      gravarEscolha('recusado');
      mostrarBarra(false);
      window[`ga-disable-${GA}`] = true;
      apagarCookiesGa();
    });
    const caixa = document.getElementById('abrir-cookies-caixa');
    const reabrir = document.getElementById('abrir-cookies');
    if (caixa && reabrir) { caixa.hidden = false; reabrir.addEventListener('click', () => { mostrarBarra(true); barra.querySelector('button').focus(); }); }

    // Eventos (só com consentimento). O texto digitado nas buscas nunca é enviado.
    const OFICIAL = /\.(gov|jus|leg)\.br$|sisvetor\.com\.br$|obaratec\.com\.br$/;
    document.addEventListener('click', (e) => {
      const alvo = e.target instanceof Element ? e.target : null;
      if (!alvo) return;
      const ano = alvo.closest('[data-ano-botao]');
      if (ano) evento('troca_ano', { ano: ano.dataset.anoBotao });
      const a = alvo.closest('a[href]');
      if (!a) return;
      if (a.closest('#menu-principal')) evento('menu', { item: a.textContent.trim() });
      else if (a.closest('.topicos, .sumario')) evento('atalho', { item: a.textContent.trim(), pagina: location.pathname });
      else if (/feed\.xml$/.test(a.getAttribute('href'))) evento('rss');
      else if (a.classList.contains('selo-fonte') || OFICIAL.test(a.hostname)) evento('clique_fonte', { dominio: a.hostname });
    });
    const medirBusca = (campo, tipo, saida) => {
      if (!campo) return;
      const vistos = new Set();
      campo.addEventListener('change', () => {
        const q = norm(campo.value);
        if (q.length < 3 || vistos.has(q)) return;
        vistos.add(q);
        setTimeout(() => evento('busca', { tipo, achou: saida && saida.querySelector('li') ? 'sim' : 'nao' }), 600);
      });
    };
    medirBusca(document.getElementById('busca-bairro'), 'bairro', document.getElementById('resultado-busca'));
    medirBusca(document.getElementById('busca-empresa'), 'empresa', document.getElementById('resultado-empresa'));
  }

  let dados = null;
  const carregar = async () => dados || (dados = await (await fetch('dados/busca.json')).json());
  const item = ([id, data, , autores, ementa, doc]) =>
    `<li><span class="data">${esc(dataBR(data))}</span> <strong>${esc(autores)}</strong> <span class="tag">${esc(doc)}</span> ${esc(ementa)} <a href="${ficha(id)}" target="_blank" rel="noopener">ficha oficial</a></li>`;

  // Menu do celular
  const botaoMenu = document.querySelector('.menu-botao');
  const menu = document.getElementById('menu-principal');
  if (botaoMenu && menu) {
    botaoMenu.addEventListener('click', () => {
      const aberto = botaoMenu.getAttribute('aria-expanded') === 'true';
      botaoMenu.setAttribute('aria-expanded', String(!aberto));
      menu.classList.toggle('aberto', !aberto);
    });
  }

  // Busca por bairro ou rua (+ sugestões tocáveis)
  const campo = document.getElementById('busca-bairro');
  if (campo) {
    const saida = document.getElementById('resultado-busca');
    let espera;
    campo.addEventListener('input', () => {
      clearTimeout(espera);
      espera = setTimeout(async () => {
        const q = norm(campo.value);
        if (q.length < 3) { saida.innerHTML = ''; return; }
        const d = await carregar();
        const idx = new Set();
        const nomes = [];
        for (const [nome, lista] of d.l) {
          if (norm(nome).includes(q)) { nomes.push(nome); lista.forEach((i) => idx.add(i)); }
        }
        const itens = [...idx].map((i) => d.p[i]).sort((a, b) => b[1].localeCompare(a[1]));
        saida.innerHTML = itens.length
          ? `<p>${itens.length} ${itens.length === 1 ? 'pedido' : 'pedidos'} para: ${nomes.slice(0, 8).map(esc).join(', ')}${nomes.length > 8 ? '…' : ''}</p><ul class="lista">${itens.slice(0, 200).map(item).join('')}</ul>${itens.length > 200 ? '<p>Mostrando os 200 mais recentes.</p>' : ''}`
          : '<p>Nada encontrado. Tente outro nome ou só uma parte dele.</p>';
      }, 250);
    });
    for (const chip of document.querySelectorAll('[data-busca]')) {
      chip.addEventListener('click', () => {
        campo.value = chip.dataset.busca;
        campo.dispatchEvent(new Event('input'));
        campo.focus();
      });
    }
  }

  // Grupos "Homenagem ou trabalho?" carregam ao abrir
  for (const det of document.querySelectorAll('details.grupo')) {
    det.addEventListener('toggle', async () => {
      const ul = det.querySelector('.lista');
      if (!det.open || ul.dataset.ok) return;
      const d = await carregar();
      const itens = d.p.filter((p) => p[2] === det.dataset.grupo);
      ul.innerHTML = itens.slice(0, 500).map(item).join('') + (itens.length > 500 ? '<li>Mostrando as 500 mais recentes. Veja todas na página de cada vereador.</li>' : '');
      ul.dataset.ok = '1';
    });
  }

  // "O problema que não some": mostra 10 e um botão "ver mais"
  const verMais = document.getElementById('ver-mais-repetidos');
  if (verMais) {
    const extras = [...document.querySelectorAll('#repetidos [data-extra]')];
    extras.forEach((li) => { li.hidden = true; });
    verMais.hidden = false;
    verMais.addEventListener('click', () => {
      extras.forEach((li) => { li.hidden = false; });
      verMais.hidden = true;
    });
  }

  // Filtro e ordem dos vereadores (ordem por botões)
  const lista = document.getElementById('lista-vereadores');
  if (lista) {
    const nome = document.getElementById('filtro-nome');
    const partido = document.getElementById('filtro-partido');
    const botoesOrdem = [...document.querySelectorAll('[data-ordem]')];
    let ordem = 'nome';
    const aplicar = () => {
      const q = norm(nome ? nome.value : '');
      const pt = partido ? partido.value : '';
      const cartoes = [...lista.children];
      cartoes.sort((a, b) => (ordem === 'nome' ? 0 : Number(b.dataset[ordem]) - Number(a.dataset[ordem])) || a.dataset.nome.localeCompare(b.dataset.nome, 'pt-BR'));
      for (const c of cartoes) {
        c.hidden = Boolean((q && !norm(`${c.dataset.nome} ${c.dataset.apelido || ''}`).includes(q)) || (pt && c.dataset.partido !== pt));
        lista.appendChild(c);
      }
    };
    for (const b of botoesOrdem) {
      b.addEventListener('click', () => {
        ordem = b.dataset.ordem;
        botoesOrdem.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        aplicar();
      });
    }
    [nome, partido].filter(Boolean).forEach((el) => el.addEventListener('input', aplicar));
    aplicar();
  }

  // Raio-X: seletor de ano (sem JS todos os anos aparecem)
  const botoesAno = [...document.querySelectorAll('[data-ano-botao]')];
  if (botoesAno.length) {
    const mostrarAno = (ano) => {
      botoesAno.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.anoBotao === ano)));
      document.querySelectorAll('.ano-gastos').forEach((s) => { s.hidden = s.dataset.ano !== ano; });
    };
    botoesAno.forEach((b) => b.addEventListener('click', () => mostrarAno(b.dataset.anoBotao)));
    mostrarAno(botoesAno[botoesAno.length - 1].dataset.anoBotao);
  }

  // Raio-X: busca por empresa (carrega dados/empresas.json no primeiro uso)
  const campoEmpresa = document.getElementById('busca-empresa');
  if (campoEmpresa) {
    const saidaEmpresa = document.getElementById('resultado-empresa');
    const real = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
    const ORG = { prefeitura: 'Prefeitura', camara: 'Câmara', saae: 'SAAE' };
    const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const fmtCnpj = (c) => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    const contagemEmpresa = document.getElementById('contagem-empresa');
    let carregando = null;
    let esperaEmpresa;
    const itemEmpresa = ([cnpj, nome, porMes, porOrgao]) => {
      const porAno = {};
      for (const [k, v] of Object.entries(porMes)) porAno[k.slice(0, 4)] = (porAno[k.slice(0, 4)] || 0) + v;
      const anos = Object.entries(porAno).sort().map(([a, v]) => `${a}: ${real.format(v)}`).join(' · ');
      const meses = Object.entries(porMes).sort().map(([k, v]) => `${MES[Number(k.slice(5, 7)) - 1]}/${k.slice(0, 4)}: ${real.format(v)}`).join(' · ');
      const orgaos = Object.entries(porOrgao).map(([k, v]) => `${ORG[k] || k}: ${real.format(v)}`).join(' · ');
      return `<li><strong>${esc(nome)}</strong> <span class="nota">CNPJ <span class="cnpj">${esc(fmtCnpj(cnpj))}</span></span><br>Por ano: ${esc(anos)}<br>Por órgão: ${esc(orgaos)}<details><summary>Mês a mês</summary><p>${esc(meses)}</p></details><a href="https://transparencia.tce.sp.gov.br/despesas-fornecedor?nr_identificador_despesa=${esc(cnpj)}" target="_blank" rel="noopener">ver no TCE-SP</a></li>`;
    };
    campoEmpresa.addEventListener('input', () => {
      clearTimeout(esperaEmpresa);
      esperaEmpresa = setTimeout(async () => {
        const valorDigitado = campoEmpresa.value;
        const q = norm(valorDigitado);
        const digitos = campoEmpresa.value.replace(/\D/g, '');
        if (q.length < 3) { contagemEmpresa.textContent = ''; saidaEmpresa.innerHTML = ''; return; }
        carregando = carregando || fetch('dados/empresas.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));
        let empresas;
        try {
          empresas = await carregando;
        } catch {
          carregando = null;
          if (campoEmpresa.value !== valorDigitado) return;
          contagemEmpresa.textContent = 'Não foi possível carregar a lista de empresas. Tente de novo.';
          saidaEmpresa.innerHTML = '';
          return;
        }
        if (campoEmpresa.value !== valorDigitado) return;
        const achadas = empresas.filter(([cnpj, nome]) => norm(nome).includes(q) || (digitos.length >= 3 && cnpj.includes(digitos)));
        if (!achadas.length) {
          contagemEmpresa.textContent = 'Nenhuma empresa encontrada. Tente outra parte do nome ou o CNPJ.';
          saidaEmpresa.innerHTML = '';
          return;
        }
        contagemEmpresa.textContent = `${achadas.length} ${achadas.length === 1 ? 'resultado' : 'resultados'}${achadas.length > 30 ? ' (mostrando os 30 que mais receberam)' : ''}.`;
        saidaEmpresa.innerHTML = `<ul class="lista">${achadas.slice(0, 30).map(itemEmpresa).join('')}</ul>`;
      }, 250);
    });
  }


  // Contador de salário (só existe na página se houver fonte oficial)
  const sal = document.getElementById('contador-salario');
  if (sal) {
    const porMs = (Number(sal.dataset.mensal) * 12) / (365.25 * 24 * 3600 * 1000);
    const inicio = new Date(`${sal.dataset.inicio}T00:00:00-03:00`).getTime();
    const tique = () => { sal.textContent = ((Date.now() - inicio) * porMs).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }); };
    tique();
    setInterval(tique, 1000);
  }

  // Impostômetro: oficial + ritmo diário × dias desde o início da estimativa (para em 31/12).
  const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const moeda = (v) => fmt.format(v);
  const reduzido = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const el of document.querySelectorAll('.contador-impostos')) {
    const oficial = Number(el.dataset.oficial);
    const ritmo = Number(el.dataset.ritmo);
    const inicio = Number(el.dataset.inicio);
    const fim = Number(el.dataset.fim);
    const pop = Number(el.dataset.populacao);
    const valor = el.querySelector('.valor');
    const porMorador = el.querySelector('.por-morador strong');
    // "Enquanto você está nesta página": começa do zero ao abrir, no mesmo ritmo diário do contador
    const nestaVisita = el.querySelector('.nesta-visita');
    const valorVisita = nestaVisita && nestaVisita.querySelector('strong');
    const abertura = Date.now();
    if (nestaVisita && ritmo > 0) nestaVisita.hidden = false;
    let timer = null;
    let visivel = true;
    let ultimoPessoa = '';
    const parar = () => { if (timer) { clearInterval(timer); timer = null; } };
    const tique = () => {
      const agora = Date.now();
      const v = oficial + ritmo * Math.max(0, (Math.min(agora, fim) - inicio) / 86400000);
      valor.textContent = moeda(v);
      if (porMorador && pop) {
        const t = moeda(v / pop);
        if (t !== ultimoPessoa) { ultimoPessoa = t; porMorador.textContent = t; }
      }
      if (valorVisita && !nestaVisita.hidden) valorVisita.textContent = moeda(ritmo * (Math.min(agora, fim) - abertura) / 86400000);
      if (agora >= fim) { parar(); finalizado = true; }
    };
    let finalizado = false;
    const atualizar = () => {
      if (finalizado) return;
      if (visivel && !document.hidden) {
        if (!timer) { tique(); if (!finalizado) timer = setInterval(tique, reduzido ? 1000 : 100); }
      } else parar();
    };
    document.addEventListener('visibilitychange', atualizar);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => { visivel = es[es.length - 1].isIntersecting; atualizar(); }).observe(el);
    }
    tique();
    atualizar();
  }
})();
