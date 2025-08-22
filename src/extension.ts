import * as vscode from "vscode";
import { getWebviewContent } from "./webviewContent";
import { PlanStore } from "./planStore";
import { generatePlan, suggestNextSteps } from "./planner";
import { runAgent } from "./agents";
import { Plan, PlanStep } from "./types";

export function activate(context: vscode.ExtensionContext) {
  const store = new PlanStore(context.workspaceState);

  context.subscriptions.push(
    vscode.commands.registerCommand("planpilot.openPlanner", () => {
      const panel = vscode.window.createWebviewPanel("planpilot","PlanPilot — Planning Done Simple", vscode.ViewColumn.One,{
        enableScripts:true,
        retainContextWhenHidden:true
      });

      panel.webview.html=getWebviewContent(panel, context.extensionUri);
      const sendPlan=(plan?:Plan)=>panel.webview.postMessage({type:"plan",plan});

      panel.webview.onDidReceiveMessage(async msg=>{
        let plan=store.load();
        switch(msg.type){
          case "ready": sendPlan(plan); break;
          case "generate":
            plan=generatePlan(msg.request);
            plan.suggestions=suggestNextSteps(plan);
            await store.save(plan); sendPlan(plan); break;
          case "addStep":
            if(!plan) plan={steps:[],request:"Manual",suggestions:[]};
            plan.steps.push({id:`${Date.now()}`,title:msg.step.title,description:msg.step.description,agent:msg.step.agent,status:"pending"});
            plan.suggestions=suggestNextSteps(plan);
            await store.save(plan); sendPlan(plan); break;
          case "updateStep":
            if(!plan)break;
            const idx=plan.steps.findIndex(s=>s.id===msg.step.id);
            if(idx===-1)break;
            plan.steps[idx]={...plan.steps[idx],...msg.step};
            plan.suggestions=suggestNextSteps(plan);
            await store.save(plan); sendPlan(plan); break;
          case "deleteStep":
            if(!plan)break;
            plan.steps=plan.steps.filter(s=>s.id!==msg.id);
            plan.suggestions=suggestNextSteps(plan);
            await store.save(plan); sendPlan(plan); break;
          case "moveStep":
            if(!plan)break;
            const s=plan.steps.find(s=>s.id===msg.id); if(!s)break;
            s.status=msg.status;
            plan.suggestions=suggestNextSteps(plan);
            await store.save(plan); sendPlan(plan); break;
          case "executeStep":
            if(!plan)break;
            const se=plan.steps.find(s=>s.id===msg.id); if(!se)break;
            se.status="in-progress"; sendPlan(plan);
            const {outputUri,error}=await runAgent(se);
            if(error){se.status="error"; se.error=error;}
            else{se.status="done"; se.outputUri=outputUri;}
            plan.suggestions=suggestNextSteps(plan);
            await store.save(plan); sendPlan(plan); break;
          case "executeAll":
            if(!plan)break;
            for(const st of plan.steps){
              if(st.status==="done") continue;
              st.status="in-progress"; sendPlan(plan);
              const {outputUri,error}=await runAgent(st);
              if(error){st.status="error";st.error=error;} else{st.status="done";st.outputUri=outputUri;}
              plan.suggestions=suggestNextSteps(plan);
              await store.save(plan); sendPlan(plan);
            }
            vscode.window.showInformationMessage("PlanPilot: All steps executed"); break;
          case "resetPlan":
            await store.save(undefined);
            sendPlan(undefined);
            vscode.window.showInformationMessage("PlanPilot: Plan reset"); break;
        }
      });
    })
  );
}

export function deactivate() {}