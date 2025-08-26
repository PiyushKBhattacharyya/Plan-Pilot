import * as vscode from 'vscode';
import { GoogleGenAI } from "@google/genai";

interface ProjectAnalysis {
  projectDescription: string;
  techStack: string[];
  architecture: string;
  existingFeatures: string[];
  codeQuality: string;
  recommendations: string[];
  keyFiles: string[];
}

interface FileAnalysis {
  path: string;
  type: 'config' | 'source' | 'test' | 'documentation' | 'build' | 'unknown';
  importance: 'high' | 'medium' | 'low';
  description: string;
  technologies: string[];
}

// Fixed interface to match all usage patterns
interface WorkspaceContext {
  projectDescription: string;
  techStack?: string[];
  existingFiles?: string[];
  architecture?: string;
  existingFeatures?: string[];
  codeQuality?: string;
  recommendations?: string[];
  userNotes?: string;
  keyFiles?: string[];
  fileContents?: {[key: string]: string};
}

export class ContextAnalyzer {
  private ai: GoogleGenAI | null = null;

  constructor() {
    this.initializeApi();
  }

  private initializeApi() {
    const config = vscode.workspace.getConfiguration('planpilot');
    let apiKey = config.get<string>('geminiApiKey');
    
    if (!apiKey) {
      apiKey = process.env.GEMINI_API_KEY || "";
    }
      
    // Only initialize if we have a valid, non-empty API key
    if (apiKey && apiKey.trim().length > 0) {
      try {
        this.ai = new GoogleGenAI({ apiKey });
      } catch (error) {
        console.error('Failed to initialize GoogleGenAI:', error);
        this.ai = null;
      }
    } else {
      this.ai = null;
    }
  }

  async analyzeWorkspaceContext(): Promise<ProjectAnalysis | null> {
    if (!this.ai) {
      return this.getFallbackContext();
    }

    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return null;
      }

      const workspaceFolder = workspaceFolders[0];
      const files = await this.scanWorkspaceFiles(workspaceFolder.uri);
      const fileAnalyses = await this.analyzeFiles(files.slice(0, 20));
      
      const analysisPrompt = this.buildAnalysisPrompt(workspaceFolder.name, fileAnalyses);
      
