import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Account, Visibility } from "../../domain/types";
import type { MastodonApi } from "../../services/MastodonApi";
import { useEmojiManager, type EmojiItem } from "../hooks/useEmojiManager";
import { useImageZoom } from "../hooks/useImageZoom";
import { useToast } from "../state/ToastContext";
import {
  calculateCharacterCount,
  getCharacterLimit,
  getCharacterCountStatus,
  getCharacterCountClassName,
  getDefaultCharacterLimit
} from "../utils/characterCount";

const VISIBILITY_KEY_PREFIX = "textodon.compose.visibility";
const parseVisibility = (value: string | null): Visibility | null => {
  if (value === "public" || value === "unlisted" || value === "private" || value === "direct") {
    return value;
  }
  return null;
};

const getVisibilityStorageKey = (accountId: string | null | undefined) =>
  accountId ? `${VISIBILITY_KEY_PREFIX}.${accountId}` : VISIBILITY_KEY_PREFIX;

const visibilityOptions: { value: Visibility; label: string }[] = [
  { value: "public", label: "전체 공개" },
  { value: "unlisted", label: "미등록" },
  { value: "private", label: "팔로워" },
  { value: "direct", label: "DM" }
];

const ZERO_WIDTH_SPACE = "\u200b";

export const ComposeBox = ({
  onSubmit,
  replyingTo,
  onCancelReply,
  mentionText,
  accountSelector,
  account,
  api
}: {
  onSubmit: (params: {
    text: string;
    visibility: Visibility;
    inReplyToId?: string;
    files: File[];
    spoilerText: string;
  }) => Promise<boolean>;
  replyingTo: { id: string; summary: string } | null;
  onCancelReply: () => void;
  mentionText: string | null;
  accountSelector?: React.ReactNode;
  account: Account | null;
  api: MastodonApi;
}) => {
  const [text, setText] = useState("");
  const [emojiQuery, setEmojiQuery] = useState<{
    value: string;
    start: number;
    end: number;
  } | null>(null);
  const [emojiSuggestionIndex, setEmojiSuggestionIndex] = useState(0);
  const [emojiSearchQuery, setEmojiSearchQuery] = useState("");
  const [cwEnabled, setCwEnabled] = useState(false);
  const [cwText, setCwText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [visibilityState, setVisibilityState] = useState(() => {
    const accountId = account?.id ?? null;
    const stored = parseVisibility(localStorage.getItem(getVisibilityStorageKey(accountId)));
    return {
      visibility: stored ?? "public" as Visibility,
      accountId
    };
  });
  const [attachments, setAttachments] = useState<
    { id: string; file: File; previewUrl: string }[]
  >([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const imageContainerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const cwInputRef = useRef<HTMLInputElement | null>(null);
  const composeRef = useRef<HTMLElement | null>(null);
  const visibilitySelectRef = useRef<HTMLSelectElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const emojiToggleRef = useRef<HTMLButtonElement | null>(null);
  const cwToggleRef = useRef<HTMLButtonElement | null>(null);
  const emojiPanelRef = useRef<HTMLDivElement | null>(null);

  // useImageZoom 훅 사용
  const {
    zoom: imageZoom,
    offset: imageOffset,
    isDragging,
    handleWheel,
    handleImageLoad,
    handlePointerDown,
    reset: resetImageZoom
  } = useImageZoom(imageContainerRef, imageRef);
  const [emojiPanelOpen, setEmojiPanelOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(true);
  const { showToast } = useToast();
  const lastEmojiErrorRef = useRef<string | null>(null);

  const handleAccountSelectionDone = useCallback(() => {
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, []);

  // 문자 수 관련 상태
  const [characterLimit, setCharacterLimit] = useState<number | null>(null);
  const [instanceLoading, setInstanceLoading] = useState(false);

  // useEmojiManager 훅 사용
  const {
    emojis: activeEmojis,
    emojiStatus,
    emojiError,
    emojiCategories,
    customEmojiCategories,
    standardEmojiCategories,
    expandedCategories,
    loadEmojis,
    addToRecent,
    toggleCategory,
    searchEmojis
  } = useEmojiManager(account, api, false);

  const lastEmojiStatusRef = useRef<typeof emojiStatus>(emojiStatus);

  useEffect(() => {
    if (emojiStatus !== "error") {
      lastEmojiErrorRef.current = null;
      return;
    }
    const message = emojiError ?? "이모지를 불러오지 못했습니다.";
    if (message === lastEmojiErrorRef.current) {
      return;
    }
    lastEmojiErrorRef.current = message;
    showToast(message, { tone: "error" });
  }, [emojiError, emojiStatus, showToast]);

  const activeImage = useMemo(
    () => attachments.find((item) => item.id === activeImageId) ?? null,
    [attachments, activeImageId]
  );

  const accountSelectorNode = useMemo(() => {
    if (!accountSelector) {
      return null;
    }
    if (React.isValidElement(accountSelector)) {
      return React.cloneElement(
        accountSelector as React.ReactElement<{ onSelectionDone?: () => void }>,
        {
          onSelectionDone: handleAccountSelectionDone
        }
      );
    }
    return accountSelector;
  }, [accountSelector, handleAccountSelectionDone]);

  const emojiSuggestions = useMemo(() => {
    if (!emojiQuery) {
      return [];
    }
    return searchEmojis(emojiQuery.value, 5);
  }, [emojiQuery, searchEmojis]);

  const emojiSearchResults = useMemo(() => {
    if (!emojiSearchQuery.trim()) {
      return [];
    }
    return searchEmojis(emojiSearchQuery);
  }, [emojiSearchQuery, searchEmojis]);

  const emojiById = useMemo(
    () => new Map(activeEmojis.map((emoji) => [emoji.id, emoji])),
    [activeEmojis]
  );

  const hasEmojiSearch = emojiSearchQuery.trim().length > 0;

  useEffect(() => {
    if (!activeImage) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [activeImage]);

  useEffect(() => {
    if (account?.id !== visibilityState.accountId) {
      const accountId = account?.id ?? null;
      const stored = parseVisibility(localStorage.getItem(getVisibilityStorageKey(accountId)));
      setVisibilityState({
        visibility: stored ?? "public",
        accountId
      });
    }
  }, [account?.id, visibilityState.accountId]);

  useEffect(() => {
    if (account?.id && visibilityState.accountId === account.id) {
      localStorage.setItem(getVisibilityStorageKey(account.id), visibilityState.visibility);
    }
  }, [account?.id, visibilityState]);

  // 계정 변경 시 인스턴스 정보 로드
  useEffect(() => {
    if (!account) {
      setCharacterLimit(null);
      return;
    }
    
    const loadInstanceInfo = async () => {
      try {
        setInstanceLoading(true);
        const instanceInfo = await api.fetchInstanceInfo(account);
        const limit = getCharacterLimit(instanceInfo);
        setCharacterLimit(limit);
      } catch (error) {
        console.error("인스턴스 정보 로드 실패:", error);
        // fallback: 기본값 사용
        const fallbackLimit = getDefaultCharacterLimit(account.platform);
        setCharacterLimit(fallbackLimit);
      } finally {
        setInstanceLoading(false);
      }
    };
    
    loadInstanceInfo();
  }, [account, api]);

  // 현재 문자 수 계산
  const currentCharCount = useMemo(() => {
    if (!account) return 0;
    const fullText = (cwEnabled ? cwText + "\n" : "") + text;
    return calculateCharacterCount(fullText, account.platform);
  }, [text, cwText, cwEnabled, account]);

  // 문자 수 상태 계산
  const charCountStatus = useMemo(() => {
    if (!characterLimit) return "normal";
    return getCharacterCountStatus(currentCharCount, characterLimit);
  }, [currentCharCount, characterLimit]);

  const submitPost = async () => {
    if (!text.trim() || isSubmitting) {
      return;
    }

    // 문자 수 제한 검사
    if (characterLimit && currentCharCount > characterLimit) {
      showToast(`글자 수 제한(${characterLimit.toLocaleString()}자)을 초과했습니다.`, { tone: "error" });
      return;
    }

    setIsSubmitting(true);
    try {
      const ok = await onSubmit({
        text: text.trim(),
        visibility: visibilityState.visibility,
        inReplyToId: replyingTo?.id,
        files: attachments.map((item) => item.file),
        spoilerText: cwEnabled ? cwText.trim() : ""
      });
      if (ok) {
        setText("");
        setCwText("");
        setCwEnabled(false);
        setAttachments((current) => {
          current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
          return [];
        });
        setActiveImageId(null);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await submitPost();
  };

  useEffect(() => {
    if (mentionText) {
      setText(mentionText);
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    }
  }, [mentionText]);

  // 이모지 패널이 열리면 이모지 로드
  useEffect(() => {
    if (emojiPanelOpen && account) {
      void loadEmojis();
    }
  }, [emojiPanelOpen, account, loadEmojis]);

  useEffect(() => {
    if (!emojiPanelOpen) {
      setEmojiSearchQuery("");
      return;
    }
    setRecentOpen(true);
  }, [emojiPanelOpen]);

  useEffect(() => {
    setEmojiSuggestionIndex(0);
  }, [emojiQuery?.value, emojiSuggestions.length]);

  useEffect(() => {
    if (emojiQuery?.value && account && emojiStatus === "idle") {
      void loadEmojis();
    }
  }, [emojiQuery?.value, account, emojiStatus, loadEmojis]);

  useEffect(() => {
    if (emojiSearchQuery.trim() && account && emojiStatus === "idle") {
      void loadEmojis();
    }
  }, [emojiSearchQuery, account, emojiStatus, loadEmojis]);

  const addAttachments = useCallback((files: File[]) => {
    if (files.length === 0) {
      return;
    }
    setAttachments((current) => [
      ...current,
      ...files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file)
      }))
    ]);
  }, []);

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    addAttachments(files);
    event.target.value = "";
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (isSubmitting) {
      return;
    }
    const items = Array.from(event.clipboardData.items);
    const imageFiles: File[] = [];
    items.forEach((item) => {
      if (item.kind !== "file" || !item.type.startsWith("image/")) {
        return;
      }
      const file = item.getAsFile();
      if (file) {
        imageFiles.push(file);
      }
    });
    if (imageFiles.length > 0) {
      event.preventDefault();
      addAttachments(imageFiles);
    }
  };

  const toggleCw = () => {
    setCwEnabled((current) => {
      const next = !current;
      if (!next) {
        setCwText("");
      } else {
        requestAnimationFrame(() => {
          cwInputRef.current?.focus();
        });
      }
      return next;
    });
  };

  useEffect(() => {
    const isEditableElement = (element: Element | null) => {
      if (!element) {
        return false;
      }
      return (
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        (element as HTMLElement).isContentEditable
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (emojiPanelOpen) {
        if (event.ctrlKey && event.shiftKey && !event.metaKey && key === "e") {
          if (emojiToggleRef.current && !emojiToggleRef.current.disabled) {
            event.preventDefault();
            setEmojiPanelOpen(false);
            emojiToggleRef.current.focus();
          }
        }
        return;
      }
      const activeElement = document.activeElement;
      const isTextField = isEditableElement(activeElement);
      const isInsideCompose =
        !!composeRef.current && !!activeElement && composeRef.current.contains(activeElement);

      if (key === "escape" && isTextField && isInsideCompose) {
        event.preventDefault();
        (activeElement as HTMLElement).blur();
        return;
      }

      if (key === "n" && !event.ctrlKey && !event.metaKey && !event.shiftKey && !isTextField) {
        event.preventDefault();
        textareaRef.current?.focus();
        return;
      }

      if (key === "n" && event.ctrlKey && event.shiftKey && !event.metaKey && isTextField) {
        event.preventDefault();
        textareaRef.current?.focus();
        return;
      }

      if (!event.ctrlKey || event.metaKey || !event.shiftKey) {
        return;
      }

      if (key === "w") {
        if (cwToggleRef.current && !cwToggleRef.current.disabled) {
          event.preventDefault();
          toggleCw();
          if (cwEnabled) {
            requestAnimationFrame(() => {
              textareaRef.current?.focus();
            });
          }
        }
        return;
      }

      if (!composeRef.current) {
        return;
      }

      if (key === "a") {
        const summary = composeRef.current.querySelector<HTMLElement>(
          ".account-selector-summary"
        );
        if (summary) {
          const details = summary.closest("details");
          if (details?.hasAttribute("open")) {
            event.preventDefault();
            summary.focus();
            return;
          }
          event.preventDefault();
          summary.click();
          summary.focus();
        }
        return;
      }

      if (key === "o") {
        const select = visibilitySelectRef.current;
        if (select && !select.disabled) {
          event.preventDefault();
          select.focus();
          select.click();
        }
        return;
      }

      if (key === "i") {
        if (fileInputRef.current && !fileInputRef.current.disabled) {
          event.preventDefault();
          fileInputRef.current.click();
        }
        return;
      }

      if (key === "e") {
        if (emojiToggleRef.current && !emojiToggleRef.current.disabled) {
          event.preventDefault();
          setEmojiPanelOpen((open) => !open);
          emojiToggleRef.current.focus();
        }
        return;
      }

      
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cwEnabled, emojiPanelOpen, setEmojiPanelOpen, toggleCw]);

  const findEmojiQuery = useCallback(
    (value: string, cursor: number) => {
      if (cursor <= 0) {
        return null;
      }
      const beforeCursor = value.slice(0, cursor);
      const colonIndex = beforeCursor.lastIndexOf(":");
      if (colonIndex < 0) {
        return null;
      }
      const query = beforeCursor.slice(colonIndex + 1);
      if (!query || /\s/.test(query)) {
        return null;
      }
      const prevChar = colonIndex > 0 ? beforeCursor[colonIndex - 1] : "";
      if (prevChar && !/\s/.test(prevChar) && prevChar !== ZERO_WIDTH_SPACE) {
        return null;
      }
      return {
        value: query,
        start: colonIndex,
        end: cursor
      };
    },
    []
  );

  const updateEmojiQuery = useCallback(
    (value: string, cursor: number) => {
      const nextQuery = findEmojiQuery(value, cursor);
      setEmojiQuery(nextQuery);
      if (!nextQuery) {
        setEmojiSuggestionIndex(0);
      }
    },
    [findEmojiQuery]
  );

  const insertEmojiValue = (value: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setText((current) => `${current}${value}`);
      return;
    }
    const start = textarea.selectionStart ?? text.length;
    const end = textarea.selectionEnd ?? text.length;
    const next = `${text.slice(0, start)}${value}${text.slice(end)}`;
    setText(next);
    requestAnimationFrame(() => {
      textarea.focus();
      const nextCursor = start + value.length;
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const buildEmojiInsertValue = (emoji: EmojiItem) => {
    if (emoji.isCustom && emoji.shortcode) {
      return `${ZERO_WIDTH_SPACE}:${emoji.shortcode}:${ZERO_WIDTH_SPACE}`;
    }
    if (emoji.unicode) {
      return `${ZERO_WIDTH_SPACE}${emoji.unicode}${ZERO_WIDTH_SPACE}`;
    }
    return "";
  };

  const handleEmojiSuggestionSelect = (emoji: EmojiItem) => {
    if (!emojiQuery) {
      return;
    }
    const value = buildEmojiInsertValue(emoji);
    if (!value) {
      return;
    }
    const nextText = `${text.slice(0, emojiQuery.start)}${value}${text.slice(emojiQuery.end)}`;
    setText(nextText);
    addToRecent(emoji.id);
    setEmojiQuery(null);
    setEmojiSuggestionIndex(0);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }
      const nextCursor = emojiQuery.start + value.length;
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
      updateEmojiQuery(nextText, nextCursor);
    });
  };

  const handleEmojiSelect = (emoji: EmojiItem) => {
    const value = buildEmojiInsertValue(emoji);
    if (!value) {
      return;
    }
    insertEmojiValue(value);
    addToRecent(emoji.id);
  };

  const setCategoryExpanded = useCallback(
    (categoryId: string, expanded: boolean) => {
      if (categoryId === "recent") {
        setRecentOpen((current) => (current === expanded ? current : expanded));
        return;
      }
      const isExpanded = expandedCategories.has(categoryId);
      if (isExpanded !== expanded) {
        toggleCategory(categoryId);
      }
    },
    [expandedCategories, toggleCategory]
  );

  const getEmojiNavItems = useCallback(() => {
    const panel = emojiPanelRef.current;
    if (!panel) {
      return [] as HTMLElement[];
    }
    return Array.from(panel.querySelectorAll<HTMLElement>("[data-emoji-nav]"));
  }, []);

  useEffect(() => {
    if (!emojiPanelOpen) {
      lastEmojiStatusRef.current = emojiStatus;
      return;
    }
    if (emojiStatus === "loaded" && lastEmojiStatusRef.current !== "loaded") {
      const items = getEmojiNavItems();
      const focusTarget = items[0] ?? emojiPanelRef.current;
      if (focusTarget) {
        requestAnimationFrame(() => {
          focusTarget.focus();
        });
      }
    }
    lastEmojiStatusRef.current = emojiStatus;
  }, [emojiPanelOpen, emojiStatus, getEmojiNavItems]);

  useEffect(() => {
    if (!emojiPanelOpen) {
      return;
    }
    const panel = emojiPanelRef.current;
    if (!panel) {
      return;
    }
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && panel.contains(activeElement)) {
      return;
    }
    const items = getEmojiNavItems();
    const focusTarget = items[0] ?? panel;
    requestAnimationFrame(() => {
      focusTarget.focus();
    });
  }, [emojiPanelOpen, emojiCategories.length, customEmojiCategories.length, standardEmojiCategories.length, emojiSearchResults.length, getEmojiNavItems]);

  const handleEmojiPanelKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      event.stopPropagation();
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      const key = event.key;
      if (key === "Escape") {
        event.preventDefault();
        setEmojiPanelOpen(false);
        emojiToggleRef.current?.focus();
        return;
      }

      const items = getEmojiNavItems();
      if (items.length === 0) {
        return;
      }

      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const currentIndex = activeElement ? items.indexOf(activeElement) : -1;
      const currentItem = currentIndex >= 0 ? items[currentIndex] : null;
      const navType = currentItem?.dataset.emojiNav;
      const categoryId = currentItem?.dataset.emojiCategoryId;

      const focusItem = (index: number) => {
        const nextIndex = Math.min(items.length - 1, Math.max(0, index));
        items[nextIndex]?.focus();
      };

      const findEmojiByDirection = (direction: "down" | "up"): HTMLElement | null => {
        if (!currentItem) {
          return null;
        }
        const currentRect = currentItem.getBoundingClientRect();
        const currentCenterX = currentRect.left + currentRect.width / 2;
        const currentCenterY = currentRect.top + currentRect.height / 2;
        const emojiItems = items.filter((item) => item.dataset.emojiNav === "emoji");
        let bestItem: HTMLElement | null = null;
        let bestDy = Number.POSITIVE_INFINITY;
        let bestDx = Number.POSITIVE_INFINITY;
        emojiItems.forEach((item) => {
          if (item === currentItem) {
            return;
          }
          const rect = item.getBoundingClientRect();
          const centerY = rect.top + rect.height / 2;
          const centerX = rect.left + rect.width / 2;
          const dy = centerY - currentCenterY;
          if (direction === "down" && dy <= 0) {
            return;
          }
          if (direction === "up" && dy >= 0) {
            return;
          }
          const absDy = Math.abs(dy);
          const dx = Math.abs(centerX - currentCenterX);
          if (absDy < bestDy || (absDy === bestDy && dx < bestDx)) {
            bestItem = item;
            bestDy = absDy;
            bestDx = dx;
          }
        });
        return bestItem;
      };

      if (key === "Enter") {
        if (navType === "emoji") {
          event.preventDefault();
          const emojiId = currentItem?.dataset.emojiId;
          const emoji = emojiId ? emojiById.get(emojiId) : null;
          if (emoji) {
            handleEmojiSelect(emoji);
          }
        }
        return;
      }

      if (key === "ArrowLeft" || key === "ArrowRight") {
        if (navType === "category" && categoryId) {
          event.preventDefault();
          setCategoryExpanded(categoryId, key === "ArrowRight");
          return;
        }
        event.preventDefault();
        const direction = key === "ArrowRight" ? 1 : -1;
        const nextIndex =
          currentIndex >= 0 ? currentIndex + direction : key === "ArrowRight" ? 0 : items.length - 1;
        focusItem(nextIndex);
        return;
      }

      if (key === "ArrowDown" || key === "ArrowUp") {
        event.preventDefault();
        if (navType === "emoji") {
          const targetEmoji = findEmojiByDirection(key === "ArrowDown" ? "down" : "up");
          if (targetEmoji) {
            targetEmoji.focus();
            return;
          }
          if (key === "ArrowDown") {
            const nextCategory = items
              .slice(currentIndex + 1)
              .find((item) => item.dataset.emojiNav === "category");
            if (nextCategory) {
              nextCategory.focus();
              return;
            }
          }
          if (key === "ArrowUp") {
            const previousCategory = items
              .slice(0, Math.max(0, currentIndex))
              .reverse()
              .find((item) => item.dataset.emojiNav === "category");
            if (previousCategory) {
              previousCategory.focus();
              return;
            }
          }
          return;
        }
        const direction = key === "ArrowDown" ? 1 : -1;
        const nextIndex =
          currentIndex >= 0 ? currentIndex + direction : key === "ArrowDown" ? 0 : items.length - 1;
        focusItem(nextIndex);
      }
    },
    [emojiById, getEmojiNavItems, handleEmojiSelect, setCategoryExpanded]
  );

  const handleToggleCategory = (categoryId: string) => {
    if (categoryId === "recent") {
      setRecentOpen((current) => !current);
    } else {
      toggleCategory(categoryId);
    }
  };

  const handleDeleteActive = () => {
    if (!activeImage) {
      return;
    }
    setAttachments((current) => {
      const next = current.filter((item) => item.id !== activeImage.id);
      URL.revokeObjectURL(activeImage.previewUrl);
      return next;
    });
    setActiveImageId(null);
  };

  useEffect(() => {
    return () => {
      attachments.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, [attachments]);

  return (
    <section
      className="panel compose-box"
      ref={composeRef}
      onKeyDown={(event) => {
        if (emojiPanelOpen) {
          event.stopPropagation();
        }
      }}
    >
      {accountSelectorNode ? (
        <div className="compose-account-select">{accountSelectorNode}</div>
      ) : null}
      {replyingTo ? (
        <div className="replying">
          <span>답글 대상: {replyingTo.summary}</span>
          <button type="button" className="ghost" onClick={onCancelReply}>
            취소
          </button>
        </div>
      ) : null}
      <form onSubmit={handleSubmit} className="compose-form" aria-busy={isSubmitting}>
        {cwEnabled ? (
          <div className="compose-cw">
            <input
              ref={cwInputRef}
              type="text"
              value={cwText}
              onChange={(event) => setCwText(event.target.value)}
              placeholder="CW 내용을 입력하세요"
              aria-label="콘텐츠 경고"
              disabled={isSubmitting}
            />
          </div>
        ) : null}
        <div className="compose-input-container">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(event) => {
              const nextValue = event.target.value;
              setText(nextValue);
              updateEmojiQuery(nextValue, event.target.selectionStart ?? nextValue.length);
            }}
            placeholder="지금 무슨 생각을 하고 있나요?"
            aria-label="글 작성"
            title="글 작성 (N / Ctrl+Shift+N)"
            rows={4}
            onPaste={handlePaste}
            disabled={isSubmitting}
            onClick={(event) => {
              const cursor = event.currentTarget.selectionStart ?? text.length;
              updateEmojiQuery(event.currentTarget.value, cursor);
            }}
            onKeyUp={(event) => {
              const cursor = event.currentTarget.selectionStart ?? text.length;
              updateEmojiQuery(event.currentTarget.value, cursor);
            }}
            onKeyDown={(event) => {
              if (!event.metaKey && !event.ctrlKey && emojiSuggestions.length > 0) {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setEmojiSuggestionIndex((current) =>
                    current + 1 >= emojiSuggestions.length ? 0 : current + 1
                  );
                  return;
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setEmojiSuggestionIndex((current) =>
                    current - 1 < 0 ? emojiSuggestions.length - 1 : current - 1
                  );
                  return;
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  const selected = emojiSuggestions[emojiSuggestionIndex];
                  if (selected) {
                    handleEmojiSuggestionSelect(selected);
                  }
                  return;
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setEmojiQuery(null);
                  setEmojiSuggestionIndex(0);
                  return;
                }
              }
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void submitPost();
              }
            }}
          />
          {emojiSuggestions.length > 0 ? (
            <div className="compose-emoji-suggestions" role="listbox" aria-label="이모지 추천">
              {emojiSuggestions.map((emoji, index) => {
                const isActive = index === emojiSuggestionIndex;
                const label = emoji.shortcode ? `:${emoji.shortcode}:` : emoji.label;
                return (
                  <button
                    key={`suggestion:${emoji.id}`}
                    type="button"
                    className={`compose-emoji-suggestion${isActive ? " is-active" : ""}`}
                    role="option"
                    aria-selected={isActive}
                    aria-label={`이모지 ${label}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleEmojiSuggestionSelect(emoji)}
                  >
                    <span className="compose-emoji-suggestion-icon" aria-hidden="true">
                      {emoji.unicode ? (
                        <span className="compose-emoji-text">{emoji.unicode}</span>
                      ) : emoji.url ? (
                        <img src={emoji.url} alt="" loading="lazy" />
                      ) : null}
                    </span>
                    <span className="compose-emoji-suggestion-label">{label}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="compose-attachments">
            {/* 첨부된 이미지들과 이미지 추가 버튼 */}
            <div className="compose-attachments-scroll">
              {attachments.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="attachment-thumb"
                  onClick={() => {
                    resetImageZoom();
                    setActiveImageId(item.id);
                  }}
                  aria-label="이미지 미리보기"
                >
                  <img src={item.previewUrl} alt="선택한 이미지" loading="lazy" />
                </button>
              ))}
              
              {/* 이미지 추가 버튼 */}
              <label
                className="file-button attachment-thumb"
                aria-label="이미지 추가"
                title="이미지 추가 (Ctrl+Shift+I)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2" ry="2" />
                  <circle cx="9" cy="10" r="2" />
                  <path d="M21 16l-5-5-4 4-2-2-5 5" />
                </svg>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFilesSelected}
                  disabled={isSubmitting}
                />
              </label>
            </div>
            
            {/* 문자 수 표시 - 고정 위치 */}
            {characterLimit && (
              <div className="compose-attachments-character-count">
                <span className={getCharacterCountClassName(charCountStatus)}>
                  {currentCharCount.toLocaleString()} / {characterLimit.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
        {visibilityState.visibility === "public" ? (
          <p className="compose-visibility-warning" role="status">
            전체 공개로 게시됩니다. 민감한 내용은 주의해주세요.
          </p>
        ) : null}
        <div className="compose-actions">
          <select
            ref={visibilitySelectRef}
            value={visibilityState.visibility}
            onChange={(event) => setVisibilityState(prev => ({ ...prev, visibility: event.target.value as Visibility }))}
            disabled={isSubmitting}
            title="공개 범위 (Ctrl+Shift+O)"
          >
            {visibilityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          
          <div className="compose-actions-right">
            <button
              type="button"
              className={`icon-button compose-icon-button${emojiPanelOpen ? " is-active" : ""}`}
              aria-label="이모지 팔렛트 열기"
              title="이모지 팔렛트 열기 (Ctrl+Shift+E)"
              onClick={() => setEmojiPanelOpen((open) => !open)}
              disabled={!account || isSubmitting}
              ref={emojiToggleRef}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M8.5 10.5h0.01" />
                <path d="M15.5 10.5h0.01" />
                <path d="M8.5 15.5c1.2 1 2.4 1.5 3.5 1.5s2.3-.5 3.5-1.5" />
              </svg>
            </button>
            <button
              type="button"
              className={`icon-button compose-icon-button${cwEnabled ? " is-active" : ""}`}
              aria-label="콘텐츠 경고 입력"
              title="콘텐츠 경고 입력 (Ctrl+Shift+W)"
              aria-pressed={cwEnabled}
              onClick={toggleCw}
              disabled={isSubmitting}
              ref={cwToggleRef}
            >
              CW
            </button>
            <button
              type="submit"
              className="icon-button compose-icon-button compose-submit-button"
              aria-label="게시"
              title="전송 (Ctrl+Enter)"
              disabled={isSubmitting}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22 2L11 13" />
                <path d="M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
              <span>전송</span>
            </button>
          </div>
        </div>
        {emojiPanelOpen ? (
          <div
            className="compose-emoji-panel"
            role="region"
            aria-label="이모지 팔렛트"
            ref={emojiPanelRef}
            onKeyDown={handleEmojiPanelKeyDown}
            data-emoji-picker-open="true"
            tabIndex={-1}
          >
            {!account ? <p className="compose-emoji-empty">계정을 선택해주세요.</p> : null}
            {account ? (
              <div className="compose-emoji-search">
                <input
                  type="text"
                  value={emojiSearchQuery}
                  onChange={(event) => setEmojiSearchQuery(event.target.value)}
                  placeholder="이모지 검색"
                  aria-label="이모지 검색"
                  disabled={emojiStatus === "loading"}
                />
              </div>
            ) : null}
            {account && emojiStatus === "loading" ? (
              <p className="compose-emoji-empty">이모지를 불러오는 중...</p>
            ) : null}
            {account && emojiStatus === "error" ? (
              <div className="compose-emoji-empty">
                <p>{emojiError ?? "이모지를 불러오지 못했습니다."}</p>
                <button type="button" className="ghost" onClick={() => loadEmojis()}>
                  다시 불러오기
                </button>
              </div>
            ) : null}
             {account && emojiCategories.length === 0 ? (
              <p className="compose-emoji-empty">사용할 수 있는 이모지가 없습니다.</p>
            ) : null}
            {account && emojiCategories.length > 0 ? (
              <>
                {hasEmojiSearch ? (
                  <section className="compose-emoji-category">
                    <div className="compose-emoji-category-toggle is-static">
                      <span>검색 결과</span>
                      <span className="compose-emoji-count">{emojiSearchResults.length}</span>
                    </div>
                    {emojiSearchResults.length > 0 ? (
                      <div className="compose-emoji-grid">
                        {emojiSearchResults.map((emoji) => (
                          <button
                            key={`search:${emoji.id}`}
                            type="button"
                            className="compose-emoji-button"
                            onClick={() => handleEmojiSelect(emoji)}
                            aria-label={`이모지 ${emoji.label}`}
                            title={emoji.shortcode ? `:${emoji.shortcode}:` : undefined}
                            data-emoji-nav="emoji"
                            data-emoji-id={emoji.id}
                          >
                            {emoji.unicode ? (
                              <span className="compose-emoji-text" aria-hidden="true">
                                {emoji.unicode}
                              </span>
                            ) : emoji.url ? (
                              <img src={emoji.url} alt="" loading="lazy" />
                            ) : null}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="compose-emoji-empty">검색 결과가 없습니다.</p>
                    )}
                  </section>
                ) : null}
                {(() => {
                  const recentCategory = emojiCategories.find((item) => item.id === "recent");
                  if (!recentCategory) return null;
                  const categoryKey = `${account.instanceUrl}::${recentCategory.id}`;
                  const isCollapsed = !recentOpen;
                  return (
                    <section key={categoryKey} className="compose-emoji-category">
                      <button
                        type="button"
                        className="compose-emoji-category-toggle"
                        onClick={() => handleToggleCategory(recentCategory.id)}
                        aria-expanded={!isCollapsed}
                        data-emoji-nav="category"
                        data-emoji-category-id={recentCategory.id}
                      >
                        <span>{recentCategory.label}</span>
                        <span className="compose-emoji-count">{recentCategory.emojis.length}</span>
                      </button>
                      {isCollapsed ? null : (
                        <div className="compose-emoji-grid">
                          {recentCategory.emojis.map((emoji) => (
                            <button
                              key={`${recentCategory.id}:${emoji.id}`}
                              type="button"
                              className="compose-emoji-button"
                              onClick={() => handleEmojiSelect(emoji)}
                              aria-label={`이모지 ${emoji.label}`}
                              title={emoji.shortcode ? `:${emoji.shortcode}:` : undefined}
                              data-emoji-nav="emoji"
                              data-emoji-id={emoji.id}
                            >
                              {emoji.unicode ? (
                                <span className="compose-emoji-text" aria-hidden="true">
                                  {emoji.unicode}
                                </span>
                              ) : emoji.url ? (
                                <img src={emoji.url} alt="" loading="lazy" />
                              ) : null}
                            </button>
                          ))}
                        </div>
                      )}
                    </section>
                  );
                })()}
                {customEmojiCategories.map((category) => {
                  const categoryKey = `${account.instanceUrl}::${category.id}`;
                  const isCollapsed = !expandedCategories.has(category.id);
                  return (
                    <section key={categoryKey} className="compose-emoji-category">
                      <button
                        type="button"
                        className="compose-emoji-category-toggle"
                        onClick={() => handleToggleCategory(category.id)}
                        aria-expanded={!isCollapsed}
                        data-emoji-nav="category"
                        data-emoji-category-id={category.id}
                      >
                        <span>{category.label}</span>
                        <span className="compose-emoji-count">{category.emojis.length}</span>
                      </button>
                      {isCollapsed ? null : (
                        <div className="compose-emoji-grid">
                          {category.emojis.map((emoji) => (
                            <button
                              key={`${category.id}:${emoji.id}`}
                              type="button"
                              className="compose-emoji-button"
                              onClick={() => handleEmojiSelect(emoji)}
                              aria-label={`이모지 ${emoji.label}`}
                              title={emoji.shortcode ? `:${emoji.shortcode}:` : undefined}
                              data-emoji-nav="emoji"
                              data-emoji-id={emoji.id}
                            >
                              {emoji.unicode ? (
                                <span className="compose-emoji-text" aria-hidden="true">
                                  {emoji.unicode}
                                </span>
                              ) : emoji.url ? (
                                <img src={emoji.url} alt="" loading="lazy" />
                              ) : null}
                            </button>
                          ))}
                        </div>
                      )}
                    </section>
                  );
                })}
                {customEmojiCategories.length > 0 && standardEmojiCategories.length > 0 ? (
                  <div
                    className="compose-emoji-divider"
                    role="separator"
                    aria-label="표준 이모지 구분선"
                  >
                    <span>표준 이모지</span>
                  </div>
                ) : null}
                {standardEmojiCategories.map((category) => {
                  const categoryKey = `${account.instanceUrl}::${category.id}`;
                  const isCollapsed = !expandedCategories.has(category.id);
                  return (
                    <section key={categoryKey} className="compose-emoji-category">
                      <button
                        type="button"
                        className="compose-emoji-category-toggle"
                        onClick={() => handleToggleCategory(category.id)}
                        aria-expanded={!isCollapsed}
                        data-emoji-nav="category"
                        data-emoji-category-id={category.id}
                      >
                        <span>{category.label}</span>
                        <span className="compose-emoji-count">{category.emojis.length}</span>
                      </button>
                      {isCollapsed ? null : (
                        <div className="compose-emoji-grid">
                          {category.emojis.map((emoji) => (
                            <button
                              key={`${category.id}:${emoji.id}`}
                              type="button"
                              className="compose-emoji-button"
                              onClick={() => handleEmojiSelect(emoji)}
                              aria-label={`이모지 ${emoji.label}`}
                              title={emoji.shortcode ? `:${emoji.shortcode}:` : undefined}
                              data-emoji-nav="emoji"
                              data-emoji-id={emoji.id}
                            >
                              {emoji.unicode ? (
                                <span className="compose-emoji-text" aria-hidden="true">
                                  {emoji.unicode}
                                </span>
                              ) : emoji.url ? (
                                <img src={emoji.url} alt="" loading="lazy" />
                              ) : null}
                            </button>
                          ))}
                        </div>
                      )}
                    </section>
                  );
                })}
              </>
            ) : null}

          </div>
        ) : null}
      </form>
      {isSubmitting ? (
        <div className="compose-busy" role="status" aria-live="polite">
          <div className="compose-busy-backdrop" aria-hidden="true" />
          <div className="compose-busy-content">
            <span className="compose-busy-spinner" aria-hidden="true" />
            <span>게시 중...</span>
          </div>
        </div>
      ) : null}
      {activeImage ? (
        <div
          className="image-modal"
          role="dialog"
          aria-modal="true"
          onWheel={(event) => event.preventDefault()}
          onMouseDown={(event) => {
            if (!(event.target instanceof Element)) {
              return;
            }
            if (!event.target.closest(".image-modal-content")) {
              setActiveImageId(null);
            }
          }}
        >
          <div className="image-modal-backdrop" onClick={() => setActiveImageId(null)} />
          <div
            className="image-modal-content"
            ref={imageContainerRef}
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setActiveImageId(null);
              }
            }}
          >
            <div className="image-modal-actions">
              <button
                type="button"
                className="image-modal-delete"
                onClick={handleDeleteActive}
              >
                삭제
              </button>
              <button type="button" onClick={() => setActiveImageId(null)}>
                닫기
              </button>
            </div>
            <img
              src={activeImage.previewUrl}
              alt="선택한 이미지 원본"
              ref={imageRef}
              draggable={false}
              className={isDragging ? "is-dragging" : undefined}
              style={{
                transform: `scale(${imageZoom}) translate(${imageOffset.x / imageZoom}px, ${imageOffset.y / imageZoom}px)`
              }}
              onWheel={handleWheel}
              onLoad={handleImageLoad}
              onPointerDown={handlePointerDown}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
};
