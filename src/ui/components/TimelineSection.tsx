import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Account, ReactionInput, Status, TimelineType } from "../../domain/types";
import type { SectionDisplaySettings } from "../types/section";
import type { AccountsState, AppServices } from "../state/AppContext";
import { useTimeline } from "../hooks/useTimeline";
import { useClickOutside } from "../hooks/useClickOutside";
import { useToast } from "../state/ToastContext";
import { AccountSelector } from "./AccountSelector";
import { TimelineItem } from "./TimelineItem";
import { formatHandle, normalizeInstanceUrl } from "../utils/account";
import { getTimelineLabel, getTimelineOptions } from "../utils/timeline";

export type TimelineSectionConfig = {
  id: string;
  accountId: string | null;
  timelineType: TimelineType;
  settings: SectionDisplaySettings;
};

type TimelineSectionProps = {
  section: TimelineSectionConfig;
  account: Account | null;
  services: AppServices;
  accountsState: AccountsState;
  onAccountChange: (sectionId: string, accountId: string | null) => void;
  onTimelineChange: (sectionId: string, timelineType: TimelineType) => void;
  onAddSectionLeft: (sectionId: string) => void;
  onAddSectionRight: (sectionId: string) => void;
  onRemoveSection: (sectionId: string) => void;
  onReply: (status: Status, account: Account | null) => void;
  onStatusClick: (status: Status, columnAccount: Account | null, settings: SectionDisplaySettings) => void;
  onReact: (account: Account | null, status: Status, reaction: ReactionInput) => void;
  onProfileClick: (status: Status, account: Account | null, settings: SectionDisplaySettings) => void;
  onError: (message: string | null) => void;
  onMoveSection: (sectionId: string, direction: "left" | "right") => void;
  onScrollToSection: (sectionId: string) => void;
  onCloseStatusModal: () => void;
  onTimelineItemsChange: (sectionId: string, items: Status[]) => void;
  onSelectStatus: (sectionId: string, statusId: string) => void;
  onUpdateSectionSettings: (sectionId: string, updates: Partial<SectionDisplaySettings>) => void;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  canRemoveSection: boolean;
  timelineType: TimelineType;
  registerTimelineListener: (accountId: string, listener: (status: Status) => void) => void;
  unregisterTimelineListener: (accountId: string, listener: (status: Status) => void) => void;
  registerTimelineShortcutHandler: (sectionId: string, handler: ((event: KeyboardEvent) => boolean) | null) => void;
  columnRef?: React.Ref<HTMLDivElement>;
  selectedStatusId: string | null;
};

const SECTION_SIZE_MAP: Record<SectionDisplaySettings["sectionSize"], { width: number; maxWidth: number }> = {
  small: { width: 440, maxWidth: 520 },
  medium: { width: 550, maxWidth: 650 },
  large: { width: 660, maxWidth: 780 }
};

const TimelineIcon = ({ timeline }: { timeline: TimelineType | string }) => {
  switch (timeline) {
    case "divider-before-bookmarks":
      return null;
    case "home":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 11l9-7 9 7" />
          <path d="M5 10v10h14V10" />
        </svg>
      );
    case "local":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10z" />
          <path d="M12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
        </svg>
      );
    case "federated":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="12" r="3" />
          <path d="M9 12h6" />
          <path d="M12 6v3" />
          <path d="M12 15v3" />
        </svg>
      );
    case "social":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="8" cy="9" r="3" />
          <circle cx="16" cy="9" r="3" />
          <path d="M4 20c0-3 2.5-5 4-5h0" />
          <path d="M20 20c0-3-2.5-5-4-5h0" />
        </svg>
      );
    case "global":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a15 15 0 0 1 0 18" />
          <path d="M12 3a15 15 0 0 0 0 18" />
        </svg>
      );
    case "notifications":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case "bookmarks":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      );
    default:
      return null;
  }
};

