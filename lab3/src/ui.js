/* ============================================================
   МОДУЛЬ UI — работа с DOM, таблицами, canvas, кнопками
   ============================================================ */
(() => {
  const $ = sel => document.querySelector(sel);

  // ---- Инициализация
  document.addEventListener('DOMContentLoaded', () => {
    $('#analyze').addEventListener('click', run);

    // ---- Выбор файла .rs
    const fileInput = $('#fileInput');
    $('#chooseFile').addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;

      // Проверка расширения (на случай, если accept не сработал)
      if (!/\.rs$/i.test(file.name)) {
        alert('Пожалуйста, выберите файл с расширением .rs');
        fileInput.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        $('#src').value = e.target.result;
        $('#fileName').textContent = '📄 ' + file.name;
        run();
      };
      reader.onerror = () => alert('Не удалось прочитать файл: ' + reader.error);
      reader.readAsText(file, 'UTF-8');

      // Сброс, чтобы можно было выбрать тот же файл повторно
      fileInput.value = '';
    });
  });

  // ---- Главный сценарий
  function run() {
    const code = $('#src').value;
    if (!code.trim()) return;
    let res;
    try {
      res = RustParser.analyze(code);
    } catch (e) {
      alert('Ошибка разбора: ' + e.message);
      return;
    }
    renderSpen(res.spen);
    renderChepin(res.chepin, res.chepinIO);
    renderChart(res.spen);
    $('#spenSection').hidden = false;
    $('#chepinSection').hidden = false;
    $('#graphSection').hidden = false;
  }

  /* ---------- Таблица 8: спены ---------- */
  function renderSpen(spen) {
    const items = spen.items;
    if (!items.length) {
      $('#spenTable').innerHTML = '<p>Идентификаторы не найдены.</p>';
      $('#spenTotal').textContent = '';
      return;
    }
    let html = '<table><thead><tr><th>Идентификатор</th>';
    items.forEach(it => html += `<th>${escapeHtml(it.name)}</th>`);
    html += '<th>Суммарный спен программы</th></tr></thead><tbody><tr><td class="id">Спен</td>';
    items.forEach(it => html += `<td>${it.spen}</td>`);
    html += `<td class="highlight">${spen.total}</td></tr></tbody></table>`;
    $('#spenTable').innerHTML = html;

    const details = items.map(it => `${escapeHtml(it.name)}: всего ${it.total}, спен ${it.spen}`).join('; ');
    $('#spenTotal').innerHTML =
      `Суммарный спен программы = <b>${spen.total}</b>` +
      `<br><span style="color:#9aa4b8;font-weight:400;font-size:12px">${details}</span>`;
  }

  /* ---------- Таблица 9: Чепин ---------- */
  function renderChepin(full, io) {
    const html = `
      <table>
        <thead>
          <tr>
            <th rowspan="2"></th>
            <th colspan="4">Полная метрика Чепина</th>
            <th colspan="4">Метрика Чепина ввода/вывода</th>
          </tr>
          <tr>
            <th>P</th><th>M</th><th>C</th><th>T</th>
            <th>P</th><th>M</th><th>C</th><th>T</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Группа переменных</td>
            <td>${fmt(full.groups.P)}</td><td>${fmt(full.groups.M)}</td>
            <td>${fmt(full.groups.C)}</td><td>${fmt(full.groups.T)}</td>
            <td>${fmt(io.groups.P)}</td><td>${fmt(io.groups.M)}</td>
            <td>${fmt(io.groups.C)}</td><td>${fmt(io.groups.T)}</td>
          </tr>
          <tr>
            <td>Количество</td>
            <td>p = ${full.p}</td><td>m = ${full.m}</td>
            <td>c = ${full.c}</td><td>t = ${full.t}</td>
            <td>p = ${io.p}</td><td>m = ${io.m}</td>
            <td>c = ${io.c}</td><td>t = ${io.t}</td>
          </tr>
          <tr>
            <td>Метрика Чепина</td>
            <td colspan="4" class="highlight">Q = ${full.Q}</td>
            <td colspan="4" class="highlight">Q = ${io.Q}</td>
          </tr>
        </tbody>
      </table>`;

    $('#chepinTable').innerHTML = html;

    const f = (p, m, c, t, Q) => `
      <div class="formula">
        <span class="name">Q</span> = 1·${p} + 2·${m} + 3·${c} + 0,5·${t}
        = <span class="val">${Q}</span>
      </div>`;

    $('#chepinFormula').innerHTML = `
      <div class="formula"><span class="name">Полная метрика Чепина:</span></div>
      ${f(full.p, full.m, full.c, full.t, full.Q)}
      <div class="formula"><span class="name">Метрика Чепина ввода/вывода:</span></div>
      ${f(io.p, io.m, io.c, io.t, io.Q)}
    `;
  }

  function fmt(arr) { return arr.length ? arr.map(escapeHtml).join(', ') : '—'; }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, ch =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  /* ---------- График (canvas, без библиотек) ---------- */
  function renderChart(spen) {
    const canvas = $('#chart');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const items = spen.items;
    if (!items.length) return;

    const pad = { l: 50, r: 20, t: 20, b: 70 };
    const plotW = W - pad.l - pad.r;
    const plotH = H - pad.t - pad.b;
    const maxV = Math.max(1, ...items.map(it => it.spen));

    // оси
    ctx.strokeStyle = '#2a3245';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t);
    ctx.lineTo(pad.l, pad.t + plotH);
    ctx.lineTo(pad.l + plotW, pad.t + plotH);
    ctx.stroke();

    // горизонтальные линии
    ctx.strokeStyle = '#1d2433';
    ctx.fillStyle = '#6b7a99';
    ctx.font = '11px Consolas, monospace';
    for (let v = 0; v <= maxV; v++) {
      const y = pad.t + plotH - (v / maxV) * plotH;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + plotW, y); ctx.stroke();
      ctx.fillText(String(v), pad.l - 28, y + 4);
    }

    // столбцы
    const bw = plotW / items.length;
    items.forEach((it, i) => {
      const x = pad.l + i * bw + bw * 0.15;
      const w = bw * 0.7;
      const h = (it.spen / maxV) * plotH;
      const y = pad.t + plotH - h;
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, '#4d73e8');
      g.addColorStop(1, '#2a3a6b');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);

      ctx.fillStyle = '#d6e2f0';
      ctx.font = '11px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(it.name, x + w / 2, pad.t + plotH + 18);
      if (it.spen > 0) ctx.fillText(String(it.spen), x + w / 2, y - 6);
    });
    ctx.textAlign = 'start';
    ctx.fillStyle = '#6b7a99';
    ctx.fillText('спен', pad.l - 40, pad.t - 6);
  }
})();