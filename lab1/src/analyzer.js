const DECLARATION_KEYWORDS = new Set(["fn","struct","enum","trait","impl","let","const","static","type","mod","use","pub","mut","ref","move","where","crate","super","self","Self"]);
const NON_OPERAND_KEYWORDS = new Set(["as","async","await","dyn","unsafe","extern","break","continue"]);
const CONTROL_OPERATORS = new Set(["if","else","for","in","while","match","return"]);
const SINGLE_CHAR_OPERATORS = new Set(["+","-","*","/","%","=","<",">","!","&","|","^","?",".",":",",",";"]);
const MULTI_CHAR_OPERATORS = ["<<=",">>=","==","!=",">=","<=","+=","-=","*=","/=","%=","&&","||","->","=>","::","..=","..","<<",">>"];

function addCount(map, key) {
    map.set(key, (map.get(key) || 0) + 1);
}

function removeComments(code) {
    let result = "", i = 0, inString = false, inChar = false, inLineComment = false, inBlockComment = false;
    while (i < code.length) {
        const c = code[i], next = code[i + 1];
        if (inLineComment) {
            if (c === "\n") { inLineComment = false; result += "\n"; }
            i++; continue;
        }
        if (inBlockComment) {
            if (c === "*" && next === "/") { inBlockComment = false; i += 2; continue; }
            if (c === "\n") result += "\n";
            i++; continue;
        }
        if (inString) {
            result += c;
            if (c === "\\" && i + 1 < code.length) { result += code[i + 1]; i += 2; continue; }
            if (c === '"') inString = false;
            i++; continue;
        }
        if (inChar) {
            result += c;
            if (c === "\\" && i + 1 < code.length) { result += code[i + 1]; i += 2; continue; }
            if (c === "'") inChar = false;
            i++; continue;
        }
        if (c === '"') { inString = true; result += c; i++; continue; }
        if (c === "'") {
            const lifetime = code.slice(i).match(/^'[A-Za-z_][A-Za-z0-9_]*/);
            if (lifetime) { result += lifetime[0]; i += lifetime[0].length; continue; }
            inChar = true; result += c; i++; continue;
        }
        if (c === "/" && next === "/") { inLineComment = true; i += 2; continue; }
        if (c === "/" && next === "*") { inBlockComment = true; i += 2; continue; }
        result += c; i++;
    }
    return result;
}

function tokenize(code) {
    const tokens = [];
    let i = 0;
    while (i < code.length) {
        const c = code[i];
        if (/\s/.test(c)) { i++; continue; }
        if (c === '"') {
            let value = '"';
            i++;
            while (i < code.length) {
                const current = code[i];
                value += current;
                if (current === "\\" && i + 1 < code.length) { value += code[i + 1]; i += 2; continue; }
                if (current === '"') { i++; break; }
                i++;
            }
            tokens.push({ type: "string", value });
            continue;
        }
        if (c === "'") {
            const lifetime = code.slice(i).match(/^'[A-Za-z_][A-Za-z0-9_]*/);
            if (lifetime) { tokens.push({ type: "operand", value: lifetime[0] }); i += lifetime[0].length; continue; }
            let value = "'";
            i++;
            while (i < code.length) {
                const current = code[i];
                value += current;
                if (current === "\\" && i + 1 < code.length) { value += code[i + 1]; i += 2; continue; }
                if (current === "'") { i++; break; }
                i++;
            }
            tokens.push({ type: "string", value });
            continue;
        }
        if (/[0-9]/.test(c)) {
            let value = "";
            while (i < code.length && /[0-9]/.test(code[i])) { value += code[i]; i++; }
            if (code[i] === "." && /[0-9]/.test(code[i + 1])) {
                value += "."; i++;
                while (i < code.length && /[0-9]/.test(code[i])) { value += code[i]; i++; }
            }
            tokens.push({ type: "operand", value });
            continue;
        }
        if (/[A-Za-z_]/.test(c)) {
            let value = "";
            while (i < code.length && /[A-Za-z0-9_]/.test(code[i])) { value += code[i]; i++; }
            if (code[i] === "!") { value += "!"; i++; }
            tokens.push({ type: "identifier", value });
            continue;
        }
        let found = MULTI_CHAR_OPERATORS.find(op => code.startsWith(op, i));
        if (found) { tokens.push({ type: "operator", value: found }); i += found.length; continue; }
        if ("()[]{}".includes(c)) { tokens.push({ type: "bracket", value: c }); i++; continue; }
        if (SINGLE_CHAR_OPERATORS.has(c)) { tokens.push({ type: "operator", value: c }); i++; continue; }
        tokens.push({ type: "unknown", value: c }); i++;
    }
    return tokens;
}

function isFunctionCall(tokens, i) {
    if (i + 1 >= tokens.length || tokens[i].type !== "identifier") return false;
    const next = tokens[i + 1].value;
    if (next === "(") return i === 0 || tokens[i - 1].value !== "fn";
    return tokens[i].value.endsWith("!") && (next === "(" || next === "[");
}

export function analyzeRust(code) {
    const tokens = tokenize(removeComments(code));
    const operators = new Map(), operands = new Map();
    let fnDecl = false;

    for (let i = 0; i < tokens.length; i++) {
        const { type, value } = tokens[i];
        if (value === "fn") { fnDecl = true; continue; }
        if (fnDecl && type === "identifier") { fnDecl = false; continue; }
        if (DECLARATION_KEYWORDS.has(value) || NON_OPERAND_KEYWORDS.has(value)) continue;

        if (CONTROL_OPERATORS.has(value)) {
            if (value === "if") {
                let braceIdx = -1;
                for (let j = i + 1; j < tokens.length; j++) {
                    if (tokens[j].value === "{") { braceIdx = j; break; }
                }
                if (braceIdx !== -1) {
                    let depth = 0, closing = -1;
                    for (let j = braceIdx; j < tokens.length; j++) {
                        if (tokens[j].value === "{") depth++;
                        if (tokens[j].value === "}") { depth--; if (depth === 0) { closing = j; break; } }
                    }
                    if (closing !== -1 && closing + 1 < tokens.length && tokens[closing + 1].value === "else") {
                        addCount(operators, "if...else");
                        continue;
                    }
                }
                addCount(operators, "if");
                continue;
            }
            if (value === "else") {
                if (i > 0 && tokens[i - 1].value === "}") continue;
                addCount(operators, "else");
                continue;
            }
            if (value === "for") {
                let hasIn = false;
                for (let j = i + 1; j < tokens.length; j++) {
                    if (tokens[j].value === "{") break;
                    if (tokens[j].value === "in") { hasIn = true; break; }
                }
                addCount(operators, hasIn ? "for...in" : "for");
                continue;
            }
            if (value === "in") {
                if (i > 0 && tokens[i - 1].value === "for") continue;
                addCount(operators, "in");
                continue;
            }
            addCount(operators, value);
            continue;
        }

        if (isFunctionCall(tokens, i)) {
            addCount(operators, tokens[i].value + "()");
            continue;
        }

        if (value === "(") {
            const prev = i > 0 ? tokens[i - 1].value : null;
            if (prev && ["if", "for", "while"].includes(prev)) continue;
            if (i > 0 && isFunctionCall(tokens, i - 1)) continue;
            addCount(operators, "()");
            continue;
        }

        if (value === "[") { addCount(operators, "[]"); continue; }
        if (value === "{") { addCount(operators, "{}"); continue; }
        if (value === ")" || value === "]" || value === "}") continue;

        if (type === "operator") { addCount(operators, value); continue; }
        if (type === "identifier" || type === "string" || type === "operand") {
            addCount(operands, value);
        }
    }

    const eta1 = operators.size, eta2 = operands.size;
    const n1 = [...operators.values()].reduce((s, v) => s + v, 0);
    const n2 = [...operands.values()].reduce((s, v) => s + v, 0);
    const eta = eta1 + eta2, n = n1 + n2;
    const volume = eta > 0 ? n * Math.log2(eta) : 0;

    return { operators, operands, eta1, eta2, n1, n2, eta, n, volume };
}