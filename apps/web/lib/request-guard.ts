// Guards against out-of-order async responses clobbering newer UI state.
// Each call site issues a token before starting an async operation, then
// checks isCurrent(token) before applying the result. A response for an
// older issue()'d token that resolves after a newer one is dropped.
export interface RequestGuard {
  issue(): number;
  isCurrent(token: number): boolean;
}

export function createRequestGuard(): RequestGuard {
  let latest = 0;
  return {
    issue() {
      latest += 1;
      return latest;
    },
    isCurrent(token: number) {
      return token === latest;
    },
  };
}
