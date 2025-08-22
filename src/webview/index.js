const vscode = acquireVsCodeApi();
let plan;

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v]) => e.setAttribute(k, String(v)));
  children.forEach(c => typeof c === 'string' ? e.appendChild(document.createTextNode(c)) : e.appendChild(c));
  return e;
}

function log(msg) {
  const logEl = document.getElementById('logConsole');
  logEl.innerHTML += msg + '<br>';
  logEl.scrollTop = logEl.scrollHeight;
}

function renderCard(step) {
  const card = el('div', { class: 'card', draggable: true, 'data-id': step.id });
  card.innerHTML = `
    <div>${step.title}</div>
    <div class="meta">${step.description}</div>
    <div class="meta">Agent: ${step.agent}</div>
    <div class="meta">
      Status: <span class="${step.status==='done'?'status-done':step.status==='error'?'status-error':''}">${step.status}</span>
    </div>
  `;
  if(step.outputUri) card.appendChild(el('div',{class:'meta'}, 'Output: '+step.outputUri));
  if(step.error) card.appendChild(el('div',{class:'meta status-error'}, 'Error: '+step.error));

  const actions = el('div', { class: 'actions' });
  const execBtn = el('button', {}, 'Execute'); execBtn.onclick = () => vscode.postMessage({type:'executeStep',id:step.id});
  const editBtn = el('button', {}, 'Edit'); editBtn.onclick = () => {
    const newTitle = prompt('Edit title', step.title); if(!newTitle) return;
    const newDesc = prompt('Edit description', step.description) || '';
    const newAgent = prompt('Agent (Scaffolder|Researcher|Refactorer)', step.agent) || step.agent;
    vscode.postMessage({ type:'updateStep', step:{ id:step.id, title:newTitle, description:newDesc, agent:newAgent } });
  };
  const delBtn = el('button', {}, 'Delete'); delBtn.onclick = () => { if(confirm('Delete step?')) vscode.postMessage({type:'deleteStep',id:step.id}); };

  actions.append(execBtn, editBtn, delBtn);
  card.appendChild(actions);

  card.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', step.id));
  return card;
}

function renderBoard() {
  const pendingList = document.getElementById('pendingList');
  const inProgressList = document.getElementById('inProgressList');
  const doneList = document.getElementById('doneList');

  pendingList.innerHTML = '';
  inProgressList.innerHTML = '';
  doneList.innerHTML = '';

  if(!plan) {
    document.getElementById('planInfo').textContent = 'No plan loaded';
    return;
  }

  document.getElementById('planInfo').textContent = 'Plan: '+plan.request;

  plan.steps.forEach(step => {
    const card = renderCard(step);
    if(step.status === 'pending') pendingList.appendChild(card);
    else if(step.status === 'in-progress') inProgressList.appendChild(card);
    else doneList.appendChild(card);
  });

  document.getElementById('countPending').textContent = `(${plan.steps.filter(s => s.status==='pending').length})`;
  document.getElementById('countInProgress').textContent = `(${plan.steps.filter(s => s.status==='in-progress').length})`;
  document.getElementById('countDone').textContent = `(${plan.steps.filter(s => s.status==='done').length})`;
}

// Drag & Drop support
document.querySelectorAll('.column').forEach(col => {
  col.addEventListener('dragover', e => e.preventDefault());
  col.addEventListener('drop', e => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    const target = col.getAttribute('data-column');
    vscode.postMessage({ type:'moveStep', id, status: target });
  });
});

// Button Events
document.getElementById('generateBtn').addEventListener('click', () => {
  const req = document.getElementById('taskInput').value.trim();
  if(!req) { alert('Enter a task'); return; }
  vscode.postMessage({ type:'generate', request: req });
});

document.getElementById('addBtn').addEventListener('click', () => {
  const title = prompt('Step title'); if(!title) return;
  const desc = prompt('Step description','') || '';
  const agent = prompt('Agent (Scaffolder|Researcher|Refactorer)','Scaffolder') || 'Scaffolder';
  vscode.postMessage({ type:'addStep', step:{ title, description: desc, agent } });
});

document.getElementById('execAllBtn').addEventListener('click', () => vscode.postMessage({ type:'executeAll' }));
document.getElementById('resetBtn').addEventListener('click', () => { if(confirm('Reset plan?')) vscode.postMessage({ type:'resetPlan' }); });

// Messages from extension
window.addEventListener('message', event => {
  const msg = event.data;
  if(msg.type === 'plan' || msg.type === 'update') { plan = msg.plan; renderBoard(); }
  else if(msg.type === 'notification') { log(msg.text); }
});

vscode.postMessage({ type:'ready' });