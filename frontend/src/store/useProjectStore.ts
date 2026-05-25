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

export type Project = {
  _id?: string;
  description?: string;
  bom?: any;
  sketch?: any;
  diagram?: any;
  assemblyLayout?: any;
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

  isStageUnlocked: (stage: StageKey) => boolean;
  isStageComplete: (stage: StageKey) => boolean;
  hasDownstreamStale: (stage: StageKey) => boolean;
  ideationReadiness: () => number;
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
}));

export default useProjectStore;