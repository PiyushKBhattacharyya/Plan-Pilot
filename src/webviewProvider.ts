import * as vscode from 'vscode';
import { GeminiService } from './gemini';
import { PlanStorage } from './storage';
import { Plan } from './types';
import * as fs from 'fs';
import * as path from 'path';

export class PlanPilotWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'planpilot.sidebar';
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
            await this.handleGeneratePlan(data.objective, data.context);
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
          case 'getWorkspaceFiles':
            await this.handleGetWorkspaceFiles();
            break;
          case 'getFileContent':
            await this.handleGetFileContent(data.filePath);
            break;
        }
      },
      undefined
    );

    // Load initial plans
    this.refreshPlans();
  }

  public async handleGeneratePlan(objective: string, context?: any) {
    try {
      this._view?.webview.postMessage({ type: 'generationStarted' });
      
      // Build comprehensive context
      const workspaceContext = await this.buildWorkspaceContext(context);
      
      const plan = await this.geminiService.generateImplementationPlan({ 
        objective,
        context: workspaceContext
      });
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
        const exported = await this.geminiService.exportPlanForAgent(plan, 'generic');
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

  private async handleGetWorkspaceFiles() {
    try {
      const files = await this.getWorkspaceFiles();
      this._view?.webview.postMessage({ 
        type: 'workspaceFiles',
        files: files
      });
    } catch (error) {
      console.error('Failed to get workspace files:', error);
    }
  }

  private async handleGetFileContent(filePath: string) {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) return;

      const fullPath = vscode.Uri.joinPath(workspaceFolders[0].uri, filePath);
      const content = await vscode.workspace.fs.readFile(fullPath);
      const textContent = Buffer.from(content).toString('utf8');
      
      this._view?.webview.postMessage({ 
        type: 'fileContent',
        filePath: filePath,
        content: textContent
      });
    } catch (error) {
      console.error('Failed to read file:', error);
    }
  }

  private async getWorkspaceFiles(): Promise<string[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return [];

    const files: string[] = [];
    const excludePatterns = ['node_modules', '.git', 'dist', 'build', 'out', '.vscode'];
    
    async function scanDirectory(dirUri: vscode.Uri, relativePath: string = '') {
      try {
        const entries = await vscode.workspace.fs.readDirectory(dirUri);
        
        for (const [name, type] of entries) {
          const currentPath = relativePath ? `${relativePath}/${name}` : name;
          
          // Skip excluded directories
          if (excludePatterns.some(pattern => currentPath.includes(pattern))) {
            continue;
          }
          
          if (type === vscode.FileType.File) {
            // Include common development files
            if (name.match(/\.(js|ts|jsx|tsx|py|java|cpp|h|cs|php|rb|go|rs|kt|swift|vue|svelte|html|css|scss|sass|less|json|xml|yaml|yml|md|txt|sql|sh|bat|dockerfile|gitignore)$/i)) {
              files.push(currentPath);
            }
          } else if (type === vscode.FileType.Directory && files.length < 100) {
            // Recursively scan subdirectories (limit to prevent overwhelming)
            await scanDirectory(vscode.Uri.joinPath(dirUri, name), currentPath);
          }
        }
      } catch (error) {
        // Ignore errors for directories we can't read
      }
    }

    await scanDirectory(workspaceFolders[0].uri);
    return files.slice(0, 100); // Limit to 100 files for performance
  }

  private async buildWorkspaceContext(userContext?: any) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return undefined;

    const workspaceFolder = workspaceFolders[0];
    const workspaceName = workspaceFolder.name;
    
    // Detect tech stack from files
    const techStack = await this.detectTechStack();
    
    // Get selected files content if provided
    const selectedFiles = userContext?.selectedFiles || [];
    const fileContents: {[key: string]: string} = {};
    
    for (const filePath of selectedFiles) {
      try {
        const fullPath = vscode.Uri.joinPath(workspaceFolder.uri, filePath);
        const content = await vscode.workspace.fs.readFile(fullPath);
        fileContents[filePath] = Buffer.from(content).toString('utf8');
      } catch (error) {
        console.error(`Failed to read file ${filePath}:`, error);
      }
    }

    return {
      projectDescription: `Workspace: ${workspaceName}`,
      techStack: techStack,
      existingFiles: userContext?.selectedFiles || [],
      fileContents: fileContents,
      userNotes: userContext?.notes || ''
    };
  }

  private async detectTechStack(): Promise<string[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return [];

    const techStack: string[] = [];
    const workspaceRoot = workspaceFolders[0].uri;

    try {
      // Check for package.json (Node.js/npm)
      try {
        const packageJsonUri = vscode.Uri.joinPath(workspaceRoot, 'package.json');
        const content = await vscode.workspace.fs.readFile(packageJsonUri);
        const packageJson = JSON.parse(Buffer.from(content).toString('utf8'));
        
        techStack.push('Node.js');
        
        // Check for specific frameworks
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        if (deps.react) techStack.push('React');
        if (deps.vue) techStack.push('Vue.js');
        if (deps.angular) techStack.push('Angular');
        if (deps.express) techStack.push('Express');
        if (deps.next) techStack.push('Next.js');
        if (deps.typescript) techStack.push('TypeScript');
        
      } catch (error) {
        // package.json not found or invalid
      }

      // Check for other config files
      const configFiles = [
        { file: 'requirements.txt', tech: 'Python' },
        { file: 'setup.py', tech: 'Python' },
        { file: 'Cargo.toml', tech: 'Rust' },
        { file: 'go.mod', tech: 'Go' },
        { file: 'pom.xml', tech: 'Java/Maven' },
        { file: 'build.gradle', tech: 'Java/Gradle' },
        { file: 'composer.json', tech: 'PHP/Composer' },
        { file: 'Gemfile', tech: 'Ruby' },
        { file: '.csproj', tech: 'C#/.NET' },
      ];

      for (const { file, tech } of configFiles) {
        try {
          await vscode.workspace.fs.stat(vscode.Uri.joinPath(workspaceRoot, file));
          techStack.push(tech);
        } catch (error) {
          // File not found
        }
      }

    } catch (error) {
      console.error('Error detecting tech stack:', error);
    }

    return [...new Set(techStack)]; // Remove duplicates
  }

  public _getHtmlForWebview(webview: vscode.Webview) {
    try {
      // Get the local resource paths
      const htmlPath = path.join(this._extensionUri.fsPath, 'src', 'webview', 'index.html');
      const cssPath = path.join(this._extensionUri.fsPath, 'src', 'webview', 'style.css');
      const jsPath = path.join(this._extensionUri.fsPath, 'src', 'webview', 'script.js');

      // Create webview URIs for resources
      const styleUri = webview.asWebviewUri(vscode.Uri.file(cssPath));
      const scriptUri = webview.asWebviewUri(vscode.Uri.file(jsPath));

      // Read and return the HTML with resource URIs injected
      let html = fs.readFileSync(htmlPath, 'utf8');
      html = html.replace('{{styleUri}}', styleUri.toString());
      html = html.replace('{{scriptUri}}', scriptUri.toString());

      return html;
    } catch (error) {
      console.error('Error loading webview resources:', error);
      return this._getFallbackHtml();
    }
  }

  private _getFallbackHtml(): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>PlanPilot</title>
        <style>
            body { 
                font-family: var(--vscode-font-family); 
                color: var(--vscode-foreground); 
                padding: 20px; 
                text-align: center;
            }
            .error {
                background: var(--vscode-inputValidation-errorBackground);
                border: 1px solid var(--vscode-inputValidation-errorBorder);
                color: var(--vscode-inputValidation-errorForeground);
                padding: 16px;
                border-radius: 4px;
                margin: 20px 0;
            }
        </style>
    </head>
    <body>
        <h2>PlanPilot - Loading Error</h2>
        <div class="error">
            Failed to load webview resources. Please reload the extension.
        </div>
    </body>
    </html>`;
  }
}