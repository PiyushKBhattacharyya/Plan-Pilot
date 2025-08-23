# PlanPilot - VSCode Extension

## Overview

PlanPilot is a VSCode extension that acts as a "planning layer" for development projects. It integrates with Google's Gemini AI to transform development objectives into structured, actionable implementation plans. The extension provides a sidebar interface where developers can input their goals and receive detailed project breakdowns with phases, file modifications, and step-by-step implementation guidance. Plans can be exported in various formats compatible with different AI coding assistants.

---

## User Preferences

Preferred communication style: Simple, everyday language.

---

## Demo
![Demo](assets/demo_fast.gif)
> Demo Video running at 2x Speed
---

## System Architecture

### Extension Architecture
The project follows VSCode's standard extension architecture with TypeScript as the primary language. The main entry point is `extension.ts` which initializes all services and registers commands and providers with the VSCode API.

### Core Components

**Service Layer**
- `GeminiService`: Handles integration with Google's Gemini AI API for plan generation
- `PlanStorage`: Manages persistence of plans using VSCode's global state storage
- Uses dependency injection pattern for service management

**UI Components**
- `PlanPilotWebviewProvider`: Creates and manages the sidebar webview interface
- `PlanProvider`: Implements VSCode's TreeDataProvider for displaying plans in tree view
- Custom HTML/CSS/JavaScript for the webview interface with VSCode theming integration

**Data Models**
- Strongly typed interfaces for Plan, Phase, Step, and FileModification entities
- Clear separation between request/response models and internal data structures
- Support for plan status tracking (draft, in_progress, completed)

### State Management
- Plans are stored locally using VSCode's globalState API
- In-memory service instances maintain application state during extension lifecycle
- Event-driven updates between webview and tree view components

### Plan Generation Workflow
1. User inputs development objective and optional context (files, tech stack)
2. Context is analyzed and sent to Gemini AI with structured prompts
3. AI response is parsed into structured Plan objects with phases and steps
4. Plans are stored locally and displayed in both sidebar and tree view
5. Plans can be exported to formats compatible with various AI coding assistants

---

## External Dependencies

**AI Integration**
- `@google/genai`: Google Gemini AI SDK for plan generation and natural language processing
- Requires API key configuration (supports environment variables and VSCode settings)

**Development Dependencies**
- `@types/vscode`: TypeScript definitions for VSCode extension API
- `@types/node`: Node.js type definitions for backend functionality

**VSCode Platform**
- Built on VSCode Extension API for UI components, commands, and storage
- Uses webview API for custom sidebar interface
- Integrates with VSCode's theming and settings system

**File System Integration**
- Direct integration with VSCode workspace for file analysis and context detection
- No external database dependencies - uses VSCode's built-in storage mechanisms