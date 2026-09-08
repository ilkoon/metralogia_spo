import { analyzeRust } from './analyzer.js';

const codeInput = document.getElementById("codeInput");
const fileInput = document.getElementById("fileInput");
const fileName = document.getElementById("fileName");
const analyzeButton = document.getElementById("analyzeButton");

function escapeHtml(v) {
    return String(v)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function renderTable(tableId, map, title) {
    const tbody = document.getElementById(tableId).querySelector("tbody");
    tbody.innerHTML = "";
    const entries = [...map.entries()]
        .filter(([, v]) => v > 0)
        .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
    let total = 0;
    entries.forEach(([name, count], idx) => {
        total += count;
        tbody.innerHTML += `<tr><td>${idx+1}</td><td>${escapeHtml(name)}</td><td>${count}</td></tr>`;
    });
    tbody.innerHTML += `<tr class="total-row"><td>—</td><td>Уникальных ${title.toLowerCase()}: ${entries.length}</td><td>Всего: ${total}</td></tr>`;
}

function displayResult(result) {
    ["eta1", "eta2", "n1", "n2", "eta", "n"].forEach(id => {
        document.getElementById(id).textContent = result[id];
    });
    document.getElementById("volume").textContent = result.volume.toFixed(2);
    renderTable("operatorsTable", result.operators, "операторов");
    renderTable("operandsTable", result.operands, "операндов");
}

function runAnalysis() {
    if (!codeInput.value.trim()) {
        displayResult({
            operators: new Map(),
            operands: new Map(),
            eta1: 0, eta2: 0,
            n1: 0, n2: 0,
            eta: 0, n: 0,
            volume: 0
        });
        return;
    }
    displayResult(analyzeRust(codeInput.value));
}

fileInput.addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".rs")) {
        alert("Выберите файл с расширением .rs");
        fileInput.value = "";
        return;
    }
    fileName.textContent = file.name;
    const reader = new FileReader();
    reader.onload = () => {
        codeInput.value = reader.result;
        runAnalysis();
    };
    reader.onerror = () => alert("Не удалось прочитать файл.");
    reader.readAsText(file, "UTF-8");
});

analyzeButton.addEventListener("click", runAnalysis);
codeInput.addEventListener("keydown", e => {
    if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        runAnalysis();
    }
});

runAnalysis();