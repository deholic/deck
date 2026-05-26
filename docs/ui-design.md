# UI 디자인 시스템

## 디자인 목표

Deck은 멀티 컬럼 페디버스 클라이언트다. 화면은 장시간 모니터링, 반복 액션, 여러 계정 전환에 최적화되어야 한다. 마케팅 페이지처럼 장식적인 구성을 쓰지 않고, 조밀하지만 스캔하기 쉬운 도구형 UI를 유지한다.

기본 텍스트는 한국어다. 버튼과 메뉴는 기능을 바로 실행할 수 있는 짧은 명령형 문구를 사용한다.

## 레이아웃

- 최상위 `.app`은 뷰포트 높이에 맞춘 여백을 가진다.
- 데스크톱 기본 레이아웃은 2열 grid다.
  - 왼쪽: 260-320px 사이드바.
  - 오른쪽: 타임라인 보드.
- 사이드바는 글쓰기, 뽀모도로, 브랜드/설정/계정추가/정보 링크를 세로로 배치한다.
- 타임라인 보드는 가로 스크롤 가능한 컬럼 배열이다.
- 컬럼은 섹션별 CSS 변수로 폭을 조정한다.
  - small: width 440px, max 520px.
  - medium: width 550px, max 650px.
  - large: width 660px, max 780px.
- 900px 이하에서는 일반 앱 UI를 사용하지 않고 모바일 안내 블로커를 전체 화면으로 표시한다.

## 패널과 카드

- `.panel`은 반투명 배경, 1px 테두리, 16px radius, 부드러운 그림자를 가진다.
- 반복되는 실제 항목은 `.status`, `.timeline-column`, `.profile-field`처럼 독립 요소로 표현한다.
- 모달 내부에서도 게시글은 동일한 `.status` 디자인을 재사용한다.
- 글쓰기 패널, 설정 모달, 프로필 모달, 상세 모달은 모두 기존 panel/timeline/status 규칙을 재사용해 시각적 일관성을 유지한다.

## 색상 토큰

기본 토큰은 `src/ui/styles/base.css`의 `:root`에 있다. 주요 범주는 다음과 같다.

- 텍스트: `--color-text-primary`, `--color-text-muted`, `--color-text-subtle`, `--color-text-faint`.
- 링크: `--color-link`, `--color-status-link`, `--color-link-preview-url`.
- 패널: `--color-panel-bg`, `--color-panel-border`, `--shadow-panel`.
- 액션: `--color-action-bg`, `--color-action-text`, `--color-action-active-bg`, `--color-action-danger-bg`.
- 타임라인: `--color-timeline-column-bg`, `--color-timeline-column-border`, `--color-status-bg`, `--color-status-border`.
- 오버레이/모달: `--color-overlay-backdrop`, `--color-status-backdrop`, `--color-settings-backdrop`.
- 입력: `--color-input-bg`, `--color-input-border`, `--color-input-text`, `--color-input-placeholder`.
- 토스트: success/info/error 별 배경, 테두리, 텍스트.
- 이모지/첨부/리액션/뽀모도로도 전용 토큰을 가진다.

색상 변경 시 light/dark와 모든 테마 override를 함께 검토해야 한다.

## 테마

지원 테마:

- `default`
- `christmas`
- `sky-pink`
- `monochrome`
- `matcha-core`
- `royal-purple`
- `summer-beach`

지원 색상 모드:

- `system`
- `light`
- `dark`

적용 방식:

- 테마는 `documentElement.dataset.theme`와 `body.dataset.theme`에 저장한다.
- `default`는 data attribute를 제거한다.
- 색상 모드가 `system`이면 `data-color-scheme`을 제거한다.
- `light` 또는 `dark`는 `data-color-scheme`을 지정한다.
- CSS는 `@media (prefers-color-scheme: dark)`와 data attribute 조합으로 dark override를 적용한다.

## 타이포그래피

