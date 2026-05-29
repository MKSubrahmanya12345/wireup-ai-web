# Codebase Documentation: Wireup.ai

This document serves as the absolute technical reference and architecture blueprint for the Wireup.ai hardware project builder application. It is designed to be read by developer agents to facilitate onboarding, feature extensions, and system verification.

---

## 1. Project Structure

```
wireup.ai - new/
├── backend/                             # Express + Node.js TypeScript Backend
│   ├── data/
│   │   └── componentRegistry.json       # Catalog of electronic components with pin capabilities
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── assembly.controller.ts   # Manages enclosure design and layout generation
│   │   │   ├── auth.controller.ts       # Coordinates user registration, login, and profile updates
│   │   │   ├── components.controller.ts # Manages BOM sourcing and interactive wiring node updates
│   │   │   ├── ideation.controller.ts   # Runs the dual-agent Interviewer/Validator chat flow
│   │   │   ├── library.controller.ts    # Component library queries (local & Nexar API)
│   │   │   ├── pipeline.controller.ts   # Enforces stage override/advancement requests
│   │   │   ├── project.controller.ts    # Main project CRUD operations and ideation history
│   │   │   ├── shopping.controller.ts   # Compiles the final shopping list and DIY suggestions
│   │   │   └── voice.controller.ts      # Integrates voice transcription and TTS output streams
│   │   ├── lib/
│   │   │   ├── arduino-boards.ts        # Board specifications (FQBN keys, definitions)
│   │   │   ├── binPacking.ts            # 2D bin packing layout algorithm
│   │   │   ├── componentDimensions.ts   # Hardcoded physical sizes (mm) of common parts
│   │   │   ├── db.ts                    # Handles Mongoose database connection setup
│   │   │   ├── svgLayout.ts             # Generates SVG enclosure cutting layouts
│   │   │   ├── utils.ts                 # Clean/strip thinking markdown helper scripts
│   │   │   ├── wokwi-components.ts      # Component type translations for Wokwi simulation
│   │   │   ├── wokwi-context.ts         # Pulls diagram.json files from public Wokwi links
│   │   │   ├── wokwi.ts                 # Simulation port and routing settings
│   │   │   └── wokwiDimensionKeyMap.ts  # Maps component identifiers to dimension categories
│   │   ├── middleware/
│   │   │   └── auth.middleware.ts       # JWT validation guard for secure routes
│   │   ├── models/
│   │   │   ├── part.model.ts            # Schema for electronic components (curated and custom)
│   │   │   ├── project.model.ts         # Monolithic Project state tracking and history schema
│   │   │   ├── systemConfig.model.ts    # Store keys and general configurations (API keys index)
│   │   │   └── user.model.ts            # User records (email, passwords, profiles)
│   │   ├── routes/
│   │   │   ├── assembly.route.ts        # Enclosure generation routes
│   │   │   ├── auth.route.ts            # Signup/login paths
│   │   │   ├── build.route.ts           # Compilation and simulation logs routes
│   │   │   ├── components.route.ts      # Sourcing and wiring endpoints
│   │   │   ├── ideation.route.ts        # AI interview and validate paths
│   │   │   ├── library.route.ts         # Parts searching endpoints
│   │   │   ├── pipeline.route.ts        # Project step transition paths
│   │   │   ├── project.routes.ts        # Project CRUD paths
│   │   │   ├── shopping.route.ts        # Shopping checklist endpoints
│   │   │   └── voice.route.ts           # Speech-to-text / Text-to-speech audio streams
│   │   ├── scripts/
│   │   │   ├── migrate-ideation.ts      # Updates old schema values to match new structures
│   │   │   ├── reproduce-500.ts         # Testing file for compiling validation
│   │   │   ├── seed-curated-parts.ts    # Initial catalog seeding script
│   │   │   └── test-chat-flow.ts        # Simulated chatbot test execution
│   │   ├── services/
│   │   │   ├── ai.services.ts           # Core prompt wrappers, JSON repair, and file generation
│   │   │   ├── assembly.service.ts      # Board-packing and layout calculator
│   │   │   ├── gemini.service.ts        # Orchestrates Gemini/Groq model prompts and configurations
│   │   │   ├── keyRotation.service.ts   # MongoDB-backed round-robin Groq API key rotation
│   │   │   ├── library.service.ts       # MongoDB text index query + Nexar Graph API fallback
│   │   │   ├── modelConversion.service.ts# Background SnapEDA to GLB CAD conversion worker
│   │   │   ├── pipeline.service.ts      # Enforces stage advancement, rollback, and invalidation
│   │   │   ├── registry.services.ts     # Component registry loader and AI capabilities builder
│   │   │   ├── shopping.service.ts      # Formats parts list costs and DIY "Jugaad" substitutes
│   │   │   ├── wokwi-local.service.ts   # Runs arduino-cli to compile sketch code locally
│   │   │   ├── wokwi-mcp-client.service.ts # Model Context Protocol (MCP) client for Wokwi
│   │   │   └── wokwi-runner.service.ts  # Runs linting, capture, and headless simulator runs
│   │   ├── utils/
│   │   │   ├── boardLock.ts             # Locks target microcontroller configurations
│   │   │   ├── bom.utils.ts             # Sourced component layout tools
│   │   │   ├── parseAIResponse.ts       # Parses markdown JSON responses
│   │   │   ├── validateDiagram.ts       # Structural checker for Wokwi diagram schemas
│   │   │   └── validateSketch.ts        # Code check constraints on .ino compiler files
│   │   └── index.ts                     # Main entry file (Express, Socket.IO, DB link)
│   ├── .env                             # Active backend credentials and model declarations
│   ├── package.json                     # Backend script executions and dependencies
│   └── tsconfig.json                    # Typescript compiler instructions
├── frontend/                            # React + TypeScript Frontend Application
│   ├── src/
│   │   ├── assets/                      # Styling icons and vector assets
│   │   ├── components/
│   │   │   ├── shared/
│   │   │   │   ├── ErrorBoundary.tsx    # Renders fallback display in case of component crashes
│   │   │   │   ├── ProjectLayout.tsx    # Left nav bar and step progression shell
│   │   │   │   └── StageNav.tsx         # Color-coded workflow navigation showing step statuses
│   │   │   ├── sim/
│   │   │   │   ├── Avr8jsRunner.ts      # Web-assembly client-side AVR emulator wrapper
│   │   │   │   ├── CodeEditor.tsx       # Basic text viewer for sketch.ino files
│   │   │   │   ├── ComponentLibrary.tsx # Slider modal listing hardware parts to add
│   │   │   │   ├── ComponentLibraryData.tsx# Definitions of parts for simulation canvas
│   │   │   │   ├── DiagramViewer.tsx    # Visualizer for wokwi connections
│   │   │   │   ├── LibraryManager.tsx   # Curates part lists for placement
│   │   │   │   ├── SerialMonitor.tsx    # Input/Output text log for target firmware serials
│   │   │   │   ├── SimCanvas.tsx        # Grid canvas for layout mapping
│   │   │   │   ├── SimulatorCard.tsx    # Panel representation for canvas objects
│   │   │   │   ├── SimulatorWorkspace.tsx# Core canvas schematic wiring logic and interactions
│   │   │   │   ├── WireOverlay.tsx      # Renders SVG connections between parts
│   │   │   │   ├── WirePreview.tsx      # SVG placeholder for active drawing wire
│   │   │   │   ├── diagramStorage.ts    # LocalStorage utilities for offline simulation caching
│   │   │   │   └── types.ts             # Simulator coordinate and wire types
│   │   │   ├── ui/
│   │   │   │   └── PromptInputDynamicGrow.tsx # Expandable voice and text prompt field
│   │   │   ├── ChatRichText.tsx         # Renders markdown and AI thoughts inside chat panels
│   │   │   ├── CreateProjectModal.tsx   # Opens new project configurations (Board selection)
│   │   │   ├── DesignChat.tsx           # Layout customization chatbot panel
│   │   │   ├── Forge3D.tsx              # Three.js 3D viewport for enclosure models
│   │   │   ├── InteractiveNodeGraph.tsx # Wiring graph builder for component pin connections
│   │   │   ├── Simulator3D.tsx          # 3D canvas viewport renderer for component arrangements
│   │   │   ├── ThreeViewport.tsx        # Generic 3D orbit viewport loader
│   │   │   ├── WokwiProofLab.tsx        # Live code editor + visual diagram dashboard
│   │   │   └── WokwiSimulator.tsx       # Live web simulation viewport
│   │   ├── hooks/
│   │   │   ├── useCompiler.ts           # Triggers and monitors firmware compilation status
│   │   │   ├── useIsMobile.ts           # Matches viewport sizes for mobile adjustments
│   │   │   └── useVoiceGuidance.ts      # Direct audio mic streaming to voice controller
│   │   ├── lib/
│   │   │   ├── axios.ts                 # Configures axios base API routes and cookies
│   │   │   └── firebase.ts              # Firebase auth settings (if enabled)
│   │   ├── pages/
│   │   │   ├── AssemblyPage.tsx         # Phase 5: Generates enclosure packaging blueprints
│   │   │   ├── AuthPage.tsx             # Signup and Login landing page
│   │   │   ├── BuildPage.tsx            # Phase 3: Hardware coding and pin wiring configuration
│   │   │   ├── ComponentsPage.tsx       # Phase 2: BOM component list and pin connection graphs
│   │   │   ├── HeroPage.tsx             # Promotional app landing page
│   │   │   ├── HomePage.tsx             # User dashboard listing current hardware projects
│   │   │   ├── IdeationPage.tsx         # Phase 1: Interactive requirements interview chat
│   │   │   ├── ShoppingPage.tsx         # Phase 6: pricing estimates and Jugaad swaps
│   │   │   └── Simulator3DPage.tsx      # Standalone testing page for the 3D model engine
│   │   ├── store/
│   │   │   ├── useAuthStore.ts          # Zustand store for user auth session
│   │   │   ├── useProjectStore.ts       # Zustand store coordinating active project steps
│   │   │   ├── useSimulatorStore.ts     # Zustand store managing wiring canvas objects
│   │   │   └── useThemeStore.ts         # Toggle state for dark/light mode
│   │   ├── styles/
│   │   │   ├── forge3d.css              # Custom styling definitions for 3D packaging elements
│   │   │   └── mobile.css               # Mobile responsive styling definitions
│   │   ├── App.tsx                      # Page routing and authentication checks
│   │   ├── index.css                    # Main design system colors and components definitions
│   │   └── main.tsx                     # Mounts React DOM wrapper
```

