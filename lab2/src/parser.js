function tokenize(code) {
    const clean = code;
    const pattern = /=>|==|!=|<=|>=|&&|\|\||\+=|-=|\*=|\/=|%=|->|::|[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[{}()[\];,:.?]|[+\-*\/%<>=!&|^~]/g;
    return [...clean.matchAll(pattern)].map(m => ({
        value: m[0],
        index: m.index
    }));
}

function findMatching(tokens, start, open, close) {
    let depth = 0;
    for (let i = start; i < tokens.length; i++) {
        if (tokens[i].value === open) depth++;
        if (tokens[i].value === close) {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

function findBlockEnd(tokens, start) {
    if (tokens[start]?.value !== "{") return start;
    return findMatching(tokens, start, "{", "}");
}

function findIfEnd(tokens, ifIndex) {
    let j = ifIndex + 1;
    while (j < tokens.length && tokens[j].value !== "{") j++;
    if (j >= tokens.length) return ifIndex;

    let end = findBlockEnd(tokens, j);

    let k = end + 1;
    while (tokens[k]?.value === "else") {
        if (tokens[k + 1]?.value === "if") {
            let m = k + 2;
            while (m < tokens.length && tokens[m].value !== "{") m++;
            if (m >= tokens.length) break;
            end = findBlockEnd(tokens, m);
            k = end + 1;
        } else if (tokens[k + 1]?.value === "{") {
            end = findBlockEnd(tokens, k + 1);
            k = end + 1;
        } else {
            break;
        }
    }
    return end;
}

function countMatchBranches(tokens, openIndex) {
    const closeIndex = findMatching(tokens, openIndex, "{", "}");
    if (closeIndex < 0) return { branches: 0, closeIndex: tokens.length - 1 };

    let totalBranches = 0;
    let defaultBranches = 0;
    let depth = 0;

    for (let i = openIndex + 1; i < closeIndex; i++) {
        const v = tokens[i].value;

        if (v === "{") depth++;
        if (v === "}") depth--;

        if (depth === 0 && v === "=>") {
            totalBranches++;

            let j = i - 1;
            while (j > openIndex && tokens[j].value !== "," && tokens[j].value !== "=>") {
                j--;
            }
            let start = j + 1;
            while (start < i && (tokens[start].value === " " || tokens[start].value === "\n")) start++;

            if (tokens[start]?.value === "_") {
                defaultBranches++;
            }
        }
    }

    return {
        branches: Math.max(0, totalBranches - defaultBranches),
        closeIndex
    };
}

const DECL_KEYWORDS = new Set([
     "let", "const", "static", "struct", "enum",
    "trait", "impl", "mod", "use", "type"
]);

const CONTROL_KEYWORDS = new Set([
    "if", "while", "for", "loop"
]);

const JUMP_KEYWORDS = new Set([
    "break", "continue", "return"
]);

function countStatements(tokens) {
    let operators = 0;
    let i = 0;

    while (i < tokens.length) {
        const v = tokens[i].value;

        if (v === "match") {
            operators++;
            let j = i + 1;
            while (j < tokens.length && tokens[j].value !== "{") j++;
            if (j < tokens.length) {
                const closeIndex = findMatching(tokens, j, "{", "}");
                if (closeIndex > 0) {
                    let depth = 0;
                    for (let k = j + 1; k < closeIndex; k++) {
                        const t = tokens[k].value;
                        if (t === "{") depth++;
                        if (t === "}") depth--;
                        if (depth === 0 && t === "=>") {
                            operators++;
                        }
                    }
                    i = closeIndex + 1;
                    continue;
                }
            }
            i++;
            continue;
        }

        if (CONTROL_KEYWORDS.has(v)) {
            operators++;
            i++;
            continue;
        }

        if (DECL_KEYWORDS.has(v)) {
            operators++;
            while (i < tokens.length
                   && tokens[i].value !== ";"
                   && tokens[i].value !== "{") i++;
            if (i < tokens.length && tokens[i].value === ";") i++;
            continue;
        }

        if (JUMP_KEYWORDS.has(v)) {
            operators++;
            while (i < tokens.length
                   && tokens[i].value !== ";"
                   && tokens[i].value !== "}") i++;
            if (i < tokens.length && tokens[i].value === ";") i++;
            continue;
        }

        if (v === ";") {
            operators++;
            i++;
            continue;
        }

        i++;
    }

    return operators;
}

export function analyzeRust(code) {
    const tokens = tokenize(code);

    let CL = 0;
    let CLI = 0;

    const constructions = [];
    const stack = [];

    for (let i = 0; i < tokens.length; i++) {
        const value = tokens[i].value;

        while (stack.length && i > stack[stack.length - 1].end) {
            stack.pop();
        }

        const currentDepth = stack.length;

        if (value === "if") {
            CL++;
            const end = findIfEnd(tokens, i);
            CLI = Math.max(CLI, currentDepth + 1);
            constructions.push(`if: ветвление, уровень ${currentDepth + 1}`);
            stack.push({ type: "if", end });
        }

        else if (value === "while") {
            CL++;
            let j = i + 1;
            while (j < tokens.length && tokens[j].value !== "{") j++;
            const end = j < tokens.length ? findBlockEnd(tokens, j) : i;
            CLI = Math.max(CLI, currentDepth + 1);
            constructions.push(`while: цикл, уровень ${currentDepth + 1}`);
            stack.push({ type: "while", end });
        }

        else if (value === "for") {
            CL++;
            let j = i + 1;
            while (j < tokens.length && tokens[j].value !== "{") j++;
            const end = j < tokens.length ? findBlockEnd(tokens, j) : i;
            CLI = Math.max(CLI, currentDepth + 1);
            constructions.push(`for: цикл, уровень ${currentDepth + 1}`);
            stack.push({ type: "for", end });
        }

        else if (value === "loop") {
            //CL++;
            let j = i + 1;
            while (j < tokens.length && tokens[j].value !== "{") j++;
            const end = j < tokens.length ? findBlockEnd(tokens, j) : i;
            CLI = Math.max(CLI, currentDepth + 1);
            constructions.push(`loop: цикл, уровень ${currentDepth + 1}`);
            stack.push({ type: "loop", end });
        }

        else if (value === "match") {
            let j = i + 1;
            while (j < tokens.length && tokens[j].value !== "{") j++;

            if (j < tokens.length) {
                const result = countMatchBranches(tokens, j);
                const n = result.branches;

                if (n >= 1) {
                    //CL += n - 1;
                    CL += n;
                }

                const matchCLI = n >= 2
                    ? currentDepth + 1 + (n - 2)
                    : currentDepth + 1;

                CLI = Math.max(CLI, matchCLI);
                constructions.push(
                    `match: ${n} ветвлений (default не учитывается), ` +
                    `CL += ${n >= 1 ? n - 1 : 0}, условная глубина до ${matchCLI}`
                );

                stack.push({ type: "match", end: result.closeIndex });
            }
        }
    }

    const totalOperators = countStatements(tokens);
    const cl = totalOperators > 0 ? CL / totalOperators : 0;

    return {
        CL,
        cl,
        CLI,
        totalOperators,
        constructions
    };
}