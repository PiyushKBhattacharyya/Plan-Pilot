import * as vscode from "vscode";
import { Plan } from "./types";

// PlanStore handles persistent storage of PlanPilot plans using VS Code's workspaceState.

export class PlanStore {
  private readonly storageKey = "planpilot.plan";

  constructor(private workspaceState: vscode.Memento) {}

  /**
    Saves the current plan to VS Code workspace state.
      - @param plan - Plan to save. If undefined, clears storage.
  */
  async save(plan?: Plan): Promise<void> {
    await this.workspaceState.update(this.storageKey, plan ?? undefined);
  }

  /**
    Loads the current plan from VS Code workspace state.
      - @returns The saved Plan or undefined if none exists.
  */
  load(): Plan | undefined {
    return this.workspaceState.get<Plan>(this.storageKey);
  }

  /**
    Resets/clears the current plan from storage.
  */
  async reset(): Promise<void> {
    await this.workspaceState.update(this.storageKey, undefined);
  }
}