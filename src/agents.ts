import * as vscode from "vscode";
import { Buffer } from "buffer"; // ✅ ensures Buffer is available
import { PlanStep } from "./types";

async function ensureOutputFolder(): Promise<vscode.Uri | undefined> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) return undefined;

  const out = vscode.Uri.joinPath(folder.uri, ".planpilot");
  try {
    await vscode.workspace.fs.createDirectory(out);
  } catch {
    // ignore if it already exists
  }
  return out;
}

async function writeFile(outDir: vscode.Uri, name: string, content: string): Promise<vscode.Uri> {
  const uri: vscode.Uri = vscode.Uri.joinPath(outDir, name);
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf8"));
  return uri;
}

/**
 * Mock agent runner: simulates work and writes a small artifact file under .planpilot/.
 */
export async function runAgent(step: PlanStep): Promise<{ outputUri?: string; error?: string }> {
  const outDir = await ensureOutputFolder();
  if (!outDir) {
    return { error: "No workspace folder open. Open a folder to allow agents to write outputs." };
  }

  try {
    // simulate time-consuming work
    await new Promise((resolve) => setTimeout(resolve, 600 + Math.floor(Math.random() * 800)));

    switch (step.agent) {
      case "scaffolder": {
        const uri = await writeFile(
          outDir,
          `scaffold-${step.id}.txt`,
          `Scaffolder artifact
Task: ${step.title}
Details: ${step.description}
Generated at: ${new Date().toISOString()}
`
        );
        return { outputUri: uri.toString() };
      }

      case "researcher": {
        const uri = await writeFile(
          outDir,
          `research-${step.id}.md`,
          `# Research notes: ${step.title}

${step.description}

- Approach A
- Approach B

(Generated: ${new Date().toISOString()})
`
        );
        return { outputUri: uri.toString() };
      }

      case "refactorer": {
        const uri = await writeFile(
          outDir,
          `refactor-${step.id}.txt`,
          `Refactor suggestions
Task: ${step.title}
Suggestions:
 - Extract utilities
 - Add input guards
 - Add tests

(Generated: ${new Date().toISOString()})
`
        );
        return { outputUri: uri.toString() };
      }

      default:
        return { error: `Unknown agent: ${step.agent}` };
    }
  } catch (e: any) {
    return { error: String(e?.message ?? e) };
  }
}