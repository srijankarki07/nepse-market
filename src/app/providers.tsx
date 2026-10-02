"use client";

/**
 * TanStack Query, for the pages that fetch at runtime.
 *
 * The site has no server, so every page loads its own data in the browser. Query handles
 * the parts that are boring to write and easy to get wrong: deduplicating the requests a
 * page makes for the same session, keeping a loading state, retrying a CDN blip, and
 * caching a result the moment the user navigates back.
 *
 * `refetchOnWindowFocus` is off deliberately. The archive publishes once a day, so
 * refetching because somebody alt-tabbed would spend requests to learn nothing. The only
 * thing that changes the data is the data changing, and a reload picks that up.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  // Created in state rather than at module scope: a module-level client would be shared
  // across requests if this ever ran on a server, which is the classic way a cache leaks
  // one user's data into another's page.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 30 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 2,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
