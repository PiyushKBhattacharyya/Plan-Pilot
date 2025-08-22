"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePlan = generatePlan;
exports.suggestNextSteps = suggestNextSteps;
const generative_ai_1 = require("@google/generative-ai");
const vscode = require("vscode");
const dotenv = require("dotenv");
dotenv.config();
async function generatePlan(request, context) {
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
        const prompt = `You are Traycer AI, a planning layer for coding agents. Given the user task: "${request}"

Workspace context:
Repo: ${context.repoName || 'N/A'}
File count: ${context.fileCount}
Languages: ${JSON.stringify(context.languageStats)}
Recent files: ${context.recentFiles.join('\n')}
User-selected files: ${context.userSelectedFiles?.join('\n') || 'None'}
Sample files:
${context.files.map(f => `${f.path}: ${f.contentPreview || ''}`).join('\n')}

Generate a precise, actionable plan with 3-5 steps to achieve the task.
Assign each step to one agent: Scaffolder, Researcher, or Refactorer.

Output only valid JSON:
{
  "request": "${request}",
  "steps": [
    {
      "id": "s1",
      "title": "Step title",
      "description": "Detailed step description",
      "agent": "Scaffolder" | "Researcher" | "Refactorer",
      "status": "pending"
    }
  ]
}`;
        const result = await model.generateContent(prompt);
        const response = result.response.text();
        let plan;
        try {
            plan = JSON.parse(response);
        }
        catch {
            throw new Error("Failed to parse AI response.");
        }
        plan.steps.forEach((step, i) => {
            step.id = `s${i + 1}`;
            step.status = "pending";
        });
        plan.suggestions = [];
        return plan;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(`Failed to generate plan: ${message}`);
        return {
            request,
            steps: [
                {
                    id: "s1",
                    title: "Error",
                    description: `Failed to generate plan: ${message}`,
                    agent: "Researcher",
                    status: "error",
                },
            ],
            suggestions: [],
        };
    }
}
async function suggestNextSteps(plan, context) {
    try {
        let apiKey = vscode.workspace.getConfiguration('traycer').get('geminiApiKey');
        if (!apiKey) {
            apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
                return ["Configure Gemini API key in VS Code settings or .env file."];
            }
        }
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Given the current plan: ${JSON.stringify(plan)}

Workspace context:
Repo: ${context.repoName || 'N/A'}
File count: ${context.fileCount}
Languages: ${JSON.stringify(context.languageStats)}
Recent files: ${context.recentFiles.join('\n')}
User-selected files: ${context.userSelectedFiles?.join('\n') || 'None'}
Sample files:
${context.files.map(f => `${f.path}: ${f.contentPreview || ''}`).join('\n')}

Suggest 3-5 next steps, tips, or improvements for the plan.

Output only JSON array of strings: ["suggestion1", "suggestion2", ...]`;
        const result = await model.generateContent(prompt);
        const response = result.response.text();
        try {
            return JSON.parse(response);
        }
        catch {
            return ["Failed to parse suggestions."];
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(`Failed to generate suggestions: ${message}`);
        return ["Error generating suggestions."];
    }
}
//# sourceMappingURL=planner.js.map