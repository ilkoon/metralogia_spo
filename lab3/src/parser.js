/* ============================================================
   МОДУЛЬ ПАРСЕРА — чистый анализ, не трогает DOM
   ============================================================ */
const RustParser = (() => {

  // ---- Ключевые слова Rust, которые не считаем идентификаторами
  const KEYWORDS = new Set([
    'fn','let','mut','for','in','if','else','while','loop','match','break',
    'continue','return','struct','enum','impl','trait','pub','use','mod','crate',
    'as','ref','move','async','await','dyn','where','type','const','static',
    'unsafe','extern','self','Self','super','true','false','i32','i64','u32',
    'u64','usize','isize','f64','f32','str','bool','char','String','Vec'
  ]);

  // Управляющие конструкции (для классификации Чепина)
  const CONTROL_CTX = ['if','while','for','match','loop'];

  // Операторы ввода/вывода (в Rust обычно print!/println!/read_line)
  const IO_RE = /\b(?:println!|print!|eprintln!|eprint!|read_line|stdin)\b/;

  /* ---------- 1. Удаление комментариев и строк (грубо, для учебных программ) ---------- */
  function strip(code) {
    return code
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/[^\n]*/g, ' ')
      .replace(/"(?:\\.|[^"\\])*"/g, ' "" ')
      .replace(/'(?:\\.|[^'\\])'/g, " ' ' ");
  }

  /* ---------- 2. Токенизация ---------- */
    function tokenize(code) {
        const clean = strip(code);
        const tokens = [];
        const re = /([A-Za-z_][A-Za-z0-9_]*)|(\d+(?:\.\d+)?)|(=>|==|!=|<=|>=|\+=|-=|\*=|\/=|\.\.|::|[{}()\[\];,.<>+\-*/%!=:&|])/g;
        let m;
        while ((m = re.exec(clean)) !== null) {
        if (m[1]) {
            // Одиночный '_' — это wildcard-паттерн Rust, а не переменная.
            // '_foo' — валидный идентификатор, его оставляем.
            if (m[1] === '_') tokens.push({ type: 'op', val: '_' });
            else tokens.push({ type: KEYWORDS.has(m[1]) ? 'kw' : 'id', val: m[1] });
        }
        else if (m[2]) tokens.push({ type: 'num', val: m[2] });
        else tokens.push({ type: 'op', val: m[3] });
        }
        return tokens;
    }
  /* ---------- 3. Спен: число появлений после первого ----------
     Идентификатор учитывается в объявлении и каждом использовании.
     Первое появление (обычно в let/for/параметрах) — «объявление»,
     спен = всего появлений - 1. */
  function computeSpen(tokens) {
    const counts = new Map();     // id -> сколько раз встретился
    const firstAt = new Map();    // id -> индекс первого появления
    tokens.forEach((t, idx) => {
      if (t.type !== 'id') return;
      if (!counts.has(t.val)) firstAt.set(t.val, idx);
      counts.set(t.val, (counts.get(t.val) || 0) + 1);
    });
    const result = [];
    for (const [name, total] of counts) {
      result.push({ name, total, spen: total - 1 });
    }
    // по убыванию спена, затем по имени
    result.sort((a, b) => b.spen - a.spen || a.name.localeCompare(b.name));
    const sum = result.reduce((s, r) => s + r.spen, 0);
    return { items: result, total: sum };
  }

  /* ---------- 4. Метрика Чепина ----------
     Классификация переменных:
       P — только читаются (ввод / параметры), не модифицируются, не управляющие
       M — модифицируются (=, +=, -=, *=, /=, ++, --) и не управляющие
       C — участвуют в условии/управлении (внутри if/while/for/match/loop)
       T — объявлены, но больше нигде не используются
     Для учебных программ классфицируем по факту первого присваивания + контекста.
  --------------------------------------------------------------- */
  function computeChepin(tokens) {
    // 1) Собираем «объявления» (let [mut] x) и все идентификаторы
    const declared = new Set();
    const used = new Map();             // id -> {read, write, inControl, firstAssign}
    const controlDepth = { depth: 0 };

    // Проход: для каждого id фиксируем, был ли он в условиях, присваивался ли
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];

      // let [mut] x ...
      if (t.type === 'kw' && t.val === 'let') {
        let j = i + 1;
        if (tokens[j] && tokens[j].val === 'mut') j++;
        if (tokens[j] && tokens[j].type === 'id') {
          declared.add(tokens[j].val);
        }
        continue;
      }

      // Управляющие конструкции — увеличиваем «глубину управления» до закрытия блока
      if (t.type === 'kw' && CONTROL_CTX.includes(t.val)) {
        // все идентификаторы до ближайшей ')' или '{' считаются управляющими
        let j = i + 1, depthParen = 0, depthBrace = 0;
        while (j < tokens.length) {
          const tj = tokens[j];
          if (tj.val === '(') depthParen++;
          else if (tj.val === ')') { depthParen--; if (depthParen === 0 && tj.val === ')') { j++; break; } }
          else if (tj.val === '{') { depthBrace++; break; }
          if (tj.type === 'id') markControl(tj.val);
          j++;
        }
        continue;
      }

      // Присваивание: x = ..., x += ..., x -= ..., x *= ..., x /=
      if (t.type === 'id' && tokens[i + 1] && ['=','+=','-=','*=','/='].includes(tokens[i + 1].val)) {
        const rec = ensure(t.val);
        rec.write = true;
        if (rec.firstAssign === undefined) rec.firstAssign = i;
        // если это `+= i` — правая часть читается
        if (tokens[i + 2] && tokens[i + 2].type === 'id') {
          ensure(tokens[i + 2].val).read = true;
        }
      }
    }

    function ensure(name) {
      if (!used.has(name)) used.set(name, { read: false, write: false, inControl: false, firstAssign: undefined });
      return used.get(name);
    }
    function markControl(name) {
      ensure(name).inControl = true;
    }

    // 2) Дополнительный проход: пометить чтения и управляющие вхождения
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.type !== 'id') continue;
      // не считаем ключевое слово идентификатором
      if (KEYWORDS.has(t.val)) continue;
      const rec = ensure(t.val);

      // в контексте if/while/for/match: считаем управляющим, если
      // токен находится между ключевым словом и открывающей '{'
      // (упрощённо: если перед нами недавно было if/while/for/match/loop)
      if (isInsideControl(tokens, i)) rec.inControl = true;

      // Чтение: id, за которым НЕ следует оператор присваивания
      const next = tokens[i + 1];
      const isAssignTarget = next && ['=','+=','-=','*=','/='].includes(next.val);
      if (!isAssignTarget) rec.read = true;
    }

    // 3) Классификация
    const groups = { P: [], M: [], C: [], T: [] };
    for (const [name, rec] of used) {
      if (!declared.has(name) && !rec.inControl && !rec.read && !rec.write) continue; // шум
      if (rec.inControl) {
        groups.C.push(name);
      } else if (rec.write && rec.read) {
        // модифицируется и читается, но не в управлении → M (по определению M — модифицируемые)
        groups.M.push(name);
      } else if (rec.write) {
        groups.M.push(name);
      } else if (rec.read) {
        groups.P.push(name);
      } else {
        groups.T.push(name);
      }
    }

    // Сортировка для стабильного вывода
    for (const k of Object.keys(groups)) groups[k].sort();

    const p = groups.P.length, m = groups.M.length, c = groups.C.length, t = groups.T.length;
    const Q = 1 * p + 2 * m + 3 * c + 0.5 * t;

    return { groups, p, m, c, t, Q };
  }

  // Проверка: находится ли токен в «шапке» управляющей конструкции
  function isInsideControl(tokens, idx) {
    // Идём назад до ближайшего { } ; ; или начала
    for (let j = idx - 1; j >= 0 && j >= idx - 30; j--) {
      const v = tokens[j].val;
      if (v === '{' || v === '}' || v === ';') break;
      if (tokens[j].type === 'kw' && CONTROL_CTX.includes(v)) return true;
    }
    return false;
  }

  /* ---------- 5. Чепин только для переменных ввода/вывода ----------
     В Rust «ввод/вывод» = переменные в print!/println!/read_line.
     Извлекаем аргументы этих макросов и классифицируем их так же. */
  function computeChepinIO(tokens, fullChepin) {
    const ioVars = new Set();

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.type !== 'id') continue;
      // print!/println!/read_line / stdin
      if (IO_RE.test(t.val)) {
        // захватываем всё внутри следующих ( ... ) на глубине 1
        let j = i + 1;
        // пропустить «!», если это макрос
        if (tokens[j] && tokens[j].val === '!') j++;
        if (!tokens[j] || tokens[j].val !== '(') continue;
        j++;
        let depth = 1;
        while (j < tokens.length && depth > 0) {
          const tj = tokens[j];
          if (tj.val === '(') depth++;
          else if (tj.val === ')') depth--;
          else if (tj.type === 'id' && !KEYWORDS.has(tj.val)) ioVars.add(tj.val);
          j++;
        }
      }
    }

    // Классифицируем только эти переменные по уже посчитанным группам
    const map = new Map();
    for (const name of ioVars) {
      if (fullChepin.groups.C.includes(name)) map.set(name, 'C');
      else if (fullChepin.groups.M.includes(name)) map.set(name, 'M');
      else if (fullChepin.groups.P.includes(name)) map.set(name, 'P');
      else map.set(name, 'T');
    }
    const groups = { P: [], M: [], C: [], T: [] };
    for (const [name, g] of map) groups[g].push(name);
    for (const k of Object.keys(groups)) groups[k].sort();

    const p = groups.P.length, m = groups.M.length, c = groups.C.length, t = groups.T.length;
    const Q = 1 * p + 2 * m + 3 * c + 0.5 * t;
    return { groups, p, m, c, t, Q };
  }

  /* ---------- 6. Публичный API ---------- */
  function analyze(code) {
    const tokens = tokenize(code);
    const spen = computeSpen(tokens);
    const chepin = computeChepin(tokens);
    const chepinIO = computeChepinIO(tokens, chepin);
    return { tokens, spen, chepin, chepinIO };
  }

  return { analyze, tokenize, strip };
})();