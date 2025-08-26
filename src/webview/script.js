const vscode = acquireVsCodeApi();
let plans = [];
let filteredPlans = [];
let isGenerating = false;
let workspaceFiles = [];
let selectedFiles = [];
let detectedTechStack = [];
let isInitialized = false;
let currentViewingPlan = null;
let currentExportPlanId = null;
let currentModalPlanId = null;
let currentView = 'cards';
let currentFilter = 'all';

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

    // Initialize after DOM is ready with a small delay
    setTimeout(() => {
        initializeWebview();
    }, 100);
});

function initializeWebview() {
    if (isInitialized) return;
    
    isInitialized = true;
    updateStatusBar('Initializing...');
    updateApiStatus();
    updateWorkspaceInfo();
    
    // Set a timeout for loading state
    const loadingTimeout = setTimeout(() => {
        if (plans.length === 0) {
            updateStatusBar('Ready - No plans found');
            renderEmptyPlans();
        }
    }, 3000);

    // Clear timeout when plans are loaded
    window.loadingTimeout = loadingTimeout;
    
    refreshPlans();
}

// Listen for messages from the extension
window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.type) {
        case 'plansLoaded':
            // Clear the loading timeout since we got a response
            if (window.loadingTimeout) {
                clearTimeout(window.loadingTimeout);
                window.loadingTimeout = null;
            }
            
            plans = message.plans || [];
            applyFilters();
            renderPlans();
            updatePlansCount();
            updateStatusBar(plans.length > 0 ? 'Plans loaded' : 'Ready');
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
            refreshPlans();
            break;
        case 'error':
            setGenerating(false);
            showError(message.message);
            updateStatusBar('Error occurred');
            break;
        case 'workspaceFiles':
            workspaceFiles = message.files || [];
            renderFileBrowser();
            updateStatusBar(`${workspaceFiles.length} files found`);
            break;
        case 'fileContent':
            // File content received (can be used for preview if needed)
            break;
        case 'projectAnalysisStarted':
            updateStatusBar('Analyzing project...');
            break;
        case 'projectAnalysisComplete':
            handleProjectAnalysisComplete(message.analysis);
            updateStatusBar('Project analyzed');
            break;
        case 'projectAnalysisError':
            showError(message.message);
            updateStatusBar('Analysis failed');
            break;
        case 'smartFileSelectionStarted':
            updateStatusBar('Finding relevant files...');
            break;
        case 'smartFileSelectionComplete':
            handleSmartFileSelectionComplete(message.analysis);
            updateStatusBar('Relevant files identified');
            break;
        case 'smartFileSelectionError':
            showError(message.message);
            updateStatusBar('Smart selection failed');
            break;
        case 'exportComplete':
            showInfo('Plan exported successfully!');
            updateStatusBar('Export complete');
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
    const objective = document.getElementById('objective').value.trim();
    if (!objective) {
        showError('Enter an objective first to get smart recommendations');
        return;
    }
    
    updateStatusBar('Analyzing project for smart suggestions...');
    
    vscode.postMessage({
        type: 'smartFileSelection',
        objective: objective
    });
}

function analyzeProject() {
    updateStatusBar('Analyzing project structure...');
    vscode.postMessage({
        type: 'analyzeProject'
    });
}

function handleProjectAnalysisComplete(analysis) {
    if (!analysis) return;
    
    // Update detected tech stack from intelligent analysis
    detectedTechStack = analysis.techStack || [];
    
    // Show analysis summary
    if (analysis.projectDescription) {
        showInfo(`Project analyzed: ${analysis.architecture || 'Architecture detected'} with ${analysis.techStack.length} technologies`);
    }
    
    updateContextSummary();
    
    // Auto-select key files if available
    if (analysis.keyFiles && analysis.keyFiles.length > 0) {
        analysis.keyFiles.forEach(file => {
            if (!selectedFiles.includes(file) && workspaceFiles.includes(file)) {
                selectedFiles.push(file);
            }
        });
        renderFileBrowser();
        updateFileCount();
    }
}

