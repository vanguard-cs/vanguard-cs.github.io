function copyCode() {
    const code = document.getElementById("code-snippet").innerText;
    navigator.clipboard.writeText(code).then(() => {
        alert("Code copied to clipboard!");
    });
}