---

## 2. Mongoose Schemas

### User Schema (`user.model.ts`)
```typescript
import mongoose, { Schema } from "mongoose";

const userSchema = new Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePic: { type: String, default: "" },
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);
export default User;
```

### Part Schema (`part.model.ts`)
```typescript
import mongoose, { Schema } from "mongoose";

const partSchema = new Schema(
  {
    mpn: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    manufacturer: { type: String, required: true },
    description: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    datasheetUrl: { type: String, default: "" },
    specs: { type: Schema.Types.Mixed, default: () => ({}) },
    available: { type: Number, default: 0 },
    price: { type: Number, default: 0 },
    glbUrl: { type: String, default: "" },
    wokwiPartType: { type: String, default: "" },
  },
  { timestamps: true }
);

// Enable text indexing for component searches
partSchema.index({ name: "text", mpn: "text", description: "text" });

const Part = mongoose.models.Part || mongoose.model("Part", partSchema);
export default Part;
```

### SystemConfig Schema (`systemConfig.model.ts`)
```typescript
import mongoose, { Schema } from "mongoose";

const systemConfigSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

const SystemConfig = mongoose.models.SystemConfig || mongoose.model("SystemConfig", systemConfigSchema);
export default SystemConfig;
```

### Project Schema (`project.model.ts`)
```typescript
import mongoose, { Schema, Types } from "mongoose";

const messageSchema = new Schema(
  {
    role: { type: String, enum: ["user", "model"], required: true },
    content: { type: String, required: true },
  },
  { _id: false }
);

const ideationMessageSchema = new Schema(
  {
    role: { type: String, enum: ["user", "model"], required: true },
    content: { type: String, default: "" },
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

const ideationSchema = new Schema(
  {
    messages: { type: [ideationMessageSchema], default: [] },
    brief: { type: String, default: "" },
    objective: { type: String, default: "" },
    compute: { type: String, default: "" },
    phases: { type: Schema.Types.Mixed, default: () => ({}) },
    constraints: { type: String, default: "" },
    open: { type: String, default: "" },
    thinking: { type: String, default: "" },
    toolTrace: { type: String, default: "" },
    readyForComponents: { type: Boolean, default: false },
    readyAt: { type: Date, default: null },
    readinessReason: { type: String, default: "" },
    validatorApproved: { type: Boolean, default: false },
    validatorFeedback: { type: String, default: "" },
    validationAttempts: { type: Number, default: 0 },
    snapshot: { type: Schema.Types.Mixed, default: () => ({}) }
  },
  { _id: false }
);

const architectureStateSchema = new Schema(
  {
    summary: { type: String, default: "" },
    pattern: { type: String, default: "" },
    sourceStrategy: { type: String, default: "" },
    entryFile: { type: String, default: "" },
    files: { type: [Schema.Types.Mixed], default: [] },
    libraries: { type: [Schema.Types.Mixed], default: [] },
    pinAssignments: { type: [Schema.Types.Mixed], default: [] },
    runtimeFlow: { type: [String], default: [] },
    assumptions: { type: [String], default: [] },
    openDecisions: { type: [String], default: [] },
    updatedAt: { type: Date, default: null },
  },
  { _id: false }
);

const generationProfileSchema = new Schema(
  {
    board: { type: String, default: null },
    boardPartType: { type: String, default: "wokwi-arduino-uno" },
    powerSource: { type: String, enum: ["usb", "lipo", "9v", "aa-batteries", "unknown", null], default: null },
    language: { type: String, enum: ["cpp", "micropython"], default: "cpp" },
    firmwareTarget: { type: String, default: "arduino-cpp-sketch-ino" },
    simulationTarget: { type: String, default: "wokwi-json-ino" },
    runtimeHints: { type: [String], default: [] },
    profileVersion: { type: Number, default: 1 },
    lockedAt: { type: Date, default: null },
    updatedAt: { type: Date, default: null },
  },
  { _id: false }
);

const bomItemSchema = new Schema(
  {
    key: { type: String, default: "" },
    wokwiPartType: { type: String, default: "" },
    displayName: { type: String, default: "" },
    qty: { type: Number, default: 1 },
    purpose: { type: String, default: "" },
    pinConnections: [
      {
        pin: { type: String, default: "" },
        connectsTo: { type: String, default: "" }
      }
    ],
    price: { type: Number, default: 0 },
    storeUrl: { type: String, default: "" },
    mpn: { type: String, default: "" },
    partId: { type: String, default: "" },
    phase: { type: String, default: "" }
  },
  { _id: false }
);

const compilationSchema = new Schema(
  {
    hex: { type: String, default: "" },
    compilationErrors: { type: [Schema.Types.Mixed], default: [] },
    warnings: { type: [String], default: [] },
    compiledAt: { type: Date, default: null }
  },
  { _id: false }
);

const assemblyLayoutSchema = new Schema(
  {
    svgString: { type: String, default: "" },
    dimensions: {
      width_mm: { type: Number, default: 0 },
      height_mm: { type: Number, default: 0 },
      depth_mm: { type: Number, default: 0 }
    },
    componentPositions: { type: [Schema.Types.Mixed], default: [] },
    sizePreference: { type: String, enum: ["pocket", "desk", "wall", "custom"], default: "pocket" },
    warnings: { type: [String], default: [] },
    generatedAt: { type: Date, default: null }
  },
  { _id: false }
);

const stageStatusSchema = new Schema(
  {
    ideation: { type: String, enum: ["locked", "ready", "generating", "done", "stale", "error"], default: "ready" },
    components: { type: String, enum: ["locked", "ready", "generating", "done", "stale", "error"], default: "locked" },
    build: { type: String, enum: ["locked", "ready", "generating", "done", "stale", "error"], default: "locked" },
    simulation: { type: String, enum: ["locked", "ready", "generating", "done", "stale", "error"], default: "locked" },
    assembly: { type: String, enum: ["locked", "ready", "generating", "done", "stale", "error"], default: "locked" },
    shopping: { type: String, enum: ["locked", "ready", "generating", "done", "stale", "error"], default: "locked" }
  },
  { _id: false }
);

const wokwiEvidenceResultSchema = new Schema(
  {
    ok: { type: Boolean, default: false },
    command: { type: String, default: "" },
    exitCode: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
    stdoutTail: { type: String, default: "" },
    stderrTail: { type: String, default: "" },
    serialTail: { type: String, default: "" },
    summary: { type: String, default: "" },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
    ranAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const wokwiEvidenceSchema = new Schema(
  {
    lastLint: { type: wokwiEvidenceResultSchema, default: null },
    lastRun: { type: wokwiEvidenceResultSchema, default: null },
    lastScenario: { type: wokwiEvidenceResultSchema, default: null },
    lastSerialCapture: { type: wokwiEvidenceResultSchema, default: null },
    updatedAt: { type: Date, default: null }
  },
  { _id: false }
);

const projectAiStateSchema = new Schema(
  {
    summary: { type: String, default: "" },
    hardwarePath: { type: String, default: "" },
    files: { type: [String], default: [] },
    notes: { type: [String], default: [] },
    lastContextAt: { type: Date, default: null }
  },
  { _id: false }
);

const projectSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    description: { type: String, required: true },
    wokwiUrl: { type: String, default: "" },
    wokwiProjectPath: { type: String, default: "" },
    componentsMessages: { type: [messageSchema], default: [] },
    designMessages: { type: [messageSchema], default: [] },
    projectAiMessages: { type: [messageSchema], default: [] },
    ideation: { type: ideationSchema, default: () => ({}) },
    architectureState: { type: architectureStateSchema, default: () => ({}) },
    generationProfile: { type: generationProfileSchema, default: () => ({}) },
    meta: {
      stage: { type: String, enum: ["ideation", "components", "build", "simulation", "assembly", "shopping"], default: "ideation" },
      board: { type: String, default: null },
      powerSource: { type: String, enum: ["usb", "lipo", "9v", "aa-batteries", "unknown", null], default: null },
      language: { type: String, enum: ["cpp", "micropython"], default: "cpp" },
      componentCount: { type: Number, default: 0 },
      detectedAt: { type: Date, default: null },
      agentLock: { type: String, default: null }
    },
    projectAiState: { type: projectAiStateSchema, default: () => ({}) },
    wokwiEvidence: { type: wokwiEvidenceSchema, default: () => ({}) },
    bom: { type: [bomItemSchema], default: [] },
    pinAssignments: { type: Schema.Types.Mixed, default: () => ({}) },
    sketch: { type: String, default: "" },
    diagram: { type: Schema.Types.Mixed, default: () => ({}) },
    lastCompilation: { type: compilationSchema, default: () => ({}) },
    assemblyLayout: { type: assemblyLayoutSchema, default: () => ({}) },
    stageStatus: { type: stageStatusSchema, default: () => ({}) },
    nodeCoordinates: { type: Schema.Types.Mixed, default: () => ({}) }
  },
  { timestamps: true }
);

// Pre-validate Hook: Sanitizes roles ("ai" -> "model") and derives the ideation snapshot
projectSchema.pre("validate", function (next) {
  const sanitizeMessages = (msgs: any[]) => {
    if (!Array.isArray(msgs)) return;
    for (const m of msgs) {
      if (m && m.role === "ai") m.role = "model";
    }
  };
  sanitizeMessages(this.componentsMessages);
  sanitizeMessages(this.designMessages);
  sanitizeMessages(this.projectAiMessages);
  if (this.ideation && Array.isArray(this.ideation.messages)) {
    sanitizeMessages(this.ideation.messages);
  }

  // Derive snapshot fields from the current ideation responses
  if (this.ideation) {
    const inputs: string[] = [];
    const outputs: string[] = [];
    const phases = this.ideation.phases || {};
    for (const [phaseName, phaseContent] of Object.entries(phases)) {
      const content = String(phaseContent || "");
      if (!content) continue;
      const upperPhase = phaseName.toUpperCase();
      if (upperPhase.includes("SENSING") || upperPhase.includes("INPUT")) {
        inputs.push(content);
      } else if (upperPhase.includes("MOTOR") || upperPhase.includes("DISPLAY") || upperPhase.includes("OUTPUT")) {
        outputs.push(content);
      } else {
        if (content.toLowerCase().includes("sensor") || content.toLowerCase().includes("read")) {
          inputs.push(content);
        } else {
          outputs.push(content);
        }
      }
    }

    this.ideation.snapshot = {
      corePurpose: this.ideation.objective || "",
      computeCore: this.ideation.compute || "",
      constraints: this.ideation.constraints ? [this.ideation.constraints] : [],
      openQuestions: this.ideation.open ? [this.ideation.open] : [],
      inputs,
      outputs
    };
  }
  next();
});

const Project = mongoose.models.Project || mongoose.model("Project", projectSchema);
export default Project;
```

