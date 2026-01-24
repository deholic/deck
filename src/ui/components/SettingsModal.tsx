import type { AccountsState } from "../state/AppContext";
import type { ColorScheme, ThemeMode } from "../utils/theme";
import { AccountSelector } from "./AccountSelector";

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
  showProfileImages: boolean;
  onToggleProfileImages: (value: boolean) => void;
  showCustomEmojis: boolean;
  onToggleCustomEmojis: (value: boolean) => void;
  showMisskeyReactions: boolean;
  onToggleMisskeyReactions: (value: boolean) => void;
  sectionSize: "small" | "medium" | "large";
  onSectionSizeChange: (value: "small" | "medium" | "large") => void;
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
  showProfileImages,
  onToggleProfileImages,
  showCustomEmojis,
  onToggleCustomEmojis,
  showMisskeyReactions,
  onToggleMisskeyReactions,
  sectionSize,
  onSectionSizeChange,
  showPomodoro,
  onTogglePomodoro,
  pomodoroFocus,
  pomodoroBreak,
  pomodoroLongBreak,
  onPomodoroFocusChange,
  onPomodoroBreakChange,
  onPomodoroLongBreakChange
}: SettingsModalProps) => {
  if (!open) {
    return null;
  }

  return (
    <div className="settings-modal">
      <div className="settings-modal-backdrop" onClick={onClose} />
      <div className="settings-modal-content panel">
        <div className="settings-modal-header">
          <h3>설정</h3>
          <button
            type="button"
            className="settings-close"
            onClick={onClose}
          >
            닫기
          </button>
        </div>
        <div className="settings-modal-body">
          <div className="settings-item settings-item-account">
            <div>
              <strong>계정 관리</strong>
              <p>계정을 선택하여 재인증하거나 삭제합니다.</p>
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
                  aria-label="계정 재인증"
                >
                  {reauthLoading ? "재인증 중..." : "재인증"}
                </button>
                <button
                  type="button"
                  className="settings-danger-button"
                  onClick={onRemove}
                  disabled={!settingsAccountId}
                  aria-label="계정 삭제"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
          <div className="settings-item">
            <div>
              <strong>테마</strong>
              <p>기본, 크리스마스, 하늘핑크, 모노톤 테마를 선택합니다.</p>
            </div>
            <select
              value={themeMode}
              onChange={(event) => {
                onThemeChange(event.target.value);
              }}
              aria-label="테마 선택"
            >
              <option value="default">기본</option>
              <option value="christmas">크리스마스</option>
              <option value="sky-pink">하늘핑크</option>
              <option value="monochrome">모노톤</option>
              <option value="matcha-core">말차코어</option>
            </select>
          </div>
          <div className="settings-item">
            <div>
              <strong>색상 모드</strong>
              <p>시스템 설정을 따르거나 라이트/다크 모드를 고정합니다.</p>
            </div>
            <select
              value={colorScheme}
              onChange={(event) => {
                onColorSchemeChange(event.target.value);
              }}
              aria-label="색상 모드 선택"
            >
              <option value="system">시스템</option>
              <option value="light">라이트</option>
              <option value="dark">다크</option>
            </select>
          </div>
          <div className="settings-item">
            <div>
              <strong>프로필 이미지 표시</strong>
              <p>피드에서 사용자 프로필 이미지를 보여줍니다.</p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={showProfileImages}
                onChange={(event) => onToggleProfileImages(event.target.checked)}
              />
              <span className="slider" aria-hidden="true" />
            </label>
          </div>
          <div className="settings-item">
            <div>
              <strong>커스텀 이모지 표시</strong>
              <p>사용자 이름과 본문에 커스텀 이모지를 표시합니다.</p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={showCustomEmojis}
                onChange={(event) => onToggleCustomEmojis(event.target.checked)}
              />
              <span className="slider" aria-hidden="true" />
            </label>
          </div>
          <div className="settings-item">
            <div>
              <strong>리액션 표시</strong>
              <p>리액션 정보를 지원하는 서버에서 받은 리액션을 보여줍니다.</p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={showMisskeyReactions}
                onChange={(event) => onToggleMisskeyReactions(event.target.checked)}
              />
              <span className="slider" aria-hidden="true" />
            </label>
          </div>
          <div className="settings-item">
            <div>
              <strong>섹션 폭</strong>
              <p>타임라인 섹션의 가로 폭을 조절합니다.</p>
            </div>
            <select
              value={sectionSize}
              onChange={(event) =>
                onSectionSizeChange(event.target.value as "small" | "medium" | "large")
              }
            >
              <option value="small">소</option>
              <option value="medium">중</option>
              <option value="large">대</option>
            </select>
          </div>
          <div className="settings-item">
            <div>
              <strong>뽀모도로 타이머</strong>
              <p>사이드바에 뽀모도로 타이머를 표시합니다.</p>
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
                  <strong>뽀모도로 시간 설정</strong>
                  <p>집중, 휴식, 긴 휴식 시간을 분 단위로 설정합니다.</p>
                </div>
                <div className="pomodoro-time-inputs">
                  <label>
                    집중
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={pomodoroFocus}
                      onChange={(event) => onPomodoroFocusChange(Number(event.target.value))}
                    />
                  </label>
                  <label>
                    휴식
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={pomodoroBreak}
                      onChange={(event) => onPomodoroBreakChange(Number(event.target.value))}
                    />
                  </label>
                  <label>
                    긴 휴식
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
              <strong>로컬 저장소 초기화</strong>
              <p>계정과 설정을 포함한 모든 로컬 데이터를 삭제합니다.</p>
            </div>
            <button
              type="button"
              className="settings-danger-button"
              onClick={onClearLocalStorage}
              aria-label="로컬 저장소 초기화"
            >
              모두 삭제
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
