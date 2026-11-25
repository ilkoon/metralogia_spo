
(() => {
  const $ = sel => document.querySelector(sel);

  document.addEventListener('DOMContentLoaded', () => {
    $('#analyze').addEventListener('click', run);

    const fileInput = $('#fileInput');
    $('#chooseFile').addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;

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

      fileInput.value = '';
    });
  });


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
    $('#spenSection').hidden = false;
    $('#chepinSection').hidden = false;
  }

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
      `<br><span style="color:#6b7280;font-weight:400;font-size:12px">${details}</span>`;
  }


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
})();