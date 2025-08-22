// src/extension.ts
import * as vscode from "vscode";
import { getWebviewContent } from "./webviewContent";
import { PlanStore } from "./planStore";
import { generatePlan, suggestNextSteps } from "./planner";
import { runAgent } from "./agents";
import { Plan } from "./types";

/**
  Activate PlanPilot extension
    - @param context - VS Code extension context
*/
export function activate(context: vscode.ExtensionContext) {
  const store = new PlanStore(context.workspaceState);

  const openPlannerCmd = vscode.commands.registerCommand(
    "planpilot.openPlanner",
    () => {
      const panel = vscode.window.createWebviewPanel(
        "planpilot",
        "PlanPilot — Planning Done Simple",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );

      panel.webview.html = getWebviewContent(panel, context.extensionUri);

      // Helper to send current plan to webview
      const sendPlan = (plan?: Plan) =>
        panel.webview.postMessage({ type: "plan", plan });

      // Listen to messages from webview
      panel.webview.onDidReceiveMessage(async (msg) => {
        let plan = store.load();

        switch (msg.type) {
          case "ready":
            sendPlan(plan);
            break;

          case "generate":
            plan = generatePlan(msg.request);
            plan.suggestions = suggestNextSteps(plan);
            await store.save(plan);
            sendPlan(plan);
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
            sendPlan(plan);
            break;

          case "updateStep":
            if (!plan) break;
            const idx = plan.steps.findIndex((s) => s.id === msg.step.id);
            if (idx === -1) break;
            plan.steps[idx] = { ...plan.steps[idx], ...msg.step };
            plan.suggestions = suggestNextSteps(plan);
            await store.save(plan);
            sendPlan(plan);
            break;

          case "deleteStep":
            if (!plan) break;
            plan.steps = plan.steps.filter((s) => s.id !== msg.id);
            plan.suggestions = suggestNextSteps(plan);
            await store.save(plan);
            sendPlan(plan);
            break;

          case "moveStep":
            if (!plan) break;
            const stepToMove = plan.steps.find((s) => s.id === msg.id);
            if (!stepToMove) break;
            stepToMove.status = msg.status;
            plan.suggestions = suggestNextSteps(plan);
            await store.save(plan);
            sendPlan(plan);
            break;

          case "executeStep":
            if (!plan) break;
            const stepToExec = plan.steps.find((s) => s.id === msg.id);
            if (!stepToExec) break;

            stepToExec.status = "in-progress";
            sendPlan(plan);

            const { outputUri, error } = await runAgent(stepToExec);
            if (error) {
              stepToExec.status = "error";
              stepToExec.error = error;
            } else {
              stepToExec.status = "done";
              stepToExec.outputUri = outputUri;
            }

            plan.suggestions = suggestNextSteps(plan);
            await store.save(plan);
            sendPlan(plan);
            break;

          case "executeAll":
            if (!plan) break;
            for (const st of plan.steps) {
              if (st.status === "done") continue;

              st.status = "in-progress";
              sendPlan(plan);

              const { outputUri, error } = await runAgent(st);
              if (error) {
                st.status = "error";
                st.error = error;
              } else {
                st.status = "done";
                st.outputUri = outputUri;
              }

              plan.suggestions = suggestNextSteps(plan);
              await store.save(plan);
              sendPlan(plan);
            }
            vscode.window.showInformationMessage(
              "PlanPilot: All steps executed"
            );
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
    }
  );

  context.subscriptions.push(openPlannerCmd);
}

export function deactivate() {}