function handleSmartFileSelectionComplete(analysis) {
    if (!analysis) return;
    
    // Update with AI-recommended files
    selectedFiles = [...new Set([...selectedFiles, ...analysis.files])];
    
    // Update tech stack with AI analysis
    if (analysis.techStack && analysis.techStack.length > 0) {
        detectedTechStack = [...new Set([...detectedTechStack, ...analysis.techStack])];
    }
    
    renderFileBrowser();
    updateContextSummary();
    updateFileCount();
    
    // Show smart recommendations
    if (analysis.recommendations && analysis.recommendations.length > 0) {
        const recText = analysis.recommendations.slice(0, 2).join('; ');
        showInfo(`Smart suggestions: ${recText}`);
    } else {
        showInfo(`Selected ${analysis.files.length} relevant files based on your objective`);
    }
}

function renderFileBrowser() {
    const fileBrowser = document.getElementById('fileBrowser');
    if (!fileBrowser) return;
    
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
    if (!summary) return;
    
    if (selectedFiles.length > 0 || detectedTechStack.length > 0) {
        summary.classList.remove('hidden');
        
        // Update selected files
        const filesList = document.getElementById('selectedFilesList');
        if (filesList) {
            filesList.innerHTML = selectedFiles.map(file => `
                <span class="file-tag">
                    ${file}
                    <span class="remove" onclick="removeFile('${file}')">×</span>
                </span>
            `).join('');
        }
        
        // Update tech stack
        const techList = document.getElementById('techStackList');
        if (techList) {
            techList.innerHTML = detectedTechStack.map(tech => `
                <span class="tech-tag">${tech}</span>
            `).join('');
        }
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
    
    const selectedFilesEl = document.getElementById('selectedFiles');
    const contextSummaryEl = document.getElementById('contextSummary');
    const fileBrowserEl = document.getElementById('fileBrowser');
    
    if (selectedFilesEl) selectedFilesEl.classList.add('hidden');
    if (contextSummaryEl) contextSummaryEl.classList.add('hidden');
    if (fileBrowserEl) fileBrowserEl.innerHTML = '';
    
    updateFileCount();
}

function showSettings() {
    vscode.postMessage({
        type: 'showSettings'
    });
}

function toggleTheme() {
    // This would need to be implemented in VS Code extension
    showInfo('Theme toggle not yet implemented');
}

function showInfo(message) {
    // Remove existing messages
    document.querySelectorAll('.error, .info').forEach(el => el.remove());

    const infoDiv = document.createElement('div');
    infoDiv.className = 'info';
    infoDiv.textContent = message;
    
    const generateSection = document.querySelector('.generate-section');
    if (generateSection) {
        generateSection.insertBefore(infoDiv, generateSection.firstChild);
    }

    setTimeout(() => {
        if (infoDiv.parentNode) {
            infoDiv.remove();
        }
    }, 4000);
}

function showError(message) {
    // Remove existing messages
    document.querySelectorAll('.error, .info').forEach(el => el.remove());

    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    
    const generateSection = document.querySelector('.generate-section');
    if (generateSection) {
        generateSection.insertBefore(errorDiv, generateSection.firstChild);
    }

    // Auto-remove after 6 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.remove();
        }
    }, 6000);
}

function deletePlan(planId) {
    if (confirm('Are you sure you want to delete this plan?')) {
        vscode.postMessage({
            type: 'deletePlan',
            planId: planId
        });
        updateStatusBar('Deleting plan...');
        
        // If we're currently viewing this plan, return to plan list
        if (currentViewingPlan && currentViewingPlan.id === planId) {
            showPlansList();
        }
    }
}

function viewPlan(planId) {
    const plan = plans.find(p => p.id === planId);
    if (plan) {
        currentViewingPlan = plan;
        currentModalPlanId = planId;
        renderPlanModal(plan);
        updateStatusBar(`Viewing: ${plan.title}`);
    }
}

