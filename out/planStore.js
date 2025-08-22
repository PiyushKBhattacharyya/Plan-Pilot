"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanStore = void 0;
class PlanStore {
    constructor(workspaceState) {
        this.workspaceState = workspaceState;
        this.storageKey = "traycer.plan";
    }
    async save(plan) {
        await this.workspaceState.update(this.storageKey, plan ?? undefined);
    }
    load() {
        return this.workspaceState.get(this.storageKey);
    }
    async reset() {
        await this.workspaceState.update(this.storageKey, undefined);
    }
}
exports.PlanStore = PlanStore;
//# sourceMappingURL=planStore.js.map