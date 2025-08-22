"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePlan = generatePlan;
function newId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function makeStep(title, description, agent) {
    return {
        id: newId(),
        title,
        description,
        agent,
        status: "pending"
    };
}
function generatePlan(request) {
    const lower = request.toLowerCase();
    const steps = lower.includes("rest api") || lower.includes("express") || lower.includes("api")
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
//# sourceMappingURL=planner.js.map