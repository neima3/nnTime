export type AuthRequestLock = {
  current: boolean;
};

export function acquireAuthRequest(lock: AuthRequestLock): boolean {
  if (lock.current) {
    return false;
  }
  lock.current = true;
  return true;
}

export function releaseAuthRequest(lock: AuthRequestLock): void {
  lock.current = false;
}
