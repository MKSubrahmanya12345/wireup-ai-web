# Wireup.ai — Full Deep Context v2  
Implementation-aligned context based on the current codebase decisions you provided.

This should now be treated as the working technical/product context for cleanup, bug fixing, and future feature development.

---

# 1. Core Product Identity

`wireup.ai` is a browser-based electronics and hardware emulation platform.

The goal is not merely to draw circuits or mock UI behavior. The goal is to emulate hardware systems through the model:

```text
Inputs → User Firmware / Logic → Outputs
```

This means:

- Physical components are represented as interactive browser-native components.
- User firmware acts as the logic router.
- Browser APIs realize hardware outputs:
  - GPIO state → LEDs, motors, displays
  - PWM/tone → Web Audio
  - I2C/SPI display buffers → Canvas
  - SD card reads/writes → browser/local virtual filesystem
  - WiFi/Bluetooth/Serial behavior → sandboxed browser/server abstractions

The platform supports two major emulation families:

1. **Arduino / AVR / 8-bit MCU family**
   - Uses low-level binary execution.
   - Firmware compiles to HEX using backend `arduino-cli`.
   - HEX is executed inside the browser via `avr8js`.

2. **ESP32 / ARM / higher-level board family**
   - Uses behavior simulation.
   - Firmware and project intent are analyzed.
   - Runtime behavior is represented by structured logic rules evaluated against a shared GPIO bus.

---

# 2. Current Architecture Overview

The current architecture is hybrid and split across backend and frontend simulation layers.

```text
Frontend UI
  ├── Project/workspace UI
  ├── Monaco editor
  ├── 3D hardware view
  ├── 2D behavior dashboard
  ├── Web Worker for AVR CPU
  └── Browser-side LogicEngine

Backend API
  ├── Project/session persistence
  ├── MongoDB/Mongoose models
  ├── Socket.io streaming events
  ├── Arduino compile API
  ├── Simulation bundle compiler
  ├── Sketch analyzer
  └── Local filesystem export sync

Simulation Core
  ├── AVR mode:
  │     .ino → backend arduino-cli → HEX → frontend avr8js worker
  │
  └── Behavior mode:
        project/session/sketch → SimulationCompiler/SketchAnalyzer
        → LogicRule bundle → frontend LogicEngine → GPIOBus updates
```

---

# 3. Execution Model

## 3.1 Hardware Mode: Arduino / AVR / avr8js

This mode is used for boards such as:

- Arduino Uno
- Arduino Nano
- Arduino Mega
- Other compatible 8-bit AVR boards

### Flow

```text
User edits sketch.ino
        ↓
Frontend sends POST /api/compile
        ↓
Backend writes temporary sketch workspace
        ↓
Backend invokes arduino-cli
        ↓
arduino-cli produces Intel HEX
        ↓
Backend returns HEX to frontend
        ↓
Frontend sends HEX to cpu.worker.ts
        ↓
avr8js executes compiled firmware
        ↓
GPIO/register writes drive visual hardware components
```

### Key implementation points

- Compilation is **backend-driven**, not browser-WASM.
- This avoids shipping/running a heavy Go-based `arduino-cli` binary in the browser.
- The frontend does not compile AVR firmware itself.
- The frontend only:
  - Sends source code to backend.
  - Receives compiled HEX.
  - Runs the HEX in `avr8js`.
- The actual CPU loop runs in a browser worker, likely `cpu.worker.ts`, to avoid blocking the UI.

### Important backend component

```text
backend/src/routes/compile.route.ts
```

The `/api/compile` endpoint handles compile requests.

### Important compile service

```text
wokwi-local.service.ts
```

Contains `compileWokwiSketch`, which:

- Creates temporary compile workspace.
- Writes `sketch.ino`.
- Runs local `arduino-cli`.
- Reads output HEX.
- Returns HEX to frontend.

---

## 3.2 Behavior Mode: ESP32 / ARM / High-Level Simulation

