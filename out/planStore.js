"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanStore = void 0;
class PlanStore {
    constructor(state) {
        this.state = state;
    }
    async save(plan) {
        await this.state.update("planpilot.plan", plan);
    }
    load() {
        return this.state.get("planpilot.plan");
    }
}
exports.PlanStore = PlanStore;
//# sourceMappingURL=planStore.js.map