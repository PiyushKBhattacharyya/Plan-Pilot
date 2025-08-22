"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAgent = runAgent;
/**
  Simulates the execution of a coding agent for a given plan step.
    - @param step - The plan step to execute.
    - @returns A promise that resolves with an output URI or an error message.
 */
async function runAgent(step) {
    return new Promise((resolve) => {
        // Simulate asynchronous agent execution with a delay
        setTimeout(() => {
            const isError = Math.random() < 0.1; // 10% chance of failure
            if (isError) {
                resolve({ error: "Simulated agent error" });
            }
            else {
                resolve({ outputUri: `output://${step.id}` });
            }
        }, 800); // 800ms delay to mimic execution
    });
}
//# sourceMappingURL=agents.js.map