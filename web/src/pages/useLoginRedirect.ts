import { useLocation } from "react-router";

export function useLoginRedirect(): string {
  const location = useLocation();
  return (location.state as { from?: string } | null)?.from ?? "/";
}
