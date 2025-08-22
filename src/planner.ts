import { Plan } from "./types";

/**
  Generates a simple plan based on a user request.
    - @param request - The user’s task description.
    - @returns A Plan object with predefined steps.
*/
export function generatePlan(request: string): Plan {
  return {
    request,
    steps: [
      {
        id: "s1",
        title: "Analyze request",
        description: request,
        agent: "Researcher",
        status: "pending",
      },
      {
        id: "s2",
        title: "Scaffold basic files",
        description: "Create project structure",
        agent: "Scaffolder",
        status: "pending",
      },
      {
        id: "s3",
        title: "Refactor & optimize",
        description: "Cleanup code",
        agent: "Refactorer",
        status: "pending",
      },
    ],
    suggestions: [],
  };
}

/**
  Provides dynamic suggestions based on the current plan state.
    - @param plan - The current plan.
    - @returns An array of suggestion strings.
 */

export function suggestNextSteps(plan: Plan): string[] {
  const pendingSteps = plan.steps.filter((s) => s.status === "pending").length;
  const suggestions: string[] = [];

  if (pendingSteps === 0) {
    suggestions.push("All steps done! Consider adding new tasks.");
  } else {
    suggestions.push("Prioritize high-impact steps first.");
    suggestions.push("Break down complex steps into smaller subtasks.");
    suggestions.push("Review completed steps for possible refactoring.");
  }

  return suggestions;
}