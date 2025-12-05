import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Track if we've already triggered a session expiration redirect
let sessionExpiredRedirectTriggered = false;

// Handle session expiration - redirect to home with a message
function handleSessionExpired() {
  // Prevent multiple redirects
  if (sessionExpiredRedirectTriggered) return;
  sessionExpiredRedirectTriggered = true;
  
  // Store a flag for the toast message
  sessionStorage.setItem('session_expired', 'true');
  
  // Redirect to home page
  if (window.location.pathname !== '/') {
    window.location.href = '/';
  }
  
  // Reset the flag after a short delay (in case they log back in)
  setTimeout(() => {
    sessionExpiredRedirectTriggered = false;
  }, 2000);
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // Handle session expiration for mutations
  if (res.status === 401) {
    handleSessionExpired();
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw" | "redirect";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (res.status === 401) {
      if (unauthorizedBehavior === "returnNull") {
        return null;
      }
      if (unauthorizedBehavior === "redirect") {
        handleSessionExpired();
        return null;
      }
      // For "throw" behavior, still redirect but also throw
      handleSessionExpired();
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 3 * 60 * 1000, // 3 minutes - balance between freshness and performance
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
