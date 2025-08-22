import * as vscode from "vscode";
import * as fs from "fs";

// Generate a random nonce for CSP
function getNonce(): string {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// Get webview content from separate HTML, CSS, and JS files

export function getWebviewContent(panel: vscode.WebviewPanel, extensionUri: vscode.Uri): string {
  const webview = panel.webview;
  const nonce = getNonce();

  // Paths to webview files
  const htmlPath = vscode.Uri.joinPath(extensionUri, "src", "webview", "index.html").fsPath;
  const cssPath = vscode.Uri.joinPath(extensionUri, "src", "webview", "index.css").fsPath;
  const jsPath = vscode.Uri.joinPath(extensionUri, "src", "webview", "index.js").fsPath;

  // Read files
  let html = fs.readFileSync(htmlPath, "utf8");
  const css = fs.readFileSync(cssPath, "utf8");
  const js = fs.readFileSync(jsPath, "utf8");

  // Replace placeholders
  html = html.replace("{{nonce}}", nonce);

  // Inject CSS and JS inline (for webview compatibility)
  html = html.replace(
    '<link rel="stylesheet" href="index.css">',
    `<style>${css}</style>`
  );

  html = html.replace(
    `<script nonce="{{nonce}}" src="index.js"></script>`,
    `<script nonce="${nonce}">${js}</script>`
  );

  return html;
}