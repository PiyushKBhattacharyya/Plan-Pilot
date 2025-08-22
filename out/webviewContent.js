"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWebviewContent = getWebviewContent;
const vscode = require("vscode");
const fs = require("fs");
function getNonce() {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
function getWebviewContent(panel, extensionUri) {
    try {
        const webview = panel.webview;
        const nonce = getNonce();
        const htmlPath = vscode.Uri.joinPath(extensionUri, "src", "webview", "index.html").fsPath;
        const cssPath = vscode.Uri.joinPath(extensionUri, "src", "webview", "index.css").fsPath;
        const jsPath = vscode.Uri.joinPath(extensionUri, "src", "webview", "index.js").fsPath;
        let html = fs.readFileSync(htmlPath, "utf8");
        const css = fs.readFileSync(cssPath, "utf8");
        const js = fs.readFileSync(jsPath, "utf8");
        html = html.replace("{{nonce}}", nonce);
        html = html.replace('<link rel="stylesheet" href="index.css">', `<style>${css}</style>`);
        html = html.replace(`<script nonce="{{nonce}}" src="index.js"></script>`, `<script nonce="${nonce}">${js}</script>`);
        return html;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(`Failed to load webview content: ${message}`);
        return `<html><body><h1>Error loading Traycer AI</h1><p>${message}</p></body></html>`;
    }
}
//# sourceMappingURL=webviewContent.js.map