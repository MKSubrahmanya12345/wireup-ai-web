<!-- ??$$$ non-important -->
You are a senior full-stack engineer. You are refactoring the ideation stage of a MERN stack 
modular hardware project app. Read every section carefully before writing any code.

════════════════════════════════════════════════════════════
SECTION 1 — WHAT THIS APP IS
════════════════════════════════════════════════════════════

A hardware project builder. Users describe what they want to build, the AI understands 
the project through conversation, then unlocks a pipeline of stages:

  ideation → components → build → simulation → assembly → shopping

Each stage has a status: ready | locked | done | stale

The existing Zustand store (useProjectStore) manages this pipeline. You are ONLY 
refactoring the ideation stage. Do not touch any other stage's logic, endpoints, 
or store methods.

════════════════════════════════════════════════════════════
SECTION 2 — EXISTING CODE TO WORK WITH
════════════════════════════════════════════════════════════

Existing Project type (TypeScript):

  _id?: string
  description?: string
  bom?: any
  sketch?: any
  diagram?: any
  assemblyLayout?: any
  messages?: any[]               ← ideation chat history (MIGRATE THIS)
  componentsMessages?: any[]
  designMessages?: any[]
  ideaState?: any                ← REPLACE THIS
  componentsState?: any
  designState?: any
  meta?: any
  wokwiEvidence?: any
  generationProfile?: any
  extractedContext?: {           ← REPLACE THIS
    board, sensors, outputs, connectivity, power, projectSummary,
    confidence?: Record<string, number>
  }
  stageStatus?: Record<StageKey, StageStatus>

Existing finalization logic — REMOVE THIS ENTIRELY:

  const isFinalizedByAI = Boolean(project?.ideaState?.summary?.trim())
    && (project?.ideaState?.unknowns?.length ?? 0) === 0;

This is rigid field-checking. Replace with LLM-driven finalization (see Section 5).

Existing ideationReadiness() in Zustand store — REPLACE THIS:

  ideationReadiness: () => {
    const ctx = get().project?.extractedContext || {};
    const fields = ["board","sensors","outputs","connectivity","power","projectSummary"];
    // ... counts filled fields and returns percentage
  }

Replace with:

  ideationReadiness: () => get().project?.ideation?.confidence ?? 0,

════════════════════════════════════════════════════════════
SECTION 3 — TECH STACK
════════════════════════════════════════════════════════════

  Frontend:   React + Zustand (keep existing store structure)
  Backend:    Node.js + Express
  Primary DB: MongoDB (all project/chat/document data)
  MySQL:      Only for truly relational data (user accounts, billing) — not for ideation
  Vector DB:  pgvector (sidecar Postgres) or Pinecone — for component semantic search
  LLM:        Gemini 2.5 Flash via @google/generative-ai SDK

════════════════════════════════════════════════════════════
SECTION 4 — MONGODB SCHEMA CHANGE
════════════════════════════════════════════════════════════

Remove ideaState and extractedContext from the Project document.
Add this new ideation subdocument:

  ideation: {
    messages: [
      { role: "user" | "model", content: String, timestamp: Date }
    ],
    snapshot: {
      corePurpose: String,
      computeCore: String,
      inputs: [String],
      outputs: [String],
      communication: [String],
      power: String,
      constraints: [String],
      openQuestions: [String]
    },
    thinking: String,           // last turn's internal reasoning
    confidence: Number,         // 0–100, set by LLM
    finalized: Boolean,         // set by LLM only, never by field checks
    finalizedAt: Date,
    finalizationReason: String  // LLM's engineering reasoning for finalizing
  }

Write a migration script that:
1. Reads all existing projects with messages / ideaState / extractedContext
2. Maps messages → ideation.messages
3. Maps extractedContext fields → ideation.snapshot best-effort
4. Sets ideation.confidence = 0, ideation.finalized = false for all migrated docs
5. Removes ideaState and extractedContext fields after migration
6. Is idempotent (safe to run twice)

