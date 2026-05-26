# 아키텍처

## 기술 스택

- 런타임: React 18, React DOM, TypeScript strict, Vite.
- 패키지 매니저: pnpm.
- 테스트: Vitest.
- 배포 런타임: 정적 SPA와 Cloudflare Pages Functions.
- 주요 라이브러리: DOMPurify, emoji-datasource, vite-plugin-svgr, Wrangler.

## 레이어 구조

```text
src/
  domain/       공통 도메인 타입
  services/     추상 인터페이스
  infra/        Mastodon/Misskey 구현체와 통합 어댑터
  ui/
    state/      React Context 기반 전역 상태
    hooks/      기능 단위 상태 훅
    components/ 화면 컴포넌트
    utils/      순수 유틸과 렌더링 보조 함수
    styles/     CSS 토큰, 레이아웃, 컴포넌트, 테마
functions/
  api/preview.ts 링크 미리보기 Cloudflare Function
```

코드는 플랫폼별 API 차이를 `infra`에서 정규화하고, UI는 `domain/types.ts`의 공통 타입만 의존한다. 새 플랫폼을 추가하려면 `MastodonApi`, `OAuthClient`, `StreamingClient` 인터페이스를 구현하고 통합 클라이언트의 라우팅을 확장하는 방식이 맞다.

## 의존성 주입

`src/main.tsx`에서 구현체를 생성하고 `AppProvider`에 전달한다.

- `MastodonHttpClient`
- `MisskeyHttpClient`
- `MastodonStreamingClient`
- `MisskeyStreamingClient`
- `MastodonOAuthClient`
- `MisskeyOAuthClient`
- `LocalStorageAccountStore`
- `UnifiedApiClient`
- `UnifiedOAuthClient`
- `UnifiedStreamingClient`

UI 컴포넌트는 직접 `new`를 호출하지 않고 `useAppContext()`로 서비스를 가져온다. 이 구조는 테스트와 플랫폼 교체를 쉽게 하기 위한 핵심 아키텍처 정책이다.

## 주요 인터페이스

- `AccountStore`: 계정 목록 로드/저장.
- `OAuthClient`: 앱 등록, 승인 URL 생성, 토큰 교환.
- `MastodonApi`: 이름은 Mastodon이지만 실제로는 공통 페디버스 API 포트다. 타임라인, 글쓰기, 미디어, 액션, 프로필, 관계, 스레드, 번역을 포함한다.
- `StreamingClient`: 계정과 타임라인 종류에 맞는 스트리밍 연결을 만들고 해제 함수를 반환한다.

## 상태 소유권

- `AppProvider`
  - 계정 목록, 활성 계정, 계정 추가/삭제/갱신.
  - 계정 저장소와 활성 계정 저장소 동기화.
  - 앱 시작 시 계정 검증 정보 백그라운드 갱신.
- `ToastProvider`
  - 토스트 목록, 자동 제거 타이머, 액션 버튼.
- `App`
  - 라우트, 테마, 색상 모드, 뽀모도로 설정, 섹션 목록, 글쓰기 계정, 답글 대상, 선택 게시글, 프로필 모달 스택, 전역 단축키.
- `TimelineSection`
  - 한 컬럼의 메뉴, 알림 팝오버, 섹션 설정, 스크롤 상태, 선택 글 단축키 위임.
- `useTimeline`
  - 한 타임라인의 아이템, 로딩/추가 로딩, 에러, 스트리밍 대기열, 새 글 배치 반영, 무한 스크롤 상태.
- `ComposeBox`
  - 본문, 공개 범위, 콘텐츠 경고, 첨부 이미지, 이모지 패널, 글자 수, 제출 상태.
- `ProfileModal`
  - 프로필 정보, 관계 정보, 작성글 목록, 팔로우/뮤트/차단 낙관적 상태.
- `StatusModal`
  - 스레드 컨텍스트와 로딩 상태.

## 라우팅

라우팅은 별도 라우터 없이 `window.location.hash`로 처리한다.

- `#/` 또는 빈 해시: 홈.
- `#/terms`: 이용약관 페이지.
- `#/license`: 라이선스 페이지.
- `#/oss`: 오픈소스 목록 페이지.
- `#/shortcuts`: 단축키 페이지.

사이드바 링크는 기본적으로 모달을 열지만, 직접 해시 URL로 들어오면 페이지 컴포넌트를 렌더링한다.

## OAuth 흐름

