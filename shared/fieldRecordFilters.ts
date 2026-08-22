export type FieldRecordFilter = {
  takenAt: string;
  destinationId: string;
  descriptionQuery?: string;
};

export type FilterableFieldRecord = {
  destinationId: string;
  takenAt?: string;
  description?: string;
};

export function filterFieldRecords<T extends FilterableFieldRecord>(records: T[], filter: FieldRecordFilter) {
  const normalizedQuery = (filter.descriptionQuery ?? "").trim().toLocaleLowerCase();
  return records.filter(record => {
    const matchesDate = !filter.takenAt || record.takenAt === filter.takenAt;
    const matchesDestination = !filter.destinationId || record.destinationId === filter.destinationId;
    const matchesDescription = !normalizedQuery || (record.description ?? "").toLocaleLowerCase().includes(normalizedQuery);
    return matchesDate && matchesDestination && matchesDescription;
  });
}

export function getSelectedFieldRecords<T extends FilterableFieldRecord & { storageKey: string }>(records: T[], selectedKeys: string[]) {
  const selectedKeySet = new Set(selectedKeys);
  return records.filter(record => selectedKeySet.has(record.storageKey));
}

export function toggleRecordSelection(selectedKeys: string[], recordKey: string) {
  return selectedKeys.includes(recordKey)
    ? selectedKeys.filter(key => key !== recordKey)
    : [...selectedKeys, recordKey];
}
