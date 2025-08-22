import * as vscode from 'vscode';
import { GeminiService } from './gemini';
import { PlanStorage } from './storage';
import { Plan } from './types';

export class PlanPilotWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'planpilot.plans';
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly geminiService: GeminiService,
    private readonly planStorage: PlanStorage
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(
      async (data) => {
        switch (data.type) {
          case 'generatePlan':
            await this.handleGeneratePlan(data.objective);
            break;
          case 'deletePlan':
            await this.handleDeletePlan(data.planId);
            break;
          case 'exportPlan':
            await this.handleExportPlan(data.planId);
            break;
          case 'refreshPlans':
            await this.refreshPlans();
            break;
          case 'showPhaseDetails':
            await this.handleShowPhaseDetails(data.planId, data.phaseId);
            break;
        }
      },
      undefined
    );

    // Load initial plans
    this.refreshPlans();
  }

  public async handleGeneratePlan(objective: string) {
    try {
      this._view?.webview.postMessage({ type: 'generationStarted' });
      
      const plan = await this.geminiService.generateImplementationPlan({ objective });
      await this.planStorage.savePlan(plan);
      
      this._view?.webview.postMessage({ 
        type: 'generationComplete',
        plan: plan
      });
      
      await this.refreshPlans();
    } catch (error) {
      this._view?.webview.postMessage({ 
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to generate plan'
      });
    }
  }

  public async handleDeletePlan(planId: string) {
    await this.planStorage.deletePlan(planId);
    await this.refreshPlans();
  }

  public async handleExportPlan(planId: string) {
    try {
      const plans = await this.planStorage.getPlans();
      const plan = plans.find(p => p.id === planId);
      if (plan) {
        const exported = await this.geminiService.exportPlanForAgent(plan, 'markdown');
        // Show the exported content in a new document
        const doc = await vscode.workspace.openTextDocument({
          content: exported.content,
          language: 'markdown'
        });
        await vscode.window.showTextDocument(doc);
      }
    } catch (error) {
      vscode.window.showErrorMessage('Failed to export plan: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  private async handleShowPhaseDetails(planId: string, phaseId: string) {
    try {
      const plans = await this.planStorage.getPlans();
      const plan = plans.find(p => p.id === planId);
      const phase = plan?.phases.find(p => p.id === phaseId);
      
      if (phase) {
        this._view?.webview.postMessage({
          type: 'showPhaseDetails',
          phase: phase
        });
      }
    } catch (error) {
      vscode.window.showErrorMessage('Failed to load phase details');
    }
  }

  public async refreshPlans() {
    try {
      const plans = await this.planStorage.getPlans();
      this._view?.webview.postMessage({ 
        type: 'plansLoaded',
        plans: plans
      });
    } catch (error) {
      console.error('Failed to load plans:', error);
    }
  }

  public _getHtmlForWebview(webview: vscode.Webview) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PlanPilot</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            background-color: var(--vscode-sideBar-background);
            color: var(--vscode-sideBar-foreground);
            height: 100vh;
            overflow-x: hidden;
        }

        .container {
            padding: 16px;
            height: 100%;
            display: flex;
            flex-direction: column;
        }

        .header {
            margin-bottom: 20px;
        }

        .logo {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
        }

        .logo-icon {
            width: 24px;
            height: 24px;
            background: var(--vscode-button-background);
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--vscode-button-foreground);
            font-weight: bold;
        }

        .title {
            font-size: 18px;
            font-weight: 600;
            color: var(--vscode-foreground);
        }

        .subtitle {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }

        .generate-section {
            background: var(--vscode-sideBar-background);
            border: 1px solid var(--vscode-sideBar-border);
            border-radius: 6px;
            padding: 16px;
            margin-bottom: 20px;
        }

        .form-group {
            margin-bottom: 12px;
        }

        label {
            display: block;
            font-size: 12px;
            font-weight: 500;
            color: var(--vscode-foreground);
            margin-bottom: 6px;
        }

        textarea {
            width: 100%;
            min-height: 80px;
            padding: 8px 12px;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            color: var(--vscode-input-foreground);
            font-family: inherit;
            font-size: inherit;
            resize: vertical;
        }

        textarea:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }

        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-family: inherit;
            font-size: 12px;
            font-weight: 500;
            transition: background-color 0.2s;
        }

        .btn-primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .btn-primary:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .btn-primary:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .btn-secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .btn-small {
            padding: 4px 8px;
            font-size: 11px;
        }

        .plans-section {
            flex: 1;
            overflow-y: auto;
        }

        .section-title {
            font-size: 14px;
            font-weight: 600;
            color: var(--vscode-foreground);
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .plan-card {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 12px;
            cursor: pointer;
            transition: border-color 0.2s;
        }

        .plan-card:hover {
            border-color: var(--vscode-focusBorder);
        }

        .plan-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            margin-bottom: 8px;
        }

        .plan-title {
            font-size: 13px;
            font-weight: 600;
            color: var(--vscode-foreground);
            flex: 1;
            margin-right: 8px;
        }

        .plan-status {
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: 500;
            text-transform: uppercase;
        }

        .status-draft {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }

        .status-in_progress {
            background: #1f4e79;
            color: #ffffff;
        }

        .status-completed {
            background: #107c10;
            color: #ffffff;
        }

        .plan-objective {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
            line-height: 1.4;
        }

        .plan-meta {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
        }

        .plan-actions {
            margin-top: 8px;
            display: flex;
            gap: 6px;
        }

        .phases-list {
            margin-top: 8px;
            padding-left: 12px;
        }

        .phase-item {
            padding: 6px 0;
            border-bottom: 1px solid var(--vscode-panel-border);
            font-size: 11px;
        }

        .phase-item:last-child {
            border-bottom: none;
        }

        .phase-title {
            font-weight: 500;
            color: var(--vscode-foreground);
            margin-bottom: 2px;
        }

        .phase-meta {
            color: var(--vscode-descriptionForeground);
        }

        .loading {
            text-align: center;
            padding: 20px;
            color: var(--vscode-descriptionForeground);
        }

        .empty-state {
            text-align: center;
            padding: 20px;
            color: var(--vscode-descriptionForeground);
        }

        .error {
            background: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            color: var(--vscode-inputValidation-errorForeground);
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            margin-bottom: 12px;
        }

        .refresh-btn {
            cursor: pointer;
            padding: 2px;
            border-radius: 3px;
        }

        .refresh-btn:hover {
            background: var(--vscode-toolbar-hoverBackground);
        }

        .hidden {
            display: none;
        }

        .expanded .phases-list {
            display: block;
        }

        .collapsed .phases-list {
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">
                <div class="logo-icon">📋</div>
                <div>
                    <div class="title">PlanPilot</div>
                    <div class="subtitle">AI-powered development planning</div>
                </div>
            </div>
        </div>

        <div class="generate-section">
            <div class="form-group">
                <label for="objective">Development Objective</label>
                <textarea 
                    id="objective" 
                    placeholder="Describe what you want to build or accomplish..."
                    rows="3"
                ></textarea>
            </div>
            <button id="generateBtn" class="btn btn-primary" onclick="generatePlan()">
                Generate Plan
            </button>
        </div>

        <div class="plans-section">
            <div class="section-title">
                Implementation Plans
                <span class="refresh-btn" onclick="refreshPlans()" title="Refresh">🔄</span>
            </div>
            <div id="plansContainer">
                <div class="loading">Loading plans...</div>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let plans = [];
        let isGenerating = false;

        // Listen for messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'plansLoaded':
                    plans = message.plans;
                    renderPlans();
                    break;
                case 'generationStarted':
                    setGenerating(true);
                    break;
                case 'generationComplete':
                    setGenerating(false);
                    document.getElementById('objective').value = '';
                    break;
                case 'error':
                    setGenerating(false);
                    showError(message.message);
                    break;
            }
        });

        function generatePlan() {
            const objective = document.getElementById('objective').value.trim();
            if (!objective) {
                showError('Please enter a development objective');
                return;
            }

            vscode.postMessage({
                type: 'generatePlan',
                objective: objective
            });
        }

        function deletePlan(planId) {
            if (confirm('Are you sure you want to delete this plan?')) {
                vscode.postMessage({
                    type: 'deletePlan',
                    planId: planId
                });
            }
        }

        function exportPlan(planId) {
            vscode.postMessage({
                type: 'exportPlan',
                planId: planId
            });
        }

        function refreshPlans() {
            vscode.postMessage({
                type: 'refreshPlans'
            });
        }

        function togglePlan(planId) {
            const planCard = document.querySelector(\`[data-plan-id="\${planId}"]\`);
            if (planCard) {
                planCard.classList.toggle('expanded');
                planCard.classList.toggle('collapsed');
            }
        }

        function setGenerating(generating) {
            isGenerating = generating;
            const btn = document.getElementById('generateBtn');
            const textarea = document.getElementById('objective');
            
            btn.disabled = generating;
            btn.textContent = generating ? 'Generating...' : 'Generate Plan';
            textarea.disabled = generating;
        }

        function showError(message) {
            // Remove existing errors
            const existingError = document.querySelector('.error');
            if (existingError) {
                existingError.remove();
            }

            // Add new error
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error';
            errorDiv.textContent = message;
            
            const generateSection = document.querySelector('.generate-section');
            generateSection.insertBefore(errorDiv, generateSection.firstChild);

            // Auto-remove after 5 seconds
            setTimeout(() => {
                if (errorDiv.parentNode) {
                    errorDiv.remove();
                }
            }, 5000);
        }

        function renderPlans() {
            const container = document.getElementById('plansContainer');
            
            if (plans.length === 0) {
                container.innerHTML = '<div class="empty-state">No plans yet. Generate your first plan above!</div>';
                return;
            }

            container.innerHTML = plans.map(plan => \`
                <div class="plan-card collapsed" data-plan-id="\${plan.id}">
                    <div class="plan-header" onclick="togglePlan('\${plan.id}')">
                        <div class="plan-title">\${plan.title}</div>
                        <div class="plan-status status-\${plan.status}">\${plan.status.replace('_', ' ')}</div>
                    </div>
                    <div class="plan-objective">\${plan.objective}</div>
                    <div class="plan-meta">
                        <span>📁 \${plan.phases.length} phases</span>
                        <span>⏱️ \${plan.estimatedHours || 'N/A'}h</span>
                        <span>📅 \${new Date(plan.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div class="plan-actions">
                        <button class="btn btn-secondary btn-small" onclick="exportPlan('\${plan.id}')">Export</button>
                        <button class="btn btn-secondary btn-small" onclick="deletePlan('\${plan.id}')">Delete</button>
                    </div>
                    <div class="phases-list">
                        \${plan.phases.map(phase => \`
                            <div class="phase-item">
                                <div class="phase-title">\${phase.title}</div>
                                <div class="phase-meta">\${phase.category} • \${phase.estimatedHours}h • \${phase.files.length} files</div>
                            </div>
                        \`).join('')}
                    </div>
                </div>
            \`).join('');
        }

        // Initialize
        refreshPlans();
    </script>
</body>
</html>`;
  }
}