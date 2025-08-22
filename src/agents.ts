import * as fs from "fs";
import * as path from "path";
import { workspace } from "vscode";
import { PlanStep } from "./types";

export async function runAgent(
  step: PlanStep
): Promise<{ outputUri?: string; error?: string }> {
  try {
    const folder = workspace.workspaceFolders?.[0].uri.fsPath;
    if (!folder) throw new Error("No workspace open");

    const outDir = path.join(folder, "planpilot", "steps");
    fs.mkdirSync(outDir, { recursive: true });

    const filePath = path.join(outDir, `${step.id}.md`);
    fs.writeFileSync(
      filePath,
      `# Step: ${step.title}\n\nAgent: ${step.agent}\n\n${step.description}\n\nGenerated at ${new Date().toISOString()}`
    );

    return { outputUri: filePath };
  } catch (e: any) {
    return { error: e.message };
  }
}