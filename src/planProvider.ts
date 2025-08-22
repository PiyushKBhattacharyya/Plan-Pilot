import * as vscode from 'vscode';
import { Plan, Phase } from './types';
import { PlanStorage } from './storage';

export class PlanProvider implements vscode.TreeDataProvider<PlanItem | PhaseItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<PlanItem | PhaseItem | undefined | null | void> = new vscode.EventEmitter<PlanItem | PhaseItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<PlanItem | PhaseItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor(private storage: PlanStorage) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: PlanItem | PhaseItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: PlanItem | PhaseItem): Promise<(PlanItem | PhaseItem)[]> {
    if (!element) {
      // Root level - return plans
      const plans = await this.storage.getPlans();
      return plans.map(plan => new PlanItem(plan));
    } else if (element instanceof PlanItem) {
      // Plan level - return phases
      return element.plan.phases.map(phase => new PhaseItem(phase, element.plan.id));
    } else {
      // Phase level - no children
      return [];
    }
  }
}

export class PlanItem extends vscode.TreeItem {
  constructor(public readonly plan: Plan) {
    super(plan.title, vscode.TreeItemCollapsibleState.Collapsed);
    
    this.tooltip = `${plan.objective}\n\nPhases: ${plan.phases.length}\nEstimated Hours: ${plan.estimatedHours || 'N/A'}\nStatus: ${plan.status}`;
    this.description = `${plan.phases.length} phases`;
    this.contextValue = 'plan';
    
    // Add icons based on status
    switch (plan.status) {
      case 'draft':
        this.iconPath = new vscode.ThemeIcon('edit');
        break;
      case 'in_progress':
        this.iconPath = new vscode.ThemeIcon('play');
        break;
      case 'completed':
        this.iconPath = new vscode.ThemeIcon('check');
        break;
    }
  }
}

export class PhaseItem extends vscode.TreeItem {
  constructor(public readonly phase: Phase, public readonly planId: string) {
    super(phase.title, vscode.TreeItemCollapsibleState.None);
    
    this.tooltip = `${phase.description}\n\nCategory: ${phase.category}\nEstimated Hours: ${phase.estimatedHours}\nFiles: ${phase.files.length}\nSteps: ${phase.steps.length}`;
    this.description = `${phase.estimatedHours}h • ${phase.files.length} files`;
    this.contextValue = 'phase';
    
    // Add category-based icons
    switch (phase.category.toLowerCase()) {
      case 'database':
        this.iconPath = new vscode.ThemeIcon('database');
        break;
      case 'backend':
        this.iconPath = new vscode.ThemeIcon('server');
        break;
      case 'frontend':
        this.iconPath = new vscode.ThemeIcon('browser');
        break;
      case 'api':
        this.iconPath = new vscode.ThemeIcon('link');
        break;
      case 'security':
        this.iconPath = new vscode.ThemeIcon('shield');
        break;
      case 'testing':
        this.iconPath = new vscode.ThemeIcon('beaker');
        break;
      default:
        this.iconPath = new vscode.ThemeIcon('gear');
    }
  }
}