---

## 3. API Endpoints & Controllers

### Auth Module (`auth.route.ts`)
*   **POST `/api/auth/signup`**
    *   *Controller*: `signup`
    *   *Payload*: `{ fullName, email, password }`
    *   *Response*: User document JSON + JWT set in secure HttpOnly cookie `jwt`.
*   **POST `/api/auth/login`**
    *   *Controller*: `login`
    *   *Payload*: `{ email, password }`
    *   *Response*: User document JSON + JWT cookie.
*   **POST `/api/auth/logout`**
    *   *Controller*: `logout`
    *   *Response*: Clears `jwt` cookie.
*   **GET `/api/auth/check`**
    *   *Controller*: `checkAuth`
    *   *Guards*: `protectRoute` (validates cookie JWT)
    *   *Response*: Current User document JSON.
*   **PUT `/api/auth/update`**
    *   *Controller*: `updateProfile` / `updateUser`
    *   *Guards*: `protectRoute`
    *   *Payload*: Partial settings update details `{ fullName, email, password }`.

### Project Module (`project.routes.ts`)
*   **POST `/api/projects`**
    *   *Controller*: `createProject`
    *   *Guards*: `protectRoute`
    *   *Payload*: `{ description, board }` (instantiates base project document with stages locked).
*   **GET `/api/projects`**
    *   *Controller*: `getProjects`
    *   *Guards*: `protectRoute`
    *   *Response*: Array of project summaries owned by user.