function renderPlanModal(plan) {
    const modal = document.getElementById('planDetailModal');
    const title = document.getElementById('modalPlanTitle');
    const content = document.getElementById('modalPlanContent');
    
    if (title) title.textContent = plan.title;
    
    if (content) {
        content.innerHTML = `
            <div class="plan-objective">
                <h4>Objective</h4>
                <p>${plan.objective}</p>
            </div>
            
            <div class="plan-meta-section">
                <div class="meta-grid">
                    <div class="meta-item">
                        <strong>Status:</strong> 
                        <span class="plan-status status-${plan.status || 'draft'}">${(plan.status || 'draft').replace('_', ' ')}</span>
                    </div>
                    <div class="meta-item"><strong>Phases:</strong> ${plan.phases.length}</div>
                    <div class="meta-item"><strong>Est. Hours:</strong> ${plan.estimatedHours || 'N/A'}h</div>
                    <div class="meta-item"><strong>Files:</strong> ${plan.filesAffected || 'N/A'}</div>
                    <div class="meta-item"><strong>Created:</strong> ${plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : 'Unknown'}</div>
                </div>
            </div>
            
            <div class="phases-summary">
                <h4>Implementation Phases</h4>
                ${plan.phases.map((phase, index) => `
                    <div class="phase-summary-item">
                        <div class="phase-summary-header">
                            <span class="phase-number">${index + 1}</span>
                            <div class="phase-summary-info">
                                <h5>${phase.title}</h5>
                                <div class="phase-summary-meta">
                                    <span class="phase-category">${phase.category}</span>
                                    <span>${phase.estimatedHours}h</span>
                                    <span>${phase.files.length} files</span>
                                    <span>${phase.steps.length} steps</span>
                                </div>
                            </div>
                        </div>
                        <p class="phase-summary-desc">${phase.description}</p>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    modal.classList.remove('hidden');
}

function closePlanModal() {
    const modal = document.getElementById('planDetailModal');
    modal.classList.add('hidden');
    currentModalPlanId = null;
}

function showPlansList() {
    currentViewingPlan = null;
    renderPlans();
    updateStatusBar('Ready');
}

function openPlanInWindow(planId) {
    vscode.postMessage({
        type: 'openPlanInWindow',
        planId: planId
    });
    updateStatusBar('Opening plan in new window...');
}

function exportPlan(planId, format = null) {
    if (format) {
        // Get export options
        const options = {
            includeDetails: document.getElementById('includeDetails')?.checked ?? true,
            includeCode: document.getElementById('includeCode')?.checked ?? true,
            includeTimeline: document.getElementById('includeTimeline')?.checked ?? true,
            includeDependencies: document.getElementById('includeDependencies')?.checked ?? false
        };
        
        vscode.postMessage({
            type: 'exportPlan',
            planId: planId,
            format: format,
            options: options
        });
        updateStatusBar('Exporting plan...');
        closeExportModal();
    } else {
        // Show export options modal
        showExportModal(planId);
    }
}

function showExportModal(planId) {
    currentExportPlanId = planId;
    const modal = document.getElementById('exportModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeExportModal() {
    const modal = document.getElementById('exportModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    currentExportPlanId = null;
}

function refreshPlans() {
    updateStatusBar('Refreshing plans...');
    vscode.postMessage({
        type: 'refreshPlans'
    });
}

function switchView(viewType) {
    currentView = viewType;
    
    // Update button states
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewType);
    });
    
    renderPlans();
}

function filterPlans() {
    const filterSelect = document.getElementById('statusFilter');
    currentFilter = filterSelect ? filterSelect.value : 'all';
    
    applyFilters();
    renderPlans();
}

function applyFilters() {
    filteredPlans = plans.filter(plan => {
        if (currentFilter === 'all') return true;
        return plan.status === currentFilter;
    });
}

