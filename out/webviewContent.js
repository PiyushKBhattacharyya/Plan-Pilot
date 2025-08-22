"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWebviewContent = getWebviewContent;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
// Generate a random nonce for CSP
function getNonce() {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
// Get webview content from separate HTML, CSS, and JS files
function getWebviewContent(panel, extensionUri) {
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
    html = html.replace('<link rel="stylesheet" href="index.css">', `<style>${css}</style>`);
    html = html.replace(`<script nonce="{{nonce}}" src="index.js"></script>`, `<script nonce="${nonce}">${js}</script>`);
    return html;
}
//# sourceMappingURL=webviewContent.js.map