This mode is used for boards such as:

- ESP32
- ESP8266
- Raspberry Pi Pico
- Other ARM/high-level boards where full cycle-accurate emulation is not currently practical

The system does **not** attempt to emulate Xtensa/ARM CPU instructions cycle-by-cycle.

Instead, it models behavior as:

```text
Inputs / Sensors / Protocol Events
        ↓
LogicRule evaluation
        ↓
GPIOBus mutations
        ↓
Browser-rendered outputs
```

### Important distinction

ESP32 behavior mode is not arbitrary C++ execution.

It is a hybrid of:

1. **Static sketch analysis**
2. **Protocol/use-case extraction**
3. **Generated or user-defined structured logic rules**
4. **Browser-side rule evaluation**

---

# 4. Behavior Simulation Architecture

## 4.1 Backend Simulation Compiler

Important file:

```text
backend/src/simulation/SimulationCompiler.ts
```

Responsibilities:

- Build a behavior simulation bundle.
- Analyze the sketch/project/session.
- Generate or include `LogicRule` definitions.
- Produce fallback rules if custom rules are missing.
- Package enough simulation metadata for the frontend runtime.

### Fallback rule behavior

If a session does not contain custom logic rules, the backend compiler can generate fallback/direct-mapping rules.

Example conceptual fallback:

```text
potentiometer analog value > threshold
        ↓
set LED pin HIGH
```

or:

```text
slider sensor value
        ↓
map to PWM duty cycle
        ↓
drive motor/LED/servo output
```

This ensures behavior mode still works even before a perfect C++ transpilation layer exists.

---

## 4.2 Sketch Analyzer

Important file:

```text
backend/src/simulation/SketchAnalyzer.ts
```

Responsibilities:

- Perform static text analysis on the sketch.
- Detect protocol and platform patterns such as:
  - Serial usage
  - Bluetooth usage
  - WiFi endpoints
  - HTTP routes like `GET /status`
  - Potential component interactions
- Extract high-level intent from firmware.

This is intentionally not a full deterministic C++ compiler/transpiler.

The current approach is pragmatic:

```text
C++ source text
    → pattern/static analyzer
    → detected capabilities/protocols
    → simulation metadata
    → rules/runtime behavior
```

---

## 4.3 Frontend Logic Engine

Important file:

```text
virtual-playground/frontend/src/simulation/behavior/LogicEngine.ts
```

Responsibilities:

- Receive a set of logic rules from the backend simulation bundle.
- Evaluate those rules against current runtime state.
- Read inputs from the behavior simulation GPIO bus/state.
- Write outputs back to the bus.
- Trigger visual/audio/browser-native effects indirectly through bus state changes.

Conceptual runtime loop:

```text
for each simulation tick:
    read current GPIOBus/input state
    evaluate active LogicRules
    apply matching actions
    publish updated output states
    UI/renderers observe state and update visuals/audio
```

---

# 5. LogicRule Concept

A `LogicRule` represents behavior in a deterministic, serializable form.

Conceptually:

```ts
interface LogicRule {
  id: string;
  trigger: RuleTrigger;
  condition?: RuleCondition;
  actions: RuleAction[];
  enabled?: boolean;
  priority?: number;
}
```

Example:

```json
{
  "id": "pot_controls_led",
  "trigger": {
    "type": "input_change",
    "source": "potentiometer_1.value"
  },
  "condition": {
    "type": "gt",
    "left": "potentiometer_1.value",
    "right": 512
  },
  "actions": [
    {
      "type": "digital_write",
      "target": "esp32.GPIO2",
      "value": 1
    }
  ]
}
```

The exact schema should follow whatever currently exists in `LogicEngine.ts` and `SimulationCompiler.ts`.

Important rule categories likely needed:

- Timer-based rules
- Pin-change rules
- Sensor-value rules
- Digital write actions
- Analog/PWM write actions
- Display buffer update actions
- Serial/message actions
- HTTP/WiFi request/response actions
- File/SD card read/write actions

