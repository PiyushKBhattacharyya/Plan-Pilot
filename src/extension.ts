import * as vscode from 'vscode';
import { GeminiService } from './gemini';
import { PlanStorage } from './storage';
import { PlanProvider } from './planProvider';
import { PlanPilotWebviewProvider } from './webviewProvider';
import { CommandManager } from './commands';
import { WelcomeManager } from './welcomeManager';

let geminiService: GeminiService;
let planStorage: PlanStorage;
let planProvider: PlanProvider;
let webviewProvider: PlanPilotWebviewProvider;
let commandManager: CommandManager;

export function activate(context: vscode.ExtensionContext) {
  console.log('PlanPilot extension is now active!');

  // Initialize services
  geminiService = new GeminiService();
  planStorage = new PlanStorage(context);
  planProvider = new PlanProvider(planStorage);
  webviewProvider = new PlanPilotWebviewProvider(context.extensionUri, geminiService, planStorage);

  // Initialize command manager
  commandManager = new CommandManager(geminiService, planStorage, planProvider, webviewProvider);

  // Register webview view provider for sidebar
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      PlanPilotWebviewProvider.viewType,
      webviewProvider
    )
  );

  // Tree data provider removed - using webview provider instead

  // Register all commands
  commandManager.registerCommands(context);

  // Show welcome message on first activation
  WelcomeManager.showWelcomeMessageIfNeeded(context);
}

export function deactivate() {}