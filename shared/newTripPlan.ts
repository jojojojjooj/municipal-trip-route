export type NewTripPromptState = {
  title: string;
  managerName: string;
  destinationCount: number;
  hasFixedStart: boolean;
  selectedPlanId: number | null;
};

export function createNewTripDraft(tripDate: string) {
  return {
    title: "",
    tripDate,
    managerName: "",
    fixedStartQuery: "",
    addressQuery: "",
    returnToStart: false,
    selectedPlanId: null,
    fieldRecordFilter: { takenAt: "", destinationId: "", descriptionQuery: "" },
  };
}

export function hasNewTripContent(state: NewTripPromptState) {
  return Boolean(
    state.title.trim()
    || state.managerName.trim()
    || state.destinationCount
    || state.hasFixedStart
    || state.selectedPlanId !== null,
  );
}
