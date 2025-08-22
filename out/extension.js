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
const vscode = __importStar(require("vscode"));
const webviewContent_1 = require("./webviewContent");
const planStore_1 = require("./planStore");
const planner_1 = require("./planner");
const agents_1 = require("./agents");
function activate(context) {
    const store = new planStore_1.PlanStore(context.workspaceState);
    context.subscriptions.push(vscode.commands.registerCommand("planpilot.openPlanner", () => {
        const panel = vscode.window.createWebviewPanel("planpilot", "PlanPilot", vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true
        });
        panel.webview.html = (0, webviewContent_1.getWebviewContent)(panel, context.extensionUri);
        // Send current plan helper
        const sendPlan = (plan) => {
            panel.webview.postMessage({ type: "plan", plan: plan ?? undefined });
        };
        // handle messages from webview
        panel.webview.onDidReceiveMessage(async (msg) => {
            switch (msg.type) {
                case "ready": {
                    const plan = store.load();
                    sendPlan(plan);
                    break;
                }
                case "generate": {
                    const request = msg.request;
                    const plan = (0, planner_1.generatePlan)(request);
                    await store.save(plan);
                    sendPlan(plan);
                    vscode.window.showInformationMessage("PlanPilot: plan generated.");
                    break;
                }
                case "addStep": {
                    const s = msg.step;
                    const plan = store.load();
                    if (!plan) {
                        vscode.window.showWarningMessage("No plan exists. Generate a plan first.");
                        break;
                    }
                    const newStep = {
                        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
                        title: s.title,
                        description: s.description || "",
                        agent: (s.agent ?? "scaffolder"),
                        status: "pending"
                    };
                    plan.steps.push(newStep);
                    await store.save(plan);
                    sendPlan(plan);
                    break;
                }
                case "updateStep": {
                    const updated = msg.step;
                    const plan = store.load();
                    if (!plan)
                        break;
                    const idx = plan.steps.findIndex(p => p.id === updated.id);
                    if (idx === -1)
                        break;
                    plan.steps[idx].title = updated.title;
                    plan.steps[idx].description = updated.description;
                    if (updated.agent)
                        plan.steps[idx].agent = updated.agent;
                    await store.save(plan);
                    sendPlan(plan);
                    break;
                }
                case "deleteStep": {
                    const id = msg.id;
                    const plan = store.load();
                    if (!plan)
                        break;
                    plan.steps = plan.steps.filter(s => s.id !== id);
                    await store.save(plan);
                    sendPlan(plan);
                    break;
                }
                case "moveStep": {
                    const id = msg.id;
                    const status = msg.status;
                    const plan = store.load();
                    if (!plan)
                        break;
                    const step = plan.steps.find(s => s.id === id);
                    if (!step)
                        break;
                    step.status = status;
                    await store.save(plan);
                    sendPlan(plan);
                    break;
                }
                case "executeStep": {
                    const id = msg.id;
                    const plan = store.load();
                    if (!plan)
                        break;
                    const step = plan.steps.find(s => s.id === id);
                    if (!step)
                        break;
                    // mark in-progress and notify UI
                    step.status = "in-progress";
                    await store.save(plan);
                    panel.webview.postMessage({ type: "update", plan });
                    // run agent
                    const { outputUri, error } = await (0, agents_1.runAgent)(step);
                    if (error) {
                        step.status = "error";
                        step.error = error;
                    }
                    else {
                        step.status = "done";
                        step.outputUri = outputUri;
                    }
                    await store.save(plan);
                    panel.webview.postMessage({ type: "update", plan });
                    break;
                }
                case "executeAll": {
                    let plan = store.load();
                    if (!plan)
                        break;
                    // run sequentially
                    for (const s of plan.steps) {
                        if (s.status === "done")
                            continue;
                        s.status = "in-progress";
                        await store.save(plan);
                        panel.webview.postMessage({ type: "update", plan });
                        const { outputUri, error } = await (0, agents_1.runAgent)(s);
                        if (error) {
                            s.status = "error";
                            s.error = error;
                        }
                        else {
                            s.status = "done";
                            s.outputUri = outputUri;
                        }
                        await store.save(plan);
                        panel.webview.postMessage({ type: "update", plan });
                    }
                    vscode.window.showInformationMessage("PlanPilot: execute all finished.");
                    break;
                }
                case "resetPlan": {
                    await store.save(undefined);
                    sendPlan(undefined);
                    vscode.window.showInformationMessage("PlanPilot: plan reset.");
                    break;
                }
                default:
                    console.warn("Unknown message from webview", msg);
            }
        });
        panel.onDidDispose(() => {
            // nothing special for now
        });
    }));
}
function deactivate() { }
//# sourceMappingURL=extension.js.map