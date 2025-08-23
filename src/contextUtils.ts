import * as vscode from 'vscode';

export function getWorkspaceContext() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return {
      projectDescription: 'No workspace folder open',
      techStack: undefined,
      existingFiles: undefined
    };
  }

  const workspaceFolder = workspaceFolders[0];
  const workspacePath = workspaceFolder.uri.fsPath;

  // Hardcoded tech stack and existing files for simplicity
  const techStack = ['Node.js', 'TypeScript', 'Express'];
  const existingFiles = ['package.json', 'tsconfig.json', 'README.md'];

  return {
    projectDescription: `Workspace: ${workspaceFolder.name}`,
    techStack,
    existingFiles
  };
}