- Pretendard 웹폰트를 CDN에서 import하고, fallback은 system UI 계열이다.
- 본문과 UI 텍스트는 작은 크기를 사용해 컬럼 밀도를 유지한다.
- 큰 hero typography는 사용하지 않는다.
- 글 본문은 줄바꿈과 링크/멘션/커스텀 이모지를 읽기 쉽게 유지한다.
- 라이선스는 `<pre>` 스타일로 고정폭과 줄바꿈을 보존한다.

## 공통 컨트롤

- 아이콘 버튼은 `.icon-button`을 사용하고, 모든 의미 있는 버튼에는 `aria-label`을 제공한다.
- 명령 버튼은 `.button-with-icon`, `.ghost`, `.text-link`, `.delete-button` 등을 사용한다.
- 토글은 `.switch`와 checkbox + slider 구조를 사용한다.
- 메뉴와 선택지는 버튼 목록으로 구성하고, 키보드 하이라이트에는 `is-highlighted`를 사용한다.
- active 상태에는 `is-active`, 선택 항목에는 `is-selected`, 비활성은 native `disabled`를 사용한다.

## 계정 표시

`AccountLabel`은 계정 표시의 표준 컴포넌트다.

- 아바타, 표시명, 핸들을 한 단위로 표시한다.
- 아바타가 없으면 fallback 원형을 보여준다.
- 표시명에 커스텀 이모지 shortcode가 있으면 이미지로 렌더링한다.
- `avatarOnly`, `hideAvatar`, `textAsDiv`, `boldName` 변형을 지원한다.
- 클릭 가능한 경우 `role="button"`, `tabIndex`, `aria-label`, `data-interactive`를 지정한다.

## 타임라인 컬럼

- 컬럼 헤더는 계정 선택, 타임라인 선택, 알림, 섹션 메뉴 순서다.
- 타임라인 선택 버튼은 타임라인별 아이콘과 라벨을 함께 표시한다.
- 알림 버튼은 배지를 겹쳐 표시하고 최대 `99+`로 압축한다.
- 섹션 메뉴는 새로고침, 원본 서버, 섹션 설정, 섹션 추가/이동/삭제 명령을 제공한다.
- 컬럼 본문은 독립 스크롤 영역이며 최하단 근처에서 추가 로딩한다.
- 새 글 배너는 컬럼 상단에 고정되어 사용자가 명시적으로 최신 글을 반영하도록 한다.
- 최상단 이동 FAB은 컬럼 오른쪽 하단에 있으며, 이미 최상단이면 disabled다.

## 게시글 카드

게시글은 `.status` article로 렌더링한다.

- 선택된 글은 `is-selected` 클래스로 강조한다.
- 상단 보조 라벨:
  - 알림 행위자.
  - 부스트한 사용자.
  - 답글 멘션 대상.
- 헤더는 아바타, 표시명, 핸들, 메뉴 버튼으로 구성한다.
- 콘텐츠 경고는 별도 박스와 `내용보기`/`가리기` 버튼을 사용한다.
- 본문은 HTML/Markdown/plain text 렌더링 결과를 동일 영역에 표시한다.
- 번역 결과는 본문 아래 별도 region으로 표시한다.
- 링크 미리보기는 이미지가 있으면 좌측 이미지, 없으면 compact no-image 형태다.
- 리액션은 pill 버튼 형태이며, 내 리액션은 active 상태로 표시한다.
- 푸터는 답글, 좋아요 또는 리액션, 부스트, 이미지 썸네일, 삭제 버튼을 배치한다.

## 글쓰기 UI

- 계정 선택은 글쓰기 상단에 inline selector로 표시한다.
- 답글 중이면 답글 대상 요약과 취소 버튼을 보여준다.
- CW 입력은 토글 시 본문 위에 나타난다.
- 본문 textarea 아래에는 첨부 썸네일 영역과 글자 수 카운터가 있다.
- 이미지 추가는 썸네일 형태의 label 버튼이다.
- 공개 범위 select는 왼쪽, 이모지/CW/전송 액션은 오른쪽에 둔다.
- 이모지 패널은 overlay backdrop과 함께 열리고, 검색 input과 카테고리 목록을 포함한다.
- 전송 중에는 패널 위에 busy overlay를 띄워 중복 전송을 막는다.

## 이미지와 미디어

