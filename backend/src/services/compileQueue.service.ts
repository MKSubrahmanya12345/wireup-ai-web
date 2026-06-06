// ??$$$ newer code - Compilation Queue Serialization
import { logPipelineStage, logPipelineFailure } from "./validation.service";

type CompileTask = {
  taskFn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  projectId?: string;
  subsystem: "ideation" | "bom" | "wiring" | "diagram" | "milestones" | "firmware" | "compilation" | "simulation" | "physicalBuild";
};

class CompileQueueService {
  private queue: CompileTask[] = [];
  private processing = false;

  /**
   * Enqueues a compilation or library installation task.
   * Returns a Promise that resolves when the task finishes execution.
   */
  public async enqueue<T>(
    taskFn: () => Promise<T>,
    projectId?: string,
    subsystem: "ideation" | "bom" | "wiring" | "diagram" | "milestones" | "firmware" | "compilation" | "simulation" | "physicalBuild" = "compilation"
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        taskFn,
        resolve,
        reject,
        projectId,
        subsystem,
      });
      console.log(`[CompileQueue] Task enqueued. Queue length: ${this.queue.length}`);
      this.processNext();
    });
  }

  private async processNext() {
    if (this.processing) return;
    if (this.queue.length === 0) return;

    this.processing = true;
    const task = this.queue.shift();

    if (!task) {
      this.processing = false;
      return;
    }

    console.log(`[CompileQueue] Starting execution of task. Subsystem: ${task.subsystem}`);
    try {
      if (task.projectId) {
        await logPipelineStage(task.projectId, task.subsystem, "running", {
          process: ["Initializing compilation workspace", "Running sequential compilation lock queue"],
        });
      }

      const result = await task.taskFn();

      if (task.projectId) {
        await logPipelineStage(task.projectId, task.subsystem, "done", {
          process: ["Sequential compilation queue lock released", "Build completed successfully"],
          outputs: { success: true, resultSummary: result?.summary || "Compile Succeeded" },
        });
      }

      task.resolve(result);
    } catch (err: any) {
      console.error(`[CompileQueue] Task failed in queue:`, err);

      if (task.projectId) {
        await logPipelineFailure(
          task.projectId,
          task.subsystem,
          {},
          err.message || "Compile Queue execution error",
          "arduino-cli compilation queue error",
          "Auto-retrying / releasing lock",
          "failed"
        );

        await logPipelineStage(task.projectId, task.subsystem, "failed", {
          process: ["Sequential compilation queue error occurred"],
          validationStatus: { valid: false, errors: [err.message || "Compile failed"], warnings: [] },
        });
      }

      task.reject(err);
    } finally {
      this.processing = false;
      // Yield CPU then run next
      setTimeout(() => this.processNext(), 50);
    }
  }
}

export const compileQueue = new CompileQueueService();
