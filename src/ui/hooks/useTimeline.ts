import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Account, Status, TimelineType } from "../../domain/types";
import type { MastodonApi } from "../../services/MastodonApi";
import type { StreamingClient } from "../../services/StreamingClient";

const TIMELINE_POLICY: Record<TimelineType, { maxItems: number; flushInterval: number; maxPending: number }> = {
  home: { maxItems: 400, flushInterval: 300, maxPending: 200 },
  local: { maxItems: 600, flushInterval: 400, maxPending: 240 },
  federated: { maxItems: 800, flushInterval: 500, maxPending: 260 },
  social: { maxItems: 600, flushInterval: 400, maxPending: 220 },
  global: { maxItems: 800, flushInterval: 500, maxPending: 260 },
  notifications: { maxItems: 300, flushInterval: 400, maxPending: 120 },
  bookmarks: { maxItems: 500, flushInterval: 400, maxPending: 0 }
};

const capItems = (items: Status[], maxItems: number): Status[] => {
  if (items.length <= maxItems) {
    return items;
  }
  return items.slice(0, maxItems);
};

const mergeStatus = (items: Status[], next: Status): Status[] => {
  const index = items.findIndex((item) => item.id === next.id);
  if (index >= 0) {
    const copy = [...items];
    copy[index] = next;
    return copy;
  }
  return [next, ...items];
};

const replaceStatus = (items: Status[], next: Status): Status[] => {
  let updated = false;
  const copy = items.map((item) => {
    if (item.id === next.id) {
      updated = true;
      return next;
    }
    if (item.reblog && item.reblog.id === next.id) {
      updated = true;
      return { ...item, reblog: next };
    }
    return item;
  });
  return updated ? copy : items;
};

const appendStatuses = (items: Status[], next: Status[]): Status[] => {
  const existing = new Set(items.map((item) => item.id));
  const filtered = next.filter((item) => !existing.has(item.id));
  return [...items, ...filtered];
};

