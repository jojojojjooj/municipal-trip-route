import type { ExecutionStatus } from "./tripOperations";

export type OfflineQueueTaskStatus = "pending" | "conflict" | "failed";

export type OfflinePhotoQueueTask = {
  id: string;
  kind: "photo_upload";
  status: OfflineQueueTaskStatus;
  createdAt: string;
  attempts: number;
  nextRetryAt: string;
  destinationId: string;
  fileName: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  contentBase64: string;
};

export type OfflineStopExecutionQueueTask = {
  id: string;
  kind: "stop_execution";
  status: OfflineQueueTaskStatus;
  createdAt: string;
  attempts: number;
  nextRetryAt: string;
  tripId: number;
  stopId: number;
  baseExecutionStatus: ExecutionStatus;
  executionStatus: ExecutionStatus;
  completedAt: string | null;
  issueNote: string | null;
  issueOwner: string | null;
  issueDueAt: string | null;
  issueResolvedAt: string | null;
  remoteExecutionStatus?: ExecutionStatus;
};

export type OfflineQueueTask =
  | OfflinePhotoQueueTask
  | OfflineStopExecutionQueueTask;

const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;

export function getOfflineQueueRetryDelay(attempts: number) {
  const normalizedAttempts = Math.max(0, Math.floor(attempts));
  return Math.min(1_000 * 2 ** normalizedAttempts, MAX_RETRY_DELAY_MS);
}

export function getOfflineQueueSummary(tasks: OfflineQueueTask[]) {
  return tasks.reduce(
    (summary, task) => {
      summary.total += 1;
      if (task.status === "pending") summary.pending += 1;
      if (task.status === "conflict") summary.conflicts += 1;
      if (task.status === "failed") summary.failed += 1;
      if (task.kind === "photo_upload") summary.photos += 1;
      if (task.kind === "stop_execution") summary.executionUpdates += 1;
      return summary;
    },
    {
      total: 0,
      pending: 0,
      conflicts: 0,
      failed: 0,
      photos: 0,
      executionUpdates: 0,
    }
  );
}

export function isOfflineQueueTaskReady(
  task: OfflineQueueTask,
  now = new Date()
) {
  return (
    task.status === "pending" &&
    new Date(task.nextRetryAt).getTime() <= now.getTime()
  );
}

export function shouldDetectExecutionConflict(input: {
  baseExecutionStatus: ExecutionStatus;
  intendedExecutionStatus: ExecutionStatus;
  remoteExecutionStatus: ExecutionStatus;
}) {
  return (
    input.remoteExecutionStatus !== input.baseExecutionStatus &&
    input.remoteExecutionStatus !== input.intendedExecutionStatus
  );
}

export function markOfflineQueueTaskRetry(
  task: OfflineQueueTask,
  now = new Date()
): OfflineQueueTask {
  const attempts = task.attempts + 1;
  return {
    ...task,
    attempts,
    nextRetryAt: new Date(
      now.getTime() + getOfflineQueueRetryDelay(attempts)
    ).toISOString(),
  };
}
