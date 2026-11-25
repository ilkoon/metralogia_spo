const RustParser = (() => {

  const KEYWORDS = new Set([
    'fn','let','mut','for','in','if','else','while','loop','match','break',
    'continue','return','struct','enum','impl','trait','pub','use','mod','crate',
    'as','ref','move','async','await','dyn','where','type','const','static',
    'unsafe','extern','self','Self','super','true','false','i32','i64','u32',
    'u64','usize','isize','f64','f32','str','bool','char'
  ]);

  const BUILTIN_FNS = new Set([
    'println','print','eprintln','eprint','format','vec','panic','assert',
    'assert_eq','assert_ne','write','writeln','read_line','stdin','stdout',
    'String','Vec','Some','None','Ok','Err'
  ]);

  const CONTROL_CTX = ['if','while','for','match','loop'];

  const IO_RE = /^(?:println|print|eprintln|eprint|read_line|stdin)$/;

  function strip(code) {
    return code
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/[^\n]*/g, ' ')
      .replace(/"(?:\\.|[^"\\])*"/g, ' "" ')
      .replace(/'(?:\\.|[^'\\])'/g, " ' ' ");
  }

  function tokenize(code) {
    const clean = strip(code);
    const tokens = [];
    const re = /([A-Za-z_][A-Za-z0-9_]*)|(\d+(?:\.\d+)?)|(=>|==|!=|<=|>=|\+=|-=|\*=|\/=|\.\.|::|[{}()\[\];,.<>+\-*/%!=:&|])/g;
    let m;
    let prevKw = null;
    
    while ((m = re.exec(clean)) !== null) {
      if (m[1]) {
        const v = m[1];
        if (v === '_') {
          tokens.push({ type: 'op', val: '_' });
          prevKw = null;
          continue;
        }
        if (prevKw === 'fn') {
          tokens.push({ type: 'fn_name', val: v });
          prevKw = null;
          continue;
        }
        if (KEYWORDS.has(v)) {
          tokens.push({ type: 'kw', val: v });
          prevKw = (v === 'fn') ? 'fn' : null;
          continue;
        }
        tokens.push({ type: 'id', val: v });
        prevKw = null;
      } else if (m[2]) {
        tokens.push({ type: 'num', val: m[2] });
        prevKw = null;
      } else {
        tokens.push({ type: 'op', val: m[3] });
        prevKw = null;
      }
    }
    return tokens;
  }

  function computeSpen(tokens) {
    const counts = new Map();
    tokens.forEach(t => {
      if (t.type !== 'id') return;
      if (BUILTIN_FNS.has(t.val)) return;
      counts.set(t.val, (counts.get(t.val) || 0) + 1);
    });
    const result = [];
    for (const [name, total] of counts) {
      result.push({ name, total, spen: total - 1 });
    }
    result.sort((a, b) => b.spen - a.spen || a.name.localeCompare(b.name));
    const sum = result.reduce((s, r) => s + r.spen, 0);
    return { items: result, total: sum };
  }

  function isLetDecl(tokens, idx) {
    let j = idx - 1;
    if (j >= 0 && tokens[j].val === 'mut') j--;
    return j >= 0 && tokens[j].type === 'kw' && tokens[j].val === 'let';
  }

  function isInsideControl(tokens, idx) {
    for (let j = idx - 1; j >= 0 && j >= idx - 30; j--) {
      const v = tokens[j].val;
      if (v === '{' || v === '}' || v === ';') break;
      if (tokens[j].type === 'kw' && CONTROL_CTX.includes(v)) return true;
    }
    return false;
  }

  function computeChepin(tokens) {
    const declared = new Set();
    const used = new Map();

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];

      if (t.type === 'kw' && t.val === 'let') {
        let j = i + 1;
        if (tokens[j] && tokens[j].val === 'mut') j++;
        if (tokens[j] && tokens[j].type === 'id' && !BUILTIN_FNS.has(tokens[j].val)) {
          declared.add(tokens[j].val);
        }
        continue;
      }

      if (t.type === 'kw' && CONTROL_CTX.includes(t.val)) {
        let j = i + 1, depthParen = 0;
        while (j < tokens.length) {
          const tj = tokens[j];
          if (tj.val === '(') depthParen++;
          else if (tj.val === ')') {
            depthParen--;
            if (depthParen === 0) { j++; break; }
          } else if (tj.val === '{') break;
          if (tj.type === 'id' && !BUILTIN_FNS.has(tj.val)) {
            ensure(tj.val).inControl = true;
          }
          j++;
        }
        continue;
      }

      if (t.type === 'id' && tokens[i + 1] &&
          ['=','+=','-=','*=','/='].includes(tokens[i + 1].val) &&
          !BUILTIN_FNS.has(t.val) &&
          !isLetDecl(tokens, i)) {
        const rec = ensure(t.val);
        rec.write = true;
        if (rec.firstAssign === undefined) rec.firstAssign = i;
        if (tokens[i + 2] && tokens[i + 2].type === 'id' && !BUILTIN_FNS.has(tokens[i + 2].val)) {
          ensure(tokens[i + 2].val).read = true;
        }
      }
    }

    function ensure(name) {
      if (!used.has(name)) {
        used.set(name, { read: false, write: false, inControl: false, firstAssign: undefined });
      }
      return used.get(name);
    }

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.type !== 'id') continue;
      if (BUILTIN_FNS.has(t.val)) continue;
      const rec = ensure(t.val);

      if (isInsideControl(tokens, i)) rec.inControl = true;

      const next = tokens[i + 1];
      const isAssignTarget = next && ['=','+=','-=','*=','/='].includes(next.val);
      if (!isAssignTarget) rec.read = true;
    }

    const groups = { P: [], M: [], C: [], T: [] };
    for (const [name, rec] of used) {
      if (!declared.has(name) && !rec.inControl && !rec.read && !rec.write) continue;
      if (rec.inControl) groups.C.push(name);
      else if (rec.write) groups.M.push(name);
      else if (rec.read) groups.P.push(name);
      else groups.T.push(name);
    }

    for (const k of Object.keys(groups)) groups[k].sort();

    const p = groups.P.length, m = groups.M.length, c = groups.C.length, t = groups.T.length;
    const Q = 1 * p + 2 * m + 3 * c + 0.5 * t;
    return { groups, p, m, c, t, Q };
  }

  function computeChepinIO(tokens, fullChepin) {
    const ioVars = new Set();

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.type !== 'id') continue;
      if (!IO_RE.test(t.val)) continue;

      let j = i + 1;
      if (tokens[j] && tokens[j].val === '!') j++;
      if (!tokens[j] || tokens[j].val !== '(') continue;
      j++;
      let depth = 1;
      while (j < tokens.length && depth > 0) {
        const tj = tokens[j];
        if (tj.val === '(') depth++;
        else if (tj.val === ')') depth--;
        else if (tj.type === 'id' && !BUILTIN_FNS.has(tj.val)) ioVars.add(tj.val);
        j++;
      }
    }

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

  function analyze(code) {
    const tokens = tokenize(code);
    const spen = computeSpen(tokens);
    const chepin = computeChepin(tokens);
    const chepinIO = computeChepinIO(tokens, chepin);
    return { tokens, spen, chepin, chepinIO };
  }

  return { analyze, tokenize, strip };
})();