export const useTimeline = (params: {
  account: Account | null;
  api: MastodonApi;
  streaming: StreamingClient;
  timelineType: TimelineType;
  onNotification?: () => void;
  enableStreaming?: boolean;
  pauseUpdates?: boolean;
  maxItems?: number;
  flushInterval?: number;
  maxPending?: number;
}) => {
  const {
    account,
    api,
    streaming,
    timelineType,
    onNotification,
    enableStreaming = true,
    pauseUpdates = false,
    maxItems,
    flushInterval,
    maxPending
  } = params;
  const policy = TIMELINE_POLICY[timelineType];
  const resolvedMaxItems = maxItems ?? policy.maxItems;
  const resolvedFlushInterval = flushInterval ?? policy.flushInterval;
  const resolvedMaxPending = maxPending ?? policy.maxPending;
  const [items, setItems] = useState<Status[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const disconnectRef = useRef<null | (() => void)>(null);
  const notificationDisconnectRef = useRef<null | (() => void)>(null);
  const notificationRef = useRef<(() => void) | null>(null);
  const pauseUpdatesRef = useRef(pauseUpdates);
  const pendingUpdatesRef = useRef<Status[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    notificationRef.current = onNotification ?? null;
  }, [onNotification]);

  useEffect(() => {
    pauseUpdatesRef.current = pauseUpdates;
  }, [pauseUpdates]);

  const refresh = useCallback(async () => {
    if (!account) {
      return;
    }
    setLoading(true);
    setError(null);
    setItems([]);
    setPendingCount(0);
    pendingUpdatesRef.current = [];
    try {
      let timeline: Status[];
      if (timelineType === "bookmarks") {
        timeline = await api.fetchBookmarks(account, 30);
      } else {
        timeline = await api.fetchTimeline(account, timelineType, 30);
      }
      setItems(capItems(timeline, resolvedMaxItems));
      setHasMore(timeline.length > 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "타임라인을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [account, api, resolvedMaxItems, timelineType]);

  const loadMore = useCallback(async () => {
    if (!account || loadingMore || loading) {
      return;
    }
    const lastId = items[items.length - 1]?.id;
    if (!lastId || !hasMore) {
      return;
    }
    setLoadingMore(true);
    try {
      let next: Status[];
      if (timelineType === "bookmarks") {
        next = await api.fetchBookmarks(account, 20, lastId);
      } else {
        next = await api.fetchTimeline(account, timelineType, 20, lastId);
      }
      setItems((current) => capItems(appendStatuses(current, next), resolvedMaxItems));
      if (next.length === 0) {
        setHasMore(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "추가 글을 불러오지 못했습니다.");
    } finally {
      setLoadingMore(false);
    }
  }, [account, api, hasMore, items, loading, loadingMore, resolvedMaxItems, timelineType]);

  useEffect(() => {
    if (!account) {
      setItems([]);
      setHasMore(false);
      setPendingCount(0);
      pendingUpdatesRef.current = [];
      return;
    }
    refresh();
  }, [account, refresh]);

  const syncPendingCount = useCallback(() => {
    setPendingCount(pendingUpdatesRef.current.length);
  }, []);

  const schedulePendingCountSync = useCallback(() => {
    if (pendingCountTimerRef.current !== null) {
      return;
    }
    pendingCountTimerRef.current = setTimeout(() => {
      pendingCountTimerRef.current = null;
      syncPendingCount();
    }, resolvedFlushInterval);
  }, [resolvedFlushInterval, syncPendingCount]);

  const flushPendingUpdates = useCallback(() => {
    const batch = pendingUpdatesRef.current;
    if (batch.length === 0) {
      return;
    }
    pendingUpdatesRef.current = [];
    setPendingCount(0);
    setItems((current) => {
      let next = current;
      for (const status of batch) {
        next = mergeStatus(next, status);
      }
      return capItems(next, resolvedMaxItems);
    });
  }, [resolvedMaxItems]);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current !== null) {
      return;
    }
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      flushPendingUpdates();
    }, resolvedFlushInterval);
  }, [flushPendingUpdates, resolvedFlushInterval]);

  const enqueuePendingUpdate = useCallback(
    (status: Status) => {
      if (resolvedMaxPending === 0) {
        return;
      }
      pendingUpdatesRef.current.push(status);
      if (pendingUpdatesRef.current.length > resolvedMaxPending) {
        pendingUpdatesRef.current = pendingUpdatesRef.current.slice(-resolvedMaxPending);
      }
      if (pauseUpdatesRef.current) {
        schedulePendingCountSync();
        return;
      }
      scheduleFlush();
    },
    [resolvedMaxPending, scheduleFlush, schedulePendingCountSync]
  );

  const dropPendingUpdate = useCallback(
    (statusId: string) => {
      if (pendingUpdatesRef.current.length === 0) {
        return;
      }
      const next = pendingUpdatesRef.current.filter((item) => item.id !== statusId);
      if (next.length === pendingUpdatesRef.current.length) {
        return;
      }
      pendingUpdatesRef.current = next;
      if (pauseUpdatesRef.current) {
        schedulePendingCountSync();
      }
    },
    [schedulePendingCountSync]
  );

  useEffect(() => {
    disconnectRef.current?.();
    disconnectRef.current = null;
    notificationDisconnectRef.current?.();
    notificationDisconnectRef.current = null;
    if (!account || !enableStreaming || timelineType === "bookmarks") {
      return;
    }

    disconnectRef.current = streaming.connect(account, timelineType, (event) => {
      if (event.type === "update") {
        if (timelineType !== "notifications") {
          enqueuePendingUpdate(event.status);
        }
      } else if (event.type === "delete") {
        if (timelineType !== "notifications") {
          setItems((current) => current.filter((item) => item.id !== event.id));
          dropPendingUpdate(event.id);
        }
      } else if (event.type === "notification") {
        notificationRef.current?.();
      }
    });

    if (onNotification && timelineType !== "home" && timelineType !== "notifications") {
      notificationDisconnectRef.current = streaming.connect(account, "notifications", (event) => {
        if (event.type === "notification") {
          notificationRef.current?.();
        }
      });
    }

    return () => {
      disconnectRef.current?.();
      disconnectRef.current = null;
      notificationDisconnectRef.current?.();
      notificationDisconnectRef.current = null;
      pendingUpdatesRef.current = [];
      setPendingCount(0);
      if (flushTimerRef.current !== null) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      if (pendingCountTimerRef.current !== null) {
        clearTimeout(pendingCountTimerRef.current);
        pendingCountTimerRef.current = null;
      }
    };
  }, [
    account,
    dropPendingUpdate,
    enableStreaming,
    enqueuePendingUpdate,
    onNotification,
    streaming,
    timelineType
  ]);

  useEffect(() => {
    if (!pauseUpdates && pendingUpdatesRef.current.length > 0) {
      if (flushTimerRef.current !== null) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      flushPendingUpdates();
    }
    if (pauseUpdates && flushTimerRef.current !== null) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, [flushPendingUpdates, pauseUpdates]);

  const flushPending = useCallback(() => {
    if (flushTimerRef.current !== null) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    flushPendingUpdates();
  }, [flushPendingUpdates]);

  const updateItem = useCallback((status: Status) => {
    setItems((current) => replaceStatus(current, status));
  }, []);

  const removeItem = useCallback((statusId: string) => {
    setItems((current) => current.filter((item) => item.id !== statusId));
  }, []);

  const timeline = useMemo(
    () => ({
      items,
      loading,
      loadingMore,
      error,
      hasMore,
      refresh,
      loadMore,
      updateItem,
      removeItem,
      pendingCount,
      flushPending
    }),
    [items, loading, loadingMore, error, hasMore, refresh, loadMore, updateItem, removeItem, pendingCount, flushPending]
  );

  return timeline;
};
