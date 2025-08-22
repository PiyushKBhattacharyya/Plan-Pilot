# PlanPilot — A Visual Planning Layer for Coding Agents (VS Code Extension)

A from-scratch, TypeScript VS Code extension that demonstrates Traycer’s core idea:
**a planning layer that sits on top of coding agents**. PlanPilot lets you:

* Generate a structured plan from a natural-language task
* Visually manage the plan in a Webview (add/edit/reorder/delete steps)
* Execute steps individually or the whole plan (mock agent outputs written to `.planpilot/`)

---

## 0) Prereqs

* Node.js 18+
* VS Code (latest)

---

## 1) Project Structure

```
planpilot/
├─ package.json
├─ tsconfig.json
├─ README.md
└─ src/
   ├─ extension.ts          # Activates commands, webview, tree, orchestration
   ├─ types.ts              # Shared types
   ├─ planStore.ts          # Persist/load plan in workspace state
   ├─ planner.ts            # Planning logic (rule-based; easy to swap for LLM)
   ├─ agents.ts             # Mock agents that produce artifacts
   ├─ planTree.ts           # Explorer tree view for plan & statuses
   └─ webview.ts            # Visual planner webview (edit/reorder/execute)
```

---