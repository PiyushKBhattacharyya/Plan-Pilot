export interface Phase {
  id: string;
  title: string;
  description: string;
  category: string;
  estimatedHours: number;
  files: FileModification[];
  steps: Step[];
  dependencies?: string[];
}

export interface FileModification {
  path: string;
  action: 'create' | 'modify' | 'delete';
  description: string;
}

export interface Step {
  id: string;
  description: string;
  details?: string;
  order: number;
}

export interface Plan {
  id: string;
  title: string;
  objective: string;
  phases: Phase[];
  estimatedHours?: number;
  filesAffected?: number;
  status: 'draft' | 'in_progress' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanGenerationRequest {
  objective: string;
  context?: {
    techStack?: string[];
    existingFiles?: string[];
    projectDescription?: string;
  };
}

export interface ExportFormat {
  format: 'cursor' | 'claude' | 'windsurf' | 'generic';
  content: string;
}