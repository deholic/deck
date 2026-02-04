import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
  const timelineButtonLabel = t("timeline.selectAria", { label: getTimelineLabel(timelineType) });
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
    ? t("notifications.close")
    : hasNotificationBadge
      ? t("notifications.openWithCount", {
          badge: notificationCount >= 99 ? t("notifications.badgeOver") : t("notifications.badgeCount", { count: notificationCount })
        })
      : t("notifications.open");
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
    showToast(t("notifications.toast"), {
      tone: "info",
      actionLabel: t("notifications.toastAction"),
      actionAriaLabel: t("notifications.toastActionAria"),
      onAction: () => onScrollToSection(section.id)
    });
  }, [notificationsOpen, refreshNotifications, timelineType, showToast, onScrollToSection, section.id, t]);
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
    ? t("timeline.empty.notifications")
    : timelineType === "bookmarks"
      ? t("timeline.empty.bookmarks")
      : t("timeline.empty.default");
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
      onError(t("errors.accountRequired"));
      return;
    }
    onError(null);
    try {
      const updated = status.favourited
        ? await services.api.unfavourite(account, status.id)
        : await services.api.favourite(account, status.id);
      timeline.updateItem(updated);
    } catch (err) {
      onError(err instanceof Error ? err.message : t("errors.likeFailed"));
    }
  };

  const handleToggleReblog = async (status: Status) => {
    if (!account) {
      onError(t("errors.accountRequired"));
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
      onError(err instanceof Error ? err.message : t("errors.boostFailed"));
      timeline.updateItem(status);
    }
  };

  const handleToggleBookmark = async (status: Status) => {
    if (!account) {
      onError(t("errors.accountRequired"));
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
        showToast(t("toast.bookmarkAdded"), { tone: "success" });
      } else {
        showToast(t("toast.bookmarkRemoved"), { tone: "success" });
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : t("errors.bookmarkFailed"));
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
      onError(err instanceof Error ? err.message : t("errors.statusDeleteFailed"));
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

  const sectionMenuItems = useMemo(
    () => [
      {
        id: "refresh",
        label: t("sectionMenu.refresh"),
        onClick: () => {
          timeline.refresh();
          setMenuOpen(false);
        },
        disabled: !account || timeline.loading,
        icon: (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 11a8 8 0 1 1-3.5-5.9" />
            <path d="M21.5 2.5v6h-6" />
          </svg>
        )
      },
      {
        id: "open-instance",
        label: t("sectionMenu.openOrigin"),
        onClick: handleOpenInstanceOrigin,
        disabled: !instanceOriginUrl,
        icon: (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 5h16v10H4z" />
            <path d="M8 19h8" />
            <path d="M12 15v4" />
          </svg>
        )
      },
      {
        id: "settings",
        label: t("sectionMenu.settings"),
        onClick: () => {
          setMenuOpen(false);
          setSettingsOpen(true);
        },
        disabled: false,
        icon: (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 6h16" />
            <circle cx="9" cy="6" r="2" />
            <path d="M4 12h16" />
            <circle cx="15" cy="12" r="2" />
            <path d="M4 18h16" />
            <circle cx="8" cy="18" r="2" />
          </svg>
        )
      },
      { id: "divider-1", type: "divider" as const },
      {
        id: "add-left",
        label: t("sectionMenu.addLeft"),
        onClick: () => {
          onAddSectionLeft(section.id);
          setMenuOpen(false);
        },
        disabled: false
      },
      {
        id: "move-left",
        label: t("sectionMenu.moveLeft"),
        onClick: () => {
          onMoveSection(section.id, "left");
          setMenuOpen(false);
        },
        disabled: !canMoveLeft
      },
      {
        id: "move-right",
        label: t("sectionMenu.moveRight"),
        onClick: () => {
          onMoveSection(section.id, "right");
          setMenuOpen(false);
        },
        disabled: !canMoveRight
      },
      {
        id: "add-right",
        label: t("sectionMenu.addRight"),
        onClick: () => {
          onAddSectionRight(section.id);
          setMenuOpen(false);
        },
        disabled: false
      },
      {
        id: "remove",
        label: t("sectionMenu.remove"),
        onClick: () => {
          onRemoveSection(section.id);
          setMenuOpen(false);
        },
        disabled: !canRemoveSection,
        danger: true
      }
    ],
    [
      account,
      canMoveLeft,
      canMoveRight,
      canRemoveSection,
      handleOpenInstanceOrigin,
      instanceOriginUrl,
      onAddSectionLeft,
      onAddSectionRight,
      onMoveSection,
      onRemoveSection,
      section.id,
      t,
      timeline.loading,
      timeline.refresh
    ]
  );

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
          onError(t("errors.accountRequired"));
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
          onError(t("errors.accountRequired"));
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
          summaryTitle={t("accountSelector.shortcutHintCompact")}
          variant="inline"
        />
        <div className="timeline-column-actions" role="group" aria-label={t("timeline.actionsAria")}>
          <div className="timeline-selector">
            <button
              type="button"
              className="timeline-selector-button"
              onClick={() => {
                if (!account) {
                  onError(t("errors.accountRequired"));
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
              title={t("timeline.selectHint")}
            >
              <TimelineIcon timeline={timelineType} />
              <span className="timeline-selector-label">{getTimelineLabel(timelineType)}</span>
            </button>
            {timelineMenuOpen ? (
              <>
                <div className="overlay-backdrop" aria-hidden="true" />
                <div
                  ref={timelineMenuRef}
                  className="section-menu-panel timeline-selector-panel"
                  role="menu"
                  aria-label={t("timeline.selectMenuAria")}
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
                      <button
                        key={option.id}
                        type="button"
                        className={`${isSelected ? "is-active" : ""}${isHighlighted ? " is-highlighted" : ""}`}
                        aria-pressed={isSelected}
                        title={isHighlighted ? t("actions.selectHint") : undefined}
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
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>
          <div className="notification-menu">
            <button
              type="button"
              className={`icon-button${notificationsOpen ? " is-active" : ""}`}
              onClick={() => {
                if (!account) {
                  onError(t("errors.accountRequired"));
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
              title={t("notifications.openHint")}
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
            </button>
            {notificationsOpen ? (
              <>
                <div className="overlay-backdrop" aria-hidden="true" />
                <div ref={notificationMenuRef} className="notification-popover panel" role="dialog" aria-modal="true" aria-label={t("notifications.title")}>
                  <div className="notification-popover-body" ref={notificationScrollRef}>
                    {notificationItems.length === 0 && !notificationsLoading ? (
                      <p className="empty">{t("notifications.empty")}</p>
                    ) : null}
                    {notificationsLoading && notificationItems.length === 0 ? (
                      <p className="empty">{t("notifications.loading")}</p>
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
                    {notificationsLoadingMore ? <p className="empty">{t("timeline.loadingMore")}</p> : null}
                  </div>
                </div>
              </>
            ) : null}
          </div>
          <div className="section-menu">
            <button
              type="button"
              className="icon-button menu-button"
              aria-label={t("sectionMenu.openAria")}
              title={t("sectionMenu.openHint")}
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
            </button>
            {menuOpen ? (
              <>
                <div className="overlay-backdrop" aria-hidden="true" />
                <div ref={menuRef} className="section-menu-panel" role="menu">
                  {sectionMenuItems.map((item, index) => {
                    if ("type" in item && item.type === "divider") {
                      return <div key={item.id} className="section-menu-divider" role="separator" />;
                    }
                    const className = [
                      item.danger ? "danger" : "",
                      highlightedSectionMenuIndex === index ? "is-highlighted" : ""
                    ]
                      .filter(Boolean)
                      .join(" ");
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={className}
                        title={highlightedSectionMenuIndex === index ? t("actions.selectHint") : undefined}
                        onClick={item.onClick}
                        disabled={item.disabled}
                      >
                        {item.icon ? (
                          <span
                            className={`section-menu-icon${item.danger ? " is-danger" : ""}`}
                            aria-hidden="true"
                          >
                            {item.icon}
                          </span>
                        ) : null}
                        <span className="section-menu-label">{item.label}</span>
                      </button>
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
                  aria-label={t("sectionSettings.title")}
                >
                  <div className="section-settings-item">
                    <div className="section-settings-text">
                      <strong id={`${settingsIdPrefix}-profile-label`}>{t("sectionSettings.profileImages.title")}</strong>
                      <p id={`${settingsIdPrefix}-profile-hint`}>{t("sectionSettings.profileImages.description")}</p>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={showProfileImages}
                        aria-labelledby={`${settingsIdPrefix}-profile-label`}
                        aria-describedby={`${settingsIdPrefix}-profile-hint`}
                        onChange={(event) =>
                          onUpdateSectionSettings(section.id, { showProfileImages: event.target.checked })
                        }
                      />
                      <span className="slider" aria-hidden="true" />
                    </label>
                  </div>
                  <div className="section-settings-item">
                    <div className="section-settings-text">
                      <strong id={`${settingsIdPrefix}-emoji-label`}>{t("sectionSettings.customEmojis.title")}</strong>
                      <p id={`${settingsIdPrefix}-emoji-hint`}>{t("sectionSettings.customEmojis.description")}</p>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={showCustomEmojis}
                        aria-labelledby={`${settingsIdPrefix}-emoji-label`}
                        aria-describedby={`${settingsIdPrefix}-emoji-hint`}
                        onChange={(event) =>
                          onUpdateSectionSettings(section.id, { showCustomEmojis: event.target.checked })
                        }
                      />
                      <span className="slider" aria-hidden="true" />
                    </label>
                  </div>
                  <div className="section-settings-item">
                    <div className="section-settings-text">
                      <strong id={`${settingsIdPrefix}-reaction-label`}>{t("sectionSettings.reactions.title")}</strong>
                      <p id={`${settingsIdPrefix}-reaction-hint`}>{t("sectionSettings.reactions.description")}</p>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={showReactions}
                        aria-labelledby={`${settingsIdPrefix}-reaction-label`}
                        aria-describedby={`${settingsIdPrefix}-reaction-hint`}
                        onChange={(event) =>
                          onUpdateSectionSettings(section.id, { showReactions: event.target.checked })
                        }
                      />
                      <span className="slider" aria-hidden="true" />
                    </label>
                  </div>
                  <div className="section-settings-item">
                    <div className="section-settings-text">
                      <strong>{t("sectionSettings.sectionSize.title")}</strong>
                      <p>{t("sectionSettings.sectionSize.description")}</p>
                    </div>
                    <select
                      className="section-settings-select"
                      value={sectionSize}
                      onChange={(event) =>
                        onUpdateSectionSettings(section.id, {
                          sectionSize: event.target.value as SectionDisplaySettings["sectionSize"]
                        })
                      }
                      aria-label={t("sectionSettings.sectionSize.aria")}
                    >
                      <option value="small">{t("sectionSettings.sectionSize.small")}</option>
                      <option value="medium">{t("sectionSettings.sectionSize.medium")}</option>
                      <option value="large">{t("sectionSettings.sectionSize.large")}</option>
                    </select>
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
              {t("timeline.pending.sr", { label: pendingCountLabel })}
            </span>
            <button
              type="button"
              className="timeline-pending-banner"
              onClick={handleShowPending}
              aria-label={t("timeline.pending.aria", { label: pendingCountLabel })}
              title={t("timeline.pending.title")}
            >
              <span>{t("timeline.pending.label", { label: pendingCountLabel })}</span>
              <span className="timeline-pending-action">{t("timeline.pending.action")}</span>
            </button>
          </>
        ) : null}
        {!account ? <p className="empty">{t("timeline.accountRequired")}</p> : null}
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
        {timeline.loadingMore ? <p className="empty">{t("timeline.loadingMore")}</p> : null}
      </div>
      <button
        type="button"
        className="icon-button scroll-top-fab"
        onClick={() => scrollToTop()}
        disabled={isAtTop}
        aria-label={t("timeline.scrollTop")}
        title={t("timeline.scrollTop")}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 19V5" />
          <path d="M5 12l7-7 7 7" />
        </svg>
      </button>
    </div>
  );
};
