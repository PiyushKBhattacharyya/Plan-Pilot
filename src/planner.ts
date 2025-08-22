import { Plan, PlanStep, AgentKind } from "./types";

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeStep(title: string, description: string, agent: AgentKind): PlanStep {
  return {
    id: newId(),
    title,
    description,
    agent,
    status: "pending"
  };
}

export function generatePlan(request: string): Plan {
  const lower = request.toLowerCase();
  const steps: PlanStep[] =
    lower.includes("rest api") || lower.includes("express") || lower.includes("api")
      ? [
          makeStep("Bootstrap project", "Set up Node.js + Express basic structure", "scaffolder"),
          makeStep("Define domain model", "Design Todo model and TypeScript types", "researcher"),
          makeStep("Implement CRUD", "Add /todos CRUD endpoints with validation", "scaffolder"),
          makeStep("Add error handling & tests", "Add error middleware and unit tests", "refactorer")
        ]
      : [
          makeStep("Research", `Outline solution for: ${request}`, "researcher"),
          makeStep("Scaffold", "Create initial files/folders", "scaffolder"),
          makeStep("Implement", "Write core feature code", "scaffolder"),
          makeStep("Refactor & test", "Polish, tests, and docs", "refactorer")
        ];

  return {
    id: newId(),
    request,
    steps,
    createdAt: Date.now()
  };
}