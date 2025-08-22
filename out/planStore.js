"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanStore = void 0;
// PlanStore handles persistent storage of PlanPilot plans using VS Code's workspaceState.
class PlanStore {
    constructor(workspaceState) {
        this.workspaceState = workspaceState;
        this.storageKey = "planpilot.plan";
    }
    /**
      Saves the current plan to VS Code workspace state.
        - @param plan - Plan to save. If undefined, clears storage.
    */
    async save(plan) {
        await this.workspaceState.update(this.storageKey, plan ?? undefined);
    }
    /**
      Loads the current plan from VS Code workspace state.
        - @returns The saved Plan or undefined if none exists.
    */
    load() {
        return this.workspaceState.get(this.storageKey);
    }
    /**
      Resets/clears the current plan from storage.
    */
    async reset() {
        await this.workspaceState.update(this.storageKey, undefined);
    }
}
exports.PlanStore = PlanStore;
//# sourceMappingURL=planStore.js.map