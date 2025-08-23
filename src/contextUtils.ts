import * as vscode from 'vscode';

export function getWorkspaceContext() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return undefined;
  }

  // Get basic workspace info
  const workspaceFolder = workspaceFolders[0];
  const workspaceName = workspaceFolder.name;

  // Try to detect tech stack from package.json or other config files
  const techStack: string[] = [];
  
  // This could be enhanced to actually read package.json, etc.
  // For now, just provide basic context
  
  return {
    projectDescription: `Workspace: ${workspaceName}`,
    techStack: techStack.length > 0 ? techStack : undefined
  };
}