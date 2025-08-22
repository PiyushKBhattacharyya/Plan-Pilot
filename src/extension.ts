// src/extension.ts
import * as vscode from "vscode";
import { getWebviewContent } from "./webviewContent";
import { PlanStore } from "./planStore";
import { generatePlan, suggestNextSteps } from "./planner";
import { runAgent } from "./agents";
import { Plan } from "./types";
import { getCodespaceContext } from "./context";

export function activate(context: vscode.ExtensionContext) {
  const store = new PlanStore(context.workspaceState);

  context.subscriptions.push(
    vscode.commands.registerCommand("planpilot.openPlanner", () => {
      const panel = vscode.window.createWebviewPanel(
        "planpilot",
        "PlanPilot — Planning Done Simple",
        vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true }
      );

      panel.webview.html = getWebviewContent(panel, context.extensionUri);

      // Always send both plan and context
      const sendPlan = async (plan?: Plan) => {
        const ctx = await getCodespaceContext();
        panel.webview.postMessage({ type: "plan", plan, context: ctx });
      };

      panel.webview.onDidReceiveMessage(async (msg) => {
        let plan = store.load();

        switch (msg.type) {
          case "ready":
            await sendPlan(plan);
            break;

          case "generate":
            plan = generatePlan(msg.request);
            plan.suggestions = suggestNextSteps(plan);
            await store.save(plan);
            await sendPlan(plan);
            break;

          case "addStep":
            if (!plan) plan = { steps: [], request: "Manual", suggestions: [] };
            plan.steps.push({
              id: `${Date.now()}`,
              title: msg.step.title,
              description: msg.step.description,
              agent: msg.step.agent,
              status: "pending",
            });
            plan.suggestions = suggestNextSteps(plan);
            await store.save(plan);
            await sendPlan(plan);
            break;

          case "updateStep": {
            if (!plan) break;
            const idx = plan.steps.findIndex((s) => s.id === msg.step.id);
            if (idx === -1) break;
            plan.steps[idx] = { ...plan.steps[idx], ...msg.step }; // ← fix bad spread
            plan.suggestions = suggestNextSteps(plan);
            await store.save(plan);
            await sendPlan(plan);
            break;
          }

          case "deleteStep":
            if (!plan) break;
            plan.steps = plan.steps.filter((s) => s.id !== msg.id);
            plan.suggestions = suggestNextSteps(plan);
            await store.save(plan);
            await sendPlan(plan);
            break;

          case "moveStep": {
            if (!plan) break;
            const step = plan.steps.find((s) => s.id === msg.id);
            if (!step) break;
            step.status = msg.status;
            plan.suggestions = suggestNextSteps(plan);
            await store.save(plan);
            await sendPlan(plan);
            break;
          }

          case "executeStep": {
            if (!plan) break;
            const step = plan.steps.find((s) => s.id === msg.id);
            if (!step) break;
            step.status = "in-progress";
            await sendPlan(plan);

            const res = await runAgent(step);
            if (res.error) {
              step.status = "error";
              step.description += `\nError: ${res.error}`;
            } else {
              step.status = "done";
              if (res.outputUri) step.description += `\nOutput: ${res.outputUri}`;
            }
            await store.save(plan);
            await sendPlan(plan);
            break;
          }

          case "executeAll":
            if (!plan) break;
            for (const step of plan.steps) {
              step.status = "in-progress";
              await sendPlan(plan);
              const res = await runAgent(step);
              if (res.error) {
                step.status = "error";
                step.description += `\nError: ${res.error}`;
              } else {
                step.status = "done";
                if (res.outputUri) step.description += `\nOutput: ${res.outputUri}`;
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
    })
  );
}

export function deactivate() {}