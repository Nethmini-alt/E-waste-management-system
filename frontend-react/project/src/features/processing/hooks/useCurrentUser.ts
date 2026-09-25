import { useAuth } from '../../auth/AuthContext';
import type { CurrentUser } from '../types';

/**
 * AuthContext is a .jsx file, so TypeScript infers useAuth()'s return as `never`.
 * This wrapper restores the real shape without touching the shared auth code.
 */
export const useCurrentUser = (): CurrentUser | null => {
  const auth = useAuth() as unknown as { user: CurrentUser | null };
  return auth.user;
};
