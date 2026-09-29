import * as React from "react";

/** False during SSR and the first client render, true afterwards. Lets non-critical assets start loading after hydration. */
export function useHydrated() {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);
  return hydrated;
}
