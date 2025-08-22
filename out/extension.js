"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
// src/extension.ts
const vscode = __importStar(require("vscode"));
const webviewContent_1 = require("./webviewContent");
const planStore_1 = require("./planStore");
const planner_1 = require("./planner");
const agents_1 = require("./agents");
/**
  Activate PlanPilot extension
    - @param context - VS Code extension context
*/
function activate(context) {
    const store = new planStore_1.PlanStore(context.workspaceState);
    const openPlannerCmd = vscode.commands.registerCommand("planpilot.openPlanner", () => {
        const panel = vscode.window.createWebviewPanel("planpilot", "PlanPilot — Planning Done Simple", vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
        });
        panel.webview.html = (0, webviewContent_1.getWebviewContent)(panel, context.extensionUri);
        // Helper to send current plan to webview
        const sendPlan = (plan) => panel.webview.postMessage({ type: "plan", plan });
        // Listen to messages from webview
        panel.webview.onDidReceiveMessage(async (msg) => {
            let plan = store.load();
            switch (msg.type) {
                case "ready":
                    sendPlan(plan);
                    break;
                case "generate":
                    plan = (0, planner_1.generatePlan)(msg.request);
                    plan.suggestions = (0, planner_1.suggestNextSteps)(plan);
                    await store.save(plan);
                    sendPlan(plan);
                    break;
                case "addStep":
                    if (!plan)
                        plan = { steps: [], request: "Manual", suggestions: [] };
                    plan.steps.push({
                        id: `${Date.now()}`,
                        title: msg.step.title,
                        description: msg.step.description,
                        agent: msg.step.agent,
                        status: "pending",
                    });
                    plan.suggestions = (0, planner_1.suggestNextSteps)(plan);
                    await store.save(plan);
                    sendPlan(plan);
                    break;
                case "updateStep":
                    if (!plan)
                        break;
                    const idx = plan.steps.findIndex((s) => s.id === msg.step.id);
                    if (idx === -1)
                        break;
                    plan.steps[idx] = { ...plan.steps[idx], ...msg.step };
                    plan.suggestions = (0, planner_1.suggestNextSteps)(plan);
                    await store.save(plan);
                    sendPlan(plan);
                    break;
                case "deleteStep":
                    if (!plan)
                        break;
                    plan.steps = plan.steps.filter((s) => s.id !== msg.id);
                    plan.suggestions = (0, planner_1.suggestNextSteps)(plan);
                    await store.save(plan);
                    sendPlan(plan);
                    break;
                case "moveStep":
                    if (!plan)
                        break;
                    const stepToMove = plan.steps.find((s) => s.id === msg.id);
                    if (!stepToMove)
                        break;
                    stepToMove.status = msg.status;
                    plan.suggestions = (0, planner_1.suggestNextSteps)(plan);
                    await store.save(plan);
                    sendPlan(plan);
                    break;
                case "executeStep":
                    if (!plan)
                        break;
                    const stepToExec = plan.steps.find((s) => s.id === msg.id);
                    if (!stepToExec)
                        break;
                    stepToExec.status = "in-progress";
                    sendPlan(plan);
                    const { outputUri, error } = await (0, agents_1.runAgent)(stepToExec);
                    if (error) {
                        stepToExec.status = "error";
                        stepToExec.error = error;
                    }
                    else {
                        stepToExec.status = "done";
                        stepToExec.outputUri = outputUri;
                    }
                    plan.suggestions = (0, planner_1.suggestNextSteps)(plan);
                    await store.save(plan);
                    sendPlan(plan);
                    break;
                case "executeAll":
                    if (!plan)
                        break;
                    for (const st of plan.steps) {
                        if (st.status === "done")
                            continue;
                        st.status = "in-progress";
                        sendPlan(plan);
                        const { outputUri, error } = await (0, agents_1.runAgent)(st);
                        if (error) {
                            st.status = "error";
                            st.error = error;
                        }
                        else {
                            st.status = "done";
                            st.outputUri = outputUri;
                        }
                        plan.suggestions = (0, planner_1.suggestNextSteps)(plan);
                        await store.save(plan);
                        sendPlan(plan);
                    }
                    vscode.window.showInformationMessage("PlanPilot: All steps executed");
                    break;
                case "resetPlan":
                    await store.reset();
                    sendPlan(undefined);
                    vscode.window.showInformationMessage("Plan reset.");
                    break;
                default:
                    console.warn("Unknown message type:", msg.type);
            }
        });
    });
    context.subscriptions.push(openPlannerCmd);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map