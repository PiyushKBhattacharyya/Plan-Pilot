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
exports.runAgent = runAgent;
const vscode = __importStar(require("vscode"));
const buffer_1 = require("buffer"); // ✅ ensures Buffer is available
async function ensureOutputFolder() {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder)
        return undefined;
    const out = vscode.Uri.joinPath(folder.uri, ".planpilot");
    try {
        await vscode.workspace.fs.createDirectory(out);
    }
    catch {
        // ignore if it already exists
    }
    return out;
}
async function writeFile(outDir, name, content) {
    const uri = vscode.Uri.joinPath(outDir, name);
    await vscode.workspace.fs.writeFile(uri, buffer_1.Buffer.from(content, "utf8"));
    return uri;
}
/**
 * Mock agent runner: simulates work and writes a small artifact file under .planpilot/.
 */
async function runAgent(step) {
    const outDir = await ensureOutputFolder();
    if (!outDir) {
        return { error: "No workspace folder open. Open a folder to allow agents to write outputs." };
    }
    try {
        // simulate time-consuming work
        await new Promise((resolve) => setTimeout(resolve, 600 + Math.floor(Math.random() * 800)));
        switch (step.agent) {
            case "scaffolder": {
                const uri = await writeFile(outDir, `scaffold-${step.id}.txt`, `Scaffolder artifact
Task: ${step.title}
Details: ${step.description}
Generated at: ${new Date().toISOString()}
`);
                return { outputUri: uri.toString() };
            }
            case "researcher": {
                const uri = await writeFile(outDir, `research-${step.id}.md`, `# Research notes: ${step.title}

${step.description}

- Approach A
- Approach B

(Generated: ${new Date().toISOString()})
`);
                return { outputUri: uri.toString() };
            }
            case "refactorer": {
                const uri = await writeFile(outDir, `refactor-${step.id}.txt`, `Refactor suggestions
Task: ${step.title}
Suggestions:
 - Extract utilities
 - Add input guards
 - Add tests

(Generated: ${new Date().toISOString()})
`);
                return { outputUri: uri.toString() };
            }
            default:
                return { error: `Unknown agent: ${step.agent}` };
        }
    }
    catch (e) {
        return { error: String(e?.message ?? e) };
    }
}
//# sourceMappingURL=agents.js.map