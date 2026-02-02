import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Account, CustomEmoji, LinkCard, MediaAttachment, Mention, ReactionInput, Status } from "../../domain/types";
import type { MastodonApi } from "../../services/MastodonApi";
import { sanitizeHtml } from "../utils/htmlSanitizer";
import { renderMarkdown } from "../utils/markdown";
import { renderTextWithLinks, type MentionLink } from "../utils/linkify";
import BoostIcon from "../assets/boost-icon.svg?react";
import ReplyIcon from "../assets/reply-icon.svg?react";
import TrashIcon from "../assets/trash-icon.svg?react";
import { ReactionPicker } from "./ReactionPicker";
import { useClickOutside } from "../hooks/useClickOutside";
import { useImageZoom } from "../hooks/useImageZoom";
import { AccountLabel } from "./AccountLabel";
import { useToast } from "../state/ToastContext";

const normalizeMentionHandle = (handle: string): string =>
  handle.replace(/^@/, "").trim().toLowerCase();

const normalizeMentionUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.replace(/\/$/, "");
    return `${parsed.protocol}//${parsed.hostname}${pathname}`;
  } catch {
    return null;
  }
};

let activeFloatingVideoId: string | null = null;
const previewCache = new Map<string, LinkCard | null>();
const isPreviewEnabled = () => {
  if (!import.meta.env.PROD) {
    return false;
  }
  if (typeof window === "undefined") {
    return false;
  }
  return !window.location.hostname.endsWith("github.io");
};

const extractFirstUrl = (text: string): string | null => {
  if (!text) {
    return null;
  }
  const match = text.match(/(https?:\/\/[^\s)\]]+|www\.[^\s)\]]+)/i);
  if (!match) {
    return null;
  }
  const value = match[0];
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  return `https://${value}`;
};

const decodeHtmlEntities = (value: string): string => {
  if (typeof document === "undefined") {
    return value;
  }
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
};

const normalizePreviewText = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  const decoded = decodeHtmlEntities(value);
  const normalized = decoded.replace(/\s+/g, " ").trim();
  return normalized || null;
};