*   **GET `/api/projects/:id`**
    *   *Controller*: `getProjectById`
    *   *Guards*: `protectRoute`
    *   *Response*: Hydrated Project document.
*   **DELETE `/api/projects/:id`**
    *   *Controller*: `deleteProject`
    *   *Guards*: `protectRoute`

### Ideation Module (`ideation.route.ts`)
*   **POST `/api/ideation/:id/message`**
    *   *Controller*: `postMessage`
    *   *Guards*: `protectRoute`
    *   *Payload*: `{ message: string }`
    *   *Core Logic*: Submits user text prompt, triggers dual-agent run (Interviewer then Validator), updates the brief, objectives, compute choices, and phases. Returns updated ideation state and AI response.
*   **POST `/api/ideation/:id/validate`**
    *   *Controller*: `triggerValidation`
    *   *Guards*: `protectRoute`
    *   *Core Logic*: Forcefully runs Agent 2 (Validator) check on the current brief. Advances stage status of ideation to `done` and components to `ready` if approved.

### Components Module (`components.route.ts`)
*   **POST `/api/components/:id/generate`**
    *   *Controller*: `generateBOM`
    *   *Guards*: `protectRoute`
    *   *Core Logic*: Invokes `ai.services.ts` -> `processComponents` based on the ideation brief snapshot. Produces a bill of materials mapped to layout phases, resolves pin signal capabilities, and updates BOM fields. Unlocks downstream build stage.
