import * as vscode from 'vscode';
import { Plan } from './types';

export class PlanStorage {
  private context: vscode.ExtensionContext;
  private readonly STORAGE_KEY = 'planpilot.plans';

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  async savePlan(plan: Plan): Promise<void> {
    const plans = await this.getPlans();
    const existingIndex = plans.findIndex(p => p.id === plan.id);
    
    if (existingIndex >= 0) {
      plans[existingIndex] = { ...plan, updatedAt: new Date() };
    } else {
      plans.push(plan);
    }

    await this.context.globalState.update(this.STORAGE_KEY, plans);
  }

  async getPlans(): Promise<Plan[]> {
    const plans = this.context.globalState.get<Plan[]>(this.STORAGE_KEY, []);
    return plans.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getPlan(id: string): Promise<Plan | undefined> {
    const plans = await this.getPlans();
    return plans.find(plan => plan.id === id);
  }

  async deletePlan(id: string): Promise<boolean> {
    const plans = await this.getPlans();
    const filteredPlans = plans.filter(plan => plan.id !== id);
    
    if (filteredPlans.length !== plans.length) {
      await this.context.globalState.update(this.STORAGE_KEY, filteredPlans);
      return true;
    }
    
    return false;
  }

  async clearAllPlans(): Promise<void> {
    await this.context.globalState.update(this.STORAGE_KEY, []);
  }
}
