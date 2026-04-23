import { useEffect, useState } from 'react';

import { fetchAuthenticatedImageDataUri } from '@/lib/fetch-authenticated-image';

/** Fetches a Bearer-protected image URL into a `data:` URI for `<Image source={{ uri }} />`. */
export function useAuthenticatedImageDataUri(
  path: string | null | undefined,
  enabled: boolean,
  token: string | null | undefined,
  bustKey: string | number | undefined
): { uri: string | null; loading: boolean } {
  const [uri, setUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !path?.trim() || !token) {
      setUri(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setUri(null);

    void (async () => {
      const u = await fetchAuthenticatedImageDataUri(path, token);
      if (!cancelled) {
        setUri(u);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, path, token, bustKey]);

  return { uri, loading };
}
