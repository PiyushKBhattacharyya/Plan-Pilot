"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePlan = generatePlan;
exports.suggestNextSteps = suggestNextSteps;
// Simple plan generation
function generatePlan(request) {
    return {
        request,
        steps: [
            { id: "s1", title: "Analyze request", description: request, agent: "Researcher", status: "pending" },
            { id: "s2", title: "Scaffold basic files", description: "Create project structure", agent: "Scaffolder", status: "pending" },
            { id: "s3", title: "Refactor & optimize", description: "Cleanup code", agent: "Refactorer", status: "pending" },
        ],
        suggestions: []
    };
}
// Suggestions
function suggestNextSteps(plan) {
    const pendingCount = plan.steps.filter(s => s.status === "pending").length;
    const suggestions = [];
    if (pendingCount === 0)
        suggestions.push("All steps done! Consider adding new tasks.");
    else {
        suggestions.push("Prioritize high-impact steps first.");
        suggestions.push("Break down complex steps into smaller subtasks.");
        suggestions.push("Review completed steps for possible refactoring.");
    }
    return suggestions;
}
//# sourceMappingURL=planner.js.map