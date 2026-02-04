import type { TFunction } from "i18next";

export type ShortcutSection = {
  title: string;
  note?: string;
  items: Array<{ keys: string; description: string }>;
};

export const getShortcutSections = (t: TFunction): ShortcutSection[] => [
  {
    title: t("shortcuts.timeline.title"),
    items: [
      { keys: "M", description: t("shortcuts.timeline.selectLeftmost") },
      { keys: "↑ / ↓", description: t("shortcuts.timeline.moveVertical") },
      { keys: "← / →", description: t("shortcuts.timeline.moveColumn") },
      { keys: "ESC", description: t("shortcuts.timeline.clearSelection") }
    ]
  },
  {
    title: t("shortcuts.selected.title"),
    note: t("shortcuts.selected.note"),
    items: [
      { keys: "R", description: t("shortcuts.selected.reply") },
      { keys: "B", description: t("shortcuts.selected.boost") },
      { keys: "L", description: t("shortcuts.selected.likeOrReaction") },
      { keys: "C", description: t("shortcuts.selected.openReactions") },
      { keys: "I", description: t("shortcuts.selected.openMedia") },
      { keys: "Enter", description: t("shortcuts.selected.openStatus") },
      { keys: "P", description: t("shortcuts.selected.openProfile") },
      { keys: "A", description: t("shortcuts.selected.openAccount") },
      { keys: "T", description: t("shortcuts.selected.openTimelineMenu") },
      { keys: "M", description: t("shortcuts.selected.openColumnMenu") },
      { keys: "G", description: t("shortcuts.selected.openNotifications") },
      { keys: "↑ / ↓", description: t("shortcuts.selected.navigateMenu") },
      { keys: "ESC", description: t("shortcuts.selected.closeMenu") }
    ]
  },
  {
    title: t("shortcuts.compose.title"),
    note: t("shortcuts.compose.note"),
    items: [
      { keys: "N", description: t("shortcuts.compose.focus") },
      { keys: "Ctrl+Shift+N", description: t("shortcuts.compose.focusWhileActive") },
      { keys: "Ctrl+Shift+W", description: t("shortcuts.compose.toggleContentWarning") },
      { keys: "Ctrl+Shift+A", description: t("shortcuts.compose.openAccountSelector") },
      { keys: "Ctrl+Shift+O", description: t("shortcuts.compose.openVisibility") },
      { keys: "Ctrl+Shift+I", description: t("shortcuts.compose.attachMedia") },
      { keys: "Ctrl+Shift+E", description: t("shortcuts.compose.toggleEmojiPanel") },
      { keys: "Ctrl/Command+Enter", description: t("shortcuts.compose.submit") },
      { keys: "ESC", description: t("shortcuts.compose.blur") }
    ]
  },
  {
    title: t("shortcuts.suggestions.title"),
    note: t("shortcuts.suggestions.note"),
    items: [
      { keys: "↑ / ↓", description: t("shortcuts.suggestions.navigate") },
      { keys: "Enter", description: t("shortcuts.suggestions.insert") },
      { keys: "ESC", description: t("shortcuts.suggestions.close") }
    ]
  },
  {
    title: t("shortcuts.emojiPanel.title"),
    note: t("shortcuts.emojiPanel.note"),
    items: [
      { keys: "↑ / ↓", description: t("shortcuts.emojiPanel.navigate") },
      { keys: "← / →", description: t("shortcuts.emojiPanel.toggleCategory") },
      { keys: "Enter", description: t("shortcuts.emojiPanel.select") },
      { keys: "ESC", description: t("shortcuts.emojiPanel.close") }
    ]
  },
  {
    title: t("shortcuts.pomodoro.title"),
    items: [
      { keys: "S", description: t("shortcuts.pomodoro.toggle") },
      { keys: "X", description: t("shortcuts.pomodoro.reset") },
      { keys: "F", description: t("shortcuts.pomodoro.focusTask") }
    ]
  },
  {
    title: t("shortcuts.imageViewer.title"),
    items: [
      { keys: "← / →", description: t("shortcuts.imageViewer.navigate") },
      { keys: "ESC", description: t("shortcuts.imageViewer.close") }
    ]
  }
];
