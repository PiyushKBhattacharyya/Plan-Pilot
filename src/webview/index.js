/* global acquireVsCodeApi */
const vscode = acquireVsCodeApi();
let plan = undefined;

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
  for (const c of children) el.append(c && c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}

function renderCard(step) {
  const wrap = h("div", { class: "card", draggable: "true", "data-id": step.id });
  wrap.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", step.id);
  });

  const actions = h("div", { class: "actions" },
    h("button", { }, "Execute"),
    h("button", { }, "Edit"),
    h("button", { }, "Delete"),
  );

  actions.children[0].onclick = () => vscode.postMessage({ type: "executeStep", id: step.id });
  actions.children[1].onclick = () => {
    const title = prompt("Title", step.title); if (title === null) return;
    const description = prompt("Description", step.description ?? ""); if (description === null) return;
    const agent = prompt("Agent", step.agent ?? "Scaffolder") || step.agent;
    vscode.postMessage({ type: "updateStep", step: { id: step.id, title, description, agent } });
  };
  actions.children[2].onclick = () => {
    if (confirm("Delete this step?")) vscode.postMessage({ type: "deleteStep", id: step.id });
  };

  wrap.append(
    h("div", {}, step.title),
    h("div", { class: "meta" }, step.description || ""),
    h("div", { class: "meta" }, "Agent: " + (step.agent || "")),
    h("div", { class: "meta" }, "Status: " + step.status),
    actions
  );
  return wrap;
}

function renderBoard() {
  document.getElementById("pendingList").innerHTML = "";
  document.getElementById("inProgressList").innerHTML = "";
  document.getElementById("doneList").innerHTML = "";

  if (!plan) {
    document.getElementById("planInfo").textContent = "No plan loaded";
    document.getElementById("countPending").textContent = "0";
    document.getElementById("countInProgress").textContent = "0";
    document.getElementById("countDone").textContent = "0";
    return;
  }

  document.getElementById("planInfo").textContent = "Plan: " + (plan.request || "Manual");

  for (const step of plan.steps) {
    const card = renderCard(step);
    if (step.status === "pending") document.getElementById("pendingList").appendChild(card);
    else if (step.status === "in-progress") document.getElementById("inProgressList").appendChild(card);
    else if (step.status === "done") document.getElementById("doneList").appendChild(card);
  }

  document.getElementById("countPending").textContent = String(plan.steps.filter(s => s.status === "pending").length);
  document.getElementById("countInProgress").textContent = String(plan.steps.filter(s => s.status === "in-progress").length);
  document.getElementById("countDone").textContent = String(plan.steps.filter(s => s.status === "done").length);
}

function renderContext(ctx) {
  const pane = document.getElementById("contextPane");
  if (!ctx) { pane.innerHTML = "<i>No context</i>"; return; }

  const filesHtml = (ctx.files || []).map(f =>
    `<div><b>${f.path}</b><br><code>${(f.contentPreview || "").replace(/[<>&]/g, s => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[s]))}</code></div>`
  ).join("<hr>");

  pane.innerHTML = `
    <h3>Codespace Context</h3>
    <p><b>Repo:</b> ${ctx.repoName || "N/A"}</p>
    <p><b>Files:</b> ${ctx.fileCount}</p>
    <p><b>Languages:</b> ${JSON.stringify(ctx.languageStats || {})}</p>
    <p><b>Recent Files:</b><br>${(ctx.recentFiles || []).join("<br>")}</p>
    <h4>Sample Files</h4>
    <div style="max-height:240px; overflow:auto;">${filesHtml}</div>
  `;
}

// DnD move support
document.querySelectorAll(".column").forEach((col) => {
  col.addEventListener("dragover", (e) => e.preventDefault());
  col.addEventListener("drop", (e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const status = col.getAttribute("data-column");
    vscode.postMessage({ type: "moveStep", id, status });
  });
});

// Buttons
document.getElementById("generateBtn").onclick = () => {
  const req = document.getElementById("taskInput").value.trim();
  if (!req) { alert("Enter a task"); return; }
  vscode.postMessage({ type: "generate", request: req });
};
document.getElementById("addBtn").onclick = () => {
  const title = prompt("Step title"); if (!title) return;
  const description = prompt("Step description", "") || "";
  const agent = prompt("Agent (Scaffolder|Researcher|Refactorer)", "Scaffolder") || "Scaffolder";
  vscode.postMessage({ type: "addStep", step: { title, description, agent } });
};
document.getElementById("execAllBtn").onclick = () => vscode.postMessage({ type: "executeAll" });
document.getElementById("resetBtn").onclick = () => { if (confirm("Reset plan?")) vscode.postMessage({ type: "resetPlan" }); };
document.getElementById("refreshCtxBtn").onclick = () => vscode.postMessage({ type: "getContext" });

// Messages from extension
window.addEventListener("message", (event) => {
  const msg = event.data;
  if (msg.type === "plan") {
    plan = msg.plan;
    renderBoard();
    renderContext(msg.context);
  }
});

// Ready
vscode.postMessage({ type: "ready" });