---

# 6. GPIOBus Concept

The GPIOBus is the central runtime state model for simulated electronics.

It acts as the shared boundary between:

```text
Inputs/components
Firmware/rules
Outputs/renderers
```

In AVR mode, GPIO is driven by CPU/register emulation.

In behavior mode, GPIO is driven by `LogicEngine` rule evaluation.

Conceptual GPIOBus shape:

```ts
interface GPIOBus {
  pins: Record<string, PinState>;
  timestamp: number;
  protocols?: {
    i2c?: unknown;
    spi?: unknown;
    uart?: unknown;
  };
}
```

Conceptual pin state:

```ts
interface PinState {
  mode: 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP' | 'ANALOG' | 'PWM' | 'PROTOCOL';
  digitalValue?: 0 | 1;
  analogValue?: number;
  pwmDutyCycle?: number;
  frequency?: number;
  metadata?: Record<string, unknown>;
}
```

The core invariant:

```text
Components do not directly control each other.
Components read/write shared bus state.
```

This keeps simulation modular and allows new components to be added without tightly coupling component implementations.

---

# 7. Component Interaction Model

## 7.1 Inputs

Inputs represent physical or environmental interaction.

Examples:

- Push button
- Toggle switch
- Potentiometer
- Slider
- Temperature sensor
- Ultrasonic sensor
- Light sensor
- Touch sensor
- File upload for SD card
- WiFi/API request trigger
- Serial input text field
- Bluetooth message input

Input components write values into the bus or simulation runtime state.

Example:

```text
User moves potentiometer slider
        ↓
potentiometer analog state updates
        ↓
GPIOBus analog value changes
        ↓
firmware/rules observe the change
```

---

## 7.2 Code / Logic

The user’s code remains central.

In hardware mode:

```text
User C++/Arduino code → compiled HEX → avr8js execution
```

In behavior mode:

```text
User C++/project intent → static analysis + rule bundle → LogicEngine execution
```

The code is always treated as the source of behavior, but the implementation route differs depending on board family.

---

## 7.3 Outputs

Outputs are browser-native realizations of electrical behavior.

Examples:

### LEDs

```text
GPIO digital HIGH/LOW or PWM duty
        ↓
LED visual state/glow/color
```

### Buzzers

```text
PWM frequency/tone state
        ↓
Web Audio oscillator
        ↓
Laptop speakers
```

### OLED / LCD Displays

```text
I2C/SPI/display buffer state
        ↓
Canvas renderer
        ↓
Pixel/character display
```

### Servo

```text
PWM pulse width
        ↓
angle calculation
        ↓
visual rotation
```

### SD Card

```text
Firmware/logic opens file
        ↓
virtual FAT/filesystem layer
        ↓
browser upload/download/local file abstraction
```

### WiFi / HTTP

```text
Firmware declares/connects endpoint
        ↓
SketchAnalyzer detects server/client behavior
        ↓
behavior runtime exposes route/action
        ↓
browser/server sandbox simulates response/request
```

---

# 8. Persistence and Project State

## 8.1 Primary persistence

The app uses MongoDB through Mongoose schemas.

Important schemas/entities:

```text
Project
NewFlowSession
```

Persisted project/session data includes:

- Project configuration
- BOM
- Wiring
- Milestones
- Sketch files
- Generated files
- Simulation metadata
- Possibly agent outputs and formulation progress

## 8.2 Authentication

The API uses session-based authentication.

Frontend requests use:

```ts
withCredentials: true
```

So cookie/session identity matters for API calls.

## 8.3 Local filesystem mirroring

Backend mirrors project/session state to disk for debugging, local tooling, and backup.

Path pattern:

```text
E:\wireup_formulation_exports\session_<id>\
```

Important utility:

```text
syncSessionToDisk
```

This mirror is not merely incidental. It affects downstream build/simulation flows, so editor saving and agent updates must keep it consistent.

---

# 9. Real-Time Streaming

