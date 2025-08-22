import * as vscode from "vscode";
import { getWebviewContent } from "./webviewContent";
import { PlanStore } from "./planStore";
import { generatePlan } from "./planner";
import { runAgent } from "./agents";
import { Plan, PlanStep } from "./types";

export function activate(context: vscode.ExtensionContext) {
  const store = new PlanStore(context.workspaceState);

  context.subscriptions.push(
    vscode.commands.registerCommand("planpilot.openPlanner", () => {
      const panel = vscode.window.createWebviewPanel("planpilot", "PlanPilot", vscode.ViewColumn.One, {
        enableScripts: true,
        retainContextWhenHidden: true
      });

      panel.webview.html = getWebviewContent(panel, context.extensionUri);

      // Send current plan helper
      const sendPlan = (plan?: Plan) => {
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
            const request: string = msg.request;
            const plan = generatePlan(request);
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
            const newStep: PlanStep = {
              id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,
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
            if (!plan) break;
            const idx = plan.steps.findIndex(p => p.id === updated.id);
            if (idx === -1) break;
            plan.steps[idx].title = updated.title;
            plan.steps[idx].description = updated.description;
            if (updated.agent) plan.steps[idx].agent = updated.agent;
            await store.save(plan);
            sendPlan(plan);
            break;
          }

          case "deleteStep": {
            const id = msg.id;
            const plan = store.load();
            if (!plan) break;
            plan.steps = plan.steps.filter(s => s.id !== id);
            await store.save(plan);
            sendPlan(plan);
            break;
          }

          case "moveStep": {
            const id = msg.id;
            const status: PlanStep["status"] = msg.status;
            const plan = store.load();
            if (!plan) break;
            const step = plan.steps.find(s => s.id === id);
            if (!step) break;
            step.status = status;
            await store.save(plan);
            sendPlan(plan);
            break;
          }

          case "executeStep": {
            const id = msg.id;
            const plan = store.load();
            if (!plan) break;
            const step = plan.steps.find(s => s.id === id);
            if (!step) break;

            // mark in-progress and notify UI
            step.status = "in-progress";
            await store.save(plan);
            panel.webview.postMessage({ type: "update", plan });

            // run agent
            const { outputUri, error } = await runAgent(step);
            if (error) {
              step.status = "error";
              step.error = error;
            } else {
              step.status = "done";
              step.outputUri = outputUri;
            }

            await store.save(plan);
            panel.webview.postMessage({ type: "update", plan });
            break;
          }

          case "executeAll": {
            let plan = store.load();
            if (!plan) break;
            // run sequentially
            for (const s of plan.steps) {
              if (s.status === "done") continue;
              s.status = "in-progress";
              await store.save(plan);
              panel.webview.postMessage({ type: "update", plan });

              const { outputUri, error } = await runAgent(s);
              if (error) {
                s.status = "error";
                s.error = error;
              } else {
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
    })
  );
}

export function deactivate() {}