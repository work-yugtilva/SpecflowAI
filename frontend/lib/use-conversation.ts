"use client";

import { useCallback, useRef, useState } from "react";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface UseConversationOptions {
  sessionId: string | null;
  contextKeys?: string[];
  maxHistory?: number;
}

export interface UseConversationReturn {
  messages: Message[];
  isStreaming: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  abortStream: () => void;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const STREAMING_ID = "streaming";

export function useConversation({
  sessionId,
  contextKeys = [],
  maxHistory = 20,
}: UseConversationOptions): UseConversationReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep a ref to always-current messages so sendMessage can read them without
  // going stale and without adding messages to its dep array (which would recreate
  // the function every keystroke).
  const messagesRef = useRef<Message[]>(messages);
  const isStreamingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Keep refs in sync on every render
  messagesRef.current = messages;
  isStreamingRef.current = isStreaming;

  const abortStream = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const clearMessages = useCallback(() => {
    abortControllerRef.current?.abort();
    setMessages([]);
    setError(null);
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!sessionId || isStreamingRef.current) return;

      setError(null);

      // Build payload from current history BEFORE mutating state
      const currentMessages = messagesRef.current.filter(
        (m) => m.id !== STREAMING_ID
      );
      const payloadMessages = [
        ...currentMessages
          .slice(-(maxHistory - 1))
          .map(({ role, content: c }) => ({ role, content: c })),
        { role: "user" as const, content },
      ];

      const userMessage: Message = {
        id: randomId(),
        role: "user",
        content,
        timestamp: Date.now(),
      };

      const assistantPlaceholder: Message = {
        id: STREAMING_ID,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const res = await fetch(`/api/sessions/${sessionId}/conversation`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: payloadMessages,
            session_context_keys: contextKeys,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          let errMsg = `Request failed (${res.status})`;
          try {
            const j = (await res.json()) as { error?: string; detail?: string };
            errMsg = j.error ?? j.detail ?? errMsg;
          } catch {
            /* keep default */
          }
          throw new Error(errMsg);
        }

        if (!res.body) throw new Error("Empty response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              let event: { type: string; content?: string; message?: string };
              try {
                event = JSON.parse(line.slice(6)) as typeof event;
              } catch {
                continue;
              }

              if (event.type === "token" && event.content) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === STREAMING_ID
                      ? { ...m, content: m.content + event.content! }
                      : m
                  )
                );
              } else if (event.type === "done") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === STREAMING_ID ? { ...m, id: randomId() } : m
                  )
                );
              } else if (event.type === "error") {
                throw new Error(event.message ?? "Stream error");
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // Finalize whatever was streamed when user aborts
          setMessages((prev) =>
            prev.map((m) =>
              m.id === STREAMING_ID ? { ...m, id: randomId() } : m
            )
          );
        } else {
          const msg = err instanceof Error ? err.message : "Conversation failed";
          setError(msg);
          setMessages((prev) => prev.filter((m) => m.id !== STREAMING_ID));
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [sessionId, contextKeys, maxHistory]
  );

  return { messages, isStreaming, error, sendMessage, clearMessages, abortStream };
}