      const response = await this.ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              projectDescription: { type: "string" },
              techStack: {
                type: "array",
                items: { type: "string" }
              },
              architecture: { type: "string" },
              existingFeatures: {
                type: "array",
                items: { type: "string" }
              },
              codeQuality: { type: "string" },
              recommendations: {
                type: "array",
                items: { type: "string" }
              },
              keyFiles: {
                type: "array",
                items: { type: "string" }
              }
            },
            required: ["projectDescription", "techStack", "architecture", "existingFeatures", "codeQuality", "recommendations", "keyFiles"]
          }
        },
        contents: analysisPrompt
      });

      // Safe JSON parsing with proper error handling
      let analysisResult: ProjectAnalysis;
      try {
        // Check if response and response.text exist
        if (!response?.text) {
          throw new Error('No response text received from Gemini API');
        }

        const responseText = typeof response.text === 'string' ? response.text : String(response.text);
        analysisResult = JSON.parse(responseText) as ProjectAnalysis;
        
        // Validate that we got the expected structure
        if (!analysisResult.projectDescription || !analysisResult.techStack) {
          throw new Error('Invalid response structure from Gemini API');
        }
        
      } catch (parseError) {
        console.error('Error parsing Gemini API response:', parseError);
        console.log('Raw response:', response);
        return this.getFallbackContext();
      }

      return analysisResult;

    } catch (error) {
      console.error('Error analyzing workspace context:', error);
      return this.getFallbackContext();
    }
  }

  async analyzeFiles(files: string[]): Promise<FileAnalysis[]> {
    if (!this.ai || files.length === 0) {
      return [];
    }

    try {
      const fileContents = await this.getFileContents(files);
      
      const prompt = `Analyze these project files and categorize them. For each file, determine:
      1. Type (config, source, test, documentation, build, unknown)
      2. Importance level (high, medium, low)
      3. Brief description of what it does
      4. Technologies/frameworks it relates to

      Files to analyze:
      ${fileContents.map(fc => `
      File: ${fc.path}
      Content (first 500 chars): ${fc.content.substring(0, 500)}
      `).join('\n')}

      Respond in JSON format with array of file analyses.`;

      const response = await this.ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              files: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    path: { type: "string" },
                    type: { 
                      type: "string", 
                      enum: ["config", "source", "test", "documentation", "build", "unknown"] 
                    },
                    importance: { 
                      type: "string", 
                      enum: ["high", "medium", "low"] 
                    },
                    description: { type: "string" },
                    technologies: {
                      type: "array",
                      items: { type: "string" }
                    }
                  },
                  required: ["path", "type", "importance", "description", "technologies"]
                }
              }
            },
            required: ["files"]
          }
        },
        contents: prompt
      });

      // Safe JSON parsing
      try {
        if (!response?.text) {
          throw new Error('No response text received from Gemini API');
        }

        const responseText = typeof response.text === 'string' ? response.text : String(response.text);
        const result = JSON.parse(responseText);
        
        if (!result.files || !Array.isArray(result.files)) {
          throw new Error('Invalid file analysis response structure');
        }
        
        return result.files as FileAnalysis[];

      } catch (parseError) {
        console.error('Error parsing file analysis response:', parseError);
        console.log('Raw response:', response);
        return [];
      }

    } catch (error) {
      console.error('Error analyzing files:', error);
      return [];
    }
  }

  private async scanWorkspaceFiles(workspaceUri: vscode.Uri): Promise<string[]> {
    const files: string[] = [];
    const excludePatterns = [
      'node_modules', '.git', 'dist', 'build', 'out', '.vscode',
      'coverage', '.next', '.nuxt', 'vendor', 'target', 'bin', 'obj'
    ];
    
    async function scanDirectory(dirUri: vscode.Uri, relativePath: string = '', depth: number = 0) {
      if (depth > 3) return;
      
      try {
        const entries = await vscode.workspace.fs.readDirectory(dirUri);
        
        for (const [name, type] of entries) {
          const currentPath = relativePath ? `${relativePath}/${name}` : name;
          
          if (excludePatterns.some(pattern => currentPath.includes(pattern))) {
            continue;
          }
          
          if (type === vscode.FileType.File) {
            if (name.match(/\.(js|ts|jsx|tsx|py|java|cpp|h|cs|php|rb|go|rs|kt|swift|vue|svelte|html|css|scss|sass|less|json|xml|yaml|yml|md|txt|sql|sh|bat|dockerfile|gitignore|lock|toml|ini|cfg|conf|env)$/i) ||
                name.match(/^(package|composer|cargo|go|pom|build|requirements|gemfile|dockerfile|makefile|readme|license|changelog)(\.(json|xml|toml|txt|md|lock|yml|yaml))?$/i)) {
              files.push(currentPath);
            }
          } else if (type === vscode.FileType.Directory && files.length < 50) {
            await scanDirectory(vscode.Uri.joinPath(dirUri, name), currentPath, depth + 1);
          }
        }
      } catch (error) {
        // Ignore errors for directories we can't read
      }
    }

    await scanDirectory(workspaceUri);
    return files.slice(0, 50);
  }

  private async getFileContents(filePaths: string[]): Promise<{path: string, content: string}[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return [];

    const workspaceRoot = workspaceFolders[0].uri;
    const fileContents: {path: string, content: string}[] = [];

    for (const filePath of filePaths.slice(0, 15)) {
      try {
        const fileUri = vscode.Uri.joinPath(workspaceRoot, filePath);
        const content = await vscode.workspace.fs.readFile(fileUri);
        const textContent = Buffer.from(content).toString('utf8');
        
        fileContents.push({
          path: filePath,
          content: textContent.substring(0, 2000)
        });
      } catch (error) {
        // Skip files we can't read
      }
    }

    return fileContents;
  }

  private buildAnalysisPrompt(workspaceName: string, fileAnalyses: FileAnalysis[]): string {
    const filesSummary = fileAnalyses.map(f => 
      `${f.path}: ${f.type} file (${f.importance} importance) - ${f.description}`
    ).join('\n');

    return `Analyze this software project and provide comprehensive context:

    Project Name: ${workspaceName}
    
    Key Files Identified:
    ${filesSummary}
    
    Technologies Found: ${[...new Set(fileAnalyses.flatMap(f => f.technologies))].join(', ')}
    
    Please provide:
    1. A clear project description explaining what this application does
    2. Complete technology stack (frameworks, languages, databases, tools)
    3. Architecture pattern (MVC, microservices, monolith, etc.)
    4. Existing features based on the codebase
    5. Code quality assessment
    6. Development recommendations
    7. Most important files for understanding the project
    
    Base your analysis on the actual files and code structure, not assumptions.`;
  }

  private getFallbackContext(): ProjectAnalysis {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const workspaceName = workspaceFolders ? workspaceFolders[0].name : 'Unknown Project';
    
    return {
      projectDescription: `${workspaceName} - Analysis unavailable (Gemini API not configured)`,
      techStack: ['Unable to detect - please configure Gemini API key'],
      architecture: 'Unknown',
      existingFeatures: ['Analysis requires Gemini API configuration'],
      codeQuality: 'Cannot assess without API access',
      recommendations: ['Configure Gemini API key for detailed analysis'],
      keyFiles: []
    };
  }
}

export async function getWorkspaceContext(): Promise<WorkspaceContext> {
  const analyzer = new ContextAnalyzer();
  const analysis = await analyzer.analyzeWorkspaceContext();
  
  if (!analysis) {
    return {
      projectDescription: 'No workspace folder open',
      techStack: undefined,
      existingFiles: undefined,
      architecture: undefined,
      existingFeatures: undefined,
      codeQuality: undefined,
      recommendations: undefined
    };
  }

  return {
    projectDescription: analysis.projectDescription,
    techStack: analysis.techStack,
    existingFiles: analysis.keyFiles,
    architecture: analysis.architecture,
    existingFeatures: analysis.existingFeatures,
    codeQuality: analysis.codeQuality,
    recommendations: analysis.recommendations
  };
}