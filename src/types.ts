export type AgentType = "Scaffolder" | "Researcher" | "Refactorer";

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  agent: AgentType;
  status: "pending" | "in-progress" | "done" | "error";
  outputUri?: string;
  error?: string;
}

export interface Plan {
  request?: string;
  steps: PlanStep[];
  suggestions?: string[];
}