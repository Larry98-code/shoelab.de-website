// Over-the-air updates: while the 0–100 % opening plays, look for a newer
// version of the app. If it arrives within a few seconds, restart straight
// into it; otherwise it finishes downloading in the background and is used
// on the next launch. Native changes still need a new build (the "fingerprint"
// runtime version keeps an update from ever reaching an app it doesn't fit).
import { useEffect, useState } from 'react';
import * as Updates from 'expo-updates';

const WAIT_MS = 3000;

// true once the check is done (or skipped, or too slow)
export function useLaunchUpdate(): boolean {
  const [done, setDone] = useState(!Updates.isEnabled || __DEV__);
  useEffect(() => {
    if (!Updates.isEnabled || __DEV__) return;
    let waiting = true;
    const give = setTimeout(() => { waiting = false; setDone(true); }, WAIT_MS);
    (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (check.isAvailable) {
          const got = await Updates.fetchUpdateAsync();
          if (got.isNew && waiting) { await Updates.reloadAsync(); return; }
        }
      } catch { /* offline or no update: carry on */ }
      if (waiting) { clearTimeout(give); setDone(true); }
    })();
    return () => clearTimeout(give);
  }, []);
  return done;
}
