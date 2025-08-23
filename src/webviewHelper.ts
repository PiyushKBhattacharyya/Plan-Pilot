import { Plan } from './types';

export function generatePlanWebview(plan: Plan): string {
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
    <p><strong>Estimated Hours:</strong> ${plan.estimatedHours || 'N/A'}</p>
    <p><strong>Files Affected:</strong> ${plan.filesAffected || 'N/A'}</p>
    <p><strong>Status:</strong> ${plan.status}</p>
    
    <h2>Phases</h2>
    ${plan.phases.map(phase => `
        <div class="phase">
            <div class="phase-header">
                <h3>${phase.title}</h3>
                <span class="phase-category">${phase.category}</span>
            </div>
            <p>${phase.description}</p>
            <p><strong>Estimated Hours:</strong> ${phase.estimatedHours}</p>
            
            <div class="files">
                <h4>Files</h4>
                ${phase.files.map(file => `
                    <div class="file-item">
                        <span class="file-action ${file.action}">${file.action}</span>
                        <strong>${file.path}</strong>
                        <p>${file.description}</p>
                    </div>
                `).join('')}
            </div>
            
            <div class="steps">
                <h4>Steps</h4>
                ${phase.steps.map(step => `
                    <div class="step-item">
                        <strong>${step.description}</strong>
                        ${step.details ? `<p>${step.details}</p>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('')}
</body>
</html>`;
}

export function generatePhaseWebview(phase: any): string {
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
        .category {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.9em;
            display: inline-block;
            margin-bottom: 16px;
        }
        .files, .steps {
            margin: 16px 0;
        }
        .file-item, .step-item {
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            padding: 12px;
            margin: 8px 0;
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
    <h1>${phase.title}</h1>
    <span class="category">${phase.category}</span>
    <p>${phase.description}</p>
    <p><strong>Estimated Hours:</strong> ${phase.estimatedHours}</p>
    
    <div class="files">
        <h2>Files</h2>
        ${phase.files.map((file: any) => `
            <div class="file-item">
                <span class="file-action ${file.action}">${file.action}</span>
                <strong>${file.path}</strong>
                <p>${file.description}</p>
            </div>
        `).join('')}
    </div>
    
    <div class="steps">
        <h2>Implementation Steps</h2>
        ${phase.steps.map((step: any) => `
            <div class="step-item">
                <strong>${step.description}</strong>
                ${step.details ? `<p>${step.details}</p>` : ''}
            </div>
        `).join('')}
    </div>
</body>
</html>`;
}