const vscode = acquireVsCodeApi();
let plans = [];
let isGenerating = false;
let workspaceFiles = [];
let selectedFiles = [];
let detectedTechStack = [];

// Enhanced character counter and validation
document.addEventListener('DOMContentLoaded', function() {
    const objectiveTextarea = document.getElementById('objective');
    const charCount = document.getElementById('charCount');
    
    if (objectiveTextarea && charCount) {
        objectiveTextarea.addEventListener('input', function() {
            const count = this.value.length;
            charCount.textContent = `${count} characters`;
            
            // Color coding for character count
            if (count < 50) {
                charCount.style.color = 'var(--vscode-errorForeground)';
            } else if (count < 100) {
                charCount.style.color = 'var(--vscode-inputValidation-warningForeground)';
            } else {
                charCount.style.color = 'var(--vscode-descriptionForeground)';
            }
        });
    }
});

// Listen for messages from the extension
window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.type) {
        case 'plansLoaded':
            plans = message.plans;
            renderPlans();
            updatePlansCount();
            updateStatusBar('Plans loaded');
            break;
        case 'generationStarted':
            setGenerating(true);
            updateStatusBar('Generating plan...');
            break;
        case 'generationComplete':
            setGenerating(false);
            document.getElementById('objective').value = '';
            document.getElementById('notes').value = '';
            clearContext();
            showInfo('Plan generated successfully!');
            updateStatusBar('Plan generated');
            break;
        case 'error':
            setGenerating(false);
            showError(message.message);
            updateStatusBar('Error occurred');
            break;
        case 'workspaceFiles':
            workspaceFiles = message.files;
            renderFileBrowser();
            updateStatusBar(`${message.files.length} files found`);
            break;
        case 'fileContent':
            // File content received (can be used for preview if needed)
            break;
    }
});

function generatePlan() {
    const objective = document.getElementById('objective').value.trim();
    if (!objective) {
        showError('Please enter a development objective');
        return;
    }

    if (objective.length < 20) {
        showError('Please provide a more detailed objective (at least 20 characters)');
        return;
    }

    const notes = document.getElementById('notes').value.trim();
    
    const context = {
        selectedFiles: selectedFiles,
        techStack: detectedTechStack,
        notes: notes
    };

    vscode.postMessage({
        type: 'generatePlan',
        objective: objective,
        context: context
    });
}

function loadWorkspaceFiles() {
    updateStatusBar('Loading workspace files...');
    vscode.postMessage({
        type: 'getWorkspaceFiles'
    });
    
    // Show file browser
    const fileBrowser = document.getElementById('selectedFiles');
    fileBrowser.classList.remove('hidden');
}

function detectTechStack() {
    updateStatusBar('Detecting tech stack...');
    
    // Auto-detect common tech stack files
    const techStackFiles = [
        'package.json', 'requirements.txt', 'Cargo.toml', 'go.mod', 
        'pom.xml', 'build.gradle', 'composer.json', 'Gemfile',
        'tsconfig.json', 'webpack.config.js', 'vite.config.js', 
        'next.config.js', 'nuxt.config.js', 'vue.config.js'
    ];
    
    const foundTechFiles = workspaceFiles.filter(file => 
        techStackFiles.some(techFile => file.includes(techFile))
    );
    
    // Add common tech files to selection
    foundTechFiles.forEach(file => {
        if (!selectedFiles.includes(file)) {
            selectedFiles.push(file);
        }
    });
    
    // Enhanced tech stack detection
    detectedTechStack = [];
    if (foundTechFiles.some(f => f.includes('package.json'))) {
        detectedTechStack.push('Node.js');
        if (foundTechFiles.some(f => f.includes('next.config.js'))) detectedTechStack.push('Next.js');
        if (foundTechFiles.some(f => f.includes('nuxt.config.js'))) detectedTechStack.push('Nuxt.js');
        if (foundTechFiles.some(f => f.includes('vue.config.js'))) detectedTechStack.push('Vue.js');
    }
    if (foundTechFiles.some(f => f.includes('requirements.txt'))) detectedTechStack.push('Python');
    if (foundTechFiles.some(f => f.includes('Cargo.toml'))) detectedTechStack.push('Rust');
    if (foundTechFiles.some(f => f.includes('go.mod'))) detectedTechStack.push('Go');
    if (foundTechFiles.some(f => f.includes('pom.xml'))) detectedTechStack.push('Java/Maven');
    if (foundTechFiles.some(f => f.includes('build.gradle'))) detectedTechStack.push('Java/Gradle');
    if (foundTechFiles.some(f => f.includes('tsconfig.json'))) detectedTechStack.push('TypeScript');
    
    updateContextSummary();
    updateFileCount();
    showInfo(`Tech stack detected: ${detectedTechStack.join(', ')}`);
    updateStatusBar(`${detectedTechStack.length} technologies detected`);
}

