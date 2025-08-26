import * as vscode from 'vscode';
import { GeminiService } from './gemini';
import { PlanStorage } from './storage';
import { PlanProvider } from './planProvider';
import { PlanPilotWebviewProvider } from './webviewProvider';
import { Plan } from './types';
import { getWorkspaceContext, ContextAnalyzer } from './contextUtils';
import { generatePlanWebview, generatePhaseWebview } from './webviewHelper';

export class CommandManager {
  private contextAnalyzer: ContextAnalyzer;

  constructor(
    private geminiService: GeminiService,
    private planStorage: PlanStorage,
    private planProvider: PlanProvider,
    private webviewProvider: PlanPilotWebviewProvider
  ) {
    this.contextAnalyzer = new ContextAnalyzer();
  }

  registerCommands(context: vscode.ExtensionContext) {
    const commands = [
      vscode.commands.registerCommand('planpilot.generatePlan', () => this.handleGeneratePlan()),
      vscode.commands.registerCommand('planpilot.showPlans', () => this.handleShowPlans()),
      vscode.commands.registerCommand('planpilot.exportPlan', () => this.handleExportPlan()),
      vscode.commands.registerCommand('planpilot.deletePlan', () => this.handleDeletePlan()),
      vscode.commands.registerCommand('planpilot.viewPhase', () => this.handleViewPhase()),
      vscode.commands.registerCommand('planpilot.refresh', () => this.handleRefresh()),
      vscode.commands.registerCommand('planpilot.analyzeProject', () => this.handleAnalyzeProject()),
    ];

    context.subscriptions.push(...commands);
  }

  private async handleGeneratePlan() {
    await vscode.commands.executeCommand('planpilot.sidebar.focus');
    await this.generatePlan();
  }

  private async handleShowPlans() {
    await vscode.commands.executeCommand('planpilot.sidebar.focus');
    await this.showPlans();
  }

  private async handleExportPlan() {
    const plans = await this.planStorage.getPlans();
    if (plans.length === 0) {
      vscode.window.showInformationMessage('No plans available to export.');
      return;
    }

    const selectedPlan = await vscode.window.showQuickPick(
      plans.map(plan => ({
        label: plan.title,
        description: `${plan.phases.length} phases`,
        plan: plan
      })),
      { placeHolder: 'Select a plan to export' }
    );

    if (selectedPlan) {
      await this.exportPlan(selectedPlan.plan);
    }
  }

  private async handleDeletePlan() {
    const plans = await this.planStorage.getPlans();
    if (plans.length === 0) {
      vscode.window.showInformationMessage('No plans available to delete.');
      return;
    }

    const selectedPlan = await vscode.window.showQuickPick(
      plans.map(plan => ({
        label: plan.title,
        description: `${plan.phases.length} phases`,
        plan: plan
      })),
      { placeHolder: 'Select a plan to delete' }
    );

    if (!selectedPlan) {
      return;
    }

    const result = await vscode.window.showWarningMessage(
      `Are you sure you want to delete "${selectedPlan.plan.title}"?`,
      'Delete',
      'Cancel'
    );

    if (result === 'Delete') {
      await this.planStorage.deletePlan(selectedPlan.plan.id);
      this.planProvider.refresh();
      vscode.window.showInformationMessage('Plan deleted successfully.');
    }
  }

  private async handleViewPhase() {
    const plans = await this.planStorage.getPlans();
    if (plans.length === 0) {
      vscode.window.showInformationMessage('No plans available.');
      return;
    }

    const selectedPlan = await vscode.window.showQuickPick(
      plans.map(plan => ({
        label: plan.title,
        description: `${plan.phases.length} phases`,
        plan: plan
      })),
      { placeHolder: 'Select a plan' }
    );

    if (!selectedPlan) {
      return;
    }

    const selectedPhase = await vscode.window.showQuickPick(
      selectedPlan.plan.phases.map(phase => ({
        label: phase.title,
        description: `${phase.category} • ${phase.estimatedHours}h`,
        phase: phase
      })),
      { placeHolder: 'Select a phase to view' }
    );

    if (selectedPhase) {
      await this.showPhaseDetails(selectedPhase.phase);
    }
  }

  private async handleRefresh() {
    this.planProvider.refresh();
    await this.webviewProvider.refreshPlans();
    vscode.window.showInformationMessage('Plans refreshed.');
  }