*   **PUT `/api/components/:id/wiring`**
    *   *Controller*: `updateWiring`
    *   *Guards*: `protectRoute`
    *   *Payload*: `{ diagram, nodeCoordinates }`
    *   *Core Logic*: Commits custom interactive canvas wiring connections and part placements back to the Mongoose record. Invalidates downstream compiler builds if connections were modified.

### Build Module (`build.route.ts`)
*   **POST `/api/build/:id/generate`**
    *   *Controller*: `generateAssets`
    *   *Guards*: `protectRoute`
    *   *Core Logic*: Generates matching `sketch.ino` and Wokwi `diagram.json` layout configurations from the active project components and wiring mappings. Compiles code via `wokwi-local.service.ts`.
*   **POST `/api/build/:id/compile`**
    *   *Controller*: `compileCode`
    *   *Guards*: `protectRoute`
    *   *Payload*: `{ sketchCode }`
    *   *Core Logic*: Saves updated compiler script locally, runs `compileWokwiSketch` through the `arduino-cli` binary, copies over output binary hex, and registers compiler errors or compilation logs.

### Assembly Module (`assembly.route.ts`)
*   **POST `/api/assembly/:id/layout`**
    *   *Controller*: `generateAssembly`
    *   *Guards*: `protectRoute`
    *   *Payload*: `{ sizePreference: "pocket"|"desk"|"wall"|"custom", overrides: { w, h, d } }`
    *   *Core Logic*: Pulls physical dimensional sizes of active components, triggers packing algorithms, creates SVG enclosures, and returns SVG layout configurations.

