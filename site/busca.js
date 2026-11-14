(() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const dataBR = (d) => (d ? d.split('-').reverse().join('/') : '');
  const ficha = (id) => `https://cmsalto.sisvetor.com.br/ords/cmsalto/f?p=742:78:::::P78_ID_PROJETO:${id}`;
  let dados = null;
  const carregar = async () => dados || (dados = await (await fetch('dados/busca.json')).json());
  const item = ([id, data, , autores, ementa, doc]) =>
    `<li><span class="data">${dataBR(data)}</span> <strong>${esc(autores)}</strong> <span class="tag">${esc(doc)}</span> ${esc(ementa)} <a href="${ficha(id)}" target="_blank" rel="noopener">ficha oficial</a></li>`;

  // Busca por bairro ou rua
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
          ? `<p>${itens.length} pedidos para: ${nomes.slice(0, 8).map(esc).join(', ')}${nomes.length > 8 ? '…' : ''}</p><ul class="lista">${itens.slice(0, 200).map(item).join('')}</ul>${itens.length > 200 ? '<p>Mostrando os 200 mais recentes.</p>' : ''}`
          : '<p>Nada encontrado. Tente outro nome ou só uma parte dele.</p>';
      }, 250);
    });
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

  // Filtro e ordem dos vereadores
  const lista = document.getElementById('lista-vereadores');
  if (lista) {
    const nome = document.getElementById('filtro-nome');
    const partido = document.getElementById('filtro-partido');
    const ordem = document.getElementById('ordem');
    const aplicar = () => {
      const q = norm(nome.value);
      const pt = partido.value;
      const o = ordem.value;
      const cartoes = [...lista.children];
      cartoes.sort((a, b) => (o === 'nome' ? 0 : Number(b.dataset[o]) - Number(a.dataset[o])) || a.dataset.nome.localeCompare(b.dataset.nome, 'pt-BR'));
      for (const c of cartoes) {
        c.hidden = Boolean((q && !norm(c.dataset.nome).includes(q)) || (pt && c.dataset.partido !== pt));
        lista.appendChild(c);
      }
    };
    [nome, partido, ordem].forEach((el) => el.addEventListener('input', aplicar));
    aplicar();
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
})();
