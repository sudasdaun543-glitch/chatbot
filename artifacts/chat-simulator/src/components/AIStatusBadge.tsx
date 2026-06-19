import { useEffect, useState, useCallback } from "react";
import type { AIStatus } from "../types";

const POLL_INTERVAL_MS = 8000;

export default function AIStatusBadge() {
  const [status, setStatus] = useState<AIStatus>({
    status: "checking",
    model: "",
    base_url: "",
    error: null,
  });

  const checkStatus = useCallback(async () => {
    try {
      const resp = await fetch("/api/ai-status");
      const data: AIStatus = await resp.json();
      setStatus(data);
    } catch {
      setStatus({
        status: "offline",
        model: "",
        base_url: "",
        error: "Не удалось достучаться до бэкенда",
      });
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const timer = setInterval(checkStatus, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [checkStatus]);

  const dot =
    status.status === "online"
      ? "🟢"
      : status.status === "offline"
        ? "🔴"
        : "🟡";

  const label =
    status.status === "online"
      ? "AI: онлайн"
      : status.status === "offline"
        ? "AI: офлайн"
        : "AI: проверка...";

  const tooltip = status.error
    ? `${status.base_url} / ${status.model}\nОшибка: ${status.error}`
    : `${status.base_url} / ${status.model}`;

  return (
    <span className="ai-status-badge" title={tooltip}>
      {dot} {label}
    </span>
  );
}