  private async handleAnalyzeProject() {
    if (!this.geminiService.isConfigured()) {
      const action = await vscode.window.showWarningMessage(
        'Gemini API key not configured. Project analysis requires AI capabilities.',
        'Configure API Key',
        'Cancel'
      );
      
      if (action === 'Configure API Key') {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'planpilot.geminiApiKey');
      }
      return;
    }

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Analyzing project structure...',
      cancellable: false
    }, async (progress) => {
      try {
        progress.report({ increment: 0, message: 'Scanning workspace...' });
        
        const analysis = await this.contextAnalyzer.analyzeWorkspaceContext();
        
        progress.report({ increment: 100, message: 'Analysis complete!' });
        
        if (analysis) {
          const action = await vscode.window.showInformationMessage(
            `Project analyzed: ${analysis.architecture} with ${analysis.techStack.length} technologies detected.`,
            'View Details',
            'Generate Plan'
          );
          
          if (action === 'View Details') {
            await this.showProjectAnalysisDetails(analysis);
          } else if (action === 'Generate Plan') {
            await this.generatePlan();
          }
        } else {
          vscode.window.showInformationMessage('No workspace folder found to analyze.');
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
  }

  private async showProjectAnalysisDetails(analysis: any) {
    const panel = vscode.window.createWebviewPanel(
      'projectAnalysis',
      'Project Analysis',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    panel.webview.html = this.generateAnalysisWebview(analysis);
  }

  private generateAnalysisWebview(analysis: any): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Project Analysis</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        h1, h2, h3 { color: var(--vscode-editor-foreground); }
        .section {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            margin: 16px 0;
            padding: 16px;
            background-color: var(--vscode-editor-background);
        }
        .tech-stack {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin: 8px 0;
        }
        .tech-item {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 0.9em;
        }
        .feature-list {
            list-style-type: none;
            padding: 0;
        }
        .feature-list li {
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            padding: 8px;
            margin: 4px 0;
        }
        .quality-indicator {
            font-weight: bold;
            padding: 8px 12px;
            border-radius: 4px;
            display: inline-block;
            margin: 8px 0;
        }
        .quality-good { background-color: #4CAF50; color: white; }
        .quality-fair { background-color: #FF9800; color: white; }
        .quality-poor { background-color: #F44336; color: white; }
    </style>
</head>
<body>
    <h1>Project Analysis Results</h1>
    
    <div class="section">
        <h2>Project Overview</h2>
        <p>${analysis.projectDescription}</p>
        <p><strong>Architecture:</strong> ${analysis.architecture}</p>
    </div>
    
    <div class="section">
        <h2>Technology Stack</h2>
        <div class="tech-stack">
            ${analysis.techStack.map((tech: string) => `<span class="tech-item">${tech}</span>`).join('')}
        </div>
    </div>
    
    <div class="section">
        <h2>Existing Features</h2>
        <ul class="feature-list">
            ${analysis.existingFeatures.map((feature: string) => `<li>${feature}</li>`).join('')}
        </ul>
    </div>
    
    <div class="section">
        <h2>Code Quality Assessment</h2>
        <div class="quality-indicator ${this.getQualityClass(analysis.codeQuality)}">
            ${analysis.codeQuality}
        </div>
    </div>
    
    <div class="section">
        <h2>Development Recommendations</h2>
        <ul class="feature-list">
            ${analysis.recommendations.map((rec: string) => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
    
    <div class="section">
        <h2>Key Files</h2>
        <ul class="feature-list">
            ${analysis.keyFiles.map((file: string) => `<li>${file}</li>`).join('')}
        </ul>
    </div>
</body>
</html>`;
  }

  private getQualityClass(quality: string): string {
    const qualityLower = quality.toLowerCase();
    if (qualityLower.includes('good') || qualityLower.includes('excellent') || qualityLower.includes('high')) {
      return 'quality-good';
    } else if (qualityLower.includes('fair') || qualityLower.includes('moderate') || qualityLower.includes('average')) {
      return 'quality-fair';
    } else {
      return 'quality-poor';
    }
  }

  private async generatePlan() {
    try {
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

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Generating implementation plan...',
        cancellable: false
      }, async (progress) => {
        progress.report({ increment: 0, message: 'Analyzing objective...' });

        const workspaceContext = await getWorkspaceContext();

        progress.report({ increment: 30, message: 'Generating plan with AI...' });

        const plan = await this.geminiService.generateImplementationPlan({
          objective,
          context: workspaceContext
        });

        progress.report({ increment: 80, message: 'Saving plan...' });

        await this.planStorage.savePlan(plan);
        this.planProvider.refresh();

        progress.report({ increment: 100, message: 'Complete!' });

        const action = await vscode.window.showInformationMessage(
          `Implementation plan "${plan.title}" generated successfully!`,
          'View Plan',
          'Export Plan'
        );

        if (action === 'View Plan') {
          await this.showPlanDetails(plan);
        } else if (action === 'Export Plan') {
          await this.exportPlan(plan);
        }
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      vscode.window.showErrorMessage(`Failed to generate plan: ${errorMessage}`);
    }
  }

  private async showPlans() {
    const plans = await this.planStorage.getPlans();
    
    if (plans.length === 0) {
      const action = await vscode.window.showInformationMessage(
        'No implementation plans found.',
        'Generate Plan'
      );
      
      if (action === 'Generate Plan') {
        await this.generatePlan();
      }
      return;
    }

    const selectedPlan = await vscode.window.showQuickPick(
      plans.map(plan => ({
        label: plan.title,
        description: `${plan.phases.length} phases • ${plan.estimatedHours || 'N/A'} hours`,
        detail: plan.objective,
        plan: plan
      })),
      { placeHolder: 'Select a plan to view' }
    );

    if (selectedPlan) {
      await this.showPlanDetails(selectedPlan.plan);
    }
  }

  private async showPlanDetails(plan: Plan) {
    const panel = vscode.window.createWebviewPanel(
      'planDetails',
      `Plan: ${plan.title}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    panel.webview.html = generatePlanWebview(plan);
  }

  private async showPhaseDetails(phase: any) {
    const panel = vscode.window.createWebviewPanel(
      'phaseDetails',
      `Phase: ${phase.title}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    panel.webview.html = generatePhaseWebview(phase);
  }

  private async exportPlan(plan: Plan) {
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
        const exportData = await this.geminiService.exportPlanForAgent(plan, format.value);
        
        const doc = await vscode.workspace.openTextDocument({
          content: exportData.content,
          language: 'markdown'
        });
        
        await vscode.window.showTextDocument(doc);
      });

      vscode.window.showInformationMessage(`Plan exported for ${format.label} successfully!`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      vscode.window.showErrorMessage(`Failed to export plan: ${errorMessage}`);
    }
  }
}