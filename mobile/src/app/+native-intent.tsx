import { appPath } from '../lib/links';

// Links into the app (from emails, push notifications or shared pages) use the
// website's addresses; this sends each to the matching screen.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try { return appPath(path) ?? path; } catch { return '/'; }
}
