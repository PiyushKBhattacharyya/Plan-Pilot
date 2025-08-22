import * as vscode from "vscode";
import { Plan } from "./types";

export class PlanStore {
  constructor(private state: vscode.Memento) {}

  async save(plan?: Plan) {
    await this.state.update("planpilot.plan", plan);
  }

  load(): Plan | undefined {
    return this.state.get<Plan>("planpilot.plan");
  }
}