import { GoogleGenAI } from "@google/genai";
import { type PlanGenerationRequest, type Plan, type Phase, type ExportFormat, type FileModification, type Step } from "./types";
import * as vscode from 'vscode';


interface GeminiPhaseResponse {
  id: string;
  title: string;
  description: string;
  category: string;
  estimatedHours: number;
  files: {
    path: string;
    action: 'create' | 'modify' | 'delete';
    description: string;
  }[];
  steps: {
    id: string;
    description: string;
    details?: string;
    order: number;
  }[];
  dependencies?: string[];
}

interface GeminiPlanResponse {
  title: string;
  phases: GeminiPhaseResponse[];
  estimatedHours: number;
  filesAffected: number;
}

export class GeminiService {
  private ai: GoogleGenAI | null = null;

  constructor() {
    this.initializeApi();
  }

  private initializeApi() {
    
    const config = vscode.workspace.getConfiguration('planpilot');
    let apiKey = config.get<string>('geminiApiKey');
    
    // Get API key from environment variable as fallback
    if (!apiKey) {
      apiKey = process.env.GEMINI_API_KEY || '';
    }
      
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  async generateImplementationPlan(request: PlanGenerationRequest): Promise<Plan> {
    if (!this.ai) {
      throw new Error('Gemini API key not configured. Please set planpilot.geminiApiKey in settings or GEMINI_API_KEY environment variable.');
    }

    try {
      const workspaceInfo = this.getWorkspaceContext();
      
      const systemPrompt = `You are an expert software architect and development planner. Your task is to analyze development objectives and create detailed, actionable implementation plans.

Context Information:
${workspaceInfo}

Guidelines:
1. Break down the objective into logical, sequential phases
2. Each phase should have a clear title, description, and category
3. Provide realistic time estimates in hours
4. Specify exact files that need to be created, modified, or deleted
5. Include detailed step-by-step instructions for each phase
6. Consider dependencies between phases
7. Use appropriate categories: Database, Backend, Frontend, API, Security, Features, Testing, etc.

Response Format:
- title: A concise title for the overall implementation plan
- phases: Array of implementation phases
- estimatedHours: Total estimated hours for the entire plan
- filesAffected: Total number of files that will be created/modified/deleted

Each phase must include:
- id: Unique identifier
- title: Phase name
- description: Brief description of what this phase accomplishes
- category: One of the predefined categories
- estimatedHours: Time estimate for this phase
- files: Array of file modifications with path, action, and description
- steps: Ordered array of implementation steps with descriptions and optional details
- dependencies: Optional array of phase IDs that must be completed first`;

      const userPrompt = `Objective: ${request.objective}

${request.context?.techStack ? `Tech Stack Context: ${request.context.techStack.join(', ')}` : ''}
${request.context?.projectDescription ? `Project Context: ${request.context.projectDescription}` : ''}
${request.context?.existingFiles ? `Existing Files: ${request.context.existingFiles.join(', ')}` : ''}

Please create a comprehensive implementation plan for this objective.`;

      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              title: { type: "string" },
              phases: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    title: { type: "string" },
                    description: { type: "string" },
                    category: { type: "string" },
                    estimatedHours: { type: "number" },
                    files: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          path: { type: "string" },
                          action: { type: "string", enum: ["create", "modify", "delete"] },
                          description: { type: "string" }
                        },
                        required: ["path", "action", "description"]
                      }
                    },
                    steps: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          description: { type: "string" },
                          details: { type: "string" },
                          order: { type: "number" }
                        },
                        required: ["id", "description", "order"]
                      }
                    },
                    dependencies: {
                      type: "array",
                      items: { type: "string" }
                    }
                  },
                  required: ["id", "title", "description", "category", "estimatedHours", "files", "steps"]
                }
              },
              estimatedHours: { type: "number" },
              filesAffected: { type: "number" }
            },
            required: ["title", "phases", "estimatedHours", "filesAffected"]
          },
        },
        contents: userPrompt,
      });

      const rawJson = response.text;
      
      if (!rawJson) {
        throw new Error("Empty response from Gemini API");
      }

      const geminiResponse: GeminiPlanResponse = JSON.parse(rawJson);

      const phases: Phase[] = geminiResponse.phases.map(phase => ({
        ...phase,
        files: phase.files as FileModification[],
        steps: phase.steps as Step[]
      }));

      const plan: Plan = {
        id: this.generateId(),
        title: geminiResponse.title,
        objective: request.objective,
        phases: phases,
        estimatedHours: geminiResponse.estimatedHours,
        filesAffected: geminiResponse.filesAffected,
        status: "draft",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return plan;

    } catch (error) {
      console.error("Gemini API Error:", error);
      
      if (error instanceof Error) {
        throw new Error(`Failed to generate implementation plan: ${error.message}`);
      }
      
      throw new Error("Failed to generate implementation plan: Unknown error occurred");
    }
  }

  async exportPlanForAgent(plan: Plan, format: string): Promise<ExportFormat> {
    if (!this.ai) {
      throw new Error('Gemini API key not configured. Please set planpilot.geminiApiKey in settings or GEMINI_API_KEY environment variable.');
    }

    try {
      const systemPrompt = `You are an expert at converting implementation plans into formats optimized for different AI coding assistants.

Guidelines for each format:

CURSOR:
- Create structured prompts with clear context and instructions
- Include file paths and specific implementation details
- Use markdown formatting for better readability
- Break down into sequential tasks
- Include error handling and edge cases

CLAUDE:
- Provide comprehensive context and background
- Use detailed explanations and reasoning
- Include code examples and implementation patterns
- Structure as conversational prompts
- Focus on architectural decisions and trade-offs

WINDSURF:
- Optimize for IDE integration workflows
- Include specific file creation and modification instructions
- Use structured task lists
- Focus on practical implementation steps
- Include testing and validation steps

GENERIC:
- Create a universal format that works with most AI assistants
- Balance detail with clarity
- Include all necessary context
- Use standard markdown formatting

Current format requested: ${format.toUpperCase()}

Plan Details:
- Title: ${plan.title}
- Objective: ${plan.objective}
- Phases: ${plan.phases?.length || 0}
- Estimated Hours: ${plan.estimatedHours || 'Not specified'}
- Files Affected: ${plan.filesAffected || 'Not specified'}

Transform this plan into an optimized prompt for the ${format} coding assistant.`;

      const planContent = JSON.stringify({
        title: plan.title,
        objective: plan.objective,
        phases: plan.phases?.map(phase => ({
          title: phase.title,
          description: phase.description,
          category: phase.category,
          estimatedHours: phase.estimatedHours,
          files: phase.files,
          steps: phase.steps,
          dependencies: phase.dependencies
        })) || []
      }, null, 2);

      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: systemPrompt,
        },
        contents: `Plan to export:\n\n${planContent}\n\nPlease format this implementation plan for the ${format} coding assistant, optimizing for their specific strengths and workflow patterns.`,
      });

      const content = response.text;
      
      if (!content) {
        throw new Error("Empty response from Gemini API during export");
      }

      return {
        format: format as 'cursor' | 'claude' | 'windsurf' | 'generic',
        content: content
      };

    } catch (error) {
      console.error("Export Error:", error);
      
      if (error instanceof Error) {
        throw new Error(`Failed to export plan for ${format}: ${error.message}`);
      }
      
      throw new Error(`Failed to export plan for ${format}: Unknown error occurred`);
    }
  }

  private getWorkspaceContext(): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return '- No workspace folder open';
    }

    const workspaceFolder = workspaceFolders[0];
    return `- Workspace: ${workspaceFolder.name}
- Path: ${workspaceFolder.uri.fsPath}`;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}