1. 사용자가 서버 주소를 입력한다.
2. 주소를 정규화한다.
3. `UnifiedOAuthClient.registerApp`이 플랫폼을 감지하고 플랫폼별 등록 정보를 만든다.
4. `createOauthState()`로 CSRF 방지 상태값을 생성한다.
5. 등록 정보와 상태값을 `sessionStorage`에 저장한다.
6. 플랫폼별 승인 URL로 이동한다.
7. 콜백으로 돌아오면 query string의 `code`, `state`, `session`을 읽는다.
8. URL query/hash를 제거한다.
9. pending OAuth 정보와 콜백 값을 검증한다.
10. 토큰을 교환한다.
11. 임시 계정으로 `verifyAccount`를 호출한다.
12. 신규 계정이면 추가하고, 재인증이면 기존 계정을 갱신한다.
13. pending OAuth 정보를 삭제한다.

## 타임라인 흐름

1. `TimelineSection`이 `useTimeline`에 계정, API, 스트리밍, 타임라인 종류를 전달한다.
2. `useTimeline.refresh()`가 30개를 가져와 목록을 초기화한다.
3. 스크롤 하단 근처에서 `loadMore()`가 20개씩 추가한다.
4. 북마크가 아니고 스트리밍이 활성화된 경우 플랫폼별 WebSocket에 연결한다.
5. 업데이트 이벤트는 최상단 여부에 따라 즉시 병합하거나 대기열에 넣는다.
6. 삭제 이벤트는 목록과 대기열에서 제거한다.
7. 알림 이벤트는 섹션의 알림 배지와 토스트 정책으로 전달한다.
8. 컴포즈 성공, 액션 성공, 모달 액션 등은 `registerTimelineListener`로 연결된 컬럼 목록에 상태 업데이트를 브로드캐스트한다.

## 글쓰기 흐름

1. `ComposeBox`가 계정별 공개 범위와 인스턴스 글자 제한을 로드한다.
2. 사용자가 본문, CW, 첨부, 이모지를 입력한다.
3. 전송 전 빈 본문과 글자 수 제한을 검사한다.
4. 첨부 파일이 있으면 먼저 `uploadMedia`를 병렬 호출한다.
5. `createStatus`에 본문, 공개 범위, 답글 ID, 미디어 ID, CW를 전달한다.
6. 생성된 `Status`를 타임라인 리스너에 브로드캐스트한다.
7. 성공 시 입력값과 첨부 미리보기 URL을 정리한다.

## 게시글 액션 흐름

- 좋아요/북마크/부스트는 플랫폼 공통 API 포트를 호출한다.
- 부스트와 북마크는 타임라인에서 낙관적 업데이트를 적용하고 실패 시 롤백한다.
- Misskey 리액션은 앱 최상위의 `handleReaction`이 처리한다. 같은 계정의 여러 컬럼과 모달 상태를 동시에 갱신하기 위함이다.
- 삭제 성공 시 현재 컬럼에서 제거하고 상세 모달을 닫는다.
- 번역은 게시글 단위 로컬 상태로 보관한다. 게시글 ID가 바뀌면 번역 요청 ID를 증가시켜 오래된 응답을 무시한다.

## 모달과 팝오버 구조

- 모달/팝오버는 컴포넌트 내부에서 조건부 렌더링한다.
- 대부분 `overlay-backdrop` 또는 전용 backdrop을 함께 렌더링한다.
- `useClickOutside`는 외부 클릭과 ESC로 닫는 공통 훅이다.
- 상세 모달과 프로필 모달은 z-index를 증가시켜 여러 프로필 모달이 쌓일 수 있다.
- 전역 키보드 핸들러는 오버레이가 열려 있거나 입력 요소가 포커스된 경우 대부분 동작하지 않는다.

## 콘텐츠 렌더링 구조

- Mastodon은 API가 주는 HTML을 `sanitizeHtml`로 정화해 렌더링한다.
- Mastodon의 텍스트 버전은 mapper에서 HTML을 plain text로 변환한다.
- Misskey는 텍스트 본문을 단순 Markdown 렌더러로 HTML화하고 정화한다.
- 커스텀 이모지는 렌더링 단계에서 shortcode를 `<img class="custom-emoji">`로 바꾼다.
- 멘션은 `renderTextWithLinks` 또는 rich content 클릭 처리로 프로필 모달과 연결된다.

## Cloudflare Function 경계

SPA는 대부분 외부 인스턴스 API를 직접 호출한다. 서버 기능은 `functions/api/preview.ts`의 링크 미리보기 하나뿐이다. 이 함수는 production 환경의 Misskey 링크 카드 보강용이며, SSRF 방어와 응답 크기 제한을 포함한다.

## 빌드와 배포

- Vite `base`는 `./`로 설정되어 정적 호스팅 경로에 상대적으로 동작한다.
- SVG는 `vite-plugin-svgr`로 React 컴포넌트 import를 지원한다.
- GitHub Actions는 pnpm 11.3.0과 Node 24를 사용한다.
- `develop` 푸시는 beta 배포 워크플로우를 실행한다.
- `main` 푸시는 production 배포 워크플로우를 실행한다.
- PR 테스트 워크플로우는 현재 `main` 대상 PR에서 `pnpm run test`를 실행한다.
