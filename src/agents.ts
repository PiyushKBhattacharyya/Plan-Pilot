import { PlanStep } from "./types";

// Fake agent execution simulation
export async function runAgent(step: PlanStep): Promise<{ outputUri?: string, error?: string }> {
  return new Promise(resolve => {
    setTimeout(() => {
      if (Math.random() < 0.1) resolve({ error: "Simulated error" });
      else resolve({ outputUri: `output://${step.id}` });
    }, 800);
  });
}