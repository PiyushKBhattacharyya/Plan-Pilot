"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAgent = runAgent;
const fs = require("fs");
const path = require("path");
const vscode_1 = require("vscode");
const generative_ai_1 = require("@google/generative-ai");
const vscode = require("vscode");
const dotenv = require("dotenv");
dotenv.config();
async function runAgent(step, ctx) {
    try {
        let apiKey = vscode.workspace.getConfiguration('traycer').get('geminiApiKey');
        if (!apiKey) {
            apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
                throw new Error("Gemini API key not set. Configure 'traycer.geminiApiKey' in VS Code settings or set GEMINI_API_KEY in .env file.");
            }
        }
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        let agentPrompt = '';
        switch (step.agent) {
            case 'Researcher':
                agentPrompt = `Research and provide detailed information on: ${step.title} - ${step.description}\n\nProject context:\nRepo: ${ctx.repoName || 'N/A'}\nLanguages: ${JSON.stringify(ctx.languageStats)}\nRecent files: ${ctx.recentFiles.join('\n')}\nSample files:\n${ctx.files.map(f => `${f.path}: ${f.contentPreview || ''}`).join('\n')}`;
                break;
            case 'Scaffolder':
                agentPrompt = `Scaffold the code structure or files for: ${step.title} - ${step.description}\n\nProject context:\nRepo: ${ctx.repoName || 'N/A'}\nLanguages: ${JSON.stringify(ctx.languageStats)}\nRecent files: ${ctx.recentFiles.join('\n')}\nSample files:\n${ctx.files.map(f => `${f.path}: ${f.contentPreview || ''}`).join('\n')}`;
                break;
            case 'Refactorer':
                agentPrompt = `Refactor or optimize the code related to: ${step.title} - ${step.description}\n\nProject context:\nRepo: ${ctx.repoName || 'N/A'}\nLanguages: ${JSON.stringify(ctx.languageStats)}\nRecent files: ${ctx.recentFiles.join('\n')}\nSample files:\n${ctx.files.map(f => `${f.path}: ${f.contentPreview || ''}`).join('\n')}`;
                break;
            default:
                throw new Error(`Unknown agent: ${step.agent}`);
        }
        const result = await model.generateContent(agentPrompt);
        const output = result.response.text();
        const folder = vscode_1.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!folder)
            throw new Error("No workspace open");
        const outDir = path.join(folder, "traycer", "steps");
        fs.mkdirSync(outDir, { recursive: true });
        const filePath = path.join(outDir, `${step.id}.md`);
        fs.writeFileSync(filePath, `# Step: ${step.title}\n\nAgent: ${step.agent}\n\nDescription: ${step.description}\n\nGenerated Output:\n${output}\n\nAt ${new Date().toISOString()}`);
        return { outputUri: filePath };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return { error: message };
    }
}
//# sourceMappingURL=agents.js.map