The platform is single-user for v1, but uses real-time streaming from the backend to the frontend.

Technology:

```text
Socket.io
```

Rooms are mapped by:

```text
sessionId
```

Important event examples:

```text
agent2:bom_update
agent2:final_sketch_update
```

Purpose:

- Push formulation progress.
- Update BOM in real time.
- Update generated sketch/files.
- Notify UI when the background agent pipeline completes major steps.

Important constraint:

```text
This is not multiplayer collaboration.
```

It is real-time single-session event streaming.

---

# 10. UI Modes

## 10.1 Hardware Mode UI

For Arduino/AVR simulations.

Uses:

- 3D component view
- Three.js or equivalent visual layer
- Real wire traces
- Physical-ish layout
- avr8js CPU-backed output behavior

Purpose:

```text
Show hardware layout and realistic component interaction.
```

## 10.2 Behavior Mode UI

For ESP32/ARM behavior simulations.

Uses:

- 2D dashboard
- Sliders
- Buttons
- LED overlays
- Canvas displays
- Serial/WiFi/Bluetooth panels
- Sensor controls

Purpose:

```text
Expose high-level interactive system behavior without requiring full CPU emulation.
```

---

# 11. Immediate Cleanup Phase

The current architecture is acceptable, but there are critical state lifecycle bugs to fix before expanding features.

The cleanup phase should prioritize:

1. Preventing unnecessary formulation restarts.
2. Fixing editor hydration and refresh.
3. Synchronizing saves across Project, NewFlowSession, and disk mirror.
4. Keeping socket-driven updates consistent with the editor and persisted state.

---

## 11.1 Bug: Formulation Loop on Page Load

### Problem

On page load, the frontend starts the formulation pipeline again via something like:

```ts
runPipeline()
```

even if the project/session is already fully formulated.

This causes:

- Duplicate agent work
- Re-generated BOM/sketch
- Possible overwrite of user edits
- Slow page loads
- Confusing UX
- Potential infinite or repeated formulation loop

### Desired behavior

On load:

```text
If session/project already has sketch.ino or completed milestones:
    hydrate from saved project/session
    do not run pipeline
else:
    start formulation pipeline
```

### Required detection

A project/session should be considered already formulated if at least one of these is true:

- `sketch.ino` exists in project files/session files
- Final sketch milestone exists
- Formulation status is complete
- Required generated files are present
- BOM and wiring are already available

This needs a single reliable `isFormulated` or equivalent guard.

---

## 11.2 Bug: Monaco Editor Does Not Refresh Properly

### Problem

The Monaco editor hook currently only syncs code when switching tabs.

If the backend socket pipeline finishes and writes generated files in the background, the editor may remain:

- Blank
- Stale
- Outdated
- Not reflecting `currentProject.files`

### Desired behavior

The editor must update when:

```text
currentProject.files changes
active file changes
socket receives final sketch update
session hydration completes
project refetch completes
```

### Likely fix

Ensure React hook dependencies include something equivalent to:

```ts
currentProject.files
currentProject.updatedAt
activeFilePath
```

But preserve unsaved user edits carefully.

### Important invariant

Do not overwrite local unsaved edits with socket updates unless intentionally confirmed or merged.

---

## 11.3 Bug: Editor Save Only Updates Project

### Problem

When user edits code in Monaco and saves, it writes to:

```text
Project.files
```

but does not update:

```text
NewFlowSession
filesystem export mirror
```

This breaks downstream compile/simulation flows that depend on session or disk state.

### Desired behavior

A save should atomically update:

```text
Project.files
NewFlowSession files/sketch state
E:\wireup_formulation_exports\session_<id>\
```

or call a backend endpoint that centralizes this synchronization.

### Recommended design

Create or enforce a single backend write path:

```text
POST /api/projects/:projectId/files/save
```

or:

```text
POST /api/sessions/:sessionId/files/save
```

That endpoint should:

