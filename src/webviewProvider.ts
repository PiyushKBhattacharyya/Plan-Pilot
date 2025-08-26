import * as vscode from 'vscode';
import { GeminiService } from './gemini';
import { PlanStorage } from './storage';
import { Plan } from './types';
import { ContextAnalyzer } from './contextUtils';
import * as fs from 'fs';
import * as path from 'path';

interface SmartFileAnalysis {
  files: string[];
  analysis: string;
  techStack: string[];
  recommendations: string[];
}

interface ExportOptions {
  includeDetails: boolean;
  includeCode: boolean;
  includeTimeline: boolean;
  includeDependencies: boolean;
}

export class PlanPilotWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'planpilot.sidebar';
  private _view?: vscode.WebviewView;
  private contextAnalyzer: ContextAnalyzer;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly geminiService: GeminiService,
    private readonly planStorage: PlanStorage
  ) {
    this.contextAnalyzer = new ContextAnalyzer();
  }

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
            await this.handleExportPlan(data.planId, data.format, data.options);
            break;
          case 'refreshPlans':
            await this.refreshPlans();
            break;
          case 'showPhaseDetails':
            await this.handleShowPhaseDetails(data.planId, data.phaseId);
            break;
          case 'openPlanInWindow':
            await this.handleOpenPlanInWindow(data.planId);
            break;
          case 'getWorkspaceFiles':
            await this.handleGetWorkspaceFiles();
            break;
          case 'getFileContent':
            await this.handleGetFileContent(data.filePath);
            break;
          case 'analyzeProject':
            await this.handleAnalyzeProject();
            break;
          case 'smartFileSelection':
            await this.handleSmartFileSelection(data.objective);
            break;
          case 'showSettings':
            await this.handleShowSettings();
            break;
        }
      },
      undefined
    );

    // Load initial plans and analyze project
    this.refreshPlans();
    this.handleAnalyzeProject();
  }

  public async handleGeneratePlan(objective: string, context?: any) {
    try {
      this._view?.webview.postMessage({ type: 'generationStarted' });
      
      // Use AI-powered context analysis
      const workspaceContext = await this.buildIntelligentWorkspaceContext(context);
      
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

  private async handleAnalyzeProject() {
    try {
      this._view?.webview.postMessage({ type: 'projectAnalysisStarted' });
      
      const analysis = await this.contextAnalyzer.analyzeWorkspaceContext();
      
      this._view?.webview.postMessage({ 
        type: 'projectAnalysisComplete',
        analysis: analysis
      });
      
    } catch (error) {
      console.error('Error analyzing project:', error);
      this._view?.webview.postMessage({ 
        type: 'projectAnalysisError',
        message: 'Could not analyze project. Ensure Gemini API key is configured.'
      });
    }
  }

  private async handleSmartFileSelection(objective: string) {
    try {
      if (!this.geminiService.isConfigured()) {
        this._view?.webview.postMessage({ 
          type: 'smartFileSelectionError',
          message: 'Gemini API key not configured'
        });
        return;
      }

      this._view?.webview.postMessage({ type: 'smartFileSelectionStarted' });
      
      const workspaceFiles = await this.getWorkspaceFiles();
      const fileAnalyses = await this.contextAnalyzer.analyzeFiles(workspaceFiles.slice(0, 20));
      
      const smartAnalysis = await this.analyzeRelevantFiles(objective, fileAnalyses, workspaceFiles);
      
      this._view?.webview.postMessage({ 
        type: 'smartFileSelectionComplete',
        analysis: smartAnalysis
      });
      
    } catch (error) {
      console.error('Error in smart file selection:', error);
      this._view?.webview.postMessage({ 
        type: 'smartFileSelectionError',
        message: 'Failed to analyze files for relevance'
      });
    }
  }

  private async analyzeRelevantFiles(objective: string, fileAnalyses: any[], allFiles: string[]): Promise<SmartFileAnalysis> {
    const prompt = `Given this development objective: "${objective}"

    Available files in the project:
    ${fileAnalyses.map(f => `${f.path}: ${f.description} (${f.type}, ${f.importance} importance)`).join('\n')}

    Additional files: ${allFiles.slice(fileAnalyses.length).join(', ')}

    Identify:
    1. Which files are most relevant for this objective
    2. What the current project structure tells us about implementation approach
    3. Technology stack recommendations based on existing code
    4. Implementation recommendations specific to this objective

    Focus on files that would be:
    - Modified for this feature
    - Good examples of existing patterns
    - Configuration/setup related
    - Core business logic`;

    try {
      const response = await this.geminiService.analyzeContent(prompt);
      
      // Parse the response to extract structured data
      const relevantFiles = this.extractRelevantFiles(response, allFiles);
      const techStack = this.extractTechStack(response);
      const recommendations = this.extractRecommendations(response);

      return {
        files: relevantFiles,
        analysis: response,
        techStack: techStack,
        recommendations: recommendations
      };
    } catch (error) {
      throw new Error('Failed to analyze file relevance');
    }
  }

  private extractRelevantFiles(analysis: string, allFiles: string[]): string[] {
    const relevantFiles: string[] = [];
    
    // Look for file mentions in the analysis
    allFiles.forEach(file => {
      if (analysis.toLowerCase().includes(file.toLowerCase()) || 
          analysis.includes(path.basename(file))) {
        relevantFiles.push(file);
      }
    });

    // If no specific files mentioned, include high-priority files
    if (relevantFiles.length === 0) {
      const priorityPatterns = [
        /package\.json$/,
        /tsconfig\.json$/,
        /\.env/,
        /config/,
        /index\.(js|ts|jsx|tsx)$/,
        /app\.(js|ts|jsx|tsx)$/,
        /main\.(js|ts|jsx|tsx)$/
      ];

      relevantFiles.push(...allFiles.filter(file => 
        priorityPatterns.some(pattern => pattern.test(file))
      ));
    }

    return [...new Set(relevantFiles)].slice(0, 10); // Remove duplicates and limit
  }

  private extractTechStack(analysis: string): string[] {
    const techPatterns = [
      /React/gi, /Vue/gi, /Angular/gi, /Node\.js/gi, /Express/gi,
      /TypeScript/gi, /JavaScript/gi, /Python/gi, /Java/gi,
      /MongoDB/gi, /PostgreSQL/gi, /MySQL/gi, /Redis/gi,
      /Docker/gi, /Kubernetes/gi, /AWS/gi, /Firebase/gi
    ];

    const foundTech = new Set<string>();
    
    techPatterns.forEach(pattern => {
      const matches = analysis.match(pattern);
      if (matches) {
        matches.forEach(match => foundTech.add(match));
      }
    });

    return Array.from(foundTech);
  }

  private extractRecommendations(analysis: string): string[] {
    // Extract bullet points or numbered lists that look like recommendations
    const recommendationPatterns = [
      /[-*•]\s*([^:\n]+(?::\s*[^\n]+)?)/g,
      /\d+\.\s*([^:\n]+(?::\s*[^\n]+)?)/g
    ];

    const recommendations = new Set<string>();
    
    recommendationPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(analysis)) !== null) {
        const recommendation = match[1].trim();
        if (recommendation.length > 10 && recommendation.length < 200) {
          recommendations.add(recommendation);
        }
      }
    });

    return Array.from(recommendations).slice(0, 5);
  }

  public async handleDeletePlan(planId: string) {
    await this.planStorage.deletePlan(planId);
    await this.refreshPlans();
  }

  public async handleExportPlan(planId: string, format?: string, options?: ExportOptions) {
    try {
      const plans = await this.planStorage.getPlans();
      const plan = plans.find(p => p.id === planId);
      if (!plan) {
        vscode.window.showErrorMessage('Plan not found');
        return;
      }

      // Use provided format or default to generic
      const exportFormat = format || 'generic';
      
      const exported = await this.geminiService.exportPlanForAgent(plan, exportFormat);
      
      // Create filename with format suffix
      const timestamp = new Date().toISOString().slice(0, 16).replace(/:/g, '-');
      const filename = `${plan.title.replace(/[^a-zA-Z0-9]/g, '_')}_${exportFormat}_${timestamp}.md`;
      
      // Show the exported content in a new document
      const doc = await vscode.workspace.openTextDocument({
        content: this.enhanceExportedContent(exported.content, plan, exportFormat, options),
        language: exportFormat === 'json' ? 'json' : 'markdown'
      });
      
      await vscode.window.showTextDocument(doc);
      
      // Also offer to save the file
      const saveAction = await vscode.window.showInformationMessage(
        `Plan exported for ${exportFormat}! Would you like to save it to a file?`,
        'Save File',
        'Copy to Clipboard'
      );
      
      if (saveAction === 'Save File') {
        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(filename),
          filters: {
            'Markdown': ['md'],
            'JSON': ['json'],
            'All Files': ['*']
          }
        });
        
        if (uri) {
          await vscode.workspace.fs.writeFile(uri, Buffer.from(doc.getText()));
          vscode.window.showInformationMessage('Plan saved successfully!');
        }
      } else if (saveAction === 'Copy to Clipboard') {
        await vscode.env.clipboard.writeText(doc.getText());
        vscode.window.showInformationMessage('Plan copied to clipboard!');
      }
      
      this._view?.webview.postMessage({ type: 'exportComplete' });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage('Failed to export plan: ' + errorMessage);
    }
  }

  private enhanceExportedContent(content: string, plan: Plan, format: string, options?: ExportOptions): string {
    // Add metadata header
    const metadata = `---
Title: ${plan.title}
Objective: ${plan.objective}
Format: ${format}
Generated: ${new Date().toISOString()}
Phases: ${plan.phases.length}
Estimated Hours: ${plan.estimatedHours || 'N/A'}
Files Affected: ${plan.filesAffected || 'N/A'}
Status: ${plan.status}
---

`;

    // Filter content based on options
    let enhancedContent = content;
    
    if (options) {
      if (!options.includeDetails) {
        // Remove detailed implementation sections
        enhancedContent = enhancedContent.replace(/## Implementation Details[\s\S]*?(?=##|$)/g, '');
      }
      if (!options.includeCode) {
        // Remove code blocks
        enhancedContent = enhancedContent.replace(/```[\s\S]*?```/g, '');
      }
      if (!options.includeTimeline) {
        // Remove timeline sections
        enhancedContent = enhancedContent.replace(/## Timeline[\s\S]*?(?=##|$)/g, '');
      }
      if (options.includeDependencies && plan.phases.some(p => p.dependencies?.length)) {
        // Add dependencies section if not present
        const depsSection = this.generateDependenciesSection(plan);
        enhancedContent += `\n\n## Dependencies\n\n${depsSection}`;
      }
    }

    return metadata + enhancedContent;
  }

  private generateDependenciesSection(plan: Plan): string {
    const phasesWithDeps = plan.phases.filter(p => p.dependencies?.length);
    if (phasesWithDeps.length === 0) return 'No explicit dependencies defined.';

    return phasesWithDeps.map(phase => 
      `### ${phase.title}\nDepends on: ${phase.dependencies?.join(', ')}\n`
    ).join('\n');
  }

  private async handleOpenPlanInWindow(planId: string) {
    try {
      const plans = await this.planStorage.getPlans();
      const plan = plans.find(p => p.id === planId);
      
      if (!plan) {
        vscode.window.showErrorMessage('Plan not found');
        return;
      }

      // Create a new webview panel for the plan
      const panel = vscode.window.createWebviewPanel(
        'planDetails',
        `Plan: ${plan.title}`,
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      // Set the HTML content for the plan
      panel.webview.html = this.generatePlanWindowHtml(plan);

      // Handle messages from the plan window
      panel.webview.onDidReceiveMessage(async (message) => {
        switch (message.type) {
          case 'exportPlan':
            await this.handleExportPlan(planId, message.format, message.options);
            break;
          case 'deletePlan':
            const result = await vscode.window.showWarningMessage(
              `Are you sure you want to delete "${plan.title}"?`,
              'Delete',
              'Cancel'
            );
            if (result === 'Delete') {
              await this.handleDeletePlan(planId);
              panel.dispose();
              vscode.window.showInformationMessage('Plan deleted successfully.');
            }
            break;
        }
      });

    } catch (error) {
      vscode.window.showErrorMessage('Failed to open plan in window: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  private generatePlanWindowHtml(plan: Plan): string {
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
            max-width: 1200px;
            margin: 0 auto;
        }
        .plan-header {
            border-bottom: 2px solid var(--vscode-panel-border);
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .plan-title {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 10px;
            color: var(--vscode-editor-foreground);
        }
        .plan-meta {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
            padding: 15px;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 8px;
        }
        .meta-item {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        .meta-label {
            font-size: 12px;
            font-weight: 600;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
        }
        .meta-value {
            font-size: 14px;
            color: var(--vscode-foreground);
        }
        .objective-section {
            background: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-button-background);
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .objective-section h3 {
            margin-top: 0;
            color: var(--vscode-editor-foreground);
        }
        .phases-section {
            margin-top: 30px;
        }
        .phase {
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 8px;
            margin: 20px 0;
            overflow: hidden;
        }
        .phase-header {
            background: var(--vscode-editor-background);
            padding: 15px 20px;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            align-items: center;
            gap: 15px;
        }
        .phase-number {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 14px;
        }
        .phase-info {
            flex: 1;
        }
        .phase-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 5px;
        }
        .phase-meta {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
        }
        .phase-content {
            padding: 20px;
        }
        .phase-description {
            margin-bottom: 20px;
            font-size: 14px;
            line-height: 1.5;
        }
        .files-section, .steps-section {
            margin-bottom: 25px;
        }
        .section-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 12px;
            color: var(--vscode-editor-foreground);
        }
        .file-item, .step-item {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 12px;
            margin: 8px 0;
        }
        .file-action {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
            margin-right: 8px;
        }
        .action-create { background: #4CAF50; color: white; }
        .action-modify { background: #FF9800; color: white; }
        .action-delete { background: #F44336; color: white; }
        .file-path {
            font-family: monospace;
            font-size: 13px;
            font-weight: 600;
        }
        .step-number {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 50%;
            font-size: 10px;
            font-weight: bold;
            margin-right: 10px;
        }
        .toolbar {
            position: fixed;
            top: 20px;
            right: 20px;
            display: flex;
            gap: 10px;
            z-index: 100;
        }
        .toolbar button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        .toolbar button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .status-badge {
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .status-draft { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
        .status-in_progress { background: #1f4e79; color: white; }
        .status-completed { background: #4CAF50; color: white; }
        @media print {
            .toolbar { display: none; }
            body { padding: 0; }
            .phase { break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <button onclick="exportPlan()">Export</button>
        <button onclick="deletePlan()">Delete</button>
        <button onclick="window.print()">Print</button>
    </div>

    <div class="plan-header">
        <h1 class="plan-title">${plan.title}</h1>
        <div class="plan-meta">
            <div class="meta-item">
                <div class="meta-label">Status</div>
                <div class="meta-value">
                    <span class="status-badge status-${plan.status || 'draft'}">${(plan.status || 'draft').replace('_', ' ')}</span>
                </div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Phases</div>
                <div class="meta-value">${plan.phases.length}</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Estimated Hours</div>
                <div class="meta-value">${plan.estimatedHours || 'N/A'}h</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Files Affected</div>
                <div class="meta-value">${plan.filesAffected || 'N/A'}</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Created</div>
                <div class="meta-value">${plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : 'Unknown'}</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Last Updated</div>
                <div class="meta-value">${plan.updatedAt ? new Date(plan.updatedAt).toLocaleDateString() : 'Unknown'}</div>
            </div>
        </div>
    </div>

    <div class="objective-section">
        <h3>Objective</h3>
        <p>${plan.objective}</p>
    </div>

    <div class="phases-section">
        <h2>Implementation Phases</h2>
        ${plan.phases.map((phase, index) => `
            <div class="phase">
                <div class="phase-header">
                    <div class="phase-number">${index + 1}</div>
                    <div class="phase-info">
                        <div class="phase-title">${phase.title}</div>
                        <div class="phase-meta">
                            <span>Category: ${phase.category}</span>
                            <span>Duration: ${phase.estimatedHours}h</span>
                            <span>Files: ${phase.files.length}</span>
                            <span>Steps: ${phase.steps.length}</span>
                        </div>
                    </div>
                </div>
                <div class="phase-content">
                    <div class="phase-description">${phase.description}</div>
                    
                    <div class="files-section">
                        <div class="section-title">Files to Modify</div>
                        ${phase.files.map(file => `
                            <div class="file-item">
                                <span class="file-action action-${file.action}">${file.action}</span>
                                <span class="file-path">${file.path}</span>
                                <p>${file.description}</p>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="steps-section">
                        <div class="section-title">Implementation Steps</div>
                        ${phase.steps.map((step, stepIndex) => `
                            <div class="step-item">
                                <span class="step-number">${stepIndex + 1}</span>
                                <div style="flex: 1;">
                                    <strong>${step.description}</strong>
                                    ${step.details ? `<p>${step.details}</p>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    ${phase.dependencies && phase.dependencies.length > 0 ? `
                        <div class="dependencies-section">
                            <div class="section-title">Dependencies</div>
                            <p>This phase depends on: ${phase.dependencies.join(', ')}</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('')}
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function exportPlan() {
            vscode.postMessage({ type: 'exportPlan', planId: '${plan.id}' });
        }
        
        function deletePlan() {
            if (confirm('Are you sure you want to delete this plan?')) {
                vscode.postMessage({ type: 'deletePlan', planId: '${plan.id}' });
            }
        }
    </script>
</body>
</html>`;
  }

  private async handleShowSettings() {
    await vscode.commands.executeCommand('workbench.action.openSettings', 'planpilot');
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
    const excludePatterns = ['node_modules', '.git', 'dist', 'build', 'out', '.vscode', 'coverage'];
    
    async function scanDirectory(dirUri: vscode.Uri, relativePath: string = '', depth: number = 0) {
      if (depth > 4) return; // Increased depth for better coverage
      
      try {
        const entries = await vscode.workspace.fs.readDirectory(dirUri);
        
        for (const [name, type] of entries) {
          const currentPath = relativePath ? `${relativePath}/${name}` : name;
          
          // Skip excluded directories
          if (excludePatterns.some(pattern => currentPath.includes(pattern))) {
            continue;
          }
          
          if (type === vscode.FileType.File) {
            // Include comprehensive file types
            if (name.match(/\.(js|ts|jsx|tsx|py|java|cpp|c|h|cs|php|rb|go|rs|kt|swift|vue|svelte|html|css|scss|sass|less|json|xml|yaml|yml|md|txt|sql|sh|bat|dockerfile|gitignore|lock|toml|ini|cfg|conf|env|properties)$/i) ||
                name.match(/^(package|composer|cargo|go|pom|build|requirements|gemfile|dockerfile|makefile|readme|license|changelog|procfile)(\.(json|xml|toml|txt|md|lock|yml|yaml))?$/i)) {
              files.push(currentPath);
            }
          } else if (type === vscode.FileType.Directory && files.length < 100) {
            await scanDirectory(vscode.Uri.joinPath(dirUri, name), currentPath, depth + 1);
          }
        }
      } catch (error) {
        // Ignore errors for directories we can't read
      }
    }

    await scanDirectory(workspaceFolders[0].uri);
    return files.slice(0, 100); // Increased limit
  }

  private async buildIntelligentWorkspaceContext(userContext?: any) {
    const analysis = await this.contextAnalyzer.analyzeWorkspaceContext();
    
    if (!analysis) {
      return undefined;
    }

    // Get selected files content if provided
    const selectedFiles = userContext?.selectedFiles || [];
    const fileContents: {[key: string]: string} = {};
    
    if (selectedFiles.length > 0) {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (workspaceFolders) {
        const workspaceFolder = workspaceFolders[0];
        
        for (const filePath of selectedFiles.slice(0, 10)) { // Limit for performance
          try {
            const fullPath = vscode.Uri.joinPath(workspaceFolder.uri, filePath);
            const content = await vscode.workspace.fs.readFile(fullPath);
            fileContents[filePath] = Buffer.from(content).toString('utf8').substring(0, 3000); // Limit content
          } catch (error) {
            console.error(`Failed to read file ${filePath}:`, error);
          }
        }
      }
    }

    return {
      projectDescription: analysis.projectDescription,
      techStack: analysis.techStack,
      architecture: analysis.architecture,
      existingFeatures: analysis.existingFeatures,
      codeQuality: analysis.codeQuality,
      recommendations: analysis.recommendations,
      existingFiles: selectedFiles,
      fileContents: fileContents,
      userNotes: userContext?.notes || '',
      keyFiles: analysis.keyFiles
    };
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