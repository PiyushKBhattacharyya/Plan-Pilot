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

// Enhanced context interface to match all usage patterns
export interface PlanGenerationContext {
  techStack?: string[];
  existingFiles?: string[];
  projectDescription?: string;
  architecture?: string;
  existingFeatures?: string[];
  codeQuality?: string;
  recommendations?: string[];
  userNotes?: string;
  keyFiles?: string[];
  fileContents?: {[key: string]: string};
}

export interface PlanGenerationRequest {
  objective: string;
  context?: PlanGenerationContext;
}

export interface ExportFormat {
  format: 'cursor' | 'claude' | 'windsurf' | 'generic';
  content: string;
}