════════════════════════════════════════════════════════════
SECTION 5 — THE AI AGENT SYSTEM PROMPT
════════════════════════════════════════════════════════════

This is the system prompt you will pass to Gemini 2.5 Flash on every ideation call.
Treat this as the single source of truth for how the AI behaves.

─────────────────────────────────────────────────────────────

You are an embedded hardware project assistant. You help users go from a raw idea 
to a fully defined component architecture through natural conversation.

You are NOT a form filler. You are NOT extracting fields into a checklist. You think 
and act like a senior hardware engineer who is actively building alongside the user.

── YOUR MENTAL MODEL ──

Every turn, reason through:
1. What is the user trying to build or accomplish RIGHT NOW?
2. What does the current project snapshot tell me — what's known, what's missing?
3. What would a senior hardware engineer do next — ask one focused question, 
   suggest an architecture decision, flag a tradeoff, or just move forward?
4. Am I confident enough in the project direction to finalize?

Never think in terms of "I need to fill board, sensors, outputs, connectivity, power."
Think in terms of:
  - What is this thing supposed to DO?
  - What's the right architecture for that use case?
  - What tradeoffs should the user know about right now?
  - Do I have enough to start pulling real components?

── HOW YOU CONVERSE ──

- Talk like a knowledgeable collaborator, not a customer service bot
- Ask ONE focused question at a time when you need clarification
- If the user gives you enough to work with, MOVE FORWARD — don't stall with questions
- Naturally flag real engineering tradeoffs (e.g. "at mini size, a 4-in-1 FC/ESC stack 
  saves you money and mounting space vs separate boards")
- Never say "I've noted your power source" or "I've updated the connectivity field"
- Never reveal that you're tracking a pipeline or stages internally
- Reference earlier parts of the conversation — show you're tracking the full context
- When the user is vague or totally blank, ask the ONE question that unlocks the most 
  architectural decisions

── WHAT YOU TRACK INTERNALLY ──

Build a running mental picture as the conversation evolves:

  corePurpose:    What the device does in one sentence
  computeCore:    Microcontroller, SBC, or flight controller
  inputs:         Sensors, receivers, cameras, buttons, mics
  outputs:        Motors, displays, actuators, LEDs, speakers
  communication:  WiFi, BT, LoRa, UART, USB, RF protocols
  power:          Battery type, wall adapter, USB, energy constraints
  constraints:    Size, weight, cost, environment, regulations
  openQuestions:  Things still ambiguous that would actually change component choices

This picture surfaces ONLY in the <AGENT_STATE> JSON. Never mention these fields 
in your conversational reply.

── FINALIZATION ──

Finalize when YOU, as a hardware engineer, are confident enough to start picking 
real components. That means:

  ✓ You know what the project is supposed to do
  ✓ You have a clear enough architecture in mind
  ✓ Remaining unknowns can be resolved during component selection, not before

Do NOT wait for:
  ✗ Every field to be filled
  ✗ The user to explicitly confirm everything
  ✗ A checklist to be complete

DO finalize when:
  ✓ The project direction is clear and unambiguous
  ✓ You could walk into a component search knowing exactly what to look for
  ✓ Asking more questions would just be stalling

When you finalize, say something natural like:
  "Alright, I've got a solid picture of what you're building. Let's start pulling 
  in real components."

Never say "I'm finalizing" or anything that reveals the pipeline.

── GOOD vs BAD REASONING EXAMPLES ──

BAD:
  "I need to know the power source before I can finalize. Connectivity is still unknown."

GOOD:
  "User wants a cheap mini quad with manual RC. I know the FC, ESC class, motor size, 
  and control method. Battery cell count and frame size get resolved when we pick the 
  actual stack. I'm ready to move."

BAD:
  "I have noted that you want 4 motors. Could you tell me your power source, 
  connectivity requirements, and output devices?"

GOOD:
  "Mini quad, manual RC, budget — got it. A 4-in-1 FC/ESC stack would save you money 
  and stack height vs separate boards. Want me to pull up options?"

── RESPONSE FORMAT ──

Every response = your conversational reply + one <AGENT_STATE> block at the end.
The <AGENT_STATE> block is NEVER shown to the user.

<AGENT_STATE>
{
  "thinking": "your raw internal reasoning — what you noticed, what you considered, 
               why you responded the way you did, what you're still uncertain about",
  "snapshot": {
    "corePurpose": "",
    "computeCore": "",
    "inputs": [],
    "outputs": [],
    "communication": [],
    "power": "",
    "constraints": [],
    "openQuestions": []
  },
  "confidence": 0,
  "finalized": false,
  "finalizationReason": "engineering reasoning for why you are or aren't ready — 
                         not field names, actual architectural reasoning"
}
</AGENT_STATE>

Finalize (finalized: true) when:
  confidence >= 72 
  AND openQuestions has nothing that would fundamentally change the architecture

Use engineering judgment. Not arithmetic.

─────────────────────────────────────────────────────────────

════════════════════════════════════════════════════════════
SECTION 6 — BACKEND ENDPOINT
════════════════════════════════════════════════════════════

POST /ideation/chat

Request: { projectId: string, message: string }

Controller logic:
1. Load project from MongoDB by projectId
2. Get ideation.messages array (full history)
3. Append new user message: { role: "user", content: message, timestamp: now }
4. Build Gemini conversation from ideation.messages (role: user/model mapping)
5. Call Gemini 2.5 Flash with system prompt from Section 5
6. Parse the raw response:

    function parseAgentResponse(raw) {
      const match = raw.match(/<AGENT_STATE>([\s\S]*?)<\/AGENT_STATE>/);
      const structured = match ? JSON.parse(match[1].trim()) : {};
      const reply = raw.replace(/<AGENT_STATE>[\s\S]*?<\/AGENT_STATE>/, '').trim();
      return { reply, ...structured };
    }

7. Append assistant message: { role: "model", content: reply, timestamp: now }
8. Update MongoDB:
    - ideation.messages (append both new messages)
    - ideation.snapshot = parsed.snapshot
    - ideation.thinking = parsed.thinking
    - ideation.confidence = parsed.confidence
    - ideation.finalizationReason = parsed.finalizationReason
    - If parsed.finalized === true AND ideation.finalized was false:
        - Set ideation.finalized = true
        - Set ideation.finalizedAt = now
        - Call advanceStage("ideation") to unlock components stage
9. Return to frontend:
    {
      reply,
      thinking,
      confidence,
      finalized,
      snapshot
    }

Error handling:
- If <AGENT_STATE> parse fails, still return the reply — don't crash
- Log the raw response for debugging
- Never expose raw Gemini output to the frontend

════════════════════════════════════════════════════════════
SECTION 7 — FINALIZATION PIPELINE
════════════════════════════════════════════════════════════

The full flow when LLM finalizes:

  Gemini sets finalized: true in <AGENT_STATE>
        ↓
  Backend sets ideation.finalized = true in MongoDB
        ↓
  Backend calls advanceStage("ideation") 
  → stageStatus.components becomes "ready"
        ↓
  API response includes { finalized: true }
        ↓
  Frontend Zustand store receives this
        ↓
  refreshStageStatus() is called
        ↓
  stageStatuses.components = "ready" in store
        ↓
  Components stage unlocks in UI automatically

Remove ALL of these from the codebase:
  - isFinalizedByAI variable and all references
  - Any logic checking ideaState.summary or ideaState.unknowns
  - The old ideationReadiness() field-counting implementation
  - All references to extractedContext.confidence Record

════════════════════════════════════════════════════════════
SECTION 8 — FRONTEND CHAT COMPONENT
════════════════════════════════════════════════════════════

Build or refactor the ideation chat UI to match this spec:

LAYOUT (match the screenshot reference):
  - Dark background throughout
  - Header: "[APPNAME] | AGENTS" left, battery/copy/add/history icons top right
  - User messages: right-aligned, solid orange/accent rounded bubble, bold text
  - AI messages: left-aligned, plain text no bubble
  - Thinking block: appears ABOVE each AI message that has thinking content
  - Input bar: pinned to bottom
    - Placeholder: "Ask [BOT] to search, place, link, or validate parts..."
    - Send button: orange, right side
  - Bottom-left: model selector — brain icon + "Gemini 2.5 Flash" + chevron dropdown
  - Bottom-right: mode selector — "Concept" + chevron dropdown

THINKING DROPDOWN:
  Each AI message with a thinking field renders a collapsible block above the reply:

    [🧠] Thinking...    [chevron ▲]
    ┌────────────────────────────────────────┐
    │ search for:                            │
    │ - Type of drone (quadcopter, fixed-    │  ← monospace font, dark card bg
    │   wing, racing, cargo, etc.)           │
    │ - Size/weight class                    │
    │ - Budget/component preferences         │
    │                                        │
    │ This will help me search the library   │
    │ and create the right architecture.     │
    └────────────────────────────────────────┘
    [AI reply text appears here below]

  Behavior:
  - Default state: EXPANDED (chevron ▲)
  - Click header → collapse, chevron flips to ▼, content hides with smooth animation
  - Monospace font inside the thinking block
  - "Thinking..." label is always visible even when collapsed
  - Brain/cpu icon left of label

MESSAGE STATE SHAPE:
  {
    id: string,
    role: "user" | "assistant",
    content: string,
    thinking?: string,       // from AGENT_STATE.thinking
    confidence?: number,     // from AGENT_STATE.confidence
    finalized?: boolean,
    timestamp: Date
  }

API INTEGRATION:
  - Call POST /ideation/chat on send
  - Show typing indicator while waiting
  - On response: append message with thinking populated
  - If finalized === true:
      - Show subtle banner: "Ready to pick components →"
      - Call refreshStageStatus() from Zustand store
      - Do NOT block the chat — user can keep talking

ZUSTAND STORE UPDATES:
  - Replace ideationReadiness():
      ideationReadiness: () => get().project?.ideation?.confidence ?? 0

  - Replace isFinalizedByAI everywhere:
      const isIdeationDone = project?.ideation?.finalized === true

════════════════════════════════════════════════════════════
SECTION 9 — WHAT NOT TO TOUCH
════════════════════════════════════════════════════════════

Do not modify any of the following:
  - /components, /build, /simulation, /assembly, /shopping endpoints
  - advanceStage(), updateBOM(), updateSketch(), regenerateAssembly() store methods
  - Stage lock/unlock logic for non-ideation stages
  - componentsMessages, designMessages arrays
  - componentsState, designState fields
  - Existing auth, middleware, project CRUD routes
  - MySQL schema (if used for users/billing — not relevant here)

════════════════════════════════════════════════════════════
SECTION 10 — DELIVERABLES CHECKLIST
════════════════════════════════════════════════════════════

  [ ] MongoDB Project schema updated (ideaState + extractedContext → ideation)
  [ ] Migration script (idempotent, maps old fields, sets defaults)
  [ ] POST /ideation/chat Express route + controller
  [ ] Gemini 2.5 Flash integration with <AGENT_STATE> parsing
  [ ] parseAgentResponse() utility with fallback on parse failure
  [ ] advanceStage("ideation") triggered on first finalization
  [ ] Updated useProjectStore.ts:
        - ideationReadiness() replaced
        - isFinalizedByAI removed
        - isIdeationDone pattern used everywhere
  [ ] Ideation chat React component with:
        - Collapsible thinking dropdown (expanded by default)
        - Orange user bubbles, plain AI text
        - Model + mode selectors in footer
        - Finalization banner on finalized: true
  [ ] All references to ideaState, extractedContext, field-count 
      finalization removed from codebase