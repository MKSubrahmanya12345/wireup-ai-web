import { create } from "zustand";
import { axiosInstance } from "../lib/axios";

export type StageStatus = "ready" | "locked" | "done" | "stale";

export type StageKey =
  | "ideation"
  | "components"
  | "build"
  | "simulation"
  | "assembly"
  | "shopping";

// ??$$$
export type DebugMessage = {
  role: "user" | "model";
  content: string;
  timestamp: string | Date;
};

// ??$$$
export type MilestoneTest = {
  expectedSerialOutput: string;
  passCondition: string;
  commonProblems: string[];
};

// ??$$$
export type Milestone = {
  id: string;
  order: number;
  title: string;
  objective: string;
  componentsInvolved: string[];
  wiringInstructions: string;
  code: string;
  explanation: string;
  test: MilestoneTest;
  status: "locked" | "ready" | "in_progress" | "passed" | "failed";
  userConfirmed: boolean;
  userNotes: string;
  compiledHex: string;
  compilationErrors: any[];
  serialOutput: string;
  completedAt: string | Date | null;
  simulatable: boolean;
  dependsOn: string[];
  debugMessages: DebugMessage[];
};

export type Project = {
  _id?: string;
  description?: string;
  bom?: any;
  sketch?: any;
  diagram?: any;
  assemblyLayout?: any;
  // ??$$$ newer code
  nodeCoordinates?: any;
  // ??$$$ Milestones
  milestones?: Milestone[];
  milestonesGenerated?: boolean;
  activeMilestoneId?: string | null;
  // Old code:
  // messages?: any[];
  // ideaState?: any;
  // extractedContext?: { ... };
  // ??$$$ newer code
  ideation?: {
    messages?: Array<{ role: "user" | "model"; content: string; timestamp?: string | Date }>;
    // ??$$$ Commented out old snapshot per Section 9 instructions
    // snapshot?: {
    //   corePurpose?: string;
    //   computeCore?: string;
    //   inputs?: string[];
    //   outputs?: string[];
    //   communication?: string[];
    //   power?: string;
    //   constraints?: string[];
    //   openQuestions?: string[];
    // };
    // ??$$$ Added brief fields per Section 9 instructions
    brief?: string;
    objective?: string;
    compute?: string;
    phases?: Record<string, string>;
    constraints?: string;
    open?: string;
    thinking?: string;
    toolTrace?: string;
    readyForComponents?: boolean;
    readyAt?: string | Date | null;
    readinessReason?: string;
    validatorApproved?: boolean;
    validatorFeedback?: string;
    validationAttempts?: number;
  };
  componentsMessages?: any[];
  designMessages?: any[];
  componentsState?: any;
  designState?: any;
  meta?: any;
  wokwiEvidence?: any;
  generationProfile?: any;
  stageStatus?: Record<StageKey, StageStatus>;
};

type ProjectState = {
  project: Project | null;
  projectId: string | null;

  stageStatuses: Record<StageKey, StageStatus>;

  isLoading: boolean;
  error: string | null;

  loadProject: (projectId: string) => Promise<void>;
  refreshStageStatus: () => Promise<void>;
  advanceStage: (fromStage: string) => Promise<void>;
  updateBOM: (componentKey: string, replacement: any) => Promise<void>;
  updateSketch: (sketch: any, diagram?: any) => Promise<void>;
  updateDiagram: (diagram: any) => void;
  regenerateAssembly: (
    sizePreference?: string,
    overrides?: any
  ) => Promise<any>;
  clearProject: () => void;

  // ??$$$ newer code
  syncWiring: (
    nodeCoordinates: any,
    bomPhases: any,
    connections: any
  ) => Promise<void>;

  isStageUnlocked: (stage: StageKey) => boolean;
  isStageComplete: (stage: StageKey) => boolean;
  hasDownstreamStale: (stage: StageKey) => boolean;
  ideationReadiness: () => number;

  // ??$$$ Milestones actions
  generateMilestones: (projectId: string) => Promise<void>;
  loadMilestones: (projectId: string) => Promise<void>;
  updateMilestone: (projectId: string, milestoneId: string, updates: Partial<Milestone>) => Promise<void>;
  compileMilestone: (projectId: string, milestoneId: string) => Promise<any>;
  confirmMilestone: (projectId: string, milestoneId: string, serialOutput: string, notes: string) => Promise<any>;
  failMilestone: (projectId: string, milestoneId: string, serialOutput: string, problem: string) => Promise<any>;
  skipMilestone: (projectId: string, milestoneId: string, notes: string) => Promise<any>;
  chatDebugCoach: (projectId: string, milestoneId: string, message: string) => Promise<any>;
  regenerateMilestoneCode: (projectId: string, milestoneId: string) => Promise<void>;
  reportComponentIssue: (projectId: string, milestoneId: string, componentKey: string, problem: string) => Promise<any>;
  validateSerial: (projectId: string, milestoneId: string, actualOutput: string) => Promise<any>;
};