const MediaVideo = ({
  id,
  src,
  poster,
  label
}: {
  id: string;
  src: string;
  poster?: string | null;
  label: string;
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFloating, setIsFloating] = useState(false);
  const [placeholderHeight, setPlaceholderHeight] = useState<number | null>(null);
  const [floatingWidth, setFloatingWidth] = useState<number | null>(null);
  const [floatingHeight, setFloatingHeight] = useState<number | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const isFloatingRef = useRef(false);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) {
      return;
    }
    const element = wrapperRef.current;
    if (!element) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.25 }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) {
      return;
    }
    const handlePlay = () => {
      activeFloatingVideoId = id;
      setIsPlaying(true);
      setIsDismissed(false);
    };
    const handlePause = () => {
      setIsPlaying(false);
    };
    element.addEventListener("play", handlePlay);
    element.addEventListener("pause", handlePause);
    element.addEventListener("ended", handlePause);
    return () => {
      element.removeEventListener("play", handlePlay);
      element.removeEventListener("pause", handlePause);
      element.removeEventListener("ended", handlePause);
    };
  }, [id]);

  useEffect(() => {
    const shouldFloat = !isVisible && activeFloatingVideoId === id && !isDismissed;
    if (!shouldFloat) {
      if (isFloating) {
        setIsFloating(false);
        setPlaceholderHeight(null);
      }
      if (isVisible && isDismissed) {
        setIsDismissed(false);
      }
      return;
    }
    if (!isFloating) {
      const height = wrapperRef.current?.getBoundingClientRect().height ?? null;
      const width = wrapperRef.current?.getBoundingClientRect().width ?? null;
      const currentHeight = videoRef.current?.getBoundingClientRect().height ?? null;
      setPlaceholderHeight(height);
      setFloatingWidth(width);
      setFloatingHeight(currentHeight);
      setIsFloating(true);
    }
  }, [id, isDismissed, isPlaying, isVisible, isFloating]);

  useEffect(() => {
    isFloatingRef.current = isFloating;
  }, [isFloating]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !("ResizeObserver" in window)) {
      return;
    }
    const observer = new ResizeObserver(() => {
      if (!isFloatingRef.current) {
        return;
      }
      const rect = element.getBoundingClientRect();
      setFloatingHeight(rect.height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const startResize = useCallback(
    (
      event: React.PointerEvent<HTMLElement>,
      options: { horizontalFactor: -1 | 0 | 1; verticalFactor: -1 | 0 | 1 }
    ) => {
      if (!isFloatingRef.current) {
        return;
      }
      const element = videoRef.current;
      if (!element) {
        return;
      }
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const startWidth = rect.width;
      const startHeight = rect.height;
      const startX = event.clientX;
      const startY = event.clientY;
      const ratio = startWidth / Math.max(1, startHeight);
      const minWidth = 220;
      const maxWidth = Math.min(window.innerWidth - 24, 720);

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        const isHorizontalResize = options.horizontalFactor !== 0;
        const isVerticalResize = options.verticalFactor !== 0;
        const widthFromHorizontal = startWidth + deltaX * options.horizontalFactor;
        const heightFromVertical = startHeight + deltaY * options.verticalFactor;
        const widthFromVertical = heightFromVertical * ratio;
        const nextWidthRaw = isHorizontalResize
          ? widthFromHorizontal
          : isVerticalResize
            ? widthFromVertical
            : startWidth;
        const nextWidth = Math.max(minWidth, Math.min(maxWidth, nextWidthRaw));
        setFloatingWidth(nextWidth);
      };
      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    []
  );

  return (
    <div
      ref={wrapperRef}
      className={`status-media-video${isFloating ? " is-floating" : ""}`}
      style={placeholderHeight ? { height: `${placeholderHeight}px` } : undefined}
    >
      <video
        ref={videoRef}
        controls
        preload="metadata"
        playsInline
        poster={poster ?? undefined}
        aria-label={label}
        className={isFloating ? "is-floating" : undefined}
        style={isFloating && floatingWidth ? { width: `${floatingWidth}px` } : undefined}
      >
        <source src={src} />
      </video>
      {isFloating && floatingWidth && floatingHeight ? (
        <div
          className="status-media-resize-overlay"
          style={{ width: `${floatingWidth}px`, height: `${floatingHeight}px` }}
          aria-hidden="true"
        >
          <button
            type="button"
            className="status-media-floating-close"
            aria-label="고정 플레이어 닫기"
            onClick={() => {
              setIsFloating(false);
              setPlaceholderHeight(null);
              setIsDismissed(true);
            }}
          >
            닫기
          </button>
          <span
            className="status-media-resize-edge edge-top"
            onPointerDown={(event) => startResize(event, { horizontalFactor: 0, verticalFactor: -1 })}
          />
          <span
            className="status-media-resize-corner corner-top-left"
            onPointerDown={(event) => startResize(event, { horizontalFactor: -1, verticalFactor: -1 })}
          />
          <span
            className="status-media-resize-edge edge-right"
            onPointerDown={(event) => startResize(event, { horizontalFactor: 1, verticalFactor: 0 })}
          />
          <span
            className="status-media-resize-corner corner-top-right"
            onPointerDown={(event) => startResize(event, { horizontalFactor: 1, verticalFactor: -1 })}
          />
          <span
            className="status-media-resize-edge edge-bottom"
            onPointerDown={(event) => startResize(event, { horizontalFactor: 0, verticalFactor: 1 })}
          />
          <span
            className="status-media-resize-corner corner-bottom-right"
            onPointerDown={(event) => startResize(event, { horizontalFactor: 1, verticalFactor: 1 })}
          />
          <span
            className="status-media-resize-edge edge-left"
            onPointerDown={(event) => startResize(event, { horizontalFactor: -1, verticalFactor: 0 })}
          />
          <span
            className="status-media-resize-corner corner-bottom-left"
            onPointerDown={(event) => startResize(event, { horizontalFactor: -1, verticalFactor: 1 })}
          />
        </div>
      ) : null}
    </div>
  );
};

export const TimelineItem = ({
  status,
  onReply,
  onToggleFavourite,
  onToggleReblog,
  onDelete,
  onToggleBookmark,
  onReact,
  onProfileClick,
  onStatusClick,
  onSelect,
  onUpdateStatus,
  isSelected = false,
  account,
  api,
  activeHandle,
  activeAccountHandle,
  activeAccountUrl,
  showProfileImage,
  showCustomEmojis,
  showReactions,
  disableActions = false,
  enableReactionActions = true
}: {
  status: Status;
  onReply: (status: Status) => void;
  onToggleFavourite: (status: Status) => void;
  onToggleReblog: (status: Status) => void;
  onDelete: (status: Status) => void;
  onToggleBookmark: (status: Status) => void;
  onReact?: (status: Status, reaction: ReactionInput) => void;
  onProfileClick?: (status: Status) => void;
  onStatusClick?: (status: Status) => void;
  onSelect?: (statusId: string) => void;
  onUpdateStatus?: (status: Status) => void;
  isSelected?: boolean;
  account: Account | null;
  api: MastodonApi;
  activeHandle: string;
  activeAccountHandle: string;
  activeAccountUrl: string | null;
  showProfileImage: boolean;
  showCustomEmojis: boolean;
  showReactions: boolean;
  disableActions?: boolean;
  enableReactionActions?: boolean;
}) => {
  const notification = status.notification;
  const displayStatus = notification?.target ?? status.reblog ?? status;
  const boostedBy = notification ? null : status.reblog ? status.boostedBy : null;
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);
  const [showContent, setShowContent] = useState(() => displayStatus.spoilerText.length === 0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [favouriteState, setFavouriteState] = useState<boolean | null>(false);
  const [previewCard, setPreviewCard] = useState<LinkCard | null>(displayStatus.card ?? null);
  const imageContainerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { showToast } = useToast();
  const handleSelect = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!onSelect) {
        return;
      }
      if (event.defaultPrevented) {
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      if (
        target?.closest(
          "button, a, input, textarea, select, label, summary, details, [role='button'], [role='link'], [contenteditable='true'], [data-interactive='true'], .overlay-backdrop, .image-modal, .confirm-modal"
        )
      ) {
        return;
      }
      onSelect(status.id);
    },
    [onSelect, status.id]
  );

  // 메뉴 열 때 즐겨찾기 상태 확인 (미스키만)
  const handleMenuToggle = useCallback(async () => {
    const willOpen = !menuOpen;
    setMenuOpen(willOpen);

    if (willOpen && account && api && account.platform === "misskey") {
      // 초기 상태를 null로 설정하여 비활성화 상태로 표시
      setFavouriteState(null);

      try {
        const state = await api.fetchNoteState(account, displayStatus.id);
        setFavouriteState(state.isFavourited);
      } catch (error) {
        console.error("즐겨찾기 상태 확인 실패:", error);
        setFavouriteState(false); // 실패 시 기본값은 false로 설정
      }
    }
  }, [menuOpen, account, api, displayStatus.id]);

  // useImageZoom 사용
  const {
    zoom: imageZoom,
    offset: imageOffset,
    isDragging,
    handleWheel,
    handleImageLoad,
    handlePointerDown,
    reset: resetImageZoom
  } = useImageZoom(imageContainerRef, imageRef);
  const attachments = displayStatus.mediaAttachments;
  const imageAttachments = useMemo(
    () => attachments.filter((item) => item.kind === "image"),
    [attachments]
  );
  const mediaAttachments = useMemo(
    () => attachments.filter((item) => item.kind !== "image"),
    [attachments]
  );
  const activeImageUrl = activeImageIndex !== null ? imageAttachments[activeImageIndex]?.url ?? null : null;

  const goToPrevImage = useCallback(() => {
    if (activeImageIndex === null || imageAttachments.length <= 1) return;
    const prevIndex = activeImageIndex === 0 ? imageAttachments.length - 1 : activeImageIndex - 1;
    setActiveImageIndex(prevIndex);
    resetImageZoom();
  }, [activeImageIndex, imageAttachments.length, resetImageZoom]);

  const goToNextImage = useCallback(() => {
    if (activeImageIndex === null || imageAttachments.length <= 1) return;
    const nextIndex = activeImageIndex === imageAttachments.length - 1 ? 0 : activeImageIndex + 1;
    setActiveImageIndex(nextIndex);
    resetImageZoom();
  }, [activeImageIndex, imageAttachments.length, resetImageZoom]);

  useEffect(() => {
    if (activeImageIndex === null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToPrevImage();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goToNextImage();
      } else if (event.key === "Escape") {
        event.preventDefault();
        setActiveImageIndex(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeImageIndex, goToPrevImage, goToNextImage]);

  useEffect(() => {
    setPreviewCard(displayStatus.card ?? null);
  }, [displayStatus.card, displayStatus.id]);
  const displayHandle = useMemo(() => {
    if (displayStatus.accountHandle.includes("@")) {
      return displayStatus.accountHandle;
    }
    if (!displayStatus.accountUrl) {
      return displayStatus.accountHandle;
    }
    try {
      const host = new URL(displayStatus.accountUrl).hostname;
      return `${displayStatus.accountHandle}@${host}`;
    } catch {
      return displayStatus.accountHandle;
    }
  }, [displayStatus.accountHandle, displayStatus.accountUrl]);
  const boostedHandle = useMemo(() => {
    if (!boostedBy) {
      return null;
    }
    if (boostedBy.handle.includes("@")) {
      return boostedBy.handle;
    }
    if (!boostedBy.url) {
      return boostedBy.handle;
    }
    try {
      const host = new URL(boostedBy.url).hostname;
      return `${boostedBy.handle}@${host}`;
    } catch {
      return boostedBy.handle;
    }
  }, [boostedBy]);
  const renderEmojiText = useCallback(
    (text: string, customEmojis: CustomEmoji[]): React.ReactNode => {
      if (!showCustomEmojis || customEmojis.length === 0) {
        return text;
      }
      const emojiMap = new Map(customEmojis.map((emoji) => [emoji.shortcode, emoji.url]));
      const regex = /:([a-zA-Z0-9_]+):/g;
      const nodes: React.ReactNode[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      let segmentIndex = 0;
      while ((match = regex.exec(text)) !== null) {
        const shortcode = match[1];
        const url = emojiMap.get(shortcode);
        if (match.index > lastIndex) {
          nodes.push(
            <React.Fragment key={`label-text-${segmentIndex}`}>
              {text.slice(lastIndex, match.index)}
            </React.Fragment>
          );
          segmentIndex += 1;
        }
        if (url) {
          nodes.push(
            <img
              key={`label-emoji-${shortcode}-${segmentIndex}`}
              src={url}
              alt={`:${shortcode}:`}
              className="custom-emoji"
              loading="lazy"
            />
          );
        } else {
          nodes.push(
            <React.Fragment key={`label-raw-${segmentIndex}`}>
              {match[0]}
            </React.Fragment>
          );
        }
        segmentIndex += 1;
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < text.length) {
        nodes.push(
          <React.Fragment key={`label-text-${segmentIndex}`}>{text.slice(lastIndex)}</React.Fragment>
        );
      }
      return nodes;
    },
    [showCustomEmojis]
  );
  const mentionLabel = useMemo(() => {
    if (!displayStatus.mentions || displayStatus.mentions.length === 0) {
      return null;
    }
    const labels = displayStatus.mentions
      .map((mention) => mention.displayName || mention.handle)
      .filter(Boolean);
    if (labels.length === 0) {
      return null;
    }
    const emojiList = [...displayStatus.customEmojis, ...displayStatus.accountEmojis];
    return labels.map((label, index) => (
      <React.Fragment key={`mention-label-${index}`}>
        {index > 0 ? ", " : ""}
        {renderEmojiText(label, emojiList)}
      </React.Fragment>
    ));
  }, [displayStatus.accountEmojis, displayStatus.customEmojis, displayStatus.mentions, renderEmojiText]);
  const boostedLabel = useMemo(() => {
    if (notification) {
      return null;
    }
    if (boostedBy) {
      const label = boostedBy.name || boostedHandle || boostedBy.handle;
      const labelNode = renderEmojiText(label, status.accountEmojis);
      return (
        <>
          {labelNode}이 부스트함
        </>
      );
    }
    if (displayStatus.reblogged) {
      return "내가 부스트함";
    }
    return null;
  }, [boostedBy, boostedHandle, displayStatus.reblogged, notification, renderEmojiText, status.accountEmojis]);
  const canOpenProfile = Boolean(onProfileClick);
  const profileLabel = `${displayStatus.accountName || displayStatus.accountHandle} 프로필 보기`;
  const notificationActorHandle = useMemo(() => {
    if (!notification) {
      return "";
    }
    const handle = notification.actor.handle;
    if (!handle) {
      return "";
    }
    if (handle.includes("@")) {
      return handle;
    }
    if (!notification.actor.url) {
      return handle;
    }
    try {
      const host = new URL(notification.actor.url).hostname;
      return `${handle}@${host}`;
    } catch {
      return handle;
    }
  }, [notification]);
  const notificationLabel = useMemo(() => {
    if (!notification) {
      return null;
    }
    const actorName =
      notification.actor.name || notificationActorHandle || notification.actor.handle || "알 수 없는 사용자";
    const actorNode = renderEmojiText(actorName, status.accountEmojis);
    return (
      <>
        {actorNode} 님이 {notification.label}
      </>
    );
  }, [notification, notificationActorHandle, renderEmojiText, status.accountEmojis]);
  const timestamp = useMemo(
    () => new Date(displayStatus.createdAt).toLocaleString(),
    [displayStatus.createdAt]
  );
  const originUrl = useMemo(() => {
    if (displayStatus.url) {
      return displayStatus.url;
    }
    const hostFromAccount = activeAccountUrl
      ? (() => {
          try {
            return new URL(activeAccountUrl).hostname;
          } catch {
            return "";
          }
        })()
      : "";
    const hostFromHandle = activeHandle.includes("@")
      ? activeHandle.split("@").pop() ?? ""
      : "";
    const host = hostFromAccount || hostFromHandle;
    if (!host || !displayStatus.id) {
      return null;
    }
    return `https://${host}/notes/${displayStatus.id}`;
  }, [activeAccountUrl, activeHandle, displayStatus.id, displayStatus.url]);
  const handleHeaderClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (onProfileClick) {
        if (event.target instanceof Element && event.target.closest("a")) {
          return;
        }
        onProfileClick(displayStatus);
        return;
      }
      if (!displayStatus.accountUrl) {
        return;
      }
      const target =
        event.target instanceof Element
          ? event.target
          : event.target && "parentElement" in event.target
            ? (event.target as Node).parentElement
            : null;
      if (target?.closest("a")) {
        return;
      }
      window.open(displayStatus.accountUrl, "_blank", "noopener,noreferrer");
    },
    [displayStatus, displayStatus.accountUrl, onProfileClick]
  );
  const handleHeaderKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      if (onProfileClick) {
        onProfileClick(displayStatus);
        return;
      }
      if (!displayStatus.accountUrl) {
        return;
      }
      window.open(displayStatus.accountUrl, "_blank", "noopener,noreferrer");
    },
    [displayStatus, displayStatus.accountUrl, onProfileClick]
  );

  useClickOutside(menuRef, menuOpen, () => setMenuOpen(false));

  const handleOpenOrigin = useCallback(() => {
    if (!originUrl) {
      return;
    }
    window.open(originUrl, "_blank", "noopener,noreferrer");
    setMenuOpen(false);
  }, [originUrl]);

  const handleStatusClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!onStatusClick) {
        return;
      }
      if (event.target instanceof Element && event.target.closest("a")) {
        return;
      }
      onStatusClick(displayStatus);
    },
    [displayStatus, onStatusClick]
  );
  const handleStatusKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      if (!onStatusClick) {
        return;
      }
      onStatusClick(displayStatus);
    },
    [displayStatus, onStatusClick]
  );
  const visibilityIcon = useMemo(() => {
    switch (displayStatus.visibility) {
      case "public":
        return (
          <svg className="visibility-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18" />
            <path d="M12 3a14 14 0 0 0 0 18" />
            <path d="M12 3a14 14 0 0 1 0 18" />
          </svg>
        );
      case "private":
        return (
          <svg className="visibility-icon" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
        );
      case "direct":
        return (
          <svg className="visibility-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 7l9 6 9-6" />
            <rect x="3" y="6" width="18" height="12" rx="2" />
          </svg>
        );
      default:
        return null;
    }
  }, [displayStatus.visibility]);

  const formatReactionLabel = useCallback((reaction: Status["reactions"][number]) => {
    const baseName =
      reaction.name.startsWith(":") && reaction.name.endsWith(":")
        ? reaction.name.slice(1, -1)
        : reaction.name;
    const trimmed = baseName.replace(/@\.?$/, "");
    if (!reaction.isCustom) {
      return trimmed || reaction.name;
    }
    if (trimmed.includes("@") || !reaction.host) {
      return trimmed || reaction.name;
    }
    return `${trimmed}@${reaction.host}`;
  }, []);
  const buildEmojiMap = useCallback((emojis: CustomEmoji[]) => {
    return new Map(emojis.map((emoji) => [emoji.shortcode, emoji.url]));
  }, []);
  const mentionMap = useMemo(() => {
    const map = new Map<string, Mention>();
    displayStatus.mentions.forEach((mention) => {
      const key = normalizeMentionHandle(mention.handle);
      if (key) {
        map.set(key, mention);
      }
    });
    return map;
  }, [displayStatus.mentions]);
  const mentionUrlMap = useMemo(() => {
    const map = new Map<string, Mention>();
    displayStatus.mentions.forEach((mention) => {
      if (!mention.url) {
        return;
      }
      const normalized = normalizeMentionUrl(mention.url);
      if (normalized) {
        map.set(normalized, mention);
      }
    });
    return map;
  }, [displayStatus.mentions]);
  const buildMentionStatus = useCallback(
    (mention: Mention): Status => ({
      id: mention.id ? `mention-${mention.id}` : `mention-${displayStatus.id}-${mention.handle}`,
      createdAt: displayStatus.createdAt,
      accountId: mention.id || null,
      accountName: mention.displayName || mention.handle,
      accountHandle: mention.handle,
      accountUrl: mention.url,
      accountAvatarUrl: null,
      content: "",
      htmlContent: "",
      hasRichContent: false,
      url: mention.url,
      visibility: "public",
      spoilerText: "",
      sensitive: false,
      card: null,
      repliesCount: 0,
      reblogsCount: 0,
      favouritesCount: 0,
      reactions: [],
      reblogged: false,
      favourited: false,
      bookmarked: false,
      inReplyToId: null,
      mentions: [],
      mediaAttachments: [],
      reblog: null,
      boostedBy: null,
      notification: null,
      myReaction: null,
      customEmojis: [],
      accountEmojis: []
    }),
    [displayStatus.createdAt, displayStatus.id]
  );
  const handleMentionClick = useCallback(
    (mention: MentionLink) => {
      if (!onProfileClick || !mention.id) {
        return;
      }
      onProfileClick(buildMentionStatus(mention as Mention));
    },
    [buildMentionStatus, onProfileClick]
  );
  const resolveMention = useCallback(
    (handle: string) => {
      const mention = mentionMap.get(handle.toLowerCase()) ?? null;
      return mention?.id ? mention : null;
    },
    [mentionMap]
  );
  const resolveMentionUrl = useCallback(
    (handle: string) => {
      const normalizedHandle = normalizeMentionHandle(handle);
      if (!normalizedHandle) {
        return null;
      }
      const mention = mentionMap.get(normalizedHandle) ?? null;
      if (mention?.url) {
        return mention.url;
      }
      if (!normalizedHandle.includes("@")) {
        return null;
      }
      const [username, ...rest] = normalizedHandle.split("@");
      const host = rest.join("@");
      if (!username || !host) {
        return null;
      }
      return `https://${host}/@${username}`;
    },
    [mentionMap]
  );
  const normalizedActiveMentionHandle = useMemo(() => {
    const base = normalizeMentionHandle(activeAccountHandle);
    if (!base) {
      return "";
    }
    if (base.includes("@")) {
      return base;
    }
    if (!activeAccountUrl) {
      return base;
    }
    try {
      const host = new URL(activeAccountUrl).hostname;
      return host ? `${base}@${host}` : base;
    } catch {
      return base;
    }
  }, [activeAccountHandle, activeAccountUrl]);
  const handleRichContentClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!onProfileClick || !(event.target instanceof Element)) {
        return;
      }
      const anchor = event.target.closest("a");
      if (!anchor) {
        return;
      }
      const href = anchor.getAttribute("href");
      if (!href) {
        return;
      }
      const hasMentionClass = anchor.classList.contains("mention");
      const looksLikeMention = hasMentionClass || href.includes("/@");
      if (!looksLikeMention) {
        return;
      }
      const normalizedHref = normalizeMentionUrl(href);
      let mention = normalizedHref ? mentionUrlMap.get(normalizedHref) ?? null : null;
      if (!mention) {
        const text = anchor.textContent ?? "";
        const normalizedHandle = normalizeMentionHandle(text);
        mention = normalizedHandle ? mentionMap.get(normalizedHandle) ?? null : null;
      }
      if (!mention) {
        const text = anchor.textContent ?? "";
        const normalizedHandle = normalizeMentionHandle(text);
        let derivedHandle = normalizedHandle;
        try {
          const parsed = new URL(href);
          const match = parsed.pathname.replace(/\/$/, "").match(/^\/@([^/]+)$/);
          if (match?.[1]) {
            const username = match[1];
            derivedHandle = derivedHandle?.includes("@") ? derivedHandle : `${username}@${parsed.hostname}`;
          }
        } catch {
          /* noop */
        }
        if (derivedHandle) {
          mention = {
            id: `mention-${displayStatus.id}-${derivedHandle}`,
            displayName: derivedHandle,
            handle: derivedHandle,
            url: href
          };
        }
      }
      if (!mention?.id) {
        if (!mention) {
          return;
        }
      }
      const normalizedMentionHandle = normalizeMentionHandle(mention.handle);
      if (normalizedMentionHandle && normalizedMentionHandle === normalizedActiveMentionHandle) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      onProfileClick(buildMentionStatus(mention));
    },
    [buildMentionStatus, mentionMap, mentionUrlMap, normalizedActiveMentionHandle, onProfileClick]
  );

  const tokenizeWithEmojis = useCallback((text: string, emojiMap: Map<string, string>) => {
    const regex = /:([a-zA-Z0-9_]+):/g;
    const tokens: Array<{ type: "text"; value: string } | { type: "emoji"; name: string; url: string }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const shortcode = match[1];
      const url = emojiMap.get(shortcode);
      if (match.index > lastIndex) {
        tokens.push({ type: "text", value: text.slice(lastIndex, match.index) });
      }
      if (url) {
        tokens.push({ type: "emoji", name: shortcode, url });
      } else {
        tokens.push({ type: "text", value: match[0] });
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      tokens.push({ type: "text", value: text.slice(lastIndex) });
    }
    return tokens;
  }, []);


  const contentParts = useMemo(() => {
    // Check if content actually contains HTML tags before rendering as HTML
    const hasHtmlTags = displayStatus.htmlContent ? /<[^>]+>/g.test(displayStatus.htmlContent) : false;
    
    if (displayStatus.hasRichContent && hasHtmlTags) {
      // Process HTML content to ensure custom emojis are properly rendered
      let processedHtml = displayStatus.htmlContent || '';
      
      // If custom emojis should be shown and we have emoji data, replace any remaining shortcodes
      if (showCustomEmojis && displayStatus.customEmojis.length > 0) {
        const emojiMap = buildEmojiMap(displayStatus.customEmojis);
        
        // Replace any remaining :shortcode: patterns that weren't converted to <img> tags
        processedHtml = processedHtml.replace(/:([a-zA-Z0-9_]+):/g, (match, shortcode) => {
          const url = emojiMap.get(shortcode);
          if (url) {
            return `<img src="${url}" alt=":${shortcode}:" class="custom-emoji" loading="lazy" />`;
          }
          return match; // Keep original if no emoji found
        });
      }
      
      return (
        <div 
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(processedHtml) }}
          className="rich-content"
          onClick={handleRichContentClick}
        />
      );
    }
    
    if (account?.platform === "misskey") {
      const emojiMap =
        showCustomEmojis && displayStatus.customEmojis.length > 0
          ? buildEmojiMap(displayStatus.customEmojis)
          : undefined;
      const markdownHtml = renderMarkdown(displayStatus.content, emojiMap, { mentionResolver: resolveMentionUrl });
      return (
        <div
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(markdownHtml) }}
          className="rich-content"
          onClick={handleRichContentClick}
        />
      );
    }

    // Fallback to plain text with link detection
    const text = displayStatus.content;
    if (!showCustomEmojis || displayStatus.customEmojis.length === 0) {
      return renderTextWithLinks(text, "content", {
        mentionResolver: resolveMention,
        onMentionClick: handleMentionClick
      });
    }
    const emojiMap = buildEmojiMap(displayStatus.customEmojis);
    const tokens = tokenizeWithEmojis(text, emojiMap);
    const parts: React.ReactNode[] = [];
    tokens.forEach((token, index) => {
      if (token.type === "text") {
        parts.push(
          ...renderTextWithLinks(token.value, `content-${index}`, {
            mentionResolver: resolveMention,
            onMentionClick: handleMentionClick
          })
        );
      } else {
        parts.push(
          <img
            key={`content-emoji-${index}`}
            src={token.url}
            alt={`:${token.name}:`}
            className="custom-emoji"
            loading="lazy"
          />
        );
      }
    });
    return parts;
  }, [
    buildEmojiMap,
    account?.platform,
    displayStatus.content,
    displayStatus.customEmojis,
    displayStatus.hasRichContent,
    displayStatus.htmlContent,
    handleMentionClick,
    handleRichContentClick,
    resolveMention,
    resolveMentionUrl,
    showCustomEmojis,
    tokenizeWithEmojis
  ]);

  const accountLabel = displayStatus.accountName || displayStatus.accountHandle;
  const accountNameNode = useMemo(() => {
    if (!showCustomEmojis || displayStatus.accountEmojis.length === 0) {
      return accountLabel;
    }
    const emojiMap = buildEmojiMap(displayStatus.accountEmojis);
    const tokens = tokenizeWithEmojis(accountLabel, emojiMap);
    return tokens.map((token, index) => {
      if (token.type === "text") {
        return token.value;
      }
      return (
        <img
          key={`account-emoji-${index}`}
          src={token.url}
          alt={`:${token.name}:`}
          className="custom-emoji"
          loading="lazy"
        />
      );
    });
  }, [
    accountLabel,
    buildEmojiMap,
    displayStatus.accountEmojis,
    showCustomEmojis,
    tokenizeWithEmojis
  ]);

  const normalizeHandle = useCallback((handle: string, url: string | null) => {
    if (!handle) {
      return "";
    }
    if (handle.includes("@")) {
      return handle;
    }
    if (!url) {
      return handle;
    }
    try {
      const host = new URL(url).hostname;
      return `${handle}@${host}`;
    } catch {
      return handle;
    }
  }, []);
  const normalizedActiveHandle = useMemo(
    () => normalizeHandle(activeAccountHandle, activeAccountUrl),
    [activeAccountHandle, activeAccountUrl, normalizeHandle]
  );
  const normalizedStatusHandle = useMemo(
    () => normalizeHandle(displayStatus.accountHandle, displayStatus.accountUrl),
    [displayStatus.accountHandle, displayStatus.accountUrl, normalizeHandle]
  );
  const isSameAccount = useMemo(() => {
    if (!normalizedActiveHandle || !normalizedStatusHandle) {
      return false;
    }
    if (normalizedActiveHandle === normalizedStatusHandle) {
      return true;
    }
    if (
      !normalizedStatusHandle.includes("@") &&
      normalizedActiveHandle.startsWith(`${normalizedStatusHandle}@`)
    ) {
      return true;
    }
    if (
      !normalizedActiveHandle.includes("@") &&
      normalizedStatusHandle.startsWith(`${normalizedActiveHandle}@`)
    ) {
      return true;
    }
    return false;
  }, [normalizedActiveHandle, normalizedStatusHandle]);
  const canDelete = isSameAccount;
  const isOwnStatus = isSameAccount;
  const boostDisabled =
    !displayStatus.reblogged && (isOwnStatus || displayStatus.visibility === "private" || displayStatus.visibility === "direct");
  const shouldShowReactions = showReactions && displayStatus.reactions.length > 0;
  const actionsEnabled = !disableActions;
  const canReact =
    Boolean(onReact) &&
    enableReactionActions &&
    actionsEnabled &&
    showReactions &&
    account?.platform === "misskey";
  const hasAttachmentButtons = showContent && imageAttachments.length > 0;
  const shouldRenderFooter = actionsEnabled || hasAttachmentButtons;
  const renderMediaItem = useCallback((item: MediaAttachment) => {
    const label = item.description ?? "첨부 미디어";
    if (item.kind === "audio") {
      return (
        <div key={item.id} className="status-media-item">
          <audio controls preload="metadata" aria-label={label}>
            <source src={item.url} />
          </audio>
        </div>
      );
    }
    if (item.kind === "unknown") {
      return (
        <div key={item.id} className="status-media-item">
          <a className="status-media-link" href={item.url} target="_blank" rel="noreferrer">
            첨부 파일 열기
          </a>
        </div>
      );
    }
    return (
      <div key={item.id} className="status-media-item">
        <MediaVideo
          id={item.id}
          src={item.url}
          poster={item.previewUrl}
          label={item.description ?? "첨부 동영상"}
        />
      </div>
    );
  }, []);

  useEffect(() => {
    setShowContent(displayStatus.spoilerText.length === 0);
  }, [displayStatus.spoilerText]);

  useEffect(() => {
    if (!activeImageUrl) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [activeImageUrl]);

  const previewCandidate = useMemo(
    () => (displayStatus.card ? null : extractFirstUrl(displayStatus.content)),
    [displayStatus.card, displayStatus.content]
  );

  useEffect(() => {
    if (!isPreviewEnabled() || previewCard || !previewCandidate || account?.platform !== "misskey") {
      return;
    }
    if (previewCache.has(previewCandidate)) {
      const cached = previewCache.get(previewCandidate) ?? null;
      if (cached) {
        setPreviewCard(cached);
      }
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const fetchPreview = async () => {
      try {
        const response = await fetch(`/api/preview?url=${encodeURIComponent(previewCandidate)}`, {
          signal: controller.signal
        });
        if (!response.ok) {
          previewCache.set(previewCandidate, null);
          return;
        }
        const data = (await response.json()) as
          | { url?: string; title?: string; description?: string | null; image?: string | null; error?: string }
          | undefined;
        const title = normalizePreviewText(data?.title);
        const description = normalizePreviewText(data?.description);
        if (!data || data.error || !title || !data.url) {
          previewCache.set(previewCandidate, null);
          return;
        }
        const card: LinkCard = {
          url: data.url,
          title,
          description,
          image: data.image ?? null
        };
        previewCache.set(previewCandidate, card);
        if (cancelled) {
          return;
        }
        setPreviewCard(card);
        const updateTarget = (() => {
          if (displayStatus.id === status.id) {
            return { ...status, card };
          }
          if (status.reblog && status.reblog.id === displayStatus.id) {
            return { ...status, reblog: { ...status.reblog, card } };
          }
          return null;
        })();
        if (updateTarget && onUpdateStatus) {
          onUpdateStatus(updateTarget);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        previewCache.set(previewCandidate, null);
      }
    };

    fetchPreview();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [account?.platform, displayStatus.id, displayStatus.card, displayStatus.content, onUpdateStatus, previewCandidate, previewCard, status]);


  const handleReactionSelect = useCallback(
    (reaction: ReactionInput) => {
      if (!canReact || !onReact) {
        return;
      }
      onReact(displayStatus, reaction);
    },
    [canReact, displayStatus, onReact]
  );

  return (
    <article
      className={`status${isSelected ? " is-selected" : ""}`}
      data-status-id={status.id}
      onClick={handleSelect}
    >
      {notificationLabel ? (
        <div className="notification-actor">
          <span className="status-avatar notification-actor-avatar" aria-hidden="true">
            {notification?.actor.avatarUrl ? (
              <img src={notification.actor.avatarUrl} alt="" loading="lazy" />
            ) : (
              <span className="status-avatar-fallback" aria-hidden="true" />
            )}
          </span>
          <span>{notificationLabel}</span>
        </div>
      ) : null}
      {boostedLabel ? (
        <div
          className="boosted-by"
          onClick={handleStatusClick}
          onKeyDown={handleStatusKeyDown}
          role={onStatusClick ? "button" : undefined}
          tabIndex={onStatusClick ? 0 : undefined}
          aria-label={onStatusClick ? "부스트한 글 스레드 보기" : undefined}
          data-interactive={onStatusClick ? "true" : undefined}
        >
          <BoostIcon aria-hidden="true" focusable="false" />
          <span>{boostedLabel}</span>
        </div>
      ) : null}
      {mentionLabel ? (
        <div
          className="reply-info"
          onClick={handleStatusClick}
          onKeyDown={handleStatusKeyDown}
          role={onStatusClick ? "button" : undefined}
          tabIndex={onStatusClick ? 0 : undefined}
          aria-label={onStatusClick ? "댓글 스레드 보기" : undefined}
          data-interactive={onStatusClick ? "true" : undefined}
        >
          <ReplyIcon aria-hidden="true" focusable="false" />
          <span>{mentionLabel}에게 보낸 답글</span>
        </div>
      ) : null}
      <header className="status-header-main">
        <div className="status-header-info">
          {showProfileImage ? (
            <span
              className="status-avatar"
              onClick={handleHeaderClick}
              onKeyDown={handleHeaderKeyDown}
              role={canOpenProfile ? "button" : displayStatus.accountUrl ? "link" : undefined}
              tabIndex={canOpenProfile || displayStatus.accountUrl ? 0 : undefined}
              aria-label={canOpenProfile ? profileLabel : displayStatus.accountUrl ? profileLabel : undefined}
              data-interactive={canOpenProfile || displayStatus.accountUrl ? "true" : undefined}
            >
              {displayStatus.accountAvatarUrl ? (
                <img
                  src={displayStatus.accountAvatarUrl}
                  alt={`${displayStatus.accountName || displayStatus.accountHandle} 프로필 이미지`}
                  loading="lazy"
                />
              ) : (
                <span className="status-avatar-fallback" aria-hidden="true" />
              )}
            </span>
          ) : null}
          <div
            className="status-account"
            onClick={handleHeaderClick}
            onKeyDown={handleHeaderKeyDown}
            role={canOpenProfile ? "button" : displayStatus.accountUrl ? "link" : undefined}
            tabIndex={canOpenProfile || displayStatus.accountUrl ? 0 : undefined}
            aria-label={canOpenProfile ? profileLabel : displayStatus.accountUrl ? profileLabel : undefined}
            data-interactive={canOpenProfile || displayStatus.accountUrl ? "true" : undefined}
          >
            <strong>
              {displayStatus.accountUrl && !canOpenProfile ? (
                <a href={displayStatus.accountUrl} target="_blank" rel="noreferrer">
                  {accountNameNode}
                </a>
              ) : (
                accountNameNode
              )}
            </strong>
            <span>
              {displayStatus.accountUrl && !canOpenProfile ? (
                <a href={displayStatus.accountUrl} target="_blank" rel="noreferrer">
                  @{displayHandle}
                </a>
              ) : (
                `@${displayHandle}`
              )}
            </span>
          </div>
        </div>
        <div className="status-menu section-menu">
          <button
            type="button"
            className="icon-button"
            aria-label="게시글 메뉴 열기" aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={handleMenuToggle}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="5" r="1.7" />
              <circle cx="12" cy="12" r="1.7" />
              <circle cx="12" cy="19" r="1.7" />
            </svg>
          </button>
          {menuOpen ? (
            <>
              <div className="overlay-backdrop" aria-hidden="true" />
              <div ref={menuRef} className="section-menu-panel status-menu-panel" role="menu">
                {account?.platform === "misskey" && (
                  <button
                    type="button"
                    disabled={favouriteState === null}
                    onClick={() => {
                      setMenuOpen(false);

                      void (async () => {
                        try {
                          if (favouriteState) {
                            await api.unfavourite(account, displayStatus.id);
                          } else {
                            await api.favourite(account, displayStatus.id);
                          }

                          const state = await api.fetchNoteState(account, displayStatus.id);
                          const newFavouriteState = state.isFavourited;
                          setFavouriteState(newFavouriteState);
                          showToast(
                            newFavouriteState ? "즐겨찾기에 추가했습니다." : "즐겨찾기에서 해제했습니다.",
                            { tone: "success" }
                          );
                        } catch (error) {
                          console.error("즐겨찾기 처리 실패:", error);
                          showToast("즐겨찾기 처리에 실패했습니다.", { tone: "error" });
                        }
                      })();
                    }}
                  >
                    {favouriteState === null ? "로딩..." : favouriteState ? "즐겨찾기 취소" : "즐겨찾기"}
                  </button>
                )}
                {account?.platform === "mastodon" && (
                  <button
                    type="button"
                    onClick={() => {
                      onToggleBookmark(displayStatus);
                      setMenuOpen(false);
                    }}
                  >
                    {displayStatus.bookmarked ? "북마크 취소" : "북마크"}
                  </button>
                )}
                <button type="button" onClick={handleOpenOrigin} disabled={!originUrl}>
                  원본 서버에서 보기
                </button>
              </div>
            </>
          ) : null}
        </div>
      </header>
      {displayStatus.spoilerText ? (
        <div className="status-warning">
          <p className="status-warning-text">{displayStatus.spoilerText}</p>
          <button type="button" className="text-link" onClick={() => setShowContent((prev) => !prev)}>
            {showContent ? "가리기" : "내용보기"}
          </button>
        </div>
      ) : null}
      {showContent ? (
        <>
          <div className="status-text">{displayStatus.content ? contentParts : "(내용 없음)"}</div>
          {previewCard ? (
            <a
              className={`link-preview${previewCard.image ? "" : " no-image"}`}
              href={previewCard.url}
              target="_blank"
              rel="noreferrer"
            >
              {previewCard.image ? (
                <img src={previewCard.image} alt="" loading="lazy" />
              ) : null}
              <div className="link-preview-body">
                <strong>{previewCard.title}</strong>
                {previewCard.description ? (
                  <span className="link-preview-description">{previewCard.description}</span>
                ) : null}
                <span className="link-preview-url">{previewCard.url}</span>
              </div>
            </a>
          ) : null}
          {mediaAttachments.length > 0 ? (
            <div className="status-media" data-interactive="true">
              {mediaAttachments.map((item) => renderMediaItem(item))}
            </div>
          ) : null}
        </>
      ) : null}
      <div
        className="status-time"
        onClick={handleStatusClick}
        role={onStatusClick ? "button" : undefined}
        tabIndex={onStatusClick ? 0 : undefined}
        aria-label={onStatusClick ? "글 보기" : undefined}
        data-interactive={onStatusClick ? "true" : undefined}
      >
        {visibilityIcon}
        {visibilityIcon ? <span className="time-separator" aria-hidden="true">·</span> : null}
        <time dateTime={displayStatus.createdAt}>{timestamp}</time>
      </div>
      {shouldShowReactions ? (
        <div className="status-reactions" aria-label="받은 리액션">
          {displayStatus.reactions.map((reaction) => {
            const label = formatReactionLabel(reaction);
            const isMine = displayStatus.myReaction === reaction.name;
            return (
              <button
                key={reaction.name}
                type="button"
                className={`status-reaction${isMine ? " is-active" : ""}`}
                title={`${label} ${reaction.count}개`}
                aria-label={`${label} 리액션 ${isMine ? "취소" : "추가"}`}
                onClick={() =>
                  handleReactionSelect({
                    name: reaction.name,
                    url: reaction.url,
                    isCustom: reaction.isCustom,
                    host: reaction.host
                  })
                }
                disabled={!canReact}
              >
                {reaction.url ? (
                  <img
                    src={reaction.url}
                    alt={`${label} 이모지`}
                    className="status-reaction-emoji"
                    loading="lazy"
                  />
                ) : (
                  <span className="status-reaction-emoji" aria-hidden="true">
                    {label}
                  </span>
                )}
                <span className="status-reaction-count">{reaction.count}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      {shouldRenderFooter ? (
        <footer>
          <div className="status-actions">
            {actionsEnabled ? (
              <>
                <button type="button" onClick={() => onReply(displayStatus)} data-action="reply">
                  답글
                </button>
                {account?.platform !== "misskey" ? (
                  <button
                    type="button"
                    className={displayStatus.favourited ? "is-active" : undefined}
                    onClick={() => onToggleFavourite(displayStatus)}
                    data-action="favourite"
                  >
                    {displayStatus.favourited ? "좋아요 취소" : "좋아요"}
                    {displayStatus.favouritesCount > 0 ? ` (${displayStatus.favouritesCount})` : ""}
                  </button>
                ) : null}
                <button
                  type="button"
                  className={displayStatus.reblogged ? "is-active" : undefined}
                  onClick={() => onToggleReblog(displayStatus)}
                  disabled={boostDisabled}
                  title={boostDisabled ? "비공개 글은 부스트할 수 없습니다." : undefined}
                  data-action="reblog"
                >
                  {displayStatus.reblogged ? "부스트 취소" : "부스트"}
                  {displayStatus.reblogsCount > 0 ? ` (${displayStatus.reblogsCount})` : ""}
                </button>
                {canReact ? (
                  <ReactionPicker
                    account={account}
                    api={api}
                    onSelect={handleReactionSelect}
                    disabled={Boolean(displayStatus.myReaction)}
                    buttonDataAction="reaction-picker"
                  />
                ) : null}
              </>
            ) : null}
            {showContent
              ? imageAttachments.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    className="attachment-thumb"
                    onClick={() => {
                      resetImageZoom();
                      setActiveImageIndex(index);
                    }}
                    data-action={index === 0 ? "open-image" : undefined}
                    aria-label={item.description ? `이미지 보기: ${item.description}` : "이미지 보기"}
                  >
                    <img src={item.previewUrl ?? item.url} alt={item.description ?? "첨부 이미지"} loading="lazy" />
                  </button>
                ))
              : null}
          </div>
          {actionsEnabled && canDelete ? (
            <button type="button" className="delete-button" onClick={() => setShowDeleteConfirm(true)}>
              <TrashIcon aria-hidden="true" focusable="false" />
            </button>
          ) : null}
        </footer>
      ) : null}
      {showDeleteConfirm ? (
        <div className="confirm-modal" role="dialog" aria-modal="true">
          <div className="image-modal-backdrop" onClick={() => setShowDeleteConfirm(false)} />
          <div className="confirm-modal-content">
            <h3>게시글 삭제</h3>
            <div className="status confirm-status">
              <header className="status-header">
                <AccountLabel
                  avatarUrl={displayStatus.accountAvatarUrl}
                  displayName={displayStatus.accountName}
                  name={displayStatus.accountHandle}
                  handle={displayHandle}
                  avatarClassName="status-avatar"
                  avatarFallbackClassName="status-avatar-fallback"
                  textAsDiv={true}
                  boldName={true}
                  className=""
                />
              </header>
              <p className="status-text confirm-text">
                {displayStatus.content || "(내용 없음)"}
              </p>
              <time dateTime={displayStatus.createdAt} className="status-time">
                {timestamp}
              </time>
            </div>
            <div className="confirm-actions">
              <button
                type="button"
                className="delete-button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onDelete(displayStatus);
                }}
              >
                삭제
              </button>
              <button type="button" onClick={() => setShowDeleteConfirm(false)}>
                취소
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {activeImageUrl ? (
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
              setActiveImageIndex(null);
            }
          }}
        >
          <div className="image-modal-backdrop" onClick={() => setActiveImageIndex(null)} />
          <div
            className="image-modal-content"
            ref={imageContainerRef}
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setActiveImageIndex(null);
              }
            }}
          >
            <button
              type="button"
              className="image-modal-close"
              onClick={() => setActiveImageIndex(null)}
            >
              닫기
            </button>
            {imageAttachments.length > 1 ? (
              <button
                type="button"
                className="image-modal-nav image-modal-nav-prev"
                onClick={goToPrevImage}
                aria-label="이전 이미지"
              >
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : null}
            {imageAttachments.length > 1 ? (
              <button
                type="button"
                className="image-modal-nav image-modal-nav-next"
                onClick={goToNextImage}
                aria-label="다음 이미지"
              >
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <polyline points="9 18 15 12 9 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : null}
            <img
              src={activeImageUrl}
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
            {imageAttachments.length > 1 ? (
              <div className="image-modal-counter">
                {(activeImageIndex ?? 0) + 1} / {imageAttachments.length}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
};
