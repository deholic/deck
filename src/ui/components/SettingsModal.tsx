import type { AccountsState } from "../state/AppContext";
import type { ColorScheme, ThemeMode } from "../utils/theme";
import { AccountSelector } from "./AccountSelector";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "../../i18n";

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
  accountsState: AccountsState;
  settingsAccountId: string | null;
  setSettingsAccountId: (id: string | null) => void;
  reauthLoading: boolean;
  onReauth: () => void;
  onRemove: () => void;
  onClearLocalStorage: () => void;
  themeMode: ThemeMode;
  onThemeChange: (value: string) => void;
  colorScheme: ColorScheme;
  onColorSchemeChange: (value: string) => void;
  showPomodoro: boolean;
  onTogglePomodoro: (value: boolean) => void;
  pomodoroFocus: number;
  pomodoroBreak: number;
  pomodoroLongBreak: number;
  onPomodoroFocusChange: (value: number) => void;
  onPomodoroBreakChange: (value: number) => void;
  onPomodoroLongBreakChange: (value: number) => void;
};

export const SettingsModal = ({
  open,
  onClose,
  accountsState,
  settingsAccountId,
  setSettingsAccountId,
  reauthLoading,
  onReauth,
  onRemove,
  onClearLocalStorage,
  themeMode,
  onThemeChange,
  colorScheme,
  onColorSchemeChange,
  showPomodoro,
  onTogglePomodoro,
  pomodoroFocus,
  pomodoroBreak,
  pomodoroLongBreak,
  onPomodoroFocusChange,
  onPomodoroBreakChange,
  onPomodoroLongBreakChange
}: SettingsModalProps) => {
  const { t, i18n } = useTranslation();
  if (!open) {
    return null;
  }

  return (
    <div className="settings-modal">
      <div className="settings-modal-backdrop" onClick={onClose} />
      <div className="settings-modal-content panel">
        <div className="settings-modal-header">
          <h3>{t("settings.title")}</h3>
          <button
            type="button"
            className="settings-close"
            onClick={onClose}
          >
            {t("actions.close")}
          </button>
        </div>
        <div className="settings-modal-body">
          <div className="settings-item settings-item-account">
            <div>
              <strong>{t("settings.account.title")}</strong>
              <p>{t("settings.account.description")}</p>
            </div>
            <div className="settings-account-actions">
              <AccountSelector
                accounts={accountsState.accounts}
                activeAccountId={settingsAccountId}
                setActiveAccount={setSettingsAccountId}
                variant="inline"
              />
              <div className="settings-account-buttons">
                <button
                  type="button"
                  onClick={onReauth}
                  disabled={!settingsAccountId || reauthLoading}
                  aria-label={t("settings.account.reauthAria")}
                >
                  {reauthLoading ? t("settings.account.reauthing") : t("settings.account.reauth")}
                </button>
                <button
                  type="button"
                  className="settings-danger-button"
                  onClick={onRemove}
                  disabled={!settingsAccountId}
                  aria-label={t("settings.account.removeAria")}
                >
                  {t("actions.remove")}
                </button>
              </div>
            </div>
          </div>
          <div className="settings-item">
            <div>
              <strong>{t("settings.theme.title")}</strong>
              <p>{t("settings.theme.description")}</p>
            </div>
            <select
              value={themeMode}
              onChange={(event) => {
                onThemeChange(event.target.value);
              }}
              aria-label={t("settings.theme.aria")}
            >
              <option value="default">{t("themes.default")}</option>
              <option value="christmas">{t("themes.christmas")}</option>
              <option value="sky-pink">{t("themes.skyPink")}</option>
              <option value="monochrome">{t("themes.monochrome")}</option>
              <option value="matcha-core">{t("themes.matchaCore")}</option>
            </select>
          </div>
          <div className="settings-item">
            <div>
              <strong>{t("settings.colorScheme.title")}</strong>
              <p>{t("settings.colorScheme.description")}</p>
            </div>
            <select
              value={colorScheme}
              onChange={(event) => {
                onColorSchemeChange(event.target.value);
              }}
              aria-label={t("settings.colorScheme.aria")}
            >
              <option value="system">{t("colorScheme.system")}</option>
              <option value="light">{t("colorScheme.light")}</option>
              <option value="dark">{t("colorScheme.dark")}</option>
            </select>
          </div>
          <div className="settings-item">
            <div>
              <strong>{t("settings.language.title")}</strong>
              <p>{t("settings.language.description")}</p>
            </div>
            <select
              value={i18n.resolvedLanguage ?? i18n.language}
              onChange={(event) => {
                void i18n.changeLanguage(event.target.value);
              }}
              aria-label={t("settings.language.aria")}
            >
              {SUPPORTED_LANGUAGES.map((locale) => (
                <option key={locale} value={locale}>
                  {locale === "ko" ? t("language.korean") : t("language.english")}
                </option>
              ))}
            </select>
          </div>
          <div className="settings-item">
            <div>
              <strong>{t("settings.pomodoro.title")}</strong>
              <p>{t("settings.pomodoro.description")}</p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={showPomodoro}
                onChange={(event) => onTogglePomodoro(event.target.checked)}
              />
              <span className="slider" aria-hidden="true" />
            </label>
          </div>
          {showPomodoro ? (
            <>
              <div className="settings-item settings-item-pomodoro">
                <div>
                  <strong>{t("settings.pomodoro.timerTitle")}</strong>
                  <p>{t("settings.pomodoro.timerDescription")}</p>
                </div>
                <div className="pomodoro-time-inputs">
                  <label>
                    {t("settings.pomodoro.focus")}
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={pomodoroFocus}
                      onChange={(event) => onPomodoroFocusChange(Number(event.target.value))}
                    />
                  </label>
                  <label>
                    {t("settings.pomodoro.break")}
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={pomodoroBreak}
                      onChange={(event) => onPomodoroBreakChange(Number(event.target.value))}
                    />
                  </label>
                  <label>
                    {t("settings.pomodoro.longBreak")}
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={pomodoroLongBreak}
                      onChange={(event) => onPomodoroLongBreakChange(Number(event.target.value))}
                    />
                  </label>
                </div>
              </div>
            </>
          ) : null}
          <div className="settings-item">
            <div>
              <strong>{t("settings.storage.title")}</strong>
              <p>{t("settings.storage.description")}</p>
            </div>
            <button
              type="button"
              className="settings-danger-button"
              onClick={onClearLocalStorage}
              aria-label={t("settings.storage.clearAria")}
            >
              {t("settings.storage.clear")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
