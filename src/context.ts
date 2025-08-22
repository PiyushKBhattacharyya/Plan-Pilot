import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export interface CodespaceContext {
  rootPath?: string;
  repoName?: string;
  fileCount: number;
  languageStats: Record<string, number>;
  recentFiles: string[];
  files: { path: string; contentPreview?: string }[];
}

/**
 * Collect lightweight context (RAG-style) from the workspace:
 * - Counts by extension
 * - Recent open files
 * - First 50 files with lightweight content previews
 */
export async function getCodespaceContext(): Promise<CodespaceContext> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return { fileCount: 0, languageStats: {}, recentFiles: [], files: [] };
  }

  const rootPath = folder.uri.fsPath;
  const files: string[] = [];

  function walk(dir: string) {
    for (const f of fs.readdirSync(dir)) {
      const fp = path.join(dir, f);
      try {
        const stat = fs.statSync(fp);
          if (stat.isDirectory()) {
            if (["node_modules", ".git", "planpilot"].includes(f)) continue;
            walk(fp);
          } else {
            files.push(fp);
          }
      } catch { /* ignore */ }
    }
  }
  walk(rootPath);

  const languageStats: Record<string, number> = {};
  files.forEach((f) => {
    const ext = path.extname(f).toLowerCase();
    languageStats[ext] = (languageStats[ext] || 0) + 1;
  });

  const recentFiles = vscode.workspace.textDocuments.map(d => d.uri.fsPath).slice(0, 5);

  // Build file list with small previews (safe for webview)
  const fileSummaries = files.slice(0, 50).map(f => {
    let preview: string | undefined;
    try {
      const content = fs.readFileSync(f, "utf8");
      preview = content.slice(0, 200).replace(/\s+/g, " ");
    } catch { /* binary / unreadable */ }
    return { path: path.relative(rootPath, f), contentPreview: preview };
  });

  return {
    rootPath,
    repoName: path.basename(rootPath),
    fileCount: files.length,
    languageStats,
    recentFiles,
    files: fileSummaries,
  };
}