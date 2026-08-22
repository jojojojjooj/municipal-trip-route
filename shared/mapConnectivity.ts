export const MAP_AUTO_RETRY_LIMIT = 3;
export const MAP_AUTO_RETRY_DELAY_SECONDS = 3;

export function getScheduledMapRetryAttempt(completedAttempts: number) {
  return Math.min(completedAttempts + 1, MAP_AUTO_RETRY_LIMIT);
}

export function shouldScheduleMapRetry(isOnline: boolean, completedAttempts: number) {
  return isOnline && completedAttempts < MAP_AUTO_RETRY_LIMIT;
}
