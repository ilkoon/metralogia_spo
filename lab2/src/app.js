import { analyzeRust } from "./parser.js";

const fileInput = document.getElementById("fileInput");
const sourceCode = document.getElementById("sourceCode");
const analyzeButton = document.getElementById("analyzeButton");
const exampleButton = document.getElementById("exampleButton");

const clElement = document.getElementById("cl");
const relativeClElement = document.getElementById("relativeCl");
const cliElement = document.getElementById("cli");
const operatorsElement = document.getElementById("operators");
const errorElement = document.getElementById("error");

fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".rs")) {
        showError("Можно открыть только файл с расширением .rs");
        return;
    }

    const reader = new FileReader();

    reader.onload = () => {
        sourceCode.value = reader.result;
        clearError();
        analyze();
    };

    reader.onerror = () => showError("Не удалось прочитать файл.");
    reader.readAsText(file);
});

analyzeButton.addEventListener("click", analyze);

function analyze() {
    const code = sourceCode.value.trim();

    if (!code) {
        showError("Исходный код отсутствует.");
        return;
    }

    try {
        const result = analyzeRust(code);

        clElement.textContent = result.CL;
        relativeClElement.textContent = result.cl.toFixed(2);
        cliElement.textContent = result.CLI;
        operatorsElement.textContent = result.totalOperators;

        clearError();
    } catch (error) {
        showError("Ошибка анализа: " + error.message);
    }
}

function showError(message) {
    errorElement.textContent = message;
    errorElement.classList.remove("hidden");
}

function clearError() {
    errorElement.textContent = "";
    errorElement.classList.add("hidden");
}
