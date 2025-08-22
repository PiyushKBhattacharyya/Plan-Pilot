export type StepStatus = "pending" | "in-progress" | "done" | "error";
export type AgentKind = "scaffolder" | "researcher" | "refactorer";

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  agent: AgentKind;
  status: StepStatus;
  outputUri?: string;
  error?: string;
}

export interface Plan {
  id: string;
  request: string;
  steps: PlanStep[];
  createdAt: number;
}