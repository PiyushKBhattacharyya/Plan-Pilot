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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const gemini_1 = require("./gemini");
const storage_1 = require("./storage");
const planProvider_1 = require("./planProvider");
const webviewProvider_1 = require("./webviewProvider");
let geminiService;
let planStorage;
let planProvider;
let webviewProvider;
function activate(context) {
    console.log('PlanPilot extension is now active!');
    // Initialize services
    geminiService = new gemini_1.GeminiService();
    planStorage = new storage_1.PlanStorage(context);
    planProvider = new planProvider_1.PlanProvider(planStorage);
    webviewProvider = new webviewProvider_1.PlanPilotWebviewProvider(context.extensionUri, geminiService, planStorage);
    // Register tree data provider (required by package.json)
    vscode.window.createTreeView('planpilot.plans', {
        treeDataProvider: planProvider,
        showCollapseAll: true
    });
    // Add command to open webview panel
    const openWebviewCommand = vscode.commands.registerCommand('planpilot.openSidebar', async () => {
        await openWebviewPanel();
    });
    context.subscriptions.push(openWebviewCommand);
    // Register commands
    const generatePlanCommand = vscode.commands.registerCommand('planpilot.generatePlan', async () => {
        await generatePlan();
    });
    const showPlansCommand = vscode.commands.registerCommand('planpilot.showPlans', async () => {
        await showPlans();
    });
    const exportPlanCommand = vscode.commands.registerCommand('planpilot.exportPlan', async () => {
        // Show quick pick to select plan
        const plans = await planStorage.getPlans();
        if (plans.length === 0) {
            vscode.window.showInformationMessage('No plans available to export.');
            return;
        }
        const selectedPlan = await vscode.window.showQuickPick(plans.map(plan => ({
            label: plan.title,
            description: `${plan.phases.length} phases`,
            plan: plan
        })), { placeHolder: 'Select a plan to export' });
        if (selectedPlan) {
            await exportPlan(selectedPlan.plan);
        }
    });
    const deletePlanCommand = vscode.commands.registerCommand('planpilot.deletePlan', async () => {
        // Show quick pick to select plan to delete
        const plans = await planStorage.getPlans();
        if (plans.length === 0) {
            vscode.window.showInformationMessage('No plans available to delete.');
            return;
        }
        const selectedPlan = await vscode.window.showQuickPick(plans.map(plan => ({
            label: plan.title,
            description: `${plan.phases.length} phases`,
            plan: plan
        })), { placeHolder: 'Select a plan to delete' });
        if (!selectedPlan) {
            return;
        }
        const result = await vscode.window.showWarningMessage(`Are you sure you want to delete "${selectedPlan.plan.title}"?`, 'Delete', 'Cancel');
        if (result === 'Delete') {
            await planStorage.deletePlan(selectedPlan.plan.id);
            planProvider.refresh();
            vscode.window.showInformationMessage('Plan deleted successfully.');
        }
    });
    const viewPhaseCommand = vscode.commands.registerCommand('planpilot.viewPhase', async () => {
        // Show quick pick to select plan first, then phase
        const plans = await planStorage.getPlans();
        if (plans.length === 0) {
            vscode.window.showInformationMessage('No plans available.');
            return;
        }
        const selectedPlan = await vscode.window.showQuickPick(plans.map(plan => ({
            label: plan.title,
            description: `${plan.phases.length} phases`,
            plan: plan
        })), { placeHolder: 'Select a plan' });
        if (!selectedPlan) {
            return;
        }
        const selectedPhase = await vscode.window.showQuickPick(selectedPlan.plan.phases.map(phase => ({
            label: phase.title,
            description: `${phase.category} • ${phase.estimatedHours}h`,
            phase: phase
        })), { placeHolder: 'Select a phase to view' });
        if (selectedPhase) {
            await showPhaseDetails(selectedPhase.phase);
        }
    });
    // Add commands to subscriptions
    context.subscriptions.push(generatePlanCommand, showPlansCommand, exportPlanCommand, deletePlanCommand, viewPhaseCommand);
    // Show welcome message on first activation
    const hasShownWelcome = context.globalState.get('planpilot.hasShownWelcome', false);
    if (!hasShownWelcome) {
        vscode.window.showInformationMessage('Welcome to PlanPilot! Generate implementation plans with AI. Check the sidebar for the modern UI!', 'Open Sidebar', 'Generate Plan').then(selection => {
            if (selection === 'Open Sidebar') {
                vscode.commands.executeCommand('planpilot.openSidebar');
            }
            else if (selection === 'Generate Plan') {
                vscode.commands.executeCommand('planpilot.generatePlan');
            }
        });
        context.globalState.update('planpilot.hasShownWelcome', true);
    }
}
async function generatePlan() {
    try {
        // Get objective from user
        const objective = await vscode.window.showInputBox({
            prompt: 'Describe your development objective',
            placeHolder: 'e.g., Add a real-time chat feature with user authentication and message history',
            validateInput: (value) => {
                if (value.length < 10) {
                    return 'Please provide a more detailed objective (at least 10 characters)';
                }
                return null;
            }
        });
        if (!objective) {
            return;
        }
        // Show progress
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Generating implementation plan...',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: 'Analyzing objective...' });
            // Get workspace context
            const workspaceContext = getWorkspaceContext();
            progress.report({ increment: 30, message: 'Generating plan with AI...' });
            // Generate plan
            const plan = await geminiService.generateImplementationPlan({
                objective,
                context: workspaceContext
            });
            progress.report({ increment: 80, message: 'Saving plan...' });
            // Save plan
            await planStorage.savePlan(plan);
            planProvider.refresh();
            progress.report({ increment: 100, message: 'Complete!' });
            // Show success message with options
            const action = await vscode.window.showInformationMessage(`Implementation plan "${plan.title}" generated successfully!`, 'View Plan', 'Export Plan');
            if (action === 'View Plan') {
                await showPlanDetails(plan);
            }
            else if (action === 'Export Plan') {
                await exportPlan(plan);
            }
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        vscode.window.showErrorMessage(`Failed to generate plan: ${errorMessage}`);
    }
}
async function showPlans() {
    const plans = await planStorage.getPlans();
    if (plans.length === 0) {
        const action = await vscode.window.showInformationMessage('No implementation plans found.', 'Generate Plan');
        if (action === 'Generate Plan') {
            await generatePlan();
        }
        return;
    }
    const selectedPlan = await vscode.window.showQuickPick(plans.map(plan => ({
        label: plan.title,
        description: `${plan.phases.length} phases • ${plan.estimatedHours || 'N/A'} hours`,
        detail: plan.objective,
        plan: plan
    })), { placeHolder: 'Select a plan to view' });
    if (selectedPlan) {
        await showPlanDetails(selectedPlan.plan);
    }
}
async function showPlanDetails(plan) {
    const panel = vscode.window.createWebviewPanel('planDetails', `Plan: ${plan.title}`, vscode.ViewColumn.One, {
        enableScripts: true,
        retainContextWhenHidden: true
    });
    panel.webview.html = generatePlanWebview(plan);
}
async function showPhaseDetails(phase) {
    const panel = vscode.window.createWebviewPanel('phaseDetails', `Phase: ${phase.title}`, vscode.ViewColumn.One, {
        enableScripts: true,
        retainContextWhenHidden: true
    });
    panel.webview.html = generatePhaseWebview(phase);
}
async function exportPlan(plan) {
    const format = await vscode.window.showQuickPick([
        { label: 'Cursor', value: 'cursor', description: 'Export for Cursor AI editor' },
        { label: 'Claude', value: 'claude', description: 'Export for Claude AI assistant' },
        { label: 'Windsurf', value: 'windsurf', description: 'Export for Windsurf editor' },
        { label: 'Generic', value: 'generic', description: 'Universal format for any AI assistant' }
    ], { placeHolder: 'Select export format' });
    if (!format) {
        return;
    }
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Exporting plan...',
            cancellable: false
        }, async () => {
            const exportData = await geminiService.exportPlanForAgent(plan, format.value);
            // Create new untitled document with exported content
            const doc = await vscode.workspace.openTextDocument({
                content: exportData.content,
                language: 'markdown'
            });
            await vscode.window.showTextDocument(doc);
        });
        vscode.window.showInformationMessage(`Plan exported for ${format.label} successfully!`);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        vscode.window.showErrorMessage(`Failed to export plan: ${errorMessage}`);
    }
}
function getWorkspaceContext() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return undefined;
    }
    // Get basic workspace info
    const workspaceFolder = workspaceFolders[0];
    const workspaceName = workspaceFolder.name;
    // Try to detect tech stack from package.json or other config files
    const techStack = [];
    // This could be enhanced to actually read package.json, etc.
    // For now, just provide basic context
    return {
        projectDescription: `Workspace: ${workspaceName}`,
        techStack: techStack.length > 0 ? techStack : undefined
    };
}
function generatePlanWebview(plan) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Plan: ${plan.title}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        h1, h2, h3 {
            color: var(--vscode-editor-foreground);
        }
        .phase {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            margin: 16px 0;
            padding: 16px;
            background-color: var(--vscode-editor-background);
        }
        .phase-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        .phase-category {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.8em;
        }
        .files, .steps {
            margin: 12px 0;
        }
        .file-item, .step-item {
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            padding: 8px;
            margin: 4px 0;
        }
        .file-action {
            font-weight: bold;
            text-transform: uppercase;
            font-size: 0.8em;
        }
        .file-action.create { color: #4CAF50; }
        .file-action.modify { color: #FF9800; }
        .file-action.delete { color: #F44336; }
    </style>
</head>
<body>
    <h1>${plan.title}</h1>
    <p><strong>Objective:</strong> ${plan.objective}</p>
    <p><strong>Status:</strong> ${plan.status}</p>
    <p><strong>Estimated Hours:</strong> ${plan.estimatedHours || 'N/A'}</p>
    <p><strong>Files Affected:</strong> ${plan.filesAffected || 'N/A'}</p>
    
    <h2>Implementation Phases</h2>
    ${plan.phases.map((phase, index) => `
        <div class="phase">
            <div class="phase-header">
                <h3>Phase ${index + 1}: ${phase.title}</h3>
                <span class="phase-category">${phase.category}</span>
            </div>
            <p>${phase.description}</p>
            <p><strong>Estimated Hours:</strong> ${phase.estimatedHours}</p>
            
            <div class="files">
                <h4>Files to Modify:</h4>
                ${phase.files.map(file => `
                    <div class="file-item">
                        <span class="file-action ${file.action}">${file.action}</span>
                        <strong>${file.path}</strong>
                        <p>${file.description}</p>
                    </div>
                `).join('')}
            </div>
            
            <div class="steps">
                <h4>Implementation Steps:</h4>
                ${phase.steps.sort((a, b) => a.order - b.order).map((step, stepIndex) => `
                    <div class="step-item">
                        <strong>Step ${stepIndex + 1}:</strong> ${step.description}
                        ${step.details ? `<p><em>${step.details}</em></p>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('')}
</body>
</html>`;
}
async function openWebviewPanel() {
    const panel = vscode.window.createWebviewPanel('planpilotSidebar', 'PlanPilot', vscode.ViewColumn.One, {
        enableScripts: true,
        retainContextWhenHidden: true
    });
    panel.webview.html = webviewProvider._getHtmlForWebview(panel.webview);
    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(async (data) => {
        switch (data.type) {
            case 'generatePlan':
                await webviewProvider.handleGeneratePlan(data.objective);
                break;
            case 'deletePlan':
                await webviewProvider.handleDeletePlan(data.planId);
                break;
            case 'exportPlan':
                await webviewProvider.handleExportPlan(data.planId);
                break;
            case 'refreshPlans':
                await webviewProvider.refreshPlans();
                break;
        }
    }, undefined);
    // Load initial plans
    await webviewProvider.refreshPlans();
}
function generatePhaseWebview(phase) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Phase: ${phase.title}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        h1, h2, h3 {
            color: var(--vscode-editor-foreground);
        }
        .file-item, .step-item {
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            padding: 8px;
            margin: 4px 0;
        }
        .file-action {
            font-weight: bold;
            text-transform: uppercase;
            font-size: 0.8em;
        }
        .file-action.create { color: #4CAF50; }
        .file-action.modify { color: #FF9800; }
        .file-action.delete { color: #F44336; }
        .category {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.9em;
            display: inline-block;
            margin-bottom: 16px;
        }
    </style>
</head>
<body>
    <h1>${phase.title}</h1>
    <span class="category">${phase.category}</span>
    <p>${phase.description}</p>
    <p><strong>Estimated Hours:</strong> ${phase.estimatedHours}</p>
    
    <h2>Files to Modify</h2>
    ${phase.files.map((file) => `
        <div class="file-item">
            <span class="file-action ${file.action}">${file.action}</span>
            <strong>${file.path}</strong>
            <p>${file.description}</p>
        </div>
    `).join('')}
    
    <h2>Implementation Steps</h2>
    ${phase.steps.sort((a, b) => a.order - b.order).map((step, index) => `
        <div class="step-item">
            <strong>Step ${index + 1}:</strong> ${step.description}
            ${step.details ? `<p><em>${step.details}</em></p>` : ''}
        </div>
    `).join('')}
</body>
</html>`;
}
function deactivate() {
    console.log('PlanPilot extension is now inactive.');
}
//# sourceMappingURL=extension.js.map