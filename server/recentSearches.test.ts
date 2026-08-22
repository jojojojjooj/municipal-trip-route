import { describe, expect, it } from "vitest";
import { addRecentSearch, MAX_RECENT_SEARCHES, normalizeRecentSearch, removeRecentSearch } from "../shared/recentSearches";

describe("recent field record searches", () => {
  it("normalizes whitespace and moves duplicate queries to the most recent position", () => {
    expect(normalizeRecentSearch("  안내   표지판 ")).toBe("안내 표지판");
    expect(addRecentSearch(["보행로", "안내 표지판"], " 안내 표지판 ")).toEqual(["안내 표지판", "보행로"]);
  });

  it("limits history length and removes individual entries", () => {
    const searches = ["하나", "둘", "셋", "넷", "다섯"];
    expect(addRecentSearch(searches, "여섯")).toEqual(["여섯", "하나", "둘", "셋", "넷"]);
    expect(addRecentSearch(searches, "여섯")).toHaveLength(MAX_RECENT_SEARCHES);
    expect(removeRecentSearch(searches, "셋")).toEqual(["하나", "둘", "넷", "다섯"]);
  });
});