1. Validate auth/session ownership.
2. Update `Project.files`.
3. Update `NewFlowSession`.
4. Call `syncSessionToDisk`.
5. Return the canonical updated project/session state.
6. Emit a socket event if necessary.

Avoid frontend writing one state but not the others.

---

# 12. Source-of-Truth Rules

This is important for future work.

## 12.1 Runtime source of truth

During active simulation:

```text
GPIOBus/runtime state is the source of truth for current electrical behavior.
```

## 12.2 Persisted project source of truth

For saved project files and metadata:

```text
MongoDB should be canonical.
```

The local filesystem export should be considered a synchronized mirror, not the primary database.

## 12.3 Generated formulation source of truth

For agent-generated outputs:

```text
NewFlowSession likely owns formulation pipeline state.
Project owns user-facing durable project state.
```

But this needs to be finalized explicitly.

## 12.4 Editor source of truth

While the user is typing:

```text
Monaco local editor buffer is temporarily authoritative.
```

On save:

```text
Backend returns canonical saved files.
Frontend hydrates from backend response.
```

---

# 13. Recommended Cleanup Implementation Plan

## Phase 1: State Hydration Guard

Add a reliable check before running formulation.

Pseudo-flow:

```ts
useEffect(() => {
  if (!sessionLoaded) return;

  if (isFormulated(session, project)) {
    hydrateProjectFromSessionOrProject();
    return;
  }

  if (!pipelineAlreadyRunning) {
    runPipeline();
  }
}, [sessionLoaded, projectId, sessionId]);
```

Create a shared helper:

```ts
function isProjectFormulated(project, session): boolean {
  return Boolean(
    hasSketchFile(project) ||
    hasSketchFile(session) ||
    hasCompletedMilestone(session, 'final_sketch') ||
    session?.status === 'complete'
  );
}
```

---

## Phase 2: Editor Hydration Fix

Ensure Monaco file state responds to project updates.

Pseudo-flow:

```ts
useEffect(() => {
  if (!currentProject?.files) return;
  if (hasUnsavedChanges) return;

  syncEditorFiles(currentProject.files);
}, [currentProject.files, currentProject.updatedAt]);
```

Need special care:

- If the user has unsaved edits, do not blindly overwrite.
- If the file was generated while user has no edits, update the editor immediately.
- If socket update conflicts with local changes, show a “new version available” state.

---

## Phase 3: Centralized Save Endpoint

Create one canonical backend path for file saves.

Pseudo-flow:

```ts
async function saveFile(sessionId, projectId, filePath, content) {
  const updated = await backend.saveFile({
    sessionId,
    projectId,
    filePath,
    content
  });

  updateProjectState(updated.project);
  updateSessionState(updated.session);
}
```

Backend should:

```text
update Project
update NewFlowSession
syncSessionToDisk
emit socket update if needed
return canonical state
```

---

## Phase 4: Regression Tests / Smoke Tests

Minimum smoke tests:

### Existing formulated project load

```text
Given project has sketch.ino
When user opens project
Then runPipeline is not called
And editor shows sketch.ino
```

### Background final sketch update

```text
Given editor is open and has no unsaved edits
When socket receives agent2:final_sketch_update
Then currentProject.files updates
And Monaco displays updated sketch
```

### Save consistency

```text
Given user edits sketch.ino
When user clicks save
Then Project.files updates
And NewFlowSession updates
And disk export updates
And compile uses the edited content
```

### Unsaved conflict

```text
Given user has unsaved local edits
When socket sends final sketch update
Then Monaco does not overwrite local edits
And UI indicates remote update/conflict
```

---

# 14. Important Implementation Constraints

## Do not introduce full C++ transpilation yet

For ESP32 behavior mode, avoid committing to full deterministic C++ → JSON transpilation unless explicitly planned.

Current intended model:

```text
Static analyzer + generated rules + explicit behavior metadata
```

This is more realistic and maintainable.

---

## Do not run arduino-cli in browser

Compilation is backend-driven.

