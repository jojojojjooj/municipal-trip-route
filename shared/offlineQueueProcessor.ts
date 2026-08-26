import type { ExecutionStatus } from "./tripOperations";
import {
  isOfflineQueueTaskReady,
  markOfflineQueueTaskRetry,
  shouldDetectExecutionConflict,
  type OfflinePhotoQueueTask,
  type OfflineQueueTask,
  type OfflineStopExecutionQueueTask,
} from "./offlineQueue";

export type OfflineQueueProcessor = {
  uploadPhoto: (task: OfflinePhotoQueueTask) => Promise<{
    storageKey: string;
    url: string;
    fileName: string;
  }>;
  getStopExecutionStatus: (
    task: OfflineStopExecutionQueueTask
  ) => Promise<ExecutionStatus | undefined>;
  updateStopExecution: (task: OfflineStopExecutionQueueTask) => Promise<void>;
  onPhotoUploaded: (
    task: OfflinePhotoQueueTask,
    photo: { storageKey: string; url: string; fileName: string }
  ) => Promise<void> | void;
  onTaskUpdated: (task: OfflineQueueTask) => Promise<void> | void;
  onTaskCompleted: (task: OfflineQueueTask) => Promise<void> | void;
};

export async function processOfflineQueueTasks(
  tasks: OfflineQueueTask[],
  processor: OfflineQueueProcessor,
  now = new Date()
) {
  for (const task of tasks) {
    if (!isOfflineQueueTaskReady(task, now)) continue;
    try {
      if (task.kind === "photo_upload") {
        const photo = await processor.uploadPhoto(task);
        await processor.onPhotoUploaded(task, photo);
        await processor.onTaskCompleted(task);
        continue;
      }

      const remoteExecutionStatus =
        await processor.getStopExecutionStatus(task);
      if (!remoteExecutionStatus) {
        await processor.onTaskUpdated(markOfflineQueueTaskRetry(task, now));
        continue;
      }
      if (
        shouldDetectExecutionConflict({
          baseExecutionStatus: task.baseExecutionStatus,
          intendedExecutionStatus: task.executionStatus,
          remoteExecutionStatus,
        })
      ) {
        await processor.onTaskUpdated({
          ...task,
          status: "conflict",
          remoteExecutionStatus,
        });
        continue;
      }

      await processor.updateStopExecution(task);
      await processor.onTaskCompleted(task);
    } catch {
      await processor.onTaskUpdated(markOfflineQueueTaskRetry(task, now));
    }
  }
}
