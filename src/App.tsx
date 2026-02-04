import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import type { Account, ReactionInput, Status, TimelineType } from "./domain/types";
import { AccountAdd } from "./ui/components/AccountAdd";
import { AccountSelector } from "./ui/components/AccountSelector";
import { ComposeBox } from "./ui/components/ComposeBox";
import { InfoModal } from "./ui/components/InfoModal";
import { MobileComposeMenu, MobileMenu } from "./ui/components/MobileMenus";
import { PomodoroTimer } from "./ui/components/PomodoroTimer";
import { ProfileModal } from "./ui/components/ProfileModal";
import { SettingsModal } from "./ui/components/SettingsModal";
import { StatusModal } from "./ui/components/StatusModal";
import { TimelineSection, type TimelineSectionConfig } from "./ui/components/TimelineSection";
import { LicensePage, OssPage, ShortcutsPage, TermsPage } from "./ui/pages/InfoPages";
import { useAppContext } from "./ui/state/AppContext";
import { useToast } from "./ui/state/ToastContext";
import { createAccountId, formatHandle, formatReplyHandle, normalizeInstanceUrl } from "./ui/utils/account";
import { clearPendingOAuth, createOauthState, loadPendingOAuth, loadRegisteredApp, saveRegisteredApp, storePendingOAuth } from "./ui/utils/oauth";
import { normalizeTimelineType } from "./ui/utils/timeline";
import { buildOptimisticReactionStatus, hasSameReactions } from "./ui/utils/reactions";
import { ColorScheme, ThemeMode, getStoredColorScheme, getStoredTheme, isColorScheme, isThemeMode } from "./ui/utils/theme";
import type { InfoModalType } from "./ui/types/info";
import type { SectionDisplaySettings } from "./ui/types/section";
import logoUrl from "./ui/assets/textodon-icon-blue.png";

type Route = "home" | "terms" | "license" | "oss" | "shortcuts";
type SelectedTimelineStatus = { sectionId: string; statusId: string };
type ProfileTarget = { status: Status; account: Account | null; settings: SectionDisplaySettings; zIndex: number };

const SECTION_STORAGE_KEY = "textodon.sections";
const COMPOSE_ACCOUNT_KEY = "textodon.compose.accountId";

const getStoredSectionSize = (): SectionDisplaySettings["sectionSize"] => {
  try {
    const stored = localStorage.getItem("textodon.sectionSize");
    if (stored === "medium" || stored === "large" || stored === "small") {
      return stored;
    }
  } catch {
    /* noop */
  }
  return "small";
};

const getDefaultSectionSettings = (): SectionDisplaySettings => {
  let showProfileImages = true;
  let showCustomEmojis = true;
  let showReactions = true;
  try {
    showProfileImages = localStorage.getItem("textodon.profileImages") !== "off";
  } catch {
    /* noop */
  }
  try {
    showCustomEmojis = localStorage.getItem("textodon.customEmojis") !== "off";
  } catch {
    /* noop */
  }
  try {
    showReactions = localStorage.getItem("textodon.reactions") !== "off";
  } catch {
    /* noop */
  }
  return {
    showProfileImages,
    showCustomEmojis,
    showReactions,
    sectionSize: getStoredSectionSize()
  };
};

const parseRoute = (): Route => {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash || hash === "/") {
    return "home";
  }
  const path = hash.startsWith("/") ? hash.slice(1) : hash;
  if (path === "terms") return "terms";
  if (path === "license") return "license";
  if (path === "oss") return "oss";
  if (path === "shortcuts") return "shortcuts";
  return "home";
};

