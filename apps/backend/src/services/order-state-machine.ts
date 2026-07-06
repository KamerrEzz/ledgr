export const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["pending_payment"],
  pending_payment: ["paid", "failed"],
  paid: ["fulfilled"],
  fulfilled: ["refunded"],
  failed: [],
  refunded: [],
};

export function canTransition(fromStatus: string, toStatus: string): boolean {
  return VALID_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;
}

export function getValidTransitions(status: string): string[] {
  return VALID_TRANSITIONS[status] ?? [];
}
