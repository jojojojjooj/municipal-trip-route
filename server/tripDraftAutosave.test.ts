import { afterEach, describe, expect, it, vi } from "vitest";
import { getTripDraftStatusCopy, resolveTripDraftAccountSync, scheduleTripDraftInputSave, startTripDraftAccountSync, TRIP_DRAFT_ACCOUNT_SYNC_INTERVAL_MS, TRIP_DRAFT_INPUT_DEBOUNCE_MS } from "../shared/tripDraftAutosave";

describe("trip draft autosave timing and fallback", () => {
  afterEach(() => vi.useRealTimers());

  it("waits 750ms after input before persisting the local draft", () => {
    vi.useFakeTimers();
    const save = vi.fn();
    scheduleTripDraftInputSave(save);
    vi.advanceTimersByTime(TRIP_DRAFT_INPUT_DEBOUNCE_MS - 1);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("retries account synchronization every 20 seconds", () => {
    vi.useFakeTimers();
    const sync = vi.fn();
    const stop = startTripDraftAccountSync(sync);
    vi.advanceTimersByTime(TRIP_DRAFT_ACCOUNT_SYNC_INTERVAL_MS * 2);
    expect(sync).toHaveBeenCalledTimes(2);
    stop();
    vi.advanceTimersByTime(TRIP_DRAFT_ACCOUNT_SYNC_INTERVAL_MS);
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it("keeps the browser payload and shows a recovery message when account sync fails", () => {
    const failure = resolveTripDraftAccountSync("local-draft", false);
    expect(failure).toEqual({ pendingPayload: "local-draft", status: "local" });
    expect(getTripDraftStatusCopy(failure.status)).toMatchObject({
      title: "브라우저에만 임시 보관됨",
      detail: expect.stringContaining("실패"),
    });
  });
});
