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
        const panel = vscode.window.createWebviewPanel("planpilot", "PlanPilot — Traycer Clone", vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true
        });
        panel.webview.html = (0, webviewContent_1.getWebviewContent)(panel, context.extensionUri);
        const sendPlan = (plan) => panel.webview.postMessage({ type: "plan", plan });
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
                    plan.steps.push({ id: `${Date.now()}`, title: msg.step.title, description: msg.step.description, agent: msg.step.agent, status: "pending" });
                    plan.suggestions = (0, planner_1.suggestNextSteps)(plan);
                    await store.save(plan);
                    sendPlan(plan);
                    break;
                case "updateStep":
                    if (!plan)
                        break;
                    const idx = plan.steps.findIndex(s => s.id === msg.step.id);
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
                    plan.steps = plan.steps.filter(s => s.id !== msg.id);
                    plan.suggestions = (0, planner_1.suggestNextSteps)(plan);
                    await store.save(plan);
                    sendPlan(plan);
                    break;
                case "moveStep":
                    if (!plan)
                        break;
                    const s = plan.steps.find(s => s.id === msg.id);
                    if (!s)
                        break;
                    s.status = msg.status;
                    plan.suggestions = (0, planner_1.suggestNextSteps)(plan);
                    await store.save(plan);
                    sendPlan(plan);
                    break;
                case "executeStep":
                    if (!plan)
                        break;
                    const se = plan.steps.find(s => s.id === msg.id);
                    if (!se)
                        break;
                    se.status = "in-progress";
                    sendPlan(plan);
                    const { outputUri, error } = await (0, agents_1.runAgent)(se);
                    if (error) {
                        se.status = "error";
                        se.error = error;
                    }
                    else {
                        se.status = "done";
                        se.outputUri = outputUri;
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
                    await store.save(undefined);
                    sendPlan(undefined);
                    vscode.window.showInformationMessage("PlanPilot: Plan reset");
                    break;
            }
        });
    }));
}
function deactivate() { }
//# sourceMappingURL=extension.js.map