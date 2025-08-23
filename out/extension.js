"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const gemini_1 = require("./gemini");
const storage_1 = require("./storage");
const planProvider_1 = require("./planProvider");
const webviewProvider_1 = require("./webviewProvider");
const commands_1 = require("./commands");
const welcomeManager_1 = require("./welcomeManager");
let geminiService;
let planStorage;
let planProvider;
let webviewProvider;
let commandManager;
function activate(context) {
    console.log('PlanPilot extension is now active!');
    // Initialize services
    geminiService = new gemini_1.GeminiService();
    planStorage = new storage_1.PlanStorage(context);
    planProvider = new planProvider_1.PlanProvider(planStorage);
    webviewProvider = new webviewProvider_1.PlanPilotWebviewProvider(context.extensionUri, geminiService, planStorage);
    // Initialize command manager
    commandManager = new commands_1.CommandManager(geminiService, planStorage, planProvider, webviewProvider);
    // Register webview view provider for sidebar
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(webviewProvider_1.PlanPilotWebviewProvider.viewType, webviewProvider));
    // Tree data provider removed - using webview provider instead
    // Register all commands
    commandManager.registerCommands(context);
    // Show welcome message on first activation
    welcomeManager_1.WelcomeManager.showWelcomeMessageIfNeeded(context);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map