function setGenerating(generating) {
    isGenerating = generating;
    const btn = document.getElementById('generateBtn');
    const textarea = document.getElementById('objective');
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    if (!btn || !textarea) return;
    
    btn.disabled = generating;
    textarea.disabled = generating;
    
    if (generating) {
        btn.innerHTML = '<span class="btn-icon">⏳</span>Generating...';
        if (progressContainer) progressContainer.classList.remove('hidden');
        
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
            
            if (progressFill) progressFill.style.width = progress + '%';
            
            if (Math.random() < 0.3 && messageIndex < messages.length - 1) {
                messageIndex++;
                if (progressText) progressText.textContent = messages[messageIndex];
            }
        }, 800);
        
        btn.dataset.progressInterval = interval;
    } else {
        btn.innerHTML = '<span class="btn-icon">🚀</span>Generate Implementation Plan';
        if (progressContainer) progressContainer.classList.add('hidden');
        if (progressFill) progressFill.style.width = '0%';
        if (progressText) progressText.textContent = 'Generating plan...';
        
        if (btn.dataset.progressInterval) {
            clearInterval(btn.dataset.progressInterval);
            delete btn.dataset.progressInterval;
        }
    }
}

function updatePlansCount() {
    const plansCountElement = document.getElementById('plansCount');
    if (plansCountElement) {
        const count = filteredPlans.length;
        plansCountElement.textContent = `${count} plan${count !== 1 ? 's' : ''}`;
    }
}