const DEFAULT_STAGES: Record<StageKey, StageStatus> = {
  ideation: "ready",
  components: "locked",
  build: "locked",
  simulation: "locked",
  assembly: "locked",
  shopping: "locked",
};

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  projectId: null,
  stageStatuses: DEFAULT_STAGES,
  isLoading: false,
  error: null,

  loadProject: async (projectId) => {
    if (!projectId) return;

    set({ isLoading: true, error: null, projectId });

    try {
      const res = await axiosInstance.get<Project>(
        `/project/${projectId}`,
        { withCredentials: true }
      );

      const project = res.data;

      set({
        project,
        projectId,
        stageStatuses: project.stageStatus || DEFAULT_STAGES,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err?.response?.data?.error || "Failed to load project",
      });
    }
  },

  refreshStageStatus: async () => {
    const { projectId } = get();
    if (!projectId) return;

    try {
      const res = await axiosInstance.get<Project>(
        `/project/${projectId}`,
        { withCredentials: true }
      );

      const status = res.data?.stageStatus || {};

      set((state) => ({
        stageStatuses: { ...state.stageStatuses, ...status },
        project: res.data,
      }));
    } catch {
      // silent
    }
  },

  advanceStage: async (fromStage) => {
    const { projectId } = get();
    if (!projectId) return;

    try {
      const res = await axiosInstance.post(
        `/pipeline/advance`,
        { projectId, fromStage },
        { withCredentials: true }
      );

      if (res.data?.stageStatuses) {
        set({ stageStatuses: res.data.stageStatuses });
      }

      await get().refreshStageStatus();
    } catch (err) {
      console.error("[useProjectStore] advanceStage error:", err);
    }
  },

  updateBOM: async (componentKey, replacement) => {
    const { projectId } = get();
    if (!projectId) return;

    try {
      const res = await axiosInstance.put(
        `/components/update`,
        { projectId, componentKey, replacement },
        { withCredentials: true }
      );

      set((state) => ({
        project: state.project
          ? {
              ...state.project,
              bom: res.data?.updatedBom ?? state.project.bom,
            }
          : state.project,
      }));

      set((state) => ({
        stageStatuses: {
          ...state.stageStatuses,
          build: "stale",
          simulation: "stale",
          assembly: "stale",
          shopping: "stale",
        },
      }));

      await get().refreshStageStatus();
    } catch (err) {
      console.error("[useProjectStore] updateBOM error:", err);
      throw err;
    }
  },

  // ??$$$ newer code
  syncWiring: async (nodeCoordinates, bomPhases, connections) => {
    const { projectId } = get();
    if (!projectId) return;

    try {
      const res = await axiosInstance.post(
        `/components/sync-wiring`,
        { projectId, nodeCoordinates, bomPhases, connections },
        { withCredentials: true }
      );

      set((state) => ({
        project: state.project
          ? {
              ...state.project,
              bom: res.data?.bom ?? state.project.bom,
              diagram: res.data?.diagram ?? state.project.diagram,
              nodeCoordinates: res.data?.nodeCoordinates ?? state.project.nodeCoordinates,
            }
          : state.project,
      }));

      set((state) => ({
        stageStatuses: {
          ...state.stageStatuses,
          build: "stale",
          simulation: "stale",
          assembly: "stale",
          shopping: "stale",
        },
      }));

      await get().refreshStageStatus();
      return res.data; // ??$$$ newer code
    } catch (err) {
      console.error("[useProjectStore] syncWiring error:", err);
      throw err;
    }
  },

  updateSketch: async (sketch, diagram) => {
    const { projectId } = get();
    if (!projectId) return;

    set((state) => ({
      project: state.project
        ? {
            ...state.project,
            sketch,
            diagram: diagram ?? state.project.diagram,
          }
        : state.project,
    }));

    try {
      const res = await axiosInstance.post(
        `/build/sync`,
        { projectId, sketch, diagram },
        { withCredentials: true }
      );

      set((state) => ({
        project: state.project
          ? {
              ...state.project,
              sketch: res.data?.sketch ?? sketch,
              diagram: res.data?.diagram ?? diagram ?? state.project.diagram,
            }
          : state.project,
      }));
    } catch (err) {
      console.error("[useProjectStore] updateSketch error:", err);
    }
  },

  updateDiagram: (diagram) => {
    set((state) => ({
      project: state.project
        ? { ...state.project, diagram }
        : state.project,
    }));
  },

  regenerateAssembly: async (sizePreference = "pocket", overrides = {}) => {
    const { projectId } = get();
    if (!projectId) return;

    try {
      const res = await axiosInstance.post(
        `/assembly/generate`,
        { projectId, sizePreference, overrides },
        { withCredentials: true }
      );

      set((state) => ({
        project: state.project
          ? {
              ...state.project,
              assemblyLayout:
                res.data?.assemblyLayout ?? state.project.assemblyLayout,
            }
          : state.project,
      }));

      await get().refreshStageStatus();
      return res.data;
    } catch (err) {
      console.error("[useProjectStore] regenerateAssembly error:", err);
      throw err;
    }
  },

  clearProject: () =>
    set({
      project: null,
      projectId: null,
      stageStatuses: DEFAULT_STAGES,
      isLoading: false,
      error: null,
    }),

  isStageUnlocked: (stage) =>
    get().stageStatuses[stage] !== "locked",

  isStageComplete: (stage) =>
    get().stageStatuses[stage] === "done",

  hasDownstreamStale: (stage) => {
    const STAGES: StageKey[] = [
      "ideation",
      "components",
      "build",
      "simulation",
      "assembly",
      "shopping",
    ];

    const fromIndex = STAGES.indexOf(stage);
    if (fromIndex === -1) return false;

    return STAGES.slice(fromIndex + 1).some(
      (s) => get().stageStatuses[s] === "stale"
    );
  },

  // Old code:
  // ideationReadiness: () => {
  //   const ctx = get().project?.extractedContext || {};
  //   const fields = [
  //     "board",
  //     "sensors",
  //     "outputs",
  //     "connectivity",
  //     "power",
  //     "projectSummary",
  //   ] as const;
  // 
  //   if (ctx.confidence && typeof ctx.confidence === "object") {
  //     const vals = fields.map((f) => Number(ctx.confidence?.[f] ?? 0));
  //     return Math.round(
  //       (vals.reduce((a, b) => a + b, 0) / fields.length) * 100
  //     );
  //   }
  // 
  //   const filled = fields.filter((f) => {
  //     const v = (ctx as any)[f];
  //     if (!v) return false;
  //     if (Array.isArray(v)) return v.length > 0;
  //     return String(v).trim().length > 0;
  //   });
  // 
  //   return Math.round((filled.length / fields.length) * 100);
  // },
  // ??$$$ Commented out old snapshot-based readiness per Section 9 instructions
  // ideationReadiness: () => {
  //   const snap = get().project?.ideation?.snapshot || {};
  //   const fields = [
  //     "corePurpose",
  //     "computeCore",
  //     "inputs",
  //     "outputs",
  //     "communication",
  //     "power",
  //     "constraints",
  //     "openQuestions",
  //   ];
  //   const filled = fields.reduce((acc, k) => {
  //     const v = (snap as any)[k];
  //     if (!v) return acc;
  //     if (Array.isArray(v)) return acc + (v.length > 0 ? 1 : 0);
  //     return acc + (String(v).trim().length > 0 ? 1 : 0);
  //   }, 0);
  //   return Math.round((filled / fields.length) * 100);
  // },
  // ??$$$ New simplified readiness check per Section 9 instructions
  ideationReadiness: () => get().project?.ideation?.readyForComponents ? 100 : 0,

  // ??$$$ Milestones actions
  generateMilestones: async (projectId) => {
    set({ isLoading: true, error: null });
    try {
      const res = await axiosInstance.post(`/build/${projectId}/milestones/generate`, {}, { withCredentials: true });
      set((state) => ({
        isLoading: false,
        project: state.project ? { 
          ...state.project, 
          milestones: res.data.milestones, 
          milestonesGenerated: true, 
          activeMilestoneId: res.data.activeMilestoneId 
        } : null
      }));
    } catch (err: any) {
      set({ isLoading: false, error: err?.response?.data?.error || "Failed to generate milestones" });
      throw err;
    }
  },

  loadMilestones: async (projectId) => {
    try {
      const res = await axiosInstance.get(`/build/${projectId}/milestones`, { withCredentials: true });
      set((state) => ({
        project: state.project ? { 
          ...state.project, 
          milestones: res.data.milestones, 
          activeMilestoneId: res.data.activeMilestoneId 
        } : null
      }));
    } catch (err) {
      console.error("Failed to load milestones", err);
    }
  },

  updateMilestone: async (projectId, milestoneId, updates) => {
    try {
      const res = await axiosInstance.put(`/build/${projectId}/milestones/${milestoneId}`, updates, { withCredentials: true });
      set((state) => {
        if (!state.project || !state.project.milestones) return {};
        const updated = state.project.milestones.map(m => m.id === milestoneId ? res.data : m);
        return {
          project: { ...state.project, milestones: updated }
        };
      });
    } catch (err) {
      console.error("Failed to update milestone", err);
    }
  },

  compileMilestone: async (projectId, milestoneId) => {
    try {
      const res = await axiosInstance.post(`/build/${projectId}/milestones/${milestoneId}/compile`, {}, { withCredentials: true });
      await get().loadMilestones(projectId);
      return res.data;
    } catch (err: any) {
      console.error("Compile milestone failed", err);
      return { success: false, errors: [err?.response?.data?.error || "Compile failed"] };
    }
  },

  confirmMilestone: async (projectId, milestoneId, serialOutput, notes) => {
    try {
      const res = await axiosInstance.post(`/build/${projectId}/milestones/${milestoneId}/confirm`, { serialOutput, notes }, { withCredentials: true });
      await get().loadMilestones(projectId);
      await get().refreshStageStatus();
      return res.data;
    } catch (err) {
      console.error("Confirm milestone failed", err);
      throw err;
    }
  },

  failMilestone: async (projectId, milestoneId, serialOutput, problem) => {
    try {
      const res = await axiosInstance.post(`/build/${projectId}/milestones/${milestoneId}/fail`, { serialOutput, problem }, { withCredentials: true });
      await get().loadMilestones(projectId);
      return res.data;
    } catch (err) {
      console.error("Fail milestone action failed", err);
      throw err;
    }
  },

  skipMilestone: async (projectId, milestoneId, notes) => {
    try {
      const res = await axiosInstance.post(`/build/${projectId}/milestones/${milestoneId}/skip`, { notes }, { withCredentials: true });
      await get().loadMilestones(projectId);
      await get().refreshStageStatus();
      return res.data;
    } catch (err) {
      console.error("Skip milestone failed", err);
      throw err;
    }
  },

  chatDebugCoach: async (projectId, milestoneId, message) => {
    try {
      const res = await axiosInstance.post(`/build/${projectId}/milestones/${milestoneId}/debug/chat`, { message }, { withCredentials: true });
      await get().loadMilestones(projectId);
      return res.data;
    } catch (err) {
      console.error("Debug chat failed", err);
      throw err;
    }
  },

  regenerateMilestoneCode: async (projectId, milestoneId) => {
    set({ isLoading: true });
    try {
      await axiosInstance.post(`/build/${projectId}/milestones/${milestoneId}/regenerate`, {}, { withCredentials: true });
      await get().loadMilestones(projectId);
      set({ isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      console.error("Regenerate milestone code failed", err);
    }
  },

  reportComponentIssue: async (projectId, milestoneId, componentKey, problem) => {
    try {
      const res = await axiosInstance.post(`/build/${projectId}/milestones/${milestoneId}/component-issue`, { componentKey, problem }, { withCredentials: true });
      return res.data;
    } catch (err) {
      console.error("Component issue report failed", err);
      throw err;
    }
  },

  validateSerial: async (projectId, milestoneId, actualOutput) => {
    try {
      const res = await axiosInstance.post(`/build/${projectId}/milestones/${milestoneId}/validate-serial`, { actualOutput }, { withCredentials: true });
      return res.data;
    } catch (err) {
      console.error("Validate serial failed", err);
      throw err;
    }
  },
}));

export default useProjectStore;