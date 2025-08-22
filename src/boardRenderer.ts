// Styles for board, cards, header, etc.
export const styles = `
:root { --bg:#0f1720; --card:#0b1220; --accent:#4f46e5; --muted:#94a3b8; --ok:#10b981; --bad:#ef4444 }
body { font-family:Segoe UI, sans-serif; margin:0; padding:12px; background:var(--bg); color:#e6eef8; }
header { display:flex; gap:10px; align-items:center; margin-bottom:12px; }
header h1 { margin:0; font-size:1.1rem; }
header .controls { margin-left:auto; display:flex; gap:6px; align-items:center; }
input[type=text] { padding:6px 8px; border-radius:6px; border:1px solid rgba(255,255,255,0.06); background:transparent; color:inherit; min-width:300px; }
button { background:var(--accent); border:none; color:white; padding:6px 8px; border-radius:6px; cursor:pointer; }
button.ghost { background:transparent; border:1px solid rgba(255,255,255,0.06); }
main { display:flex; gap:12px; align-items:flex-start; }
.column { background:rgba(255,255,255,0.03); padding:10px; border-radius:8px; width:280px; min-height:240px; overflow:auto; }
.col-title { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-weight:600; color:var(--muted); }
.card { background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)); padding:10px; border-radius:8px; margin-bottom:8px; cursor:grab; box-shadow:0 2px 6px rgba(2,6,23,0.6); }
.card .meta { font-size:12px; color:var(--muted); margin-top:4px; }
.card .actions { display:flex; gap:4px; margin-top:6px; }
.status-done { color:var(--ok); }
.status-error { color:var(--bad); }
footer { margin-top:12px; color:var(--muted); font-size:12px; }
#contextPane { flex:1; background:rgba(255,255,255,0.03); padding:10px; border-radius:8px; min-height:240px; }
`;

// JS scripts for board rendering and UI
export const scripts = `
const vscode = acquireVsCodeApi();
let plan = undefined;

// Helper to create DOM elements
function el(tag, attrs={}, ...children) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v]) => e.setAttribute(k,String(v)));
  children.forEach(c => typeof c==='string' ? e.appendChild(document.createTextNode(c)) : e.appendChild(c));
  return e;
}

// Render a single card
function renderCard(step) {
  const card = el('div', { class:'card', 'data-id':step.id });
  const title = el('div', {}, step.title);
  const desc = el('div', { class:'meta' }, step.description);
  const agent = el('div', { class:'meta' }, 'Agent: ' + step.agent);
  const statusLine = el('div', { class:'meta' }, 'Status: ' + step.status);
  if(step.status==='done') statusLine.classList.add('status-done');
  if(step.status==='error') statusLine.classList.add('status-error');

  // Actions
  const actions = el('div', { class:'actions' });
  const execBtn = el('button', {}, 'Execute');
  execBtn.onclick = () => vscode.postMessage({ type:'executeStep', id:step.id });
  const editBtn = el('button', {}, 'Edit');
  editBtn.onclick = () => {
    const newTitle = prompt('Edit title', step.title); if(newTitle===null) return;
    const newDesc = prompt('Edit description', step.description); if(newDesc===null) return;
    const newAgent = prompt('Agent (Scaffolder|Researcher|Refactorer)', step.agent) || step.agent;
    vscode.postMessage({ type:'updateStep', step:{id:step.id,title:newTitle,description:newDesc,agent:newAgent} });
  };
  const delBtn = el('button', {}, 'Delete');
  delBtn.onclick = () => { 
    if(confirm('Delete this step?')) {
      vscode.postMessage({ type:'deleteStep', id:step.id });
    }
  };

  actions.append(execBtn, editBtn, delBtn);
  card.append(title, desc, agent, statusLine, actions);

  // Drag & Drop
  card.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', step.id); });
  return card;
}

// Render entire board
function renderBoard() {
  ['pendingList','inProgressList','doneList'].forEach(id => document.getElementById(id).innerHTML = '');
  if(!plan){ 
    document.getElementById('planInfo').textContent='No plan loaded'; 
    document.getElementById('suggestionList').innerHTML='';
    renderContext(undefined);
    return; 
  }
  document.getElementById('planInfo').textContent = 'Plan: ' + (plan.request||'Manual');

  plan.steps.forEach(step => {
    const card = renderCard(step);
    if(step.status==='pending') document.getElementById('pendingList').appendChild(card);
    else if(step.status==='in-progress') document.getElementById('inProgressList').appendChild(card);
    else if(step.status==='done') document.getElementById('doneList').appendChild(card);
  });

  document.getElementById('countPending').textContent = '(' + plan.steps.filter(s=>s.status==='pending').length + ')';
  document.getElementById('countInProgress').textContent = '(' + plan.steps.filter(s=>s.status==='in-progress').length + ')';
  document.getElementById('countDone').textContent = '(' + plan.steps.filter(s=>s.status==='done').length + ')';
  renderSuggestions();
}

// Render suggestions
function renderSuggestions() {
  const list = document.getElementById('suggestionList'); list.innerHTML = '';
  if(!plan || !plan.suggestions) return;
  plan.suggestions.forEach(s => list.appendChild(el('div', { class:'card' }, s)));
}

// Render context
function renderContext(ctx) {
  const pane = document.getElementById('contextPane');
  if (!pane) return;
  if (!ctx) { pane.innerHTML = "<i>No context</i>"; return; }
  pane.innerHTML = \`
    <h3>Codespace Context</h3>
    <p><b>Repo:</b> \${ctx.repoName || 'N/A'}</p>
    <p><b>Files:</b> \${ctx.fileCount}</p>
    <p><b>Languages:</b> \${JSON.stringify(ctx.languageStats)}</p>
    <p><b>Recent Files:</b><br>\${ctx.recentFiles?.join("<br>") || ''}</p>
  \`;
}

// Drag & drop events
document.querySelectorAll('.column').forEach(col => {
  col.addEventListener('dragover', e => e.preventDefault());
  col.addEventListener('drop', e => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    const status = col.getAttribute('data-column');
    vscode.postMessage({ type:'moveStep', id, status });
  });
});

// Button events
document.getElementById('generateBtn').addEventListener('click', () => {
  const req = document.getElementById('taskInput').value.trim();
  if(!req){ alert('Enter a task'); return; }
  vscode.postMessage({ type:'generate', request:req });
});
document.getElementById('addBtn').addEventListener('click', () => {
  const title = prompt('Step title'); if(!title) return;
  const desc = prompt('Step description','')||'';
  const agent = prompt('Agent (Scaffolder|Researcher|Refactorer)','Scaffolder')||'Scaffolder';
  vscode.postMessage({ type:'addStep', step:{title,description:desc,agent} });
});
document.getElementById('execAllBtn').addEventListener('click', () => vscode.postMessage({ type:'executeAll' }));
document.getElementById('resetBtn').addEventListener('click', () => { if(confirm('Reset plan?')) vscode.postMessage({ type:'resetPlan' }); });

// Handle messages from extension
window.addEventListener('message', event => {
  const msg = event.data;
  if(msg.type==='plan' || msg.type==='update'){ 
    plan=msg.plan; 
    renderBoard(); 
    renderContext(msg.context);
  }
  else if(msg.type==='notification'){ 
    alert(msg.text); 
  }
  else if(msg.type==='reset'){ 
    plan = undefined;
    renderBoard(); 
    renderContext(undefined);
  }
});

// Signal ready
vscode.postMessage({ type:'ready' });
`;