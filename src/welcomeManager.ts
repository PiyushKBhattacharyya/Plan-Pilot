import * as vscode from 'vscode';

export class WelcomeManager {
  static async showWelcomeMessageIfNeeded(context: vscode.ExtensionContext) {
    const hasShownWelcome = context.globalState.get('planpilot.hasShownWelcome', false);
    
    if (!hasShownWelcome) {
      const selection = await vscode.window.showInformationMessage(
        'Welcome to PlanPilot! Generate implementation plans with AI. Check the sidebar for the modern UI!',
        'Open Sidebar',
        'Generate Plan'
      );

      if (selection === 'Open Sidebar') {
        await vscode.commands.executeCommand('planpilot.sidebar.focus');
      } else if (selection === 'Generate Plan') {
        await vscode.commands.executeCommand('planpilot.generatePlan');
      }

      await context.globalState.update('planpilot.hasShownWelcome', true);
    }
  }
}