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
const context_1 = require("./context");
function activate(context) {
    const store = new planStore_1.PlanStore(context.workspaceState);
    context.subscriptions.push(vscode.commands.registerCommand("planpilot.openPlanner", () => {
        const panel = vscode.window.createWebviewPanel("planpilot", "PlanPilot — Planning Done Simple", vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true });
        panel.webview.html = (0, webviewContent_1.getWebviewContent)(panel, context.extensionUri);
        // Always send both plan and context
        const sendPlan = async (plan) => {
            const ctx = await (0, context_1.getCodespaceContext)();
            panel.webview.postMessage({ type: "plan", plan, context: ctx });
        };
        panel.webview.onDidReceiveMessage(async (msg) => {
            let plan = store.load();
            switch (msg.type) {
                case "ready":
                    await sendPlan(plan);
                    break;
                case "generate":
                    plan = (0, planner_1.generatePlan)(msg.request);
                    plan.suggestions = (0, planner_1.suggestNextSteps)(plan);
                    await store.save(plan);
                    await sendPlan(plan);
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
                    await sendPlan(plan);
                    break;
                case "updateStep": {
                    if (!plan)
                        break;
                    const idx = plan.steps.findIndex((s) => s.id === msg.step.id);
                    if (idx === -1)
                        break;
                    plan.steps[idx] = { ...plan.steps[idx], ...msg.step }; // ← fix bad spread
                    plan.suggestions = (0, planner_1.suggestNextSteps)(plan);
                    await store.save(plan);
                    await sendPlan(plan);
                    break;
                }
                case "deleteStep":
                    if (!plan)
                        break;
                    plan.steps = plan.steps.filter((s) => s.id !== msg.id);
                    plan.suggestions = (0, planner_1.suggestNextSteps)(plan);
                    await store.save(plan);
                    await sendPlan(plan);
                    break;
                case "moveStep": {
                    if (!plan)
                        break;
                    const step = plan.steps.find((s) => s.id === msg.id);
                    if (!step)
                        break;
                    step.status = msg.status;
                    plan.suggestions = (0, planner_1.suggestNextSteps)(plan);
                    await store.save(plan);
                    await sendPlan(plan);
                    break;
                }
                case "executeStep": {
                    if (!plan)
                        break;
                    const step = plan.steps.find((s) => s.id === msg.id);
                    if (!step)
                        break;
                    step.status = "in-progress";
                    await sendPlan(plan);
                    const res = await (0, agents_1.runAgent)(step);
                    if (res.error) {
                        step.status = "error";
                        step.description += `\nError: ${res.error}`;
                    }
                    else {
                        step.status = "done";
                        if (res.outputUri)
                            step.description += `\nOutput: ${res.outputUri}`;
                    }
                    await store.save(plan);
                    await sendPlan(plan);
                    break;
                }
                case "executeAll":
                    if (!plan)
                        break;
                    for (const step of plan.steps) {
                        step.status = "in-progress";
                        await sendPlan(plan);
                        const res = await (0, agents_1.runAgent)(step);
                        if (res.error) {
                            step.status = "error";
                            step.description += `\nError: ${res.error}`;
                        }
                        else {
                            step.status = "done";
                            if (res.outputUri)
                                step.description += `\nOutput: ${res.outputUri}`;
                        }
                    }
                    await store.save(plan);
                    await sendPlan(plan);
                    break;
                case "resetPlan":
                    await store.reset();
                    await sendPlan(undefined); // clears board; context still shown
                    vscode.window.showInformationMessage("Plan reset.");
                    break;
                case "getContext": // on-demand refresh from webview
                    await sendPlan(plan);
                    break;
            }
        });
    }));
}
function deactivate() { }
//# sourceMappingURL=extension.js.map