Avoid attempts to move `arduino-cli` into WASM/browser unless this becomes a future research goal.

---

## Do not treat Socket.io as multiplayer

Socket.io is for server-to-client async updates in v1.

Do not implement collaborative editing yet.

---

## Do not let disk mirror become silently stale

Any code path that modifies session/project files should either:

- Call `syncSessionToDisk`, or
- Go through a service that does.

---

# 15. Canonical Mental Model for Developers / Agents

If another AI agent or developer needs to work on this codebase, this is the short version:

```text
wireup.ai emulates electronics in the browser.

There are two simulation modes.

Arduino/AVR mode:
- Frontend sends .ino to backend.
- Backend compiles with local arduino-cli.
- Backend returns HEX.
- Frontend runs HEX in avr8js worker.
- GPIO/register output drives 3D hardware visuals.

ESP32/ARM behavior mode:
- Backend analyzes sketch/project/session.
- SimulationCompiler produces LogicRules and metadata.
- Frontend LogicEngine evaluates rules against GPIOBus.
- GPIOBus drives 2D dashboard components, displays, audio, and browser-native behaviors.

Projects are persisted in MongoDB using Project and NewFlowSession.
Backend mirrors sessions to E:\wireup_formulation_exports\session_<id>\.
Socket.io streams background agent updates to the active client.

Immediate cleanup focuses on:
1. Preventing formulated projects from re-running the formulation pipeline on page load.
2. Making Monaco update when project files change.
3. Making editor saves update Project, NewFlowSession, and disk export consistently.
```

---

# 16. Remaining Doubts to Clarify

The big architecture decisions are now clear. These are the remaining details I would still want clarified before writing precise patches.

## 1. Which model is the canonical write target: `Project` or `NewFlowSession`?

You said saves currently update `Project.files` but not `NewFlowSession` or disk.

For the fix, should the backend treat:

```text
Project as canonical, then copy to NewFlowSession
```

or:

```text
NewFlowSession as canonical during formulation, then copy to Project
```

or:

```text
A shared service updates both equally
```

My recommendation: use a shared service and return both updated records.

---

## 2. What exactly marks a session as “fully formulated”?

Should we check:

- `sketch.ino` exists?
- final sketch milestone exists?
- `session.status === "complete"`?
- BOM exists?
- wiring exists?
- all of the above?

We should define one helper and reuse it everywhere.

---

## 3. How should unsaved editor conflicts be handled?

If the user has unsaved edits and then `agent2:final_sketch_update` arrives, should we:

1. Ignore remote update?
2. Show “Remote update available”?
3. Auto-merge?
4. Overwrite local content?
5. Save user edits as a fork?

My recommendation for v1: do not overwrite. Show a remote update indicator.

---

## 4. Which endpoint should own file saving?

Do you already have an existing save endpoint we should extend, or should we create a new canonical one?

Possible ideal endpoint:

```http
POST /api/sessions/:sessionId/files
```

or:

```http
PUT /api/projects/:projectId/files/:path
```

Need to align with current route conventions.

---

## 5. Should `syncSessionToDisk` run synchronously or asynchronously?

For save operations, should the API response wait until disk sync completes?

Options:

- Synchronous: safer, compile sees latest files immediately.
- Async: faster UI, but possible race conditions.

My recommendation: synchronous for now, because compile/simulation correctness matters more than small latency.

---

## 6. In behavior mode, where are custom `LogicRule`s stored?

Are they stored inside:

- `Project`
- `NewFlowSession`
- generated simulation bundle only
- separate collection
- frontend-only state

This matters for persistence and re-opening a behavior simulation.

---

## 7. Should fallback rules be visible/editable to users?

When `SimulationCompiler.ts` generates fallback rules, should the UI expose them as editable automation logic, or are they internal only?

My recommendation: internal for now, but save them in the simulation bundle for debugging.

---

Once these 7 points are answered, the next step would be to produce a precise cleanup execution plan with file-level edits and patch order.