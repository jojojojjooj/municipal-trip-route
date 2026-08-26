import { describe, expect, it } from "vitest";
import {
  getOfflineQueueRetryDelay,
  getOfflineQueueSummary,
  shouldDetectExecutionConflict,
  type OfflineQueueTask,
} from "../shared/offlineQueue";
import { processOfflineQueueTasks } from "../shared/offlineQueueProcessor";

const now = new Date("2026-08-26T00:00:00.000Z");

function stopTask(
  overrides: Partial<Extract<OfflineQueueTask, { kind: "stop_execution" }>> = {}
): Extract<OfflineQueueTask, { kind: "stop_execution" }> {
  return {
    id: "task-1",
    kind: "stop_execution",
    status: "pending",
    createdAt: now.toISOString(),
    attempts: 0,
    nextRetryAt: now.toISOString(),
    tripId: 1,
    stopId: 2,
    baseExecutionStatus: "planned",
    executionStatus: "completed",
    completedAt: now.toISOString(),
    issueNote: null,
    issueOwner: null,
    issueDueAt: null,
    issueResolvedAt: null,
    ...overrides,
  };
}

describe("offline queue", () => {
  it("summarizes queued work and uses capped exponential retry delays", () => {
    expect(getOfflineQueueRetryDelay(0)).toBe(1_000);
    expect(getOfflineQueueRetryDelay(10)).toBe(5 * 60 * 1000);
    expect(
      getOfflineQueueSummary([
        stopTask(),
        {
          ...stopTask({ id: "task-2", status: "conflict" }),
          kind: "photo_upload",
          destinationId: "local-stop",
          fileName: "현장.png",
          mimeType: "image/png",
          contentBase64: "abc",
        },
      ])
    ).toMatchObject({ total: 2, pending: 1, conflicts: 1, photos: 1 });
  });

  it("detects only divergent remote execution status as a user-resolvable conflict", () => {
    expect(
      shouldDetectExecutionConflict({
        baseExecutionStatus: "planned",
        intendedExecutionStatus: "completed",
        remoteExecutionStatus: "issue",
      })
    ).toBe(true);
    expect(
      shouldDetectExecutionConflict({
        baseExecutionStatus: "planned",
        intendedExecutionStatus: "completed",
        remoteExecutionStatus: "completed",
      })
    ).toBe(false);
  });

  it("marks divergent execution updates as conflicts without applying a write", async () => {
    const updated: OfflineQueueTask[] = [];
    let writeCount = 0;
    await processOfflineQueueTasks(
      [stopTask()],
      {
        uploadPhoto: async () => ({
          storageKey: "unused",
          url: "unused",
          fileName: "unused",
        }),
        getStopExecutionStatus: async () => "issue",
        updateStopExecution: async () => {
          writeCount += 1;
        },
        onPhotoUploaded: async () => undefined,
        onTaskUpdated: async task => updated.push(task),
        onTaskCompleted: async () => undefined,
      },
      now
    );
    expect(writeCount).toBe(0);
    expect(updated[0]).toMatchObject({
      status: "conflict",
      remoteExecutionStatus: "issue",
    });
  });
});
