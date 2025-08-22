"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAgent = runAgent;
// Fake agent execution simulation
async function runAgent(step) {
    return new Promise(resolve => {
        setTimeout(() => {
            if (Math.random() < 0.1)
                resolve({ error: "Simulated error" });
            else
                resolve({ outputUri: `output://${step.id}` });
        }, 800);
    });
}
//# sourceMappingURL=agents.js.map