### Shopping Module (`shopping.route.ts`)
*   **GET `/api/shopping/:id`**
    *   *Controller*: `getShoppingList`
    *   *Guards*: `protectRoute`
    *   *Core Logic*: Maps active BOM objects to local cost catalogs. Appends pricing, storefront urls, and DIY substitutes ("Jugaad"). Sets final stage status to `done`.

### Voice Module (`voice.route.ts`)
*   **POST `/api/voice/transcribe`**
    *   *Controller*: `transcribe`
    *   *Payload*: Binary audio form multipart stream data.
    *   *Core Logic*: Passes audio buffer to Deepgram transcription API and returns transcripts.
*   **POST `/api/voice/synthesize`**
    *   *Controller*: `synthesize`
    *   *Payload*: `{ text: string, voiceId?: string }`
    *   *Core Logic*: Submits text prompt to ElevenLabs Text-to-Speech API and returns base64 audio stream.

### Library Module (`library.route.ts`)
*   **GET `/api/library/search`**
    *   *Controller*: `search`
    *   *Payload*: Query params `q` (search term), `limit`.
    *   *Core Logic*: Performs MongoDB local text indexing search on parts catalog, and falls back to Nexar (Octopart v4) GraphQL API.

---

## 4. Zustand State Management

The frontend relies on Zustand for global reactive state management.

### `useAuthStore`
*   **State**:
    *   `authUser` (Object | null): Currently logged-in user profile details.
    *   `isSigningUp`, `isLoggingIn`, `isCheckingAuth` (Boolean): Request loading indicators.
*   **Actions**:
    *   `checkAuth()`: Polls `/auth/check` on startup, retrieves `forge:lastProjectId` and triggers project loads if found.
    *   `signup(data)`, `login(data)`: Posts credentials and saves user sessions.
    *   `logout()`: Deletes user sessions and clears project stores.
    *   `updateUser(data)`: Updates username or profile password configurations.

### `useProjectStore`
*   **State**:
    *   `currentProject` (ProjectDocument | null): The currently selected project workspace.
    *   `isLoading`, `isSaving` (Boolean): UI loading indicators.
*   **Actions**:
    *   `loadProject(projectId)`: Fetches project from `/api/projects/:id` and sets active states. Saves workspace ID in `localStorage` under `forge:lastProjectId`.
    *   `createProject(desc, board)`: Posts details to launch a new workspace.
    *   `clearProject()`: Resets workspace state parameters.
    *   `updateStageStatus(stage, status)`: Sets state statuses in local client screens.
    *   `advanceStage(fromStage)`: Invokes `/api/pipeline/advance` to lock/unlock progression nodes.