function renderFileBrowser() {
    const fileBrowser = document.getElementById('fileBrowser');
    fileBrowser.innerHTML = workspaceFiles.map(file => `
        <div class="file-item-browser ${selectedFiles.includes(file) ? 'selected' : ''}" 
             onclick="toggleFileSelection('${file}')">
            <span>📄 ${file}</span>
            <span>${selectedFiles.includes(file) ? '✓' : ''}</span>
        </div>
    `).join('');
    
    updateFileCount();
}

function toggleFileSelection(filePath) {
    if (selectedFiles.includes(filePath)) {
        selectedFiles = selectedFiles.filter(f => f !== filePath);
    } else {
        selectedFiles.push(filePath);
    }
    
    renderFileBrowser();
    updateContextSummary();
    updateFileCount();
}

function updateFileCount() {
    const fileCountElement = document.getElementById('fileCount');
    if (fileCountElement) {
        fileCountElement.textContent = `${selectedFiles.length} files selected`;
    }
}

function clearFiles() {
    selectedFiles = [];
    renderFileBrowser();
    updateContextSummary();
    updateFileCount();
    showInfo('File selection cleared');
}

function updateContextSummary() {
    const summary = document.getElementById('contextSummary');
    
    if (selectedFiles.length > 0 || detectedTechStack.length > 0) {
        summary.classList.remove('hidden');
        
        // Update selected files
        const filesList = document.getElementById('selectedFilesList');
        filesList.innerHTML = selectedFiles.map(file => `
            <span class="file-tag">
                ${file}
                <span class="remove" onclick="removeFile('${file}')">×</span>
            </span>
        `).join('');
        
        // Update tech stack
        const techList = document.getElementById('techStackList');
        techList.innerHTML = detectedTechStack.map(tech => `
            <span class="tech-tag">${tech}</span>
        `).join('');
    } else {
        summary.classList.add('hidden');
    }
}

function removeFile(filePath) {
    selectedFiles = selectedFiles.filter(f => f !== filePath);
    renderFileBrowser();
    updateContextSummary();
    updateFileCount();
}

function clearContext() {
    selectedFiles = [];
    detectedTechStack = [];
    workspaceFiles = [];
    
    document.getElementById('selectedFiles').classList.add('hidden');
    document.getElementById('contextSummary').classList.add('hidden');
    document.getElementById('fileBrowser').innerHTML = '';
    updateFileCount();
}

function showSettings() {
    vscode.postMessage({
        type: 'showSettings'
    });
}

function showInfo(message) {
    // Remove existing messages
    document.querySelectorAll('.error, .info').forEach(el => el.remove());

    const infoDiv = document.createElement('div');
    infoDiv.className = 'info';
    infoDiv.textContent = message;
    
    const generateSection = document.querySelector('.generate-section');
    generateSection.insertBefore(infoDiv, generateSection.firstChild);

    setTimeout(() => {
        if (infoDiv.parentNode) {
            infoDiv.remove();
        }
    }, 4000);
}

function deletePlan(planId) {
    if (confirm('Are you sure you want to delete this plan?')) {
        vscode.postMessage({
            type: 'deletePlan',
            planId: planId
        });
        updateStatusBar('Deleting plan...');
    }
}

function exportPlan(planId) {
    vscode.postMessage({
        type: 'exportPlan',
        planId: planId
    });
    updateStatusBar('Exporting plan...');
}

