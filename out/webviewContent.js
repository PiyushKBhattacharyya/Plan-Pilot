"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWebviewContent = getWebviewContent;
function getNonce() {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}
function getWebviewContent(panel, extensionUri) {
    const webview = panel.webview;
    const nonce = getNonce();
    const cspSource = webview.cspSource;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; img-src ${cspSource} https:; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PlanPilot</title>
  <style>
    :root{--bg:#0f1720;--card:#0b1220;--accent:#4f46e5;--muted:#94a3b8;--ok:#10b981;--bad:#ef4444}
    body{font-family:Segoe UI, Roboto, Arial; margin:0; padding:12px; background:linear-gradient(180deg,#071026, #081227); color:#e6eef8}
    header{display:flex; gap:10px; align-items:center; margin-bottom:12px}
    header h1{margin:0; font-size:1.1rem}
    header .controls{margin-left:auto; display:flex; gap:8px; align-items:center}
    input[type="text"]{padding:8px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.06); background:transparent; color:inherit; min-width:360px}
    button{background:var(--accent); border:none; color:white; padding:8px 10px; border-radius:6px; cursor:pointer}
    button.ghost{background:transparent; border:1px solid rgba(255,255,255,0.06)}
    main{display:flex; gap:12px; align-items:flex-start}
    .column{background:rgba(255,255,255,0.03); padding:10px; border-radius:8px; width:320px; min-height:240px}
    .col-title{display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-weight:600; color:var(--muted)}
    .card{background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)); padding:10px; border-radius:8px; margin-bottom:8px; cursor:grab; box-shadow: 0 2px 6px rgba(2,6,23,0.6)}
    .card .meta{font-size:12px; color:var(--muted); margin-top:6px}
    .card .actions{display:flex; gap:8px; margin-top:8px}
    .badge{font-size:11px; padding:2px 6px; border-radius:999px; background:rgba(255,255,255,0.03)}
    .status-done{color:var(--ok)}
    .status-error{color:var(--bad)}
    footer{margin-top:12px; color:var(--muted); font-size:12px}
  </style>
</head>
<body>
  <header>
    <h1>PlanPilot — Visual Planner</h1>
    <div class="controls">
      <input id="taskInput" type="text" placeholder="Describe a task (e.g. Build a REST API for todos)" />
      <button id="generateBtn">Generate Plan</button>
      <button id="addBtn" class="ghost">Add Step</button>
      <button id="execAllBtn" class="ghost">Execute All</button>
      <button id="resetBtn" class="ghost">Reset</button>
    </div>
  </header>

  <main>
    <div class="column" data-column="pending">
      <div class="col-title"><span>To Do</span><span id="countPending"></span></div>
      <div id="pendingList"></div>
    </div>

    <div class="column" data-column="in-progress">
      <div class="col-title"><span>In Progress</span><span id="countInProgress"></span></div>
      <div id="inProgressList"></div>
    </div>

    <div class="column" data-column="done">
      <div class="col-title"><span>Done</span><span id="countDone"></span></div>
      <div id="doneList"></div>
    </div>
  </main>

  <footer>
    <span id="planInfo">No plan loaded</span>
  </footer>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let plan = undefined;

    // helpers
    function el(tag, attrs = {}, ...children) {
      const e = document.createElement(tag);
      Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, String(v)));
      children.forEach(c => typeof c === 'string' ? e.appendChild(document.createTextNode(c)) : e.appendChild(c));
      return e;
    }

    function renderCard(step) {
      const card = el('div', { class: 'card', draggable: true, 'data-id': step.id });
      const title = el('div', {}, step.title);
      const desc = el('div', { class: 'meta' }, step.description);
      const agent = el('div', { class: 'meta' }, 'Agent: ' + step.agent);
      const statusLine = el('div', { class: 'meta' }, 'Status: ' + step.status);
      if (step.status === 'done') statusLine.classList.add('status-done');
      if (step.status === 'error') statusLine.classList.add('status-error');

      const actions = el('div', { class: 'actions' });
      const execBtn = el('button', {}, 'Execute');
      execBtn.onclick = () => vscode.postMessage({ type: 'executeStep', id: step.id });

      const editBtn = el('button', {}, 'Edit');
      editBtn.onclick = () => {
        const newTitle = prompt('Edit title', step.title);
        if (newTitle === null) return;
        const newDesc = prompt('Edit description', step.description);
        if (newDesc === null) return;
        const agent = prompt('Agent (scaffolder|researcher|refactorer)', step.agent) || step.agent;
        vscode.postMessage({ type: 'updateStep', step: { id: step.id, title: newTitle, description: newDesc, agent } });
      };

      const delBtn = el('button', {}, 'Delete');
      delBtn.onclick = () => {
        if (!confirm('Delete this step?')) return;
        vscode.postMessage({ type: 'deleteStep', id: step.id });
      };

      actions.appendChild(execBtn);
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      card.appendChild(title);
      card.appendChild(desc);
      card.appendChild(agent);
      card.appendChild(statusLine);
      card.appendChild(actions);

      // drag handlers
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', step.id);
      });

      return card;
    }

    function renderBoard() {
      const pendingList = document.getElementById('pendingList');
      const inProgressList = document.getElementById('inProgressList');
      const doneList = document.getElementById('doneList');

      pendingList.innerHTML = '';
      inProgressList.innerHTML = '';
      doneList.innerHTML = '';

      if (!plan) {
        document.getElementById('planInfo').textContent = 'No plan loaded';
        return;
      }

      document.getElementById('planInfo').textContent = 'Plan: ' + plan.request;

      plan.steps.forEach(step => {
        const card = renderCard(step);
        if (step.status === 'pending') pendingList.appendChild(card);
        else if (step.status === 'in-progress') inProgressList.appendChild(card);
        else if (step.status === 'done') doneList.appendChild(card);
      });

      document.getElementById('countPending').textContent = '(' + plan.steps.filter(s=>s.status==='pending').length + ')';
      document.getElementById('countInProgress').textContent = '(' + plan.steps.filter(s=>s.status==='in-progress').length + ')';
      document.getElementById('countDone').textContent = '(' + plan.steps.filter(s=>s.status==='done').length + ')';
    }

    // Column drag/drop
    document.querySelectorAll('.column').forEach(col => {
      col.addEventListener('dragover', (e) => e.preventDefault());
      col.addEventListener('drop', (e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');
        const target = col.getAttribute('data-column');
        vscode.postMessage({ type: 'moveStep', id, status: target === 'pending' ? 'pending' : target === 'in-progress' ? 'in-progress' : 'done' });
      });
    });

    // UI event hooks
    document.getElementById('generateBtn').addEventListener('click', () => {
      const req = document.getElementById('taskInput').value.trim();
      if (!req) { alert('Enter a task first'); return; }
      vscode.postMessage({ type: 'generate', request: req });
    });

    document.getElementById('addBtn').addEventListener('click', () => {
      const title = prompt('Step title');
      if (!title) return;
      const description = prompt('Step description', '') || '';
      const agent = prompt('Agent (scaffolder|researcher|refactorer)', 'scaffolder') || 'scaffolder';
      vscode.postMessage({ type: 'addStep', step: { title, description, agent } });
    });

    document.getElementById('execAllBtn').addEventListener('click', () => {
      vscode.postMessage({ type: 'executeAll' });
    });

    document.getElementById('resetBtn').addEventListener('click', () => {
      if (!confirm('Reset the current plan?')) return;
      vscode.postMessage({ type: 'resetPlan' });
    });

    // receive messages from extension host
    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.type === 'plan') {
        plan = msg.plan;
        renderBoard();
      } else if (msg.type === 'update') {
        plan = msg.plan;
        renderBoard();
      } else if (msg.type === 'notification') {
        alert(msg.text);
      }
    });

    // notify extension host we are ready and request current plan
    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
}
//# sourceMappingURL=webviewContent.js.map