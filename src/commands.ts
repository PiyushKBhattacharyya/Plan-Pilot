import * as vscode from 'vscode';
import { GeminiService } from './gemini';
import { PlanStorage } from './storage';
import { PlanProvider } from './planProvider';
import { PlanPilotWebviewProvider } from './webviewProvider';
import { Plan } from './types';
import { getWorkspaceContext } from './contextUtils';
import { generatePlanWebview, generatePhaseWebview } from './webviewHelper';

export class CommandManager {
  constructor(
    private geminiService: GeminiService,
    private planStorage: PlanStorage,
    private planProvider: PlanProvider,
    private webviewProvider: PlanPilotWebviewProvider
  ) {}

  registerCommands(context: vscode.ExtensionContext) {
    const commands = [
      vscode.commands.registerCommand('planpilot.generatePlan', () => this.handleGeneratePlan()),
      vscode.commands.registerCommand('planpilot.showPlans', () => this.handleShowPlans()),
      vscode.commands.registerCommand('planpilot.exportPlan', () => this.handleExportPlan()),
      vscode.commands.registerCommand('planpilot.deletePlan', () => this.handleDeletePlan()),
      vscode.commands.registerCommand('planpilot.viewPhase', () => this.handleViewPhase()),
      vscode.commands.registerCommand('planpilot.refresh', () => this.handleRefresh()),
    ];

    context.subscriptions.push(...commands);
  }

  private async handleGeneratePlan() {
    // Show the sidebar first
    await vscode.commands.executeCommand('planpilot.sidebar.focus');
    // Then trigger generation
    await this.generatePlan();
  }

  private async handleShowPlans() {
    // Show the sidebar
    await vscode.commands.executeCommand('planpilot.sidebar.focus');
    await this.showPlans();
  }

  private async handleExportPlan() {
    // Show quick pick to select plan
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
    // Show quick pick to select plan to delete
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
    // Show quick pick to select plan first, then phase
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

  private async generatePlan() {
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
        const plan = await this.geminiService.generateImplementationPlan({
          objective,
          context: workspaceContext
        });

        progress.report({ increment: 80, message: 'Saving plan...' });

        // Save plan
        await this.planStorage.savePlan(plan);
        this.planProvider.refresh();

        progress.report({ increment: 100, message: 'Complete!' });

        // Show success message with options
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
        
        // Create new untitled document with exported content
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