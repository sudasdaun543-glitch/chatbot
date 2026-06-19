import { useEffect, useRef, useState, useCallback } from "react";
import type { ChatMessage } from "../types";

type SendPayload = { type: string; content?: string };

export function useWebSocket(sessionId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/chat/${sessionId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onerror = () => setIsConnected(false);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as ChatMessage;
        const id = crypto.randomUUID();
        setMessages((prev) => [...prev, { ...msg, id }]);
      } catch {
        // ignore malformed messages
      }
    };

    return () => {
      ws.close();
    };
  }, [sessionId]);

  const send = useCallback((payload: SendPayload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      if (payload.type === "message" && payload.content) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: "message",
            role: "user",
            content: payload.content!,
            action: null,
            feedback: null,
          },
        ]);
      }
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  return { messages, send, isConnected };
}
