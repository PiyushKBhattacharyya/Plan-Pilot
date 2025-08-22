import * as vscode from "vscode";
import { Plan } from "./types";

const KEY = "planpilot.plan";

export class PlanStore {
  constructor(private memento: vscode.Memento) {}

  load(): Plan | undefined {
    return this.memento.get<Plan>(KEY);
  }

  save(plan: Plan | undefined) {
    return this.memento.update(KEY, plan);
  }
}