export const App = () => {
  const { t } = useTranslation();
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredTheme());
  const [colorScheme, setColorScheme] = useState<ColorScheme>(() => getStoredColorScheme());
  const [showPomodoro, setShowPomodoro] = useState(() => {
    return localStorage.getItem("textodon.pomodoro") === "on";
  });
  const [pomodoroFocus, setPomodoroFocus] = useState(() => {
    const stored = localStorage.getItem("textodon.pomodoro.focus");
    return stored ? Number(stored) : 25;
  });
  const [pomodoroBreak, setPomodoroBreak] = useState(() => {
    const stored = localStorage.getItem("textodon.pomodoro.break");
    return stored ? Number(stored) : 5;
  });
  const [pomodoroLongBreak, setPomodoroLongBreak] = useState(() => {
    const stored = localStorage.getItem("textodon.pomodoro.longBreak");
    return stored ? Number(stored) : 30;
  });
  const [pomodoroSessionType, setPomodoroSessionType] = useState<"focus" | "break" | "longBreak">("focus");
  const [pomodoroIsRunning, setPomodoroIsRunning] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsAccountId, setSettingsAccountId] = useState<string | null>(null);
  const [reauthLoading, setReauthLoading] = useState(false);
  const [infoModal, setInfoModal] = useState<InfoModalType | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileComposeOpen, setMobileComposeOpen] = useState(false);
  const { services, accountsState } = useAppContext();
  const { showToast } = useToast();
  const [sections, setSections] = useState<TimelineSectionConfig[]>(() => {
    try {
      const raw = localStorage.getItem(SECTION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Array<Partial<TimelineSectionConfig>>;
        if (Array.isArray(parsed) && parsed.length > 0) {
          const defaults = getDefaultSectionSettings();
          return parsed.map((item) => ({
            id: item.id || crypto.randomUUID(),
            accountId: item.accountId ?? null,
            timelineType: normalizeTimelineType(
              item.timelineType ?? "home",
              item.accountId
                ? accountsState.accounts.find((account) => account.id === item.accountId)?.platform ?? null
                : null,
              false
            ),
            settings: {
              showProfileImages: item.settings?.showProfileImages ?? defaults.showProfileImages,
              showCustomEmojis: item.settings?.showCustomEmojis ?? defaults.showCustomEmojis,
              showReactions: item.settings?.showReactions ?? defaults.showReactions,
              sectionSize: item.settings?.sectionSize ?? defaults.sectionSize
            }
          }));
        }
      }
    } catch {
      /* noop */
    }
    const defaults = getDefaultSectionSettings();
    if (accountsState.accounts.length === 0) {
      return [];
    }
    return [
      {
        id: crypto.randomUUID(),
        accountId: accountsState.activeAccountId ?? accountsState.accounts[0]?.id ?? null,
        timelineType: "home",
        settings: { ...defaults }
      }
    ];
  });
  const [composeAccountId, setComposeAccountId] = useState<string | null>(() => {
    try {
      const stored = localStorage.getItem(COMPOSE_ACCOUNT_KEY);
      if (stored) {
        return stored;
      }
    } catch {
      /* noop */
    }
    return accountsState.activeAccountId;
  });
  const composeAccount = useMemo(
    () => accountsState.accounts.find((account) => account.id === composeAccountId) ?? null,
    [accountsState.accounts, composeAccountId]
  );
  const [replyTarget, setReplyTarget] = useState<Status | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<Status | null>(null);
  const [selectedStatusSettings, setSelectedStatusSettings] = useState<SectionDisplaySettings>(() =>
    getDefaultSectionSettings()
  );
  const [selectedStatusThreadAccount, setSelectedStatusThreadAccount] = useState<Account | null>(null);
  const [selectedTimelineStatus, setSelectedTimelineStatus] = useState<SelectedTimelineStatus | null>(null);
  const [profileTargets, setProfileTargets] = useState<ProfileTarget[]>([]);
  const [statusModalZIndex, setStatusModalZIndex] = useState<number | null>(null);
  const nextModalZIndexRef = useRef(70);
  const [actionError, setActionError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [mentionSeed, setMentionSeed] = useState<string | null>(null);
  const timelineBoardRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const sectionItemsRef = useRef<Map<string, Status[]>>(new Map());
  const timelineShortcutHandlersRef = useRef<Map<string, (event: KeyboardEvent) => boolean>>(
    new Map()
  );
  const replySummary = replyTarget
    ? `@${formatReplyHandle(replyTarget.accountHandle, replyTarget.accountUrl, composeAccount?.instanceUrl ?? "")} · ${replyTarget.content.slice(0, 80)}`
    : null;
  const [route, setRoute] = useState<Route>(() => parseRoute());
  const timelineListeners = useRef<Map<string, Set<(status: Status) => void>>>(new Map());
  const previousAccountIds = useRef<Set<string>>(new Set());
  const hasAccounts = accountsState.accounts.length > 0;

  useEffect(() => {
    if (!actionError) {
      return;
    }
    showToast(actionError, { tone: "error" });
    setActionError(null);
  }, [actionError, showToast]);

  const registerTimelineListener = useCallback((accountId: string, listener: (status: Status) => void) => {
    const next = new Map(timelineListeners.current);
    const existing = next.get(accountId) ?? new Set();
    const updated = new Set(existing);
    updated.add(listener);
    next.set(accountId, updated);
    timelineListeners.current = next;
  }, []);

  const unregisterTimelineListener = useCallback(
    (accountId: string, listener: (status: Status) => void) => {
      const next = new Map(timelineListeners.current);
      const existing = next.get(accountId);
      if (!existing) {
        return;
      }
      existing.delete(listener);
      if (existing.size === 0) {
        next.delete(accountId);
      } else {
        next.set(accountId, new Set(existing));
      }
      timelineListeners.current = next;
    },
    []
  );

  const broadcastStatusUpdate = useCallback((accountId: string, status: Status) => {
    const listeners = timelineListeners.current.get(accountId);
    if (!listeners) {
      return;
    }
    listeners.forEach((listener) => listener(status));
  }, []);

  const updateStatusEverywhere = useCallback(
    (accountId: string, status: Status) => {
      broadcastStatusUpdate(accountId, status);
      setSelectedStatus((current) => (current && current.id === status.id ? status : current));
    },
    [broadcastStatusUpdate]
  );

  const handleTimelineItemsChange = useCallback((sectionId: string, items: Status[]) => {
    sectionItemsRef.current.set(sectionId, items);
    setSelectedTimelineStatus((current) => {
      if (!current || current.sectionId !== sectionId) {
        return current;
      }
      return items.some((item) => item.id === current.statusId) ? current : null;
    });
  }, []);

  const handleSelectStatus = useCallback((sectionId: string, statusId: string) => {
    setSelectedTimelineStatus((current) => {
      if (current && current.sectionId === sectionId && current.statusId === statusId) {
        return null;
      }
      return { sectionId, statusId };
    });
  }, []);

  const registerTimelineShortcutHandler = useCallback(
    (sectionId: string, handler: ((event: KeyboardEvent) => boolean) | null) => {
      if (!handler) {
        timelineShortcutHandlersRef.current.delete(sectionId);
        return;
      }
      timelineShortcutHandlersRef.current.set(sectionId, handler);
    },
    []
  );

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const session = params.get("session");
    if (!code && !session) {
      return;
    }

    const pending = loadPendingOAuth();
    const cleanUrl = new URL(window.location.href);
    cleanUrl.search = "";
    cleanUrl.hash = "";
    window.history.replaceState({}, "", cleanUrl.toString());

    if (!pending || !state || pending.state !== state) {
      clearPendingOAuth();
      setActionError(t("errors.oauth.invalidState"));
      return;
    }
    if (pending.platform === "mastodon" && !code) {
      clearPendingOAuth();
      setActionError(t("errors.oauth.missingCode"));
      return;
    }
    if (pending.platform === "misskey") {
      if (!session) {
        clearPendingOAuth();
        setActionError(t("errors.oauth.misskeyMissingSession"));
        return;
      }
      if (session !== pending.sessionId) {
        clearPendingOAuth();
        setActionError(t("errors.oauth.misskeySessionMismatch"));
        return;
      }
    }

      const addAccountWithToken = async () => {
        setOauthLoading(true);
        setActionError(null);
        try {
          const accessToken = await services.oauth.exchangeToken({
            app: pending,
            callback: { code, state, session }
          });
          const draft: Account = {
            id: pending.accountId ?? createAccountId(),
            instanceUrl: pending.instanceUrl,
            accessToken,
            platform: pending.platform,
            name: "",
            displayName: "",
            handle: "",
            url: null,
            avatarUrl: null,
            emojis: []
          };
          const verified = await services.api.verifyAccount(draft);
          const fullHandle = formatHandle(verified.handle, pending.instanceUrl);
          const displayName = verified.accountName || fullHandle;
          if (pending.accountId) {
            const existing = accountsState.accounts.find((account) => account.id === pending.accountId);
            if (!existing) {
              setActionError(t("errors.accountReauthNotFound"));
              return;
            }
            const updated: Account = {
              ...existing,
              instanceUrl: pending.instanceUrl,
              accessToken,
              platform: pending.platform,
              name: `${displayName} @${fullHandle}`,
              displayName,
              handle: fullHandle,
              avatarUrl: verified.avatarUrl,
              emojis: verified.emojis ?? []
            };
            accountsState.updateAccount(existing.id, updated);
            accountsState.setActiveAccount(existing.id);
            return;
          }
          const existing = accountsState.accounts.find(
            (account) =>
              account.platform === pending.platform &&
              account.instanceUrl === pending.instanceUrl &&
              account.handle === fullHandle
          );
          if (existing) {
            setActionError(t("errors.accountAlreadyRegistered"));
            accountsState.setActiveAccount(existing.id);
            return;
          }
          accountsState.addAccount({
            ...draft,
            name: `${displayName} @${fullHandle}`,
            displayName,
            handle: fullHandle,
            avatarUrl: verified.avatarUrl,
            emojis: verified.emojis ?? []
          });
        } catch (err) {
        setActionError(err instanceof Error ? err.message : t("errors.oauth.failed"));
        } finally {
        clearPendingOAuth();
        setOauthLoading(false);
      }
    };

    void addAccountWithToken();
  }, [accountsState, services.api, services.oauth, t]);

  useEffect(() => {
    const value = themeMode === "default" ? "" : themeMode;
    if (value) {
      document.documentElement.dataset.theme = value;
      document.body.dataset.theme = value;
    } else {
      delete document.documentElement.dataset.theme;
      delete document.body.dataset.theme;
    }
    localStorage.setItem("textodon.theme", themeMode);
    localStorage.setItem("textodon.christmas", themeMode === "christmas" ? "on" : "off");
  }, [themeMode]);

  useEffect(() => {
    if (colorScheme === "system") {
      delete document.documentElement.dataset.colorScheme;
      delete document.body.dataset.colorScheme;
    } else {
      document.documentElement.dataset.colorScheme = colorScheme;
      document.body.dataset.colorScheme = colorScheme;
    }
    localStorage.setItem("textodon.colorScheme", colorScheme);
  }, [colorScheme]);

  useEffect(() => {
    try {
      if (composeAccountId) {
        localStorage.setItem(COMPOSE_ACCOUNT_KEY, composeAccountId);
      } else {
        localStorage.removeItem(COMPOSE_ACCOUNT_KEY);
      }
    } catch {
      /* noop */
    }
  }, [composeAccountId]);

  useEffect(() => {
    localStorage.setItem("textodon.pomodoro", showPomodoro ? "on" : "off");
  }, [showPomodoro]);

  useEffect(() => {
    localStorage.setItem("textodon.pomodoro.focus", String(pomodoroFocus));
  }, [pomodoroFocus]);

  useEffect(() => {
    localStorage.setItem("textodon.pomodoro.break", String(pomodoroBreak));
  }, [pomodoroBreak]);

  useEffect(() => {
    localStorage.setItem("textodon.pomodoro.longBreak", String(pomodoroLongBreak));
  }, [pomodoroLongBreak]);



  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
    setMobileComposeOpen(false);
  }, []);

  const handleSettingsReauth = useCallback(async () => {
    const account = accountsState.accounts.find((a) => a.id === settingsAccountId);
    if (!account) return;
    setReauthLoading(true);
    try {
      const normalizedUrl = normalizeInstanceUrl(account.instanceUrl);
      const url = new URL(window.location.href);
      url.search = "";
      url.hash = "";
      const redirectUri = url.toString();
      const cached = loadRegisteredApp(normalizedUrl);
      const needsRegister = !cached || cached.redirectUri !== redirectUri || cached.platform === "misskey";
      const registered = needsRegister ? await services.oauth.registerApp(normalizedUrl, redirectUri) : cached;
      if (!registered) {
        throw new Error(t("errors.appRegistrationLoadFailed"));
      }
      if (needsRegister && registered.platform === "mastodon") {
        saveRegisteredApp(registered);
      }
      const state = createOauthState();
      storePendingOAuth({ ...registered, state, accountId: account.id });
      const authorizeUrl = services.oauth.buildAuthorizeUrl(registered, state);
      window.location.assign(authorizeUrl);
    } catch {
      setReauthLoading(false);
    }
  }, [accountsState.accounts, settingsAccountId, services.oauth, t]);

  const handleSettingsRemove = useCallback(() => {
    if (!settingsAccountId) return;
    const confirmed = window.confirm(t("confirm.removeAccount"));
    if (confirmed) {
      accountsState.removeAccount(settingsAccountId);
      setSettingsAccountId(null);
    }
  }, [accountsState, settingsAccountId, t]);

  const handleClearLocalStorage = useCallback(() => {
    const confirmed = window.confirm(t("confirm.clearLocalStorage"));
    if (!confirmed) {
      return;
    }
    try {
      localStorage.clear();
    } catch {
      /* noop */
    }
    window.location.reload();
  }, [t]);

  const isEditableElement = useCallback((element: Element | null) => {
    if (!element) {
      return false;
    }
    return (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      (element as HTMLElement).isContentEditable
    );
  }, []);

  const selectLeftmostTimelineAtY = useCallback(
    (targetCenterY: number) => {
      const board = timelineBoardRef.current;
      if (!board) {
        return;
      }
      const boardRect = board.getBoundingClientRect();
      let leftmostSectionId: string | null = null;
      let leftmostPosition = Number.POSITIVE_INFINITY;
      sections.forEach((section) => {
        const element = sectionRefs.current.get(section.id);
        if (!element) {
          return;
        }
        const rect = element.getBoundingClientRect();
        if (rect.right <= boardRect.left || rect.left >= boardRect.right) {
          return;
        }
        if (rect.left < leftmostPosition) {
          leftmostPosition = rect.left;
          leftmostSectionId = section.id;
        }
      });
      if (!leftmostSectionId) {
        return;
      }
      const items = sectionItemsRef.current.get(leftmostSectionId) ?? [];
      if (items.length === 0) {
        return;
      }
      const sectionElement = sectionRefs.current.get(leftmostSectionId);
      const statusElements = sectionElement?.querySelectorAll<HTMLElement>("[data-status-id]");
      let nextStatusId = items[0]?.id ?? null;
      if (statusElements && statusElements.length > 0) {
        let closestMatch: { id: string; distance: number } | null = null;
        for (const element of Array.from(statusElements)) {
          const statusId = element.dataset.statusId;
          if (!statusId) {
            continue;
          }
          const rect = element.getBoundingClientRect();
          const centerY = rect.top + rect.height / 2;
          const distance = Math.abs(centerY - targetCenterY);
          if (!closestMatch || distance < closestMatch.distance) {
            closestMatch = { id: statusId, distance };
          }
        }
        if (closestMatch) {
          nextStatusId = closestMatch.id;
        }
      }
      if (!nextStatusId) {
        return;
      }
      setSelectedTimelineStatus({ sectionId: leftmostSectionId, statusId: nextStatusId });
    },
    [sections]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      if (document.querySelector('[data-emoji-picker-open="true"]')) {
        return;
      }
      const hasOverlayBackdrop = document.querySelector(
        ".overlay-backdrop, .image-modal, .confirm-modal, .profile-modal, .status-modal, .settings-modal, .info-modal"
      );
      if (hasOverlayBackdrop) {
        return;
      }
      if (selectedStatus || settingsOpen || infoModal || mobileMenuOpen || mobileComposeOpen) {
        return;
      }
      if (profileTargets.length > 0) {
        return;
      }
      if (isEditableElement(document.activeElement)) {
        return;
      }

      const key = event.key;
      if (key === "Escape") {
        if (hasOverlayBackdrop) {
          return;
        }
        if (selectedTimelineStatus) {
          const keyHandledByTimeline = timelineShortcutHandlersRef.current.get(
            selectedTimelineStatus.sectionId
          )?.(event);
          if (keyHandledByTimeline) {
            return;
          }
        }
        if (selectedTimelineStatus) {
          event.preventDefault();
          setSelectedTimelineStatus(null);
        }
        return;
      }

      if (selectedTimelineStatus) {
        const keyHandledByTimeline = timelineShortcutHandlersRef.current.get(
          selectedTimelineStatus.sectionId
        )?.(event);
        if (keyHandledByTimeline) {
          return;
        }
      }

      if (
        key.toLowerCase() === "m" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        !event.altKey
      ) {
        if (selectedTimelineStatus) {
          return;
        }
        const board = timelineBoardRef.current;
        if (!board) {
          return;
        }
        const boardRect = board.getBoundingClientRect();
        let leftmostSectionId: string | null = null;
        let leftmostPosition = Number.POSITIVE_INFINITY;
        sections.forEach((section) => {
          const element = sectionRefs.current.get(section.id);
          if (!element) {
            return;
          }
          const rect = element.getBoundingClientRect();
          if (rect.right <= boardRect.left || rect.left >= boardRect.right) {
            return;
          }
          if (rect.left < leftmostPosition) {
            leftmostPosition = rect.left;
            leftmostSectionId = section.id;
          }
        });
        if (!leftmostSectionId) {
          return;
        }
        const items = sectionItemsRef.current.get(leftmostSectionId) ?? [];
        if (items.length === 0) {
          return;
        }
        event.preventDefault();
        setSelectedTimelineStatus({ sectionId: leftmostSectionId, statusId: items[0].id });
        return;
      }

      if (!selectedTimelineStatus) {
        return;
      }

      if (
        hasOverlayBackdrop &&
        (key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight")
      ) {
        return;
      }

      const currentItems = sectionItemsRef.current.get(selectedTimelineStatus.sectionId) ?? [];
      const currentIndex = currentItems.findIndex(
        (item) => item.id === selectedTimelineStatus.statusId
      );

      if (key === "ArrowUp" || key === "ArrowDown") {
        if (currentItems.length === 0 || currentIndex === -1) {
          return;
        }
        const nextIndex = key === "ArrowUp" ? currentIndex - 1 : currentIndex + 1;
        if (nextIndex < 0 || nextIndex >= currentItems.length) {
          return;
        }
        event.preventDefault();
        setSelectedTimelineStatus({
          sectionId: selectedTimelineStatus.sectionId,
          statusId: currentItems[nextIndex].id
        });
        return;
      }

      if (key === "ArrowLeft" || key === "ArrowRight") {
        const currentSectionIndex = sections.findIndex(
          (section) => section.id === selectedTimelineStatus.sectionId
        );
        if (currentSectionIndex === -1) {
          return;
        }
        const currentSectionElement = sectionRefs.current.get(selectedTimelineStatus.sectionId);
        const currentStatusElement = currentSectionElement?.querySelector<HTMLElement>(
          `[data-status-id="${selectedTimelineStatus.statusId}"]`
        );
        const currentCenterY = currentStatusElement
          ? currentStatusElement.getBoundingClientRect().top +
            currentStatusElement.getBoundingClientRect().height / 2
          : null;
        const direction = key === "ArrowLeft" ? -1 : 1;
        let targetIndex = currentSectionIndex + direction;
        while (targetIndex >= 0 && targetIndex < sections.length) {
          const targetSection = sections[targetIndex];
          const items = sectionItemsRef.current.get(targetSection.id) ?? [];
          if (items.length > 0) {
            let nextStatusId = items[
              Math.min(currentIndex >= 0 ? currentIndex : 0, items.length - 1)
            ]?.id;
            if (currentCenterY !== null) {
              const targetSectionElement = sectionRefs.current.get(targetSection.id);
              const statusElements = targetSectionElement?.querySelectorAll<HTMLElement>(
                "[data-status-id]"
              );
              if (statusElements && statusElements.length > 0) {
                let closestMatch: { id: string; distance: number } | null = null;
                for (const element of Array.from(statusElements)) {
                  const statusId = element.dataset.statusId;
                  if (!statusId) {
                    continue;
                  }
                  const rect = element.getBoundingClientRect();
                  const centerY = rect.top + rect.height / 2;
                  const distance = Math.abs(centerY - currentCenterY);
                  if (!closestMatch || distance < closestMatch.distance) {
                    closestMatch = { id: statusId, distance };
                  }
                }
                if (closestMatch) {
                  nextStatusId = closestMatch.id;
                }
              }
            }
            if (!nextStatusId) {
              return;
            }
            event.preventDefault();
            setSelectedTimelineStatus({
              sectionId: targetSection.id,
              statusId: nextStatusId
            });
            return;
          }
          targetIndex += direction;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    infoModal,
    isEditableElement,
    mobileComposeOpen,
    mobileMenuOpen,
    profileTargets.length,
    sections,
    selectedStatus,
    selectedTimelineStatus,
    settingsOpen
  ]);

  const scrollToSection = useCallback((sectionId: string) => {
    const target = sectionRefs.current.get(sectionId);
    if (!target) {
      return;
    }
    target.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }, []);

  useEffect(() => {
    if (!selectedTimelineStatus) {
      return;
    }
    scrollToSection(selectedTimelineStatus.sectionId);
    requestAnimationFrame(() => {
      const section = sectionRefs.current.get(selectedTimelineStatus.sectionId);
      if (!section) {
        return;
      }
      const statusElement = section.querySelector<HTMLElement>(
        `[data-status-id="${selectedTimelineStatus.statusId}"]`
      );
      if (!statusElement) {
        return;
      }
      statusElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [scrollToSection, selectedTimelineStatus]);

  useEffect(() => {
    setSections((current) =>
      current.map((section) => {
        const account = section.accountId
          ? accountsState.accounts.find((item) => item.id === section.accountId) ?? null
          : null;
        if (!account) {
          return {
            ...section,
            accountId: null,
            timelineType: normalizeTimelineType(section.timelineType, null, false)
          };
        }
        const normalizedTimeline = normalizeTimelineType(section.timelineType, account.platform, false);
        if (normalizedTimeline === section.timelineType) {
          return section;
        }
        return { ...section, timelineType: normalizedTimeline };
      })
    );
    setComposeAccountId((current) => {
      if (!current) {
        return accountsState.accounts[0]?.id ?? null;
      }
      return accountsState.accounts.some((account) => account.id === current)
        ? current
        : accountsState.accounts[0]?.id ?? null;
    });
  }, [accountsState.accounts]);

  useEffect(() => {
    const currentIds = new Set(accountsState.accounts.map((account) => account.id));
    const addedAccounts = accountsState.accounts.filter(
      (account) => !previousAccountIds.current.has(account.id)
    );
    if (addedAccounts.length > 0) {
      const defaults = getDefaultSectionSettings();
      setSections((current) => {
        const next = [...current];
        addedAccounts.forEach((account) => {
          if (!next.some((section) => section.accountId === account.id)) {
            next.push({
              id: crypto.randomUUID(),
              accountId: account.id,
              timelineType: "home",
              settings: { ...defaults }
            });
          }
        });
        return next;
      });
    }
    previousAccountIds.current = currentIds;
  }, [accountsState.accounts]);

  useEffect(() => {
    if (!selectedTimelineStatus) {
      return;
    }
    if (!sections.some((section) => section.id === selectedTimelineStatus.sectionId)) {
      setSelectedTimelineStatus(null);
    }
  }, [sections, selectedTimelineStatus]);

  const handleSubmit = async (params: {
    text: string;
    visibility: "public" | "unlisted" | "private" | "direct";
    inReplyToId?: string;
    files: File[];
    spoilerText: string;
  }): Promise<boolean> => {
    if (!composeAccount) {
      return false;
    }
    setActionError(null);
    try {
      const mediaIds =
        params.files.length > 0
          ? await Promise.all(params.files.map((file) => services.api.uploadMedia(composeAccount, file)))
          : [];
      const created = await services.api.createStatus(composeAccount, {
        status: params.text,
        visibility: params.visibility,
        inReplyToId: params.inReplyToId,
        mediaIds,
        spoilerText: params.spoilerText
      });
      broadcastStatusUpdate(composeAccount.id, created);
      setReplyTarget(null);
      setMentionSeed(null);
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("errors.composeFailed"));
      return false;
    }
  };

  const handleReply = (status: Status, account: Account | null) => {
    if (!account) {
      return;
    }
    setComposeAccountId(account.id);
    setReplyTarget(status);
    const formattedHandle = formatReplyHandle(status.accountHandle, status.accountUrl, account.instanceUrl);
    setMentionSeed(`@${formattedHandle} `);
    setSelectedStatus(null);
  };

  const handleStatusClick = (
    status: Status,
    columnAccount: Account | null,
    settings: SectionDisplaySettings
  ) => {
    setSelectedStatus(status);
    setStatusModalZIndex(nextModalZIndexRef.current++);
    setSelectedStatusThreadAccount(columnAccount);
    setSelectedStatusSettings(settings);
  };

  const handleProfileOpen = useCallback(
    (target: Status, columnAccount: Account | null, settings: SectionDisplaySettings) => {
      const zIndex = nextModalZIndexRef.current++;
      setProfileTargets((current) => [
        ...current,
        { status: target, account: columnAccount, settings, zIndex }
      ]);
    },
    []
  );

  const handleCloseProfileModal = useCallback((index?: number) => {
    setProfileTargets((current) => {
      if (current.length === 0) {
        return current;
      }
      if (typeof index !== "number") {
        return current.slice(0, -1);
      }
      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  }, []);

  const handleCloseStatusModal = () => {
    setSelectedStatus(null);
    setStatusModalZIndex(null);
    setSelectedStatusThreadAccount(null);
  };

  const handleReaction = useCallback(
    async (account: Account | null, status: Status, reaction: ReactionInput) => {
      if (!account) {
        setActionError(t("errors.accountRequired"));
        return;
      }
      if (account.platform !== "misskey") {
        setActionError(t("errors.reactionMisskeyOnly"));
        return;
      }
      const target = status.reblog ?? status;
      if (target.myReaction && target.myReaction !== reaction.name) {
        setActionError(t("errors.reactionAlreadyExists"));
        return;
      }
      setActionError(null);
      const isRemoving = target.myReaction === reaction.name;
      const optimistic = buildOptimisticReactionStatus(target, reaction, isRemoving);
      updateStatusEverywhere(account.id, optimistic);
      try {
        const updated = isRemoving
          ? await services.api.deleteReaction(account, target.id)
          : await services.api.createReaction(account, target.id, reaction.name);
        if (!hasSameReactions(updated, optimistic)) {
          updateStatusEverywhere(account.id, updated);
        }
      } catch (err) {
        setActionError(err instanceof Error ? err.message : t("errors.reactionFailed"));
        updateStatusEverywhere(account.id, target);
      }
    },
    [services.api, t, updateStatusEverywhere]
  );

  const composeAccountSelector = (
    <AccountSelector
      accounts={accountsState.accounts}
      activeAccountId={composeAccountId}
      setActiveAccount={setComposeAccountId}
      variant="inline"
    />
  );

  const addSectionAt = (index: number, baseSettings?: SectionDisplaySettings) => {
    const defaultAccountId = composeAccountId ?? accountsState.accounts[0]?.id ?? null;
    const settings = baseSettings ?? getDefaultSectionSettings();
    setSections((current) => {
      const next = [...current];
      const insertIndex = Math.max(0, Math.min(index, next.length));
      next.splice(insertIndex, 0, {
        id: crypto.randomUUID(),
        accountId: defaultAccountId,
        timelineType: "home",
        settings: { ...settings }
      });
      return next;
    });
    if (!composeAccountId && defaultAccountId) {
      setComposeAccountId(defaultAccountId);
    }
  };

  const addSectionNear = (sectionId: string, direction: "left" | "right") => {
    const index = sections.findIndex((section) => section.id === sectionId);
    if (index === -1) {
      addSectionAt(sections.length);
      return;
    }
    const baseSettings = sections[index]?.settings;
    addSectionAt(direction === "left" ? index : index + 1, baseSettings);
  };

  const moveSection = (sectionId: string, direction: "left" | "right") => {
    setSections((current) => {
      const index = current.findIndex((section) => section.id === sectionId);
      if (index === -1) {
        return current;
      }
      const targetIndex = direction === "left" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const removeSection = (sectionId: string) => {
    setSections((current) => current.filter((section) => section.id !== sectionId));
  };

  const setSectionAccount = (sectionId: string, accountId: string | null) => {
    const nextAccount = accountId
      ? accountsState.accounts.find((account) => account.id === accountId) ?? null
      : null;
    setSections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              accountId,
              timelineType: normalizeTimelineType(section.timelineType, nextAccount?.platform ?? null, false)
            }
          : section
      )
    );
  };

  const setSectionTimeline = (sectionId: string, timelineType: TimelineType) => {
    setSections((current) =>
      current.map((section) => {
        if (section.id !== sectionId) {
          return section;
        }
        const account = section.accountId
          ? accountsState.accounts.find((item) => item.id === section.accountId) ?? null
          : null;
        return {
          ...section,
          timelineType: normalizeTimelineType(timelineType, account?.platform ?? null, false)
        };
      })
    );
  };

  const updateSectionSettings = useCallback(
    (sectionId: string, updates: Partial<SectionDisplaySettings>) => {
      setSections((current) =>
        current.map((section) =>
          section.id === sectionId
            ? { ...section, settings: { ...section.settings, ...updates } }
            : section
        )
      );
    },
    []
  );

  useEffect(() => {
    try {
      localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(sections));
    } catch {
      /* noop */
    }
  }, [sections]);

  return (
    <div className="app">
      <header className="app-header">
        <a href="#/" className="app-logo" aria-label={t("app.logoHomeAria")}>
          <img src={logoUrl} alt={t("app.logoAlt")} />
        </a>
        <div className="app-header-actions">
          <button
            type="button"
            className="icon-button mobile-compose-button"
            aria-label={t("compose.openAria")}
            onClick={() => setMobileComposeOpen(true)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 20h4l10-10-4-4L4 16v4z" />
              <path d="M14 6l4 4" />
            </svg>
          </button>
          <button
            type="button"
            className="icon-button mobile-menu-button"
            aria-label={t("menu.openAria")}
            onClick={() => setMobileMenuOpen(true)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </svg>
          </button>
        </div>
      </header>
      <div className="mobile-blocker" role="dialog" aria-modal="true" aria-label={t("app.mobileBlocker.aria")}>
        <div className="mobile-blocker-card">
          <h2>{t("app.mobileBlocker.title")}</h2>
          <p>
            {t("app.mobileBlocker.description")}
          </p>
        </div>
      </div>

      <main className={`layout${hasAccounts ? "" : " layout-empty"}`}>
        <aside>
          <div className="compose-panel">
            {composeAccount ? (
              <ComposeBox
                accountSelector={composeAccountSelector}
                account={composeAccount}
                api={services.api}
                onSubmit={handleSubmit}
                replyingTo={replyTarget ? { id: replyTarget.id, summary: replySummary ?? "" } : null}
                onCancelReply={() => {
                  setReplyTarget(null);
                  setMentionSeed(null);
                }}
                mentionText={mentionSeed}
              />
            ) : null}
          </div>
          {route === "home" && showPomodoro ? (
            <PomodoroTimer
              focusMinutes={pomodoroFocus}
              breakMinutes={pomodoroBreak}
              longBreakMinutes={pomodoroLongBreak}
              onSessionTypeChange={setPomodoroSessionType}
              onRunningChange={setPomodoroIsRunning}
              isTimelineItemSelected={!!selectedTimelineStatus}
              onRequestClearTimelineSelection={() => setSelectedTimelineStatus(null)}
              onRequestSelectTimelineAtY={selectLeftmostTimelineAtY}
            />
          ) : null}
          {route === "home" ? (
            <section className="panel sidebar-panel">
              <div className="brand">
                <img src={logoUrl} alt={t("app.logoAlt")} />
                <div className="brand-text">
                  <h1>Deck</h1>
                  <p>{t("app.tagline")}</p>
                </div>
              </div>
              <p className="sidebar-description">
                {t("app.sidebarDescription")}
              </p>
              <div className="sidebar-actions">
                <button
                  type="button"
                  className="settings-button button-with-icon"
                  onClick={() => setSettingsOpen(true)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 6h16" />
                    <circle cx="9" cy="6" r="2" />
                    <path d="M4 12h16" />
                    <circle cx="15" cy="12" r="2" />
                    <path d="M4 18h16" />
                    <circle cx="8" cy="18" r="2" />
                  </svg>
                  {t("settings.open")}
                </button>
                <AccountAdd
                  oauth={services.oauth}
                />
              </div>
              <div className="sidebar-divider" role="presentation" />
              <nav className="sidebar-links">
                <a
                  href="#/terms"
                  onClick={(event) => {
                    event.preventDefault();
                    setInfoModal("terms");
                  }}
                >
                  {t("infoPages.terms")}
                </a>
                <a
                  href="#/license"
                  onClick={(event) => {
                    event.preventDefault();
                    setInfoModal("license");
                  }}
                >
                  {t("infoPages.license")}
                </a>
                <a
                  href="#/oss"
                  onClick={(event) => {
                    event.preventDefault();
                    setInfoModal("oss");
                  }}
                >
                  {t("infoPages.oss")}
                </a>
                <a
                  href="#/shortcuts"
                  onClick={(event) => {
                    event.preventDefault();
                    setInfoModal("shortcuts");
                  }}
                >
                  {t("infoPages.shortcuts")}
                </a>
                <a href="https://github.com/deholic/textodon" target="_blank" rel="noreferrer">
                  {t("app.sourceCode")}
                </a>
              </nav>
            </section>
          ) : null}
        </aside>

        {hasAccounts ? (
          <section className="main-column">
            {oauthLoading ? <p className="empty">{t("oauth.authenticating")}</p> : null}
            {route === "home" ? (
              <section className="panel">
                {showPomodoro && pomodoroSessionType === "focus" && pomodoroIsRunning ? (
                  <div className="pomodoro-focus-message">
                    <div className="pomodoro-focus-message-content">
                      <h2>{t("pomodoro.focusSession.title")}</h2>
                      <p>
                        <Trans i18nKey="pomodoro.focusSession.description">
                          뽀모도로 타이머가 동작 중입니다.<br />타임라인은 집중이 끝날 때까지 숨겨집니다.
                        </Trans>
                      </p>
                    </div>
                  </div>
                ) : null}
                <div className={`panel-content${showPomodoro && pomodoroSessionType === "focus" && pomodoroIsRunning ? " pomodoro-focus-blur" : ""}`}>
                  {sections.length > 0 ? (
                  <div
                    className="timeline-board"
                    ref={timelineBoardRef}
                  >
                      {sections.map((section, index) => {
                        const sectionAccount =
                          section.accountId
                            ? accountsState.accounts.find((account) => account.id === section.accountId) ?? null
                            : null;
                        const selectedStatusId =
                          selectedTimelineStatus?.sectionId === section.id
                            ? selectedTimelineStatus.statusId
                            : null;
                        return (
                          <TimelineSection
                            key={section.id}
                            section={section}
                            account={sectionAccount}
                            services={services}
                            accountsState={accountsState}
                            onAccountChange={setSectionAccount}
                            onTimelineChange={setSectionTimeline}
                            onScrollToSection={scrollToSection}
                            onAddSectionLeft={(id) => addSectionNear(id, "left")}
                            onAddSectionRight={(id) => addSectionNear(id, "right")}
                            onRemoveSection={removeSection}
                            onReply={handleReply}
                            onStatusClick={handleStatusClick}
                            onReact={handleReaction}
                            onProfileClick={handleProfileOpen}
                            columnRef={(node) => {
                              if (node) {
                                sectionRefs.current.set(section.id, node);
                              } else {
                                sectionRefs.current.delete(section.id);
                              }
                            }}
                            onCloseStatusModal={handleCloseStatusModal}
                            onError={(message) => setActionError(message || null)}
                            onMoveSection={moveSection}
                            onTimelineItemsChange={handleTimelineItemsChange}
                            onSelectStatus={handleSelectStatus}
                            onUpdateSectionSettings={updateSectionSettings}
                            canMoveLeft={index > 0}
                            canMoveRight={index < sections.length - 1}
                            canRemoveSection={sections.length > 1}
                            timelineType={section.timelineType}
                            registerTimelineListener={registerTimelineListener}
                            unregisterTimelineListener={unregisterTimelineListener}
                            registerTimelineShortcutHandler={registerTimelineShortcutHandler}
                            selectedStatusId={selectedStatusId}
                          />
                      );
                    })}
                  </div>
                ) : null}
                </div>
              </section>
            ) : null}
            {route === "terms" ? <TermsPage /> : null}
            {route === "license" ? <LicensePage /> : null}
            {route === "oss" ? <OssPage /> : null}
            {route === "shortcuts" ? <ShortcutsPage /> : null}
          </section>
        ) : null}
      </main>

      {infoModal ? (
        <InfoModal type={infoModal} onClose={() => setInfoModal(null)} />
      ) : null}

      <MobileComposeMenu
        open={mobileComposeOpen}
        onClose={() => setMobileComposeOpen(false)}
        composeAccount={composeAccount}
        composeAccountSelector={composeAccountSelector}
        api={services.api}
        onSubmit={handleSubmit}
        replyingTo={replyTarget ? { id: replyTarget.id, summary: replySummary ?? "" } : null}
        onCancelReply={() => {
          setReplyTarget(null);
          setMentionSeed(null);
        }}
        mentionText={mentionSeed}
      />

      <MobileMenu
        open={mobileMenuOpen}
        onClose={closeMobileMenu}
        onOpenSettings={() => setSettingsOpen(true)}
        oauth={services.oauth}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        accountsState={accountsState}
        settingsAccountId={settingsAccountId}
        setSettingsAccountId={setSettingsAccountId}
        reauthLoading={reauthLoading}
        onReauth={handleSettingsReauth}
        onRemove={handleSettingsRemove}
        onClearLocalStorage={handleClearLocalStorage}
        themeMode={themeMode}
        onThemeChange={(value) => {
          if (isThemeMode(value)) {
            setThemeMode(value);
          }
        }}
        colorScheme={colorScheme}
        onColorSchemeChange={(value) => {
          if (isColorScheme(value)) {
            setColorScheme(value);
          }
        }}
        showPomodoro={showPomodoro}
        onTogglePomodoro={setShowPomodoro}
        pomodoroFocus={pomodoroFocus}
        pomodoroBreak={pomodoroBreak}
        pomodoroLongBreak={pomodoroLongBreak}
        onPomodoroFocusChange={setPomodoroFocus}
        onPomodoroBreakChange={setPomodoroBreak}
        onPomodoroLongBreakChange={setPomodoroLongBreak}
      />
      
      {profileTargets.map((target, index) => (
        <ProfileModal
          key={`${target.status.id}-${index}`}
          status={target.status}
          account={target.account}
          api={services.api}
          zIndex={target.zIndex}
          isTopmost={index === profileTargets.length - 1}
          onClose={() => handleCloseProfileModal(index)}
          onReply={handleReply}
          onStatusClick={(status, account, settings) => handleStatusClick(status, account, settings)}
          onProfileClick={handleProfileOpen}
          showProfileImage={target.settings.showProfileImages}
          showCustomEmojis={target.settings.showCustomEmojis}
          showReactions={target.settings.showReactions}
          sectionSettings={target.settings}
        />
      ))}

      {selectedStatus ? (
        <StatusModal
          status={selectedStatus}
          account={composeAccount}
          threadAccount={selectedStatusThreadAccount}
          api={services.api}
          zIndex={statusModalZIndex ?? undefined}
          onClose={handleCloseStatusModal}
          onUpdateStatus={setSelectedStatus}
          onProfileClick={handleProfileOpen}
          onReply={(status) => {
            if (composeAccount) {
              handleReply(status, composeAccount);
            }
          }}
          onToggleFavourite={async (status) => {
            if (!composeAccount) {
              setActionError(t("errors.accountRequired"));
              return;
            }
            setActionError(null);
            try {
              const updated = status.favourited
                ? await services.api.unfavourite(composeAccount, status.id)
                : await services.api.favourite(composeAccount, status.id);
              // Update the status in modal
              setSelectedStatus(updated);
            } catch (err) {
              setActionError(err instanceof Error ? err.message : t("errors.likeFailed"));
            }
          }}
          onToggleReblog={async (status) => {
            if (!composeAccount) {
              setActionError(t("errors.accountRequired"));
              return;
            }
            setActionError(null);
            try {
              const updated = status.reblogged
                ? await services.api.unreblog(composeAccount, status.id)
                : await services.api.reblog(composeAccount, status.id);
              setSelectedStatus(updated);
            } catch (err) {
              setActionError(err instanceof Error ? err.message : t("errors.boostFailed"));
            }
          }}
          onToggleBookmark={async (status) => {
            if (!composeAccount) {
              setActionError(t("errors.accountRequired"));
              return;
            }
            setActionError(null);
            const isBookmarking = !status.bookmarked;
            try {
              const updated = status.bookmarked
                ? await services.api.unbookmark(composeAccount, status.id)
                : await services.api.bookmark(composeAccount, status.id);
              setSelectedStatus(updated);
              if (isBookmarking) {
                showToast(t("toast.bookmarkAdded"));
              } else {
                showToast(t("toast.bookmarkRemoved"));
              }
            } catch (err) {
              setActionError(err instanceof Error ? err.message : t("errors.bookmarkFailed"));
            }
          }}
          onDelete={async (status) => {
            if (!composeAccount) {
              return;
            }
            setActionError(null);
            try {
              await services.api.deleteStatus(composeAccount, status.id);
              setSelectedStatus(null);
            } catch (err) {
              setActionError(err instanceof Error ? err.message : t("errors.statusDeleteFailed"));
            }
          }}
          activeHandle={
            composeAccount?.handle ? formatHandle(composeAccount.handle, composeAccount.instanceUrl) : composeAccount?.instanceUrl ?? ""
          }
          activeAccountHandle={composeAccount?.handle ?? ""}
          activeAccountUrl={composeAccount?.url ?? null}
          showProfileImage={selectedStatusSettings.showProfileImages}
          showCustomEmojis={selectedStatusSettings.showCustomEmojis}
          showReactions={selectedStatusSettings.showReactions}
          sectionSettings={selectedStatusSettings}
        />
      ) : null}
    </div>
  );
};
