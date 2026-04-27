import { useState, useEffect } from "react";
import { api } from "@/services/api";

export function useHealthCheck(intervalMs = 30000) {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const data = await api.health();
        setIsOnline(data?.status === "healthy" || data?.status === "ok" || !!data);
      } catch {
        setIsOnline(false);
      }
    };
    check();
    const id = setInterval(check, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return isOnline;
}