- 이미지 원본 보기 모달은 전체 화면 fixed overlay다.
- 배경 클릭, 닫기 버튼, ESC로 닫는다.
- 마우스 휠로 0.6-3배 줌을 지원한다.
- 포인터 드래그로 이동하며 이미지 경계를 넘어가지 않도록 offset을 제한한다.
- 여러 이미지일 때 좌우 이동 버튼과 카운터를 보여준다.
- 동영상이 재생 중 화면 밖으로 나가면 fixed floating player로 바뀐다.
- floating player는 하나만 활성화되며 닫기와 모서리/엣지 resize handle을 제공한다.

## 모달과 팝오버

- 모든 모달은 `role="dialog"`와 `aria-modal="true"`를 사용한다.
- 배경은 tint backdrop을 사용한다.
- 바깥 영역 클릭으로 닫는다.
- 메뉴성 팝오버도 `overlay-backdrop`을 사용해 배경과 상호작용을 분리한다.
- 상세 모달과 프로필 모달은 z-index를 증가시켜 겹침 순서를 관리한다.
- 프로필 모달은 topmost일 때만 외부 클릭 닫기를 활성화한다.

## 접근성

- 의미 있는 아이콘 버튼에는 `aria-label`을 제공한다.
- 선택 가능한 목록은 `role="listbox"`/`role="option"`을 사용한다.
- 토스트 호스트는 `aria-live="polite"`이고 오류 토스트는 `role="alert"`이다.
- 글자 수, 타이머 시간, 새 글 배너는 스크린리더가 감지할 수 있는 status/live 텍스트를 포함한다.
- 이미지 alt는 작성자 프로필, 첨부 설명, 커스텀 이모지 shortcode를 기준으로 제공한다.
- 외부 링크는 `target="_blank"`와 `rel="noreferrer"`를 사용한다.

## 키보드 상호작용

전역:

- 입력 요소나 오버레이가 열려 있으면 대부분의 전역 단축키를 무시한다.
- 이모지 패널이 열려 있으면 다른 단축키를 막는다.

타임라인:

- `M`: 선택이 없을 때 왼쪽 첫 글 선택, 선택이 있으면 컬럼 메뉴.
- `↑/↓`: 선택된 글 위아래 이동.
- `←/→`: 이웃 컬럼의 같은 높이 또는 가까운 글로 이동.
- `ESC`: 선택 해제 또는 열린 메뉴 닫기.
- `R`: 답글.
- `B`: 부스트.
- `L`: Mastodon 좋아요, Misskey 하트 리액션.
- `C`: Misskey 리액션 팔레트.
- `I`: 첫 이미지 열기.
- `Enter`: 게시글 상세 모달.
- `P`: 작성자 프로필.
- `A`: 계정 선택.
- `T`: 타임라인 메뉴.
- `G`: 알림 팝오버.

글쓰기:

- `N`: 입력 포커스.
- `Ctrl+Shift+N`: 입력 중에도 본문 포커스.
- `Ctrl+Shift+W`: CW 토글.
- `Ctrl+Shift+A`: 계정 선택.
- `Ctrl+Shift+O`: 공개 범위 선택.
- `Ctrl+Shift+I`: 미디어 첨부.
- `Ctrl+Shift+E`: 이모지 패널.
- `Ctrl/Command+Enter`: 전송.
- `ESC`: 입력 포커스 해제.

뽀모도로:

- `S`: 시작/정지.
- `X`: 리셋.
- `F`: 투두 입력 포커스.
- 투두 목록: `↑/↓` 선택 이동, `Alt+↑/↓` 순서 변경, Space 완료 토글, `D` 삭제, `→` 타임라인 이동, `ESC` 선택 해제.

## 모바일 정책

코드에는 모바일 메뉴와 모바일 글쓰기 메뉴가 있지만, 900px 이하에서는 `.mobile-blocker`가 표시되어 실제 멀티 컬럼 UI를 사용할 수 없다. 재구현 시 이 정책을 유지하려면 모바일 대응을 부분 기능으로 만들지 말고 명확한 사용 불가 안내를 우선 렌더링한다.