function updateStatusBar(message) {
    const statusBar = document.getElementById('statusBar');
    const statusText = statusBar?.querySelector('.status-text');
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

function updateApiStatus() {
    const apiStatus = document.getElementById('apiStatus');
    if (apiStatus) {
        // This would be updated based on actual API status from extension
        apiStatus.textContent = '🟢 AI Ready';
    }
}

function updateWorkspaceInfo() {
    const workspaceInfo = document.getElementById('workspaceInfo');
    if (workspaceInfo) {
        // This would be updated with actual workspace info
        workspaceInfo.textContent = '';
    }
}

function renderEmptyPlans() {
    const container = document.getElementById('plansContainer');
    if (container) {
        container.innerHTML = '<div class="empty-state">No plans yet. Generate your first plan above!</div>';
    }
}

function renderPlans() {
    const container = document.getElementById('plansContainer');
    if (!container) return;
    
    if (filteredPlans.length === 0) {
        renderEmptyPlans();
        return;
    }

    if (currentView === 'list') {
        renderPlansListView(container);
    } else if (currentView === 'timeline') {
        renderPlansTimelineView(container);
    } else {
        renderPlansCardView(container);
    }
}

function renderPlansCardView(container) {
    container.innerHTML = filteredPlans.map(plan => `
        <div class="plan-card" data-plan-id="${plan.id}">
            <div class="plan-header" onclick="viewPlan('${plan.id}')">
                <div class="plan-title">${plan.title || 'Untitled Plan'}</div>
                <div class="plan-status status-${plan.status || 'draft'}">${(plan.status || 'draft').replace('_', ' ')}</div>
            </div>
            <div class="plan-objective">${plan.objective || 'No objective specified'}</div>
            <div class="plan-meta">
                <span>📋 ${(plan.phases || []).length} phases</span>
                <span>⏱️ ${plan.estimatedHours || 'N/A'}h</span>
                <span>📅 ${plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : 'Unknown'}</span>
            </div>
            <div class="plan-actions" onclick="event.stopPropagation();">
                <button class="btn btn-secondary btn-small" onclick="openPlanInWindow('${plan.id}')" title="Open in Window">🪟</button>
                <button class="btn btn-secondary btn-small" onclick="exportPlan('${plan.id}')" title="Export">📤</button>
                <button class="btn btn-secondary btn-small" onclick="deletePlan('${plan.id}')" title="Delete">🗑️</button>
            </div>
        </div>
    `).join('');
}

function renderPlansListView(container) {
    container.innerHTML = `
        <div class="plans-list-view">
            ${filteredPlans.map(plan => `
                <div class="plan-list-item" onclick="viewPlan('${plan.id}')">
                    <div class="plan-list-main">
                        <div class="plan-list-title">${plan.title || 'Untitled Plan'}</div>
                        <div class="plan-list-meta">
                            <span class="plan-status status-${plan.status || 'draft'}">${(plan.status || 'draft').replace('_', ' ')}</span>
                            <span>📋 ${(plan.phases || []).length}</span>
                            <span>⏱️ ${plan.estimatedHours || 'N/A'}h</span>
                            <span>📅 ${plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : 'Unknown'}</span>
                        </div>
                    </div>
                    <div class="plan-list-actions" onclick="event.stopPropagation();">
                        <button class="btn-icon" onclick="openPlanInWindow('${plan.id}')" title="Open in Window">🪟</button>
                        <button class="btn-icon" onclick="exportPlan('${plan.id}')" title="Export">📤</button>
                        <button class="btn-icon" onclick="deletePlan('${plan.id}')" title="Delete">🗑️</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderPlansTimelineView(container) {
    const sortedPlans = [...filteredPlans].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    container.innerHTML = `
        <div class="plans-timeline-view">
            ${sortedPlans.map(plan => `
                <div class="timeline-item" onclick="viewPlan('${plan.id}')">
                    <div class="timeline-marker"></div>
                    <div class="timeline-content">
                        <div class="timeline-date">${plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : 'Unknown'}</div>
                        <div class="timeline-title">${plan.title || 'Untitled Plan'}</div>
                        <div class="timeline-status status-${plan.status || 'draft'}">${(plan.status || 'draft').replace('_', ' ')}</div>
                        <div class="timeline-meta">
                            <span>📋 ${(plan.phases || []).length} phases</span>
                            <span>⏱️ ${plan.estimatedHours || 'N/A'}h</span>
                        </div>
                    </div>
                    <div class="timeline-actions" onclick="event.stopPropagation();">
                        <button class="btn-icon" onclick="openPlanInWindow('${plan.id}')" title="Open in Window">🪟</button>
                        <button class="btn-icon" onclick="exportPlan('${plan.id}')" title="Export">📤</button>
                        <button class="btn-icon" onclick="deletePlan('${plan.id}')" title="Delete">🗑️</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Template functions
function showTemplates() {
    const modal = document.getElementById('templatesModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeTemplatesModal() {
    const modal = document.getElementById('templatesModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function useTemplate(templateType) {
    const templates = {
        webapp: "Build a full-stack web application with user authentication, database integration, REST API, responsive frontend, and admin dashboard",
        mobile: "Develop a cross-platform mobile application with user registration, push notifications, offline storage, and social features",
        api: "Create a RESTful API service with authentication, database operations, documentation, testing, and deployment pipeline",
        microservice: "Build a containerized microservice with health checks, logging, monitoring, and CI/CD integration",
        dashboard: "Design an analytics dashboard with data visualization, real-time updates, user management, and export capabilities",
        ecommerce: "Develop an e-commerce platform with product catalog, shopping cart, payment processing, and order management"
    };
    
    const objective = document.getElementById('objective');
    if (objective && templates[templateType]) {
        objective.value = templates[templateType];
        objective.dispatchEvent(new Event('input')); // Trigger character count update
    }
    
    closeTemplatesModal();
    showInfo(`Template loaded: ${templateType.charAt(0).toUpperCase() + templateType.slice(1)}`);
}

// Import functions
function importPlan() {
    const modal = document.getElementById('importModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeImportModal() {
    const modal = document.getElementById('importModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function importFromFile() {
    showInfo('File import functionality not yet implemented');
    closeImportModal();
}

function importFromClipboard() {
    navigator.clipboard.readText().then(text => {
        if (text.trim()) {
            // Try to parse as JSON or use as objective
            try {
                const parsed = JSON.parse(text);
                if (parsed.objective) {
                    document.getElementById('objective').value = parsed.objective;
                    showInfo('Plan imported from clipboard');
                } else {
                    showError('Invalid plan format in clipboard');
                }
            } catch {
                // Use as objective text
                document.getElementById('objective').value = text.substring(0, 1000);
                showInfo('Text imported from clipboard as objective');
            }
        } else {
            showError('Clipboard is empty');
        }
    }).catch(() => {
        showError('Failed to read from clipboard');
    });
    closeImportModal();
}

function importFromUrl() {
    const url = prompt('Enter URL to import from:');
    if (url) {
        showInfo('URL import functionality not yet implemented');
    }
    closeImportModal();
}

// Close modals when clicking outside
document.addEventListener('click', (event) => {
    if (event.target.classList.contains('modal')) {
        event.target.classList.add('hidden');
    }
});