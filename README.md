# PlanPilot — Traycer AI Clone

PlanPilot is a **VS Code extension** that acts as a **planning layer on top of coding agents**, inspired by Traycer AI. It allows developers to **plan, visualize, and execute tasks** in a Kanban-style workflow, providing a simplified way to coordinate AI-assisted coding tasks.

---

## Features

- **Visual Planner:** Kanban-style board with columns for `To Do`, `In Progress`, and `Done`.
- **Dynamic Task Management:** Add, edit, delete, and move steps between columns.
- **Execution Simulation:** Execute individual steps or all steps sequentially, simulating agent behavior.
- **Suggested Next Steps:** AI-style recommendations for task planning.
- **Persistent Storage:** Plans are saved using VS Code’s workspace state.

---

## Demo

![PlanPilot Demo](./assets/demo.gif)  
*Click, drag, edit, and execute tasks easily.*

---

## Installation

1. Clone this repository:

```bash
git clone https://github.com/your-username/planpilot.git
cd planpilot
```
2. Install dependencies:
```bash
npm install
```
3. Compile TypeScript:
```bash
npm run compile
```
4. Open in VS Code and press `F5` to launch the extension in a new Extension Development Host window.

---

## Technologies

- TypeScript

- Node.js

- VS Code Extension API

- HTML/CSS/JS for Webview UI