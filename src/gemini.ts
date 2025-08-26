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

// Enhanced context interface to match all usage patterns
interface EnhancedContext {
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
      apiKey = process.env.GEMINI_API_KEY || "";
    }
      
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  public isConfigured(): boolean {
    return this.ai !== null;
  }

  async analyzeContent(prompt: string): Promise<string> {
    if (!this.ai) {
      throw new Error('Gemini API key not configured. Please set planpilot.geminiApiKey in settings or GEMINI_API_KEY environment variable.');
    }

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: prompt,
      });

      return response.text || '';
    } catch (error) {
      console.error("Gemini API Error in analyzeContent:", error);
      throw new Error(`Failed to analyze content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateImplementationPlan(request: PlanGenerationRequest): Promise<Plan> {
    if (!this.ai) {
      throw new Error('Gemini API key not configured. Please set planpilot.geminiApiKey in settings or GEMINI_API_KEY environment variable.');
    }

    try {
      const systemPrompt = this.buildEnhancedSystemPrompt(request.context);
      const userPrompt = this.buildEnhancedUserPrompt(request);

      const response = await this.ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
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

  private buildEnhancedSystemPrompt(context?: EnhancedContext): string {
    let systemPrompt = `You are an expert software architect and development planner. Your task is to analyze development objectives and create detailed, actionable implementation plans.`;

    if (context) {
      systemPrompt += `\n\nProject Context Analysis:`;
      
      if (context.projectDescription) {
        systemPrompt += `\n- Project: ${context.projectDescription}`;
      }
      
      if (context.techStack && context.techStack.length > 0) {
        systemPrompt += `\n- Technology Stack: ${context.techStack.join(', ')}`;
      }
      
      if (context.architecture) {
        systemPrompt += `\n- Architecture: ${context.architecture}`;
      }
      
      if (context.existingFeatures && context.existingFeatures.length > 0) {
        systemPrompt += `\n- Existing Features: ${context.existingFeatures.join(', ')}`;
      }
      
      if (context.codeQuality) {
        systemPrompt += `\n- Code Quality Assessment: ${context.codeQuality}`;
      }
      
      if (context.recommendations && context.recommendations.length > 0) {
        systemPrompt += `\n- Development Recommendations: ${context.recommendations.join('; ')}`;
      }

      if (context.fileContents && Object.keys(context.fileContents).length > 0) {
        systemPrompt += `\n\nKey File Contents for Reference:`;
        Object.entries(context.fileContents).forEach(([path, content]) => {
          systemPrompt += `\n\n${path}:\n${content.substring(0, 1000)}...`;
        });
      }
    }

    systemPrompt += `\n\nGuidelines:
1. Base your recommendations on the actual project context and existing codebase
2. Maintain consistency with the established architecture and patterns
3. Suggest realistic file modifications based on the existing project structure
4. Consider the current technology stack when proposing solutions
5. Break down the objective into logical, sequential phases
6. Each phase should have a clear title, description, and category
7. Provide realistic time estimates in hours
8. Specify exact files that need to be created, modified, or deleted
9. Include detailed step-by-step instructions for each phase
10. Consider dependencies between phases
11. Use appropriate categories based on the project type: Database, Backend, Frontend, API, Security, Features, Testing, DevOps, Configuration, etc.

Response Format:
- title: A concise title for the overall implementation plan
- phases: Array of implementation phases
- estimatedHours: Total estimated hours for the entire plan
- filesAffected: Total number of files that will be created/modified/deleted

Each phase must include:
- id: Unique identifier
- title: Phase name
- description: Brief description of what this phase accomplishes
- category: One of the appropriate categories for this project
- estimatedHours: Time estimate for this phase
- files: Array of file modifications with path, action, and description
- steps: Ordered array of implementation steps with descriptions and optional details
- dependencies: Optional array of phase IDs that must be completed first`;

    return systemPrompt;
  }

  private buildEnhancedUserPrompt(request: PlanGenerationRequest): string {
    let userPrompt = `Development Objective: ${request.objective}`;

    if (request.context) {
      if (request.context.userNotes) {
        userPrompt += `\n\nAdditional Requirements: ${request.context.userNotes}`;
      }

      if (request.context.keyFiles && request.context.keyFiles.length > 0) {
        userPrompt += `\n\nKey Files to Consider: ${request.context.keyFiles.join(', ')}`;
      }

      if (request.context.existingFiles && request.context.existingFiles.length > 0) {
        userPrompt += `\n\nSelected Files for Reference: ${request.context.existingFiles.join(', ')}`;
      }
    }

    userPrompt += `\n\nPlease create a comprehensive implementation plan that:
1. Leverages the existing project structure and patterns
2. Maintains compatibility with the current technology stack
3. Provides specific, actionable steps
4. Includes realistic time estimates
5. Considers the project's current state and architecture

Focus on practical implementation details that a developer can immediately act upon.`;

    return userPrompt;
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
        model: "gemini-2.0-flash-exp",
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

  async analyzeTechStack(fileContents: string[], filePaths: string[]): Promise<string[]> {
    if (!this.ai) {
      return [];
    }

    try {
      const prompt = `Analyze these project files to determine the complete technology stack:

Files analyzed:
${filePaths.map((path, index) => `
${path}:
${fileContents[index]?.substring(0, 800) || 'Unable to read content'}
`).join('\n')}

Identify:
1. Programming languages used
2. Frameworks and libraries
3. Databases and data storage
4. Build tools and package managers
5. Testing frameworks
6. Development tools and utilities
7. Deployment and infrastructure technologies

Return a comprehensive list of technologies, avoiding duplicates and being specific about versions where possible.`;

      const response = await this.ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: prompt
      });

      // Extract technologies from the response
      const technologies = this.extractTechnologiesFromResponse(response.text || '');
      return technologies;

    } catch (error) {
      console.error('Error analyzing tech stack:', error);
      return [];
    }
  }

  private extractTechnologiesFromResponse(response: string): string[] {
    const technologies = new Set<string>();
    
    // Common technology patterns
    const techPatterns = [
      /React(?:\s+\d+)?/gi,
      /Vue(?:\.js)?(?:\s+\d+)?/gi,
      /Angular(?:\s+\d+)?/gi,
      /Node\.js(?:\s+\d+)?/gi,
      /Express(?:\.js)?(?:\s+\d+)?/gi,
      /TypeScript(?:\s+\d+)?/gi,
      /JavaScript/gi,
      /Python(?:\s+\d+)?/gi,
      /Java(?:\s+\d+)?/gi,
      /MongoDB/gi,
      /PostgreSQL/gi,
      /MySQL/gi,
      /Redis/gi,
      /Docker/gi,
      /Kubernetes/gi,
      /AWS/gi,
      /Firebase/gi,
      /Webpack/gi,
      /Vite/gi,
      /Jest/gi,
      /Cypress/gi,
      /ESLint/gi,
      /Prettier/gi
    ];

    techPatterns.forEach(pattern => {
      const matches = response.match(pattern);
      if (matches) {
        matches.forEach(match => technologies.add(match.trim()));
      }
    });

    // Also look for bullet points or lists that mention technologies
    const lines = response.split('\n');
    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine.match(/^[-*•]\s+/)) {
        const tech = trimmedLine.replace(/^[-*•]\s+/, '').trim();
        if (tech.length > 2 && tech.length < 50) {
          technologies.add(tech);
        }
      }
    });

    return Array.from(technologies).slice(0, 20); // Limit results
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}