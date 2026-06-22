"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { TENANT_ID } from "@/lib/constants";
import { getWsUrl } from "@/lib/env";
import { handleRealtimeEvent } from "@/lib/realtime/handlers";
import { parseRealtimeEvent } from "@/lib/realtime/parse-event";
import type {
  RealtimeConnectionStatus,
  RealtimeContextValue,
} from "@/lib/realtime/types";

const BASE_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] =
    useState<RealtimeConnectionStatus>("disconnected");
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const unmountedRef = useRef(false);
  const hasConnectedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;

    function clearReconnectTimer() {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    }

    function scheduleReconnect() {
      if (unmountedRef.current) return;

      clearReconnectTimer();
      const delay = Math.min(
        BASE_RECONNECT_MS * 2 ** reconnectAttemptRef.current,
        MAX_RECONNECT_MS,
      );

      setStatus("reconnecting");
      reconnectTimerRef.current = setTimeout(() => {
        reconnectAttemptRef.current += 1;
        connect();
      }, delay);
    }

    function connect() {
      if (unmountedRef.current) return;

      clearReconnectTimer();

      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }

      if (!hasConnectedRef.current) {
        setStatus("reconnecting");
      } else {
        setStatus("reconnecting");
      }

      let ws: WebSocket;
      try {
        ws = new WebSocket(getWsUrl(TENANT_ID));
      } catch {
        setStatus("disconnected");
        scheduleReconnect();
        return;
      }

      wsRef.current = ws;

      ws.onopen = () => {
        if (unmountedRef.current) return;
        hasConnectedRef.current = true;
        reconnectAttemptRef.current = 0;
        setStatus("connected");
      };

      ws.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        const parsed = parseRealtimeEvent(event.data);
        if (!parsed) return;
        setLastEventAt(new Date());
        handleRealtimeEvent(parsed);
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onclose = () => {
        if (unmountedRef.current) return;
        wsRef.current = null;
        if (!hasConnectedRef.current) {
          setStatus("disconnected");
        }
        scheduleReconnect();
      };
    }

    connect();

    return () => {
      unmountedRef.current = true;
      clearReconnectTimer();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const value = useMemo<RealtimeContextValue>(
    () => ({ status, lastEventAt }),
    [status, lastEventAt],
  );

  return (
    <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeContextValue {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error("useRealtime must be used within RealtimeProvider");
  }
  return context;
}