export const TimelineSection = ({
  section,
  account,
  services,
  accountsState,
  onAccountChange,
  onTimelineChange,
  onAddSectionLeft,
  onAddSectionRight,
  onRemoveSection,
  onReply,
  onStatusClick,
  onCloseStatusModal,
  onTimelineItemsChange,
  onSelectStatus,
  onReact,
  onProfileClick,
  onError,
  onMoveSection,
  onScrollToSection,
  canMoveLeft,
  canMoveRight,
  canRemoveSection,
  timelineType,
  registerTimelineListener,
  unregisterTimelineListener,
  registerTimelineShortcutHandler,
  onUpdateSectionSettings,
  columnRef,
  selectedStatusId
}: TimelineSectionProps) => {
  const notificationsTimeline = useTimeline({
    account,
    api: services.api,
    streaming: services.streaming,
    timelineType: "notifications",
    enableStreaming: false
  });
  const {
    items: notificationItems,
    loading: notificationsLoading,
    loadingMore: notificationsLoadingMore,
    error: notificationsError,
    refresh: refreshNotifications,
    loadMore: loadMoreNotifications
  } = notificationsTimeline;
  const menuRef = useRef<HTMLDivElement | null>(null);
  const timelineMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationMenuRef = useRef<HTMLDivElement | null>(null);
  const settingsPanelRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const notificationScrollRef = useRef<HTMLDivElement | null>(null);
  const accountSummaryRef = useRef<HTMLElement | null>(null);
  const lastNotificationToastRef = useRef(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [timelineMenuOpen, setTimelineMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [isAtTop, setIsAtTop] = useState(true);
  const [highlightedTimelineIndex, setHighlightedTimelineIndex] = useState<number | null>(null);
  const [highlightedSectionMenuIndex, setHighlightedSectionMenuIndex] = useState<number | null>(null);
  const [highlightedNotificationIndex, setHighlightedNotificationIndex] = useState<number | null>(null);
  const { showProfileImages, showCustomEmojis, showReactions, sectionSize } = section.settings;
  const settingsIdPrefix = `section-settings-${section.id}`;
  const columnStyle = useMemo(() => {
    const sizeConfig = SECTION_SIZE_MAP[sectionSize];
    return {
      "--timeline-column-width": `${sizeConfig.width}px`,
      "--timeline-column-max-width": `${sizeConfig.maxWidth}px`
    } as React.CSSProperties;
  }, [sectionSize]);
  const { showToast } = useToast();
  const timelineOptions = useMemo(() => getTimelineOptions(account?.platform, false), [account?.platform]);
  const actionableTimelineOptions = useMemo(
    () => timelineOptions.filter((option) => !option.isDivider),
    [timelineOptions]
  );
  const timelineButtonLabel = `타임라인 선택: ${getTimelineLabel(timelineType)}`;
  const hasNotificationBadge = notificationCount > 0;
  const instanceOriginUrl = useMemo(() => {
    if (!account) {
      return null;
    }
    try {
      return normalizeInstanceUrl(account.instanceUrl);
    } catch {
      return null;
    }
  }, [account]);
  const notificationBadgeLabel = notificationsOpen
    ? "알림 닫기"
    : hasNotificationBadge
      ? `알림 열기 (새 알림 ${notificationCount >= 99 ? "99개 이상" : `${notificationCount}개`})`
      : "알림 열기";
  const notificationBadgeText = notificationCount >= 99 ? "99+" : String(notificationCount);
  const handleNotification = useCallback(() => {
    if (notificationsOpen) {
      refreshNotifications();
      return;
    }
    setNotificationCount((count) => Math.min(count + 1, 99));
    if (timelineType === "notifications") {
      return;
    }
    const now = Date.now();
    if (now - lastNotificationToastRef.current < 5000) {
      return;
    }
    lastNotificationToastRef.current = now;
    showToast("새 알림이 도착했습니다.", {
      tone: "info",
      actionLabel: "알림 받은 컬럼으로 이동",
      actionAriaLabel: "알림이 도착한 컬럼으로 이동",
      onAction: () => onScrollToSection(section.id)
    });
  }, [notificationsOpen, refreshNotifications, timelineType, showToast, onScrollToSection, section.id]);
  const timeline = useTimeline({
    account,
    api: services.api,
    streaming: services.streaming,
    timelineType,
    onNotification: handleNotification,
    pauseUpdates: !isAtTop
  });
  const actionsDisabled = timelineType === "notifications" || timelineType === "bookmarks";
  const emptyMessage = timelineType === "notifications"
    ? "표시할 알림이 없습니다."
    : timelineType === "bookmarks"
      ? "북마크한 글이 없습니다."
      : "표시할 글이 없습니다.";
  const pendingCount = timeline.pendingCount ?? 0;
  const pendingCountLabel = pendingCount >= 99 ? "99+" : String(pendingCount);
  const hasPendingUpdates = pendingCount > 0 && !isAtTop;

  useEffect(() => {
    onTimelineItemsChange(section.id, timeline.items);
  }, [onTimelineItemsChange, section.id, timeline.items]);

  useEffect(() => {
    if (!timeline.error) {
      return;
    }
    showToast(timeline.error, { tone: "error" });
  }, [showToast, timeline.error]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const onScroll = () => {
      const threshold = el.scrollHeight - el.clientHeight - 200;
      if (el.scrollTop >= threshold) {
        timeline.loadMore();
      }
      setIsAtTop(el.scrollTop <= 0);
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
    };
  }, [timeline.loadMore]);

  useEffect(() => {
    if (!account || timelineType === "notifications") {
      return;
    }
    registerTimelineListener(account.id, timeline.updateItem);
    return () => {
      unregisterTimelineListener(account.id, timeline.updateItem);
    };
  }, [account, registerTimelineListener, timeline.updateItem, timelineType, unregisterTimelineListener]);

  useClickOutside(menuRef, menuOpen, () => setMenuOpen(false));

  useClickOutside(timelineMenuRef, timelineMenuOpen, () => setTimelineMenuOpen(false));

  useClickOutside(notificationMenuRef, notificationsOpen, () => setNotificationsOpen(false));

  useClickOutside(settingsPanelRef, settingsOpen, () => setSettingsOpen(false));

  useEffect(() => {
    if (!timelineMenuOpen) {
      setHighlightedTimelineIndex(null);
      return;
    }
    const selectedIndex = actionableTimelineOptions.findIndex((option) => option.id === timelineType);
    const nextIndex = selectedIndex >= 0 ? selectedIndex : 0;
    setHighlightedTimelineIndex(nextIndex);
  }, [actionableTimelineOptions, timelineMenuOpen, timelineType]);

  useEffect(() => {
    if (!menuOpen) {
      setHighlightedSectionMenuIndex(null);
      return;
    }
    setHighlightedSectionMenuIndex(0);
  }, [menuOpen]);

  useEffect(() => {
    if (!notificationsOpen) {
      setHighlightedNotificationIndex(null);
      return;
    }
    if (highlightedNotificationIndex !== null) {
      return;
    }
    const hasNotifications = notificationItems.length > 0;
    setHighlightedNotificationIndex(hasNotifications ? 0 : null);
  }, [highlightedNotificationIndex, notificationItems.length, notificationsOpen]);

  useEffect(() => {
    if (!notificationsOpen) {
      return;
    }
    if (highlightedNotificationIndex === null) {
      return;
    }
    const container = notificationScrollRef.current;
    if (!container) {
      return;
    }
    const items = container.querySelectorAll<HTMLElement>(".status");
    const target = items[highlightedNotificationIndex];
    if (!target) {
      return;
    }
    target.scrollIntoView({ block: "nearest" });
  }, [highlightedNotificationIndex, notificationsOpen]);

  useEffect(() => {
    if (!notificationsOpen) {
      return;
    }
    const el = notificationScrollRef.current;
    if (!el) {
      return;
    }
    const onScroll = () => {
      const threshold = el.scrollHeight - el.clientHeight - 120;
      if (el.scrollTop >= threshold) {
        loadMoreNotifications();
      }
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
    };
  }, [notificationsOpen, loadMoreNotifications]);

  useEffect(() => {
    if (!account) {
      setNotificationsOpen(false);
      setTimelineMenuOpen(false);
    }
    setNotificationCount(0);
  }, [account?.id]);

  useEffect(() => {
    if (!notificationsOpen) {
      return;
    }
    setNotificationCount(0);
    refreshNotifications();
  }, [notificationsOpen, refreshNotifications]);

  useEffect(() => {
    if (!notificationsError) {
      return;
    }
    showToast(notificationsError, { tone: "error" });
  }, [notificationsError, showToast]);

  const handleToggleFavourite = async (status: Status) => {
    if (!account) {
      onError("계정을 선택해주세요.");
      return;
    }
    onError(null);
    try {
      const updated = status.favourited
        ? await services.api.unfavourite(account, status.id)
        : await services.api.favourite(account, status.id);
      timeline.updateItem(updated);
    } catch (err) {
      onError(err instanceof Error ? err.message : "좋아요 처리에 실패했습니다.");
    }
  };

  const handleToggleReblog = async (status: Status) => {
    if (!account) {
      onError("계정을 선택해주세요.");
      return;
    }
    onError(null);
    const delta = status.reblogged ? -1 : 1;
    const optimistic = {
      ...status,
      reblogged: !status.reblogged,
      reblogsCount: Math.max(0, status.reblogsCount + delta)
    };
    timeline.updateItem(optimistic);
    try {
      const updated = status.reblogged
        ? await services.api.unreblog(account, status.id)
        : await services.api.reblog(account, status.id);
      timeline.updateItem(updated);
    } catch (err) {
      onError(err instanceof Error ? err.message : "부스트 처리에 실패했습니다.");
      timeline.updateItem(status);
    }
  };

  const handleToggleBookmark = async (status: Status) => {
    if (!account) {
      onError("계정을 선택해주세요.");
      return;
    }
    onError(null);
    const isBookmarking = !status.bookmarked;
    const optimistic = {
      ...status,
      bookmarked: isBookmarking
    };
    timeline.updateItem(optimistic);
    try {
      const updated = status.bookmarked
        ? await services.api.unbookmark(account, status.id)
        : await services.api.bookmark(account, status.id);
      timeline.updateItem(updated);
      if (isBookmarking) {
        showToast("북마크했습니다.", { tone: "success" });
      } else {
        showToast("북마크를 취소했습니다.", { tone: "success" });
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "북마크 처리에 실패했습니다.");
      timeline.updateItem(status);
    }
  };

  const handleReact = useCallback(
    (status: Status, reaction: ReactionInput) => {
      onReact(account, status, reaction);
    },
    [account, onReact]
  );

  const handleDeleteStatus = async (status: Status) => {
    if (!account) {
      return;
    }
    onError(null);
    try {
      await services.api.deleteStatus(account, status.id);
      timeline.removeItem(status.id);
      onCloseStatusModal();
    } catch (err) {
      onError(err instanceof Error ? err.message : "게시글 삭제에 실패했습니다.");
    }
  };

  const scrollToTop = (behavior: ScrollBehavior = "smooth") => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior });
    }
  };

  const handleShowPending = () => {
    timeline.flushPending();
    setIsAtTop(true);
    scrollToTop("auto");
  };

  const handleOpenInstanceOrigin = useCallback(() => {
    if (!instanceOriginUrl) {
      return;
    }
    window.open(instanceOriginUrl, "_blank", "noopener,noreferrer");
    setMenuOpen(false);
  }, [instanceOriginUrl]);

  const handleTimelineShortcuts = useCallback(
    (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const hasModifier = event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
      if (key === "escape") {
        if (timelineMenuOpen) {
          event.preventDefault();
          setTimelineMenuOpen(false);
          return true;
        }
        if (menuOpen) {
          event.preventDefault();
          setMenuOpen(false);
          return true;
        }
        if (settingsOpen) {
          event.preventDefault();
          setSettingsOpen(false);
          return true;
        }
        if (notificationsOpen) {
          event.preventDefault();
          setNotificationsOpen(false);
          return true;
        }
        return false;
      }
      if (hasModifier) {
        return false;
      }
      if (timelineMenuOpen && (key === "arrowup" || key === "arrowdown" || key === "enter")) {
        if (!actionableTimelineOptions.length) {
          return true;
        }
        if (key === "enter") {
          const option = actionableTimelineOptions[
            highlightedTimelineIndex ?? 0
          ];
          if (option) {
            onTimelineChange(section.id, option.id as TimelineType);
            setTimelineMenuOpen(false);
          }
          event.preventDefault();
          return true;
        }
        event.preventDefault();
        setHighlightedTimelineIndex((current) => {
          const currentIndex = current ?? 0;
          const offset = key === "arrowdown" ? 1 : -1;
          const nextIndex =
            (currentIndex + offset + actionableTimelineOptions.length) % actionableTimelineOptions.length;
          return nextIndex;
        });
        return true;
      }
      if (menuOpen && (key === "arrowup" || key === "arrowdown" || key === "enter")) {
        const menuButtons = menuRef.current?.querySelectorAll<HTMLButtonElement>("button");
        if (!menuButtons || menuButtons.length === 0) {
          return true;
        }
        if (key === "enter") {
          const index = highlightedSectionMenuIndex ?? 0;
          const targetButton = menuButtons[index];
          if (targetButton) {
            targetButton.click();
            setMenuOpen(false);
          }
          event.preventDefault();
          return true;
        }
        event.preventDefault();
        setHighlightedSectionMenuIndex((current) => {
          const currentIndex = current ?? 0;
          const offset = key === "arrowdown" ? 1 : -1;
          const nextIndex = (currentIndex + offset + menuButtons.length) % menuButtons.length;
          return nextIndex;
        });
        return true;
      }
      if (notificationsOpen && (key === "arrowup" || key === "arrowdown")) {
        if (notificationItems.length === 0) {
          return true;
        }
        event.preventDefault();
        setHighlightedNotificationIndex((current) => {
          const currentIndex = current ?? 0;
          if (key === "arrowup") {
            return Math.max(0, currentIndex - 1);
          }
          return Math.min(notificationItems.length - 1, currentIndex + 1);
        });
        return true;
      }
      if (notificationsOpen && key === "enter") {
        if (highlightedNotificationIndex === null) {
          return true;
        }
        const status = notificationItems[highlightedNotificationIndex];
        if (status) {
          event.preventDefault();
          onStatusClick(status, account, section.settings);
          return true;
        }
        return true;
      }
      if (!selectedStatusId) {
        return false;
      }
      const selectedStatus = timeline.items.find((item) => item.id === selectedStatusId);
      if (!selectedStatus) {
        return false;
      }
      const selectedStatusElement = scrollRef.current?.querySelector<HTMLElement>(
        `[data-status-id="${selectedStatus.id}"]`
      );
      const clickStatusAction = (action: string) => {
        const button = selectedStatusElement?.querySelector<HTMLButtonElement>(
          `[data-action="${action}"]`
        );
        if (!button || button.disabled) {
          return false;
        }
        button.click();
        button.focus();
        return true;
      };
      if (key === "r") {
        if (actionsDisabled) {
          return false;
        }
        const handled = clickStatusAction("reply");
        if (!handled) {
          return false;
        }
        event.preventDefault();
        return true;
      }
      if (key === "b") {
        if (actionsDisabled) {
          return false;
        }
        const handled = clickStatusAction("reblog");
        if (!handled) {
          return false;
        }
        event.preventDefault();
        return true;
      }
      if (key === "l") {
        if (actionsDisabled) {
          return false;
        }
        if (account?.platform === "mastodon") {
          const handled = clickStatusAction("favourite");
          if (!handled) {
            return false;
          }
          event.preventDefault();
          return true;
        }
        if (account?.platform === "misskey" && showReactions) {
          event.preventDefault();
          onReact(account, selectedStatus, {
            name: "❤️",
            url: null,
            isCustom: false,
            host: null
          });
          return true;
        }
      }
      if (key === "c") {
        if (account?.platform !== "misskey" || !showReactions) {
          return false;
        }
        const handled = clickStatusAction("reaction-picker");
        if (!handled) {
          return false;
        }
        event.preventDefault();
        return true;
      }
      if (key === "i") {
        const handled = clickStatusAction("open-image");
        if (!handled) {
          return false;
        }
        event.preventDefault();
        return true;
      }
      if (key === "enter") {
        event.preventDefault();
        onStatusClick(selectedStatus, account, section.settings);
        return true;
      }
      if (key === "p") {
        event.preventDefault();
        onProfileClick(selectedStatus, account, section.settings);
        return true;
      }
      if (key === "a") {
        const summary = accountSummaryRef.current;
        if (!summary) {
          return false;
        }
        const details = summary.closest("details");
        if (details?.hasAttribute("open")) {
          event.preventDefault();
          summary.focus();
          return true;
        }
        event.preventDefault();
        summary.click();
        summary.focus();
        return true;
      }
      if (key === "t") {
        if (!account) {
          onError("계정을 선택해주세요.");
          return true;
        }
        event.preventDefault();
        setTimelineMenuOpen(true);
        setMenuOpen(false);
        setNotificationsOpen(false);
        setSettingsOpen(false);
        return true;
      }
      if (key === "g") {
        if (!account) {
          onError("계정을 선택해주세요.");
          return true;
        }
        event.preventDefault();
        setNotificationsOpen((current) => !current);
        setTimelineMenuOpen(false);
        setMenuOpen(false);
        setSettingsOpen(false);
        return true;
      }
      if (key === "m") {
        event.preventDefault();
        setMenuOpen(true);
        setTimelineMenuOpen(false);
        setNotificationsOpen(false);
        setSettingsOpen(false);
        return true;
      }
      return false;
    },
    [
      account,
      actionableTimelineOptions,
      actionsDisabled,
      highlightedNotificationIndex,
      highlightedSectionMenuIndex,
      highlightedTimelineIndex,
      menuOpen,
      notificationItems,
      notificationItems.length,
      notificationsOpen,
      onError,
      onProfileClick,
      onReact,
      onStatusClick,
      onTimelineChange,
      section.id,
      section.settings,
      settingsOpen,
      selectedStatusId,
      showReactions,
      timeline.items,
      timelineMenuOpen
    ]
  );

  useEffect(() => {
    if (!timelineMenuOpen && !notificationsOpen && !menuOpen && !settingsOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const handled = handleTimelineShortcuts(event);
      if (handled) {
        event.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [handleTimelineShortcuts, menuOpen, notificationsOpen, settingsOpen, timelineMenuOpen]);

  useEffect(() => {
    registerTimelineShortcutHandler(section.id, handleTimelineShortcuts);
    return () => registerTimelineShortcutHandler(section.id, null);
  }, [handleTimelineShortcuts, registerTimelineShortcutHandler, section.id]);

  return (
    <div
      className="timeline-column"
      ref={columnRef}
      data-section-id={section.id}
      style={columnStyle}
    >
      <div className="timeline-column-header">
        <AccountSelector
          accounts={accountsState.accounts}
          activeAccountId={account?.id ?? null}
          setActiveAccount={(id) => {
            onAccountChange(section.id, id);
            accountsState.setActiveAccount(id);
          }}
          summaryRef={accountSummaryRef}
          summaryTitle="계정 선택 (A)"
          variant="inline"
        />
        <div className="timeline-column-actions" role="group" aria-label="타임라인 작업">
          <div className="timeline-selector">
            <Button
              type="button"
              variant="secondary"
              className="timeline-selector-button"
              onClick={() => {
                if (!account) {
                  onError("계정을 선택해주세요.");
                  return;
                }
                setTimelineMenuOpen((current) => !current);
                setMenuOpen(false);
                setNotificationsOpen(false);
                setSettingsOpen(false);
              }}
              disabled={!account}
              aria-label={timelineButtonLabel}
              aria-haspopup="menu"
              aria-expanded={timelineMenuOpen}
              title="타임라인 선택 (T)"
            >
              <TimelineIcon timeline={timelineType} />
              <span className="timeline-selector-label">{getTimelineLabel(timelineType)}</span>
            </Button>
            {timelineMenuOpen ? (
              <>
                <div className="overlay-backdrop" aria-hidden="true" />
                <div
                  ref={timelineMenuRef}
                  className="section-menu-panel timeline-selector-panel"
                  role="menu"
                  aria-label="타임라인 선택"
                >
                  {timelineOptions.map((option) => {
                    if (option.isDivider) {
                      return (
                        <div key={option.id} className="timeline-selector-divider" role="separator" />
                      );
                    }
                    const optionIndex = actionableTimelineOptions.findIndex((item) => item.id === option.id);
                    const isSelected = !option.isDivider && timelineType === option.id;
                    const isHighlighted = optionIndex === highlightedTimelineIndex;
                    return (
                      <Button
                        key={option.id}
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`${isSelected ? "is-active" : ""}${isHighlighted ? " is-highlighted" : ""}`}
                        aria-pressed={isSelected}
                        title={isHighlighted ? "선택 (Enter)" : undefined}
                        onClick={() => {
                          if (!option.isDivider) {
                            onTimelineChange(section.id, option.id as TimelineType);
                            setTimelineMenuOpen(false);
                          }
                        }}
                        disabled={option.isDivider}
                      >
                        {!option.isDivider && <TimelineIcon timeline={option.id as TimelineType} />}
                        <span>{option.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>
          <div className="notification-menu">
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className={`icon-button${notificationsOpen ? " is-active" : ""}`}
              onClick={() => {
                if (!account) {
                  onError("계정을 선택해주세요.");
                  return;
                }
                setMenuOpen(false);
                setTimelineMenuOpen(false);
                setNotificationsOpen((current) => !current);
                setSettingsOpen(false);
              }}
              disabled={!account}
              aria-label={notificationBadgeLabel}
              aria-pressed={notificationsOpen}
              title="알림 열기 (G)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {hasNotificationBadge ? (
                <span className="notification-badge" aria-hidden="true">
                  {notificationBadgeText}
                </span>
              ) : null}
            </Button>
            {notificationsOpen ? (
              <>
                <div className="overlay-backdrop" aria-hidden="true" />
                <div ref={notificationMenuRef} className="notification-popover panel" role="dialog" aria-modal="true" aria-label="알림">
                  <div className="notification-popover-body" ref={notificationScrollRef}>
                    {notificationItems.length === 0 && !notificationsLoading ? (
                      <p className="empty">표시할 알림이 없습니다.</p>
                    ) : null}
                    {notificationsLoading && notificationItems.length === 0 ? (
                      <p className="empty">알림을 불러오는 중...</p>
                    ) : null}
                    {notificationItems.length > 0 ? (
                      <div className="timeline">
                        {notificationItems.map((status, statusIndex) => (
                <TimelineItem
                  key={status.id}
                  status={status}
                            onReply={(item) => onReply(item, account)}
                            onStatusClick={(currentStatus) => onStatusClick(currentStatus, account, section.settings)}
                            onToggleFavourite={handleToggleFavourite}
                            onToggleReblog={handleToggleReblog}
                            onToggleBookmark={handleToggleBookmark}
                            onDelete={handleDeleteStatus}
                            onReact={handleReact}
                            onProfileClick={(item) => onProfileClick(item, account, section.settings)}
                            activeHandle={
                              account?.handle ? formatHandle(account.handle, account.instanceUrl) : account?.instanceUrl ?? ""
                            }
                            activeAccountHandle={account?.handle ?? ""}
                            activeAccountUrl={account?.url ?? null}
                            account={account}
                            api={services.api}
                            showProfileImage={showProfileImages}
                            showCustomEmojis={showCustomEmojis}
                            showReactions={showReactions}
                            disableActions
                            isSelected={highlightedNotificationIndex === statusIndex}
                          />
                        ))}
                      </div>
                    ) : null}
                    {notificationsLoadingMore ? <p className="empty">더 불러오는 중...</p> : null}
                  </div>
                </div>
              </>
            ) : null}
          </div>
          <div className="section-menu">
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className="icon-button menu-button"
              aria-label="섹션 메뉴 열기"
              title="섹션 메뉴 열기 (M)"
              onClick={() => {
                setMenuOpen((current) => !current);
                setNotificationsOpen(false);
                setTimelineMenuOpen(false);
                setSettingsOpen(false);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16" />
                <path d="M4 12h16" />
                <path d="M4 17h16" />
              </svg>
            </Button>
            {menuOpen ? (
              <>
                <div className="overlay-backdrop" aria-hidden="true" />
                <div ref={menuRef} className="section-menu-panel" role="menu">
                  {(
                    [
                      {
                        label: "새로고침",
                        onClick: () => {
                          timeline.refresh();
                          setMenuOpen(false);
                        },
                        disabled: !account || timeline.loading
                      },
                      {
                        label: "원본 서버에서 보기",
                        onClick: handleOpenInstanceOrigin,
                        disabled: !instanceOriginUrl
                      },
                      {
                        label: "섹션 설정",
                        onClick: () => {
                          setMenuOpen(false);
                          setSettingsOpen(true);
                        },
                        disabled: false
                      },
                      {
                        type: "divider"
                      },
                      {
                        label: "왼쪽 섹션 추가",
                        onClick: () => {
                          onAddSectionLeft(section.id);
                          setMenuOpen(false);
                        },
                        disabled: false
                      },
                      {
                        label: "왼쪽으로 이동",
                        onClick: () => {
                          onMoveSection(section.id, "left");
                          setMenuOpen(false);
                        },
                        disabled: !canMoveLeft
                      },
                      {
                        label: "오른쪽으로 이동",
                        onClick: () => {
                          onMoveSection(section.id, "right");
                          setMenuOpen(false);
                        },
                        disabled: !canMoveRight
                      },
                      {
                        label: "오른쪽 섹션 추가",
                        onClick: () => {
                          onAddSectionRight(section.id);
                          setMenuOpen(false);
                        },
                        disabled: false
                      },
                      {
                        label: "섹션 삭제",
                        onClick: () => {
                          onRemoveSection(section.id);
                          setMenuOpen(false);
                        },
                        disabled: !canRemoveSection,
                        danger: true
                      }
                    ]
                  ).map((item, index) => {
                    if ("type" in item && item.type === "divider") {
                      return <div key={`divider-${index}`} className="section-menu-divider" role="separator" />;
                    }
                    const icon = (() => {
                      switch (item.label) {
                        case "새로고침":
                          return (
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M20 11a8 8 0 1 1-3.5-5.9" />
                              <path d="M21.5 2.5v6h-6" />
                            </svg>
                          );
                        case "원본 서버에서 보기":
                          return (
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M4 5h16v10H4z" />
                              <path d="M8 19h8" />
                              <path d="M12 15v4" />
                            </svg>
                          );
                        case "섹션 설정":
                          return (
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M4 6h16" />
                              <circle cx="9" cy="6" r="2" />
                              <path d="M4 12h16" />
                              <circle cx="15" cy="12" r="2" />
                              <path d="M4 18h16" />
                              <circle cx="8" cy="18" r="2" />
                            </svg>
                          );
                        case "왼쪽 섹션 추가":
                          return null;
                        case "왼쪽으로 이동":
                          return null;
                        case "오른쪽으로 이동":
                          return null;
                        case "오른쪽 섹션 추가":
                          return null;
                        case "섹션 삭제":
                          return null;
                        default:
                          return null;
                      }
                    })();
                    const className = [
                      item.danger ? "danger" : "",
                      highlightedSectionMenuIndex === index ? "is-highlighted" : ""
                    ]
                      .filter(Boolean)
                      .join(" ");
                    return (
                      <Button
                        key={item.label}
                        type="button"
                        variant={item.danger ? "destructive" : "ghost"}
                        size="sm"
                        className={className}
                        title={highlightedSectionMenuIndex === index ? "선택 (Enter)" : undefined}
                        onClick={item.onClick}
                        disabled={item.disabled}
                      >
                        {icon ? (
                          <span
                            className={`section-menu-icon${item.danger ? " is-danger" : ""}`}
                            aria-hidden="true"
                          >
                            {icon}
                          </span>
                        ) : null}
                        <span className="section-menu-label">{item.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </>
            ) : null}
            {settingsOpen ? (
              <>
                <div className="overlay-backdrop" aria-hidden="true" />
                <div
                  ref={settingsPanelRef}
                  className="section-menu-panel section-settings-panel"
                  role="dialog"
                  aria-modal="true"
                  aria-label="섹션 설정"
                >
                  <div className="section-settings-item">
                    <div className="section-settings-text">
                      <strong id={`${settingsIdPrefix}-profile-label`}>프로필 이미지 표시</strong>
                      <p id={`${settingsIdPrefix}-profile-hint`}>이 섹션에서만 프로필 이미지를 보여줍니다.</p>
                    </div>
                    <Switch
                      checked={showProfileImages}
                      aria-labelledby={`${settingsIdPrefix}-profile-label`}
                      aria-describedby={`${settingsIdPrefix}-profile-hint`}
                      onCheckedChange={(checked) => onUpdateSectionSettings(section.id, { showProfileImages: checked })}
                    />
                  </div>
                  <div className="section-settings-item">
                    <div className="section-settings-text">
                      <strong id={`${settingsIdPrefix}-emoji-label`}>커스텀 이모지 표시</strong>
                      <p id={`${settingsIdPrefix}-emoji-hint`}>사용자 이름과 본문에 커스텀 이모지를 표시합니다.</p>
                    </div>
                    <Switch
                      checked={showCustomEmojis}
                      aria-labelledby={`${settingsIdPrefix}-emoji-label`}
                      aria-describedby={`${settingsIdPrefix}-emoji-hint`}
                      onCheckedChange={(checked) => onUpdateSectionSettings(section.id, { showCustomEmojis: checked })}
                    />
                  </div>
                  <div className="section-settings-item">
                    <div className="section-settings-text">
                      <strong id={`${settingsIdPrefix}-reaction-label`}>리액션 표시</strong>
                      <p id={`${settingsIdPrefix}-reaction-hint`}>리액션을 지원하는 서버에서 받은 리액션을 보여줍니다.</p>
                    </div>
                    <Switch
                      checked={showReactions}
                      aria-labelledby={`${settingsIdPrefix}-reaction-label`}
                      aria-describedby={`${settingsIdPrefix}-reaction-hint`}
                      onCheckedChange={(checked) => onUpdateSectionSettings(section.id, { showReactions: checked })}
                    />
                  </div>
                  <div className="section-settings-item">
                    <div className="section-settings-text">
                      <strong>섹션 폭</strong>
                      <p>이 섹션의 가로 폭을 조절합니다.</p>
                    </div>
                    <Select
                      value={sectionSize}
                      onValueChange={(value) =>
                        onUpdateSectionSettings(section.id, {
                          sectionSize: value as SectionDisplaySettings["sectionSize"]
                        })
                      }
                    >
                      <SelectTrigger className="section-settings-select" aria-label="섹션 폭 설정">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="small">소</SelectItem>
                          <SelectItem value="medium">중</SelectItem>
                          <SelectItem value="large">대</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
      <div className="timeline-column-body" ref={scrollRef}>
        {hasPendingUpdates ? (
          <>
            <span className="sr-only" aria-live="polite">
              새 글 {pendingCountLabel}개가 새로 도착했습니다.
            </span>
            <Button
              type="button"
              variant="secondary"
              className="timeline-pending-banner"
              onClick={handleShowPending}
              aria-label={`새 글 ${pendingCountLabel}개 표시`}
              title="새 글 표시"
            >
              <span>새 글 {pendingCountLabel}개</span>
              <span className="timeline-pending-action">보기</span>
            </Button>
          </>
        ) : null}
        {!account ? <p className="empty">계정을 선택하면 타임라인을 불러옵니다.</p> : null}
        {account && timeline.items.length === 0 && !timeline.loading ? (
          <p className="empty">{emptyMessage}</p>
        ) : null}
        {account && timeline.items.length > 0 ? (
          <div className="timeline">
            {timeline.items.map((status) => (
              <TimelineItem
                key={status.id}
                status={status}
                onReply={(item) => onReply(item, account)}
                onStatusClick={(currentStatus) => onStatusClick(currentStatus, account, section.settings)}
                  onSelect={(statusId) => onSelectStatus(section.id, statusId)}
                  isSelected={selectedStatusId === status.id}
                  onUpdateStatus={timeline.updateItem}
                  onToggleFavourite={handleToggleFavourite}
                onToggleReblog={handleToggleReblog}
                onToggleBookmark={handleToggleBookmark}
                onDelete={handleDeleteStatus}
                onReact={handleReact}
                onProfileClick={(item) => onProfileClick(item, account, section.settings)}
                activeHandle={
                  account?.handle ? formatHandle(account.handle, account.instanceUrl) : account?.instanceUrl ?? ""
                }
                activeAccountHandle={account?.handle ?? ""}
                activeAccountUrl={account?.url ?? null}
                account={account}
                api={services.api}
                showProfileImage={showProfileImages}
                showCustomEmojis={showCustomEmojis}
                showReactions={showReactions}
                disableActions={actionsDisabled}
              />
            ))}
          </div>
        ) : null}
        {timeline.loadingMore ? <p className="empty">더 불러오는 중...</p> : null}
      </div>
      <Button
        type="button"
        variant="secondary"
        size="icon-lg"
        className="icon-button scroll-top-fab"
        onClick={() => scrollToTop()}
        disabled={isAtTop}
        aria-label="최상단으로 이동"
        title="최상단으로 이동"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 19V5" />
          <path d="M5 12l7-7 7 7" />
        </svg>
      </Button>
    </div>
  );
};