### `useSimulatorStore`
*   **State**:
    *   `nodes` (Array): Electronic components placed on simulator grids.
    *   `connections` (Array): Wiring paths between active nodes.
    *   `past`, `future` (Array): Tracks historical changes for Undo/Redo operations.
    *   `transient` (Object):
        *   `mode` ("IDLE" | "DRAGGING" | "WIRING"): Grid interaction context.
        *   `dragId` (String): ID of active moving part.
        *   `selectedNodeId` (String): Selection reference for deletions/property edits.
        *   `activeWiringSource` (Object): Pin context active in drawing wires.
        *   `livePositions` (Object): Realtime mouse positions for moving components.
*   **Actions**:
    *   `addNode(node)`, `deleteNode(id)`, `moveNode(id, pos)`, `commitNodeMove(id, pos)`: Manages canvas items.
    *   `addConnection(from, to, color)`, `removeConnection(id)`: Wire manipulation utilities.
    *   `undo()`, `redo()`: Travels back/forward through coordinates logs history.
    *   `resetCircuit()`: Clears connections and parts.

---

## 5. AI Services & Agent Pipelines

### Dual-Agent Ideation Pipeline (`gemini.service.ts`)
*   **Agent 1 (Interviewer)**:
    *   *Role*: Embedded engineer helping the student refine requirements.
    *   *Prompt*: Asks structured questions about core purpose, inputs/outputs, communication methods, and power sources. Keeps conversation friendly and focused.
*   **Agent 2 (Validator)**:
    *   *Role*: Technical auditor validating the brief.
    *   *Prompt*: Evaluates conversation brief files. Analyzes if a viable hardware configuration can be compiled. Outlines missing details (e.g. "Missing power source specs").
    *   *Execution Flow*:
        1. User submits text or voice prompt.
        2. Interviewer agent processes chat history and replies.
        3. Validator agent reviews the cumulative history. If it detects sufficient detail, it marks `readyForComponents: true`.
        4. If not approved, validator appends instructions detailing what specifications need refinement.

### AI Processing Services (`ai.services.ts`)
*   **`processInput`**: Feeds chat logs to Gemini and returns structured outputs for objectives, compute cores, phase definitions, constraints, and validation results.
*   **`processComponents`**:
    *   Analyzes ideation snapshots.
    *   Maps requirements to physical catalog items.
    *   Enforces component selections using structured JSON schemas containing parts lists, quantities, and pin assignments.
*   **`generateWokwiAssetsFromState`**:
    *   Creates simulator assets.
    *   Generates matching `.ino` firmware and Wokwi `diagram.json` schemas.
    *   Uses hardcoded templates for specific target projects (e.g. Simon Game) to ensure reliability.
*   **Key Rotation (`keyRotation.service.ts`)**:
    *   Rotates API keys to prevent rate limits.
    *   Loads API keys `GROQ_API_KEY_1` to `GROQ_API_KEY_33` from `.env`.
    *   Stores the active key index in MongoDB `SystemConfig` under the key `groq_key_index` for server-wide persistence.

---

## 6. Hardware Simulation & Build Services

### Local Compilation Wrapper (`wokwi-local.service.ts`)
*   **Arduino-CLI Compiles**:
    *   Creates a temporary compilation directory (`NovaAI-arduino-`) in the system temp folder.
    *   Writes `sketch.ino` to the temp directory.
    *   Spawns `arduino-cli compile --fqbn <fqbn> --output-dir <buildDir> <tempSketchDir>`.
    *   Reads and parses build logs. Copies compiled `.hex` files to the target workspace directories on success.

### Headless Runner Services (`wokwi-runner.service.ts`)
*   **Wokwi CLI Simulation**:
    *   `lintWokwiProject`: Runs `wokwi-cli lint` against target directory connections to check schema validity.
    *   `runWokwiProject`: Spawns headless simulation runs with parameters for timeouts, serial log recording, and test expectations.
    *   `captureWokwiSerial`: Listens to serial transmission streams for debugging.

### Interactive MCP Simulator Session (`wokwi-mcp-client.service.ts`)
*   **Model Context Protocol (MCP)**:
    *   Connects backend routes to active simulator inputs via the Wokwi CLI's local MCP server.
    *   Starts a background `wokwi-cli mcp` process using `WOKWI_CLI_TOKEN`.
    *   Enables other agents or scripts to programmatically toggle buttons, read pin signals, and trigger sensors during execution.

