"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanStore = void 0;
const KEY = "planpilot.plan";
class PlanStore {
    constructor(memento) {
        this.memento = memento;
    }
    load() {
        return this.memento.get(KEY);
    }
    save(plan) {
        return this.memento.update(KEY, plan);
    }
}
exports.PlanStore = PlanStore;
//# sourceMappingURL=planStore.js.map