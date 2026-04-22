import { useMemo } from "react";
import { createApi } from "@/lib/api";

/** Base URL empty in dev (Vite proxy); set VITE_API_URL for production build against a real host. */
export function useApi() {
  const base = import.meta.env.VITE_API_URL ?? "";
  return useMemo(() => createApi(base), []);
}