### STEP to GLB CAD Model Conversion (`modelConversion.service.ts`)
*   **Background CAD Job**:
    *   Triggers CAD model search in the background using SnapEDA API.
    *   Downloads target `.step` files and converts them to `.glb` via the CAD Exchanger Cloud API.
    *   *Fallback*: If API keys are missing or conversion fails, resolves to high-fidelity mock model pathways (e.g., `/models/arduino_uno.glb`, `/models/esp32.glb`).
    *   Emits a `model:ready` Socket.IO event to the client once conversion completes.

---

## 7. Stage Transitions & State Machine

The workflow progresses through a strict 6-stage pipeline orchestrated by `pipeline.service.ts`.

### Pipeline Progression List
1.  **Ideation**: Interactive requirements gathering.
2.  **Components**: Bill of materials sourcing and wiring.
3.  **Build**: Firmware compilation and asset updates.
4.  **Simulation**: Headless test executions.
5.  **Assembly**: Enclosure CAD model packaging.
6.  **Shopping**: Pricing and checkout details.

### State Transition Matrix
*   **Status Options**: `locked`, `ready`, `generating`, `done`, `stale`, `error`.
*   **`advanceStage(projectId, fromStage)`**: Marks the current stage as `done` and advances the next stage to `ready`.
*   **`invalidateDownstream(projectId, fromStage)`**: Triggers when changes are made to an upstream stage (e.g., changing the ideation brief or swapping a BOM component). Sets all downstream stages to `stale` to ensure the project remains synchronized.

---

## 8. Third-Party Services & Integrations

### Voice Processing (`voice.service.ts`)
*   **Speech-to-Text (STT) - Deepgram**:
    *   Endpoint: `https://api.deepgram.com/v1/listen`.
    *   Sends recorded audio chunks using the Deepgram Nova-2 model.
    *   *Fallback Retry*: If Deepgram returns a bad payload or unsupported media type (HTTP 400/415), retries the request using alternative mimetype headers (`audio/webm`, `audio/ogg`, `application/octet-stream`).
*   **Text-to-Speech (TTS) - ElevenLabs**:
    *   Endpoint: `https://api.elevenlabs.io/v1/text-to-speech/{voiceId}`.
    *   *Fallback Voice Allocation*: If the requested voice fails or returns a plan limit error (HTTP 402), queries `/v1/voices` and falls back to a different voice ID.

---

## 9. Frontend Pages & Core Canvas/Sim Logic

### Interface Layout and Routing
*   `App.tsx` configures routes inside `ProjectLayout.tsx`.
*   Provides left navigation controls, responsive mobile views, and visual step indicators.

### Simulator Workspace Canvas (`SimulatorWorkspace.tsx`)
*   Manages the 2D grid workspace layout.
*   Enables dragging components and rendering SVG wires.
*   Draws visual SVG wiring lines based on absolute terminal positions.

### Three.js 3D Viewport (`Forge3D.tsx`)
*   Renders enclosures and electronics layouts in 3D.
*   Implements physics-based packing controls (using `physics.ts`) to prevent component overlap.
*   Enables drag-and-drop adjustments within enclosure bounds.

---

## 10. Environment Setup & Technical Debt

### Environment Variables (`backend/.env`)
*   `PORT`: Server listener port (default: 5000).
*   `MONGO_URI`: MongoDB connection string.
*   `JWT_SECRET`: Token signature key.
*   `GROQ_API_KEY`, `GROQ_API_KEY_2`, `GROQ_API_KEY_3`: API keys for key rotation.
*   `GEMINI_API_KEY`, `GEMINI_API_KEY_1`: API keys for Gemini models.
*   `WOKWI_CLI_TOKEN`: Token for Wokwi CLI authentication.
*   `DEEPGRAM_API_KEY`: API key for Deepgram transcription.
*   `ELEVENLABS_API_KEY`: API key for ElevenLabs synthesis.
*   `access_token`: Access token for Nexar API search queries.

### Technical Debt & Known Gaps
*   **`@ts-nocheck` Headers**: Core controllers and services (`ideation.controller.ts`, `build.controller.ts`, `ai.services.ts`, `pipeline.service.ts`) contain `@ts-nocheck` headers. These need to be migrated to strict TypeScript types.
*   **Hardcoded Models**: Model identifiers (e.g. `meta-llama/llama-4-scout-17b-16e-instruct`) are hardcoded in `ai.services.ts` and `index.ts`. These should be moved to environment configuration.
*   **Observability**: Error logging is currently managed using a simple file-append setup (`components_error.log`). This should be replaced with a structured logging or observability service.

---

## 11. Code Style & Conventions

*   **New Code Marking**: Demarcate all new or modified code blocks using a `// ??$$$` comment header.
*   **Functional Priority**: Prioritize robust, working implementations over micro-optimizations.
*   **Schema Safety**: Do not modify Mongoose schemas directly without updating corresponding pre-save hooks and TypeScript definitions.