function refreshPlans() {
    updateStatusBar('Refreshing plans...');
    vscode.postMessage({
        type: 'refreshPlans'
    });
}

function togglePlan(planId) {
    const planCard = document.querySelector(`[data-plan-id="${planId}"]`);
    if (planCard) {
        planCard.classList.toggle('expanded');
        planCard.classList.toggle('collapsed');
    }
}

function setGenerating(generating) {
    isGenerating = generating;
    const btn = document.getElementById('generateBtn');
    const textarea = document.getElementById('objective');
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    btn.disabled = generating;
    textarea.disabled = generating;
    
    if (generating) {
        btn.innerHTML = '<span class="btn-icon">⏳</span>Generating...';
        progressContainer.classList.remove('hidden');
        
        // progress simulation
        let progress = 0;
        const messages = [
            'Analyzing objective...',
            'Detecting project context...',
            'Generating implementation phases...',
            'Optimizing plan structure...',
            'Finalizing details...'
        ];
        let messageIndex = 0;
        
        const interval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress > 95) progress = 95;
            
            progressFill.style.width = progress + '%';
            
            if (Math.random() < 0.3 && messageIndex < messages.length - 1) {
                messageIndex++;
                progressText.textContent = messages[messageIndex];
            }
        }, 800);
        
        btn.dataset.progressInterval = interval;
    } else {
        btn.innerHTML = '<span class="btn-icon">🚀</span>Generate Implementation Plan';
        progressContainer.classList.add('hidden');
        progressFill.style.width = '0%';
        progressText.textContent = 'Generating plan...';
        
        if (btn.dataset.progressInterval) {
            clearInterval(btn.dataset.progressInterval);
            delete btn.dataset.progressInterval;
        }
    }
}

function showError(message) {
    // Remove existing messages
    document.querySelectorAll('.error, .info').forEach(el => el.remove());

    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    
    const generateSection = document.querySelector('.generate-section');
    generateSection.insertBefore(errorDiv, generateSection.firstChild);

    // Auto-remove after 6 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.remove();
        }
    }, 6000);
}

function updatePlansCount() {
    const plansCountElement = document.getElementById('plansCount');
    if (plansCountElement) {
        const count = plans.length;
        plansCountElement.textContent = `${count} plan${count !== 1 ? 's' : ''}`;
    }
}

function updateStatusBar(message) {
    const statusText = document.getElementById('statusBar').querySelector('.status-text');
    if (statusText) {
        statusText.textContent = message;
        
        // Auto-reset to "Ready" after 3 seconds
        setTimeout(() => {
            if (statusText.textContent === message) {
                statusText.textContent = 'Ready';
            }
        }, 3000);
    }
}

function renderPlans() {
    const container = document.getElementById('plansContainer');
    
    if (plans.length === 0) {
        container.innerHTML = '<div class="empty-state">No plans yet. Generate your first plan above! 🚀</div>';
        return;
    }

    container.innerHTML = plans.map(plan => `
        <div class="plan-card collapsed" data-plan-id="${plan.id}">
            <div class="plan-header" onclick="togglePlan('${plan.id}')">
                <div class="plan-title">${plan.title}</div>
                <div class="plan-status status-${plan.status}">${plan.status.replace('_', ' ')}</div>
            </div>
            <div class="plan-objective">${plan.objective}</div>
            <div class="plan-meta">
                <span>📁 ${plan.phases.length} phases</span>
                <span>⏱️ ${plan.estimatedHours || 'N/A'}h</span>
                <span>📅 ${new Date(plan.createdAt).toLocaleDateString()}</span>
            </div>
            <div class="plan-actions">
                <button class="btn btn-secondary btn-small" onclick="exportPlan('${plan.id}')">📤 Export</button>
                <button class="btn btn-secondary btn-small" onclick="deletePlan('${plan.id}')">🗑️ Delete</button>
            </div>
            <div class="phases-list">
                ${plan.phases.map(phase => `
                    <div class="phase-item">
                        <div class="phase-title">${phase.title}</div>
                        <div class="phase-meta">${phase.category} • ${phase.estimatedHours}h • ${phase.files.length} files</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// Initialize
refreshPlans();
updateStatusBar('PlanPilot ready');