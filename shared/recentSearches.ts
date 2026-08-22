export const MAX_RECENT_SEARCHES = 5;

export function normalizeRecentSearch(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function addRecentSearch(searches: string[], query: string, limit = MAX_RECENT_SEARCHES) {
  const normalized = normalizeRecentSearch(query);
  if (!normalized) return searches;
  const duplicateIndex = searches.findIndex(search => search.toLocaleLowerCase() === normalized.toLocaleLowerCase());
  const withoutDuplicate = duplicateIndex === -1 ? searches : searches.filter((_, index) => index !== duplicateIndex);
  return [normalized, ...withoutDuplicate].slice(0, limit);
}

export function removeRecentSearch(searches: string[], query: string) {
  return searches.filter(search => search !== query);
}
