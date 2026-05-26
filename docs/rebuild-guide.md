# 재구현 가이드

이 문서는 Deck을 새 코드베이스에서 다시 구현할 때의 순서와 완료 기준이다. 자세한 동작은 다른 문서의 명세를 기준으로 한다.

## 1단계: 프로젝트 골격

1. Vite + React + TypeScript strict 프로젝트를 만든다.
2. pnpm을 패키지 매니저로 사용하고 lockfile을 생성한다.
3. 의존성을 추가한다.
   - runtime: `react`, `react-dom`, `dompurify`, `emoji-datasource`, `wrangler`.
   - dev: `typescript`, `vite`, `vitest`, `@vitejs/plugin-react`, `vite-plugin-svgr`.
4. Vite 설정에 React와 SVGR 플러그인을 등록하고 `base: "./"`를 사용한다.
5. `src/domain`, `src/services`, `src/infra`, `src/ui`, `functions/api` 디렉터리를 만든다.

## 2단계: 도메인과 포트

1. [도메인과 데이터 모델](./domain-and-data.md)의 타입을 먼저 구현한다.
2. 다음 인터페이스를 정의한다.
   - `AccountStore`
   - `OAuthClient`
   - `MastodonApi`
   - `StreamingClient`
3. UI는 이 인터페이스에만 의존하도록 설계한다.
4. 플랫폼별 응답 타입을 UI에 노출하지 않는다.

## 3단계: 저장소와 통합 클라이언트

1. `LocalStorageAccountStore`를 구현한다.
2. 7일 만료 정책과 안전한 JSON 파싱 fallback을 구현한다.
3. Mastodon/Misskey API 구현체를 주입받는 통합 API 클라이언트를 만든다.
4. OAuth와 스트리밍도 동일한 통합 라우팅 클래스를 만든다.

## 4단계: 플랫폼 연동

1. Mastodon OAuth, HTTP API, 스트리밍을 구현한다.
2. Misskey MiAuth, HTTP API, 스트리밍을 구현한다.
3. 각 mapper에서 플랫폼 응답을 `Status`, `UserProfile`, `AccountRelationship`, `ThreadContext`로 정규화한다.
4. 플랫폼별 타임라인 허용 목록과 visibility mapping을 구현한다.
5. 오류 메시지는 한국어로 맞춘다.

완료 기준:

- 계정 등록/재인증이 동작한다.
- 홈/로컬/연합 또는 소셜/글로벌 타임라인이 로드된다.
- 스트리밍 update/delete/notification이 반영된다.
- 글 작성, 미디어 업로드, 삭제, 좋아요/즐겨찾기, 부스트/리노트, 리액션, 번역이 플랫폼별 정책대로 동작한다.

## 5단계: 전역 상태

1. `AppProvider`로 서비스와 계정 상태를 제공한다.
2. 계정 추가/삭제/활성화/갱신을 구현한다.
3. 앱 시작 시 저장 계정을 normalize하고 백그라운드로 검증 정보를 갱신한다.
4. `ToastProvider`로 토스트 큐와 자동 제거 타이머를 구현한다.

## 6단계: 타임라인 훅

1. `useTimeline`을 구현한다.
2. 최초 30개, 추가 20개 로딩 정책을 적용한다.
3. 타임라인별 최대 보존 개수, 배치 interval, pending limit을 적용한다.
4. 스트리밍 연결과 cleanup을 구현한다.
5. 최상단이 아닐 때 pending queue와 `flushPending`을 구현한다.
6. `updateItem`, `removeItem`을 제공해 외부 액션 결과가 반영되게 한다.

## 7단계: 핵심 UI

구현 순서:

1. 계정 추가와 계정 선택.
2. 글쓰기 패널.
3. 타임라인 섹션.
4. 게시글 카드.
5. 상세 모달과 스레드.
6. 프로필 모달.
7. 리액션 선택기.
8. 설정 모달.
9. 뽀모도로 타이머.
10. 정보 페이지와 모바일 차단 안내.

각 컴포넌트는 `aria-label`, 외부 클릭 닫기, ESC 닫기, backdrop tint를 포함해야 한다.

## 8단계: 콘텐츠 렌더링

1. DOMPurify 기반 HTML 정화를 구현한다.
2. 단순 Markdown 렌더러를 구현한다.
3. URL, 멘션, 커스텀 이모지 렌더링을 구현한다.
4. Mastodon rich HTML과 Misskey Markdown/plain text를 분기한다.
5. 프로필 bio/field는 HTML, Markdown, plain text를 감지해 처리한다.
6. 링크와 이미지 URL은 HTTP(S)만 태그로 렌더링한다.

## 9단계: 이모지 시스템

1. 표준 이모지 카탈로그를 `emoji-datasource`에서 만든다.
2. 커스텀 이모지를 인스턴스별로 지연 로드하고 캐시한다.
3. 최근 사용 이모지를 인스턴스별로 저장한다.
4. 퍼지 검색과 `:query` 추천을 구현한다.
5. 글쓰기 이모지 패널과 리액션 패널에서 동일 훅을 재사용한다.

## 10단계: 링크 미리보기 Function

1. `functions/api/preview.ts`를 구현한다.
2. SSRF 방어, redirect 제한, timeout, response size 제한을 반드시 포함한다.
3. OG meta와 title, description, image, canonical URL을 추출한다.
4. YouTube oEmbed 보강을 구현한다.
5. CSP와 CORS 응답 헤더를 적용한다.
6. 클라이언트에서는 production + non-github.io + Misskey 카드 없음 조건에서만 호출한다.

## 11단계: 디자인과 스타일

1. `base.css`에 모든 색상/크기 토큰을 둔다.
2. `layout.css`는 앱 grid, 사이드바, 타임라인 보드, 모바일 차단을 담당한다.
3. `components.css`는 컴포넌트별 클래스만 담당한다.
4. `theme.css`는 light/dark 테마 파일을 import한다.
5. 테마는 data attribute와 CSS 변수 override로 구현한다.
6. 900px 이하에서는 모바일 차단 UI를 보여준다.

## 12단계: 키보드와 접근성

1. [UI 디자인 시스템](./ui-design.md)의 키보드 표를 모두 구현한다.
2. 입력 요소와 오버레이가 활성화된 상태에서 단축키 충돌이 없어야 한다.
3. 메뉴, 이모지 패널, 알림 팝오버는 방향키/Enter/ESC를 지원해야 한다.
4. 이미지 뷰어는 ESC와 좌우 이동을 지원해야 한다.
5. 토스트, 새 글 배너, 타이머는 live region을 제공해야 한다.

## 13단계: 검수 체크리스트

계정:

- Mastodon 계정 등록, 중복 등록 방지, 재인증, 삭제가 동작한다.
- Misskey 계정 등록, MiAuth session 검증, 재인증, 삭제가 동작한다.
- 7일 만료 정책이 동작한다.

타임라인:

- 플랫폼별 지원 타임라인만 선택된다.
- 무한 스크롤이 동작한다.
- 스트리밍 update/delete/notification이 동작한다.
- 최상단이 아닐 때 새 글 배너가 표시되고 클릭 시 반영된다.
- 알림 팝오버와 배지가 동작한다.

글쓰기:

- 공개 범위가 계정별로 저장된다.
- public warning이 표시된다.
- CW, 답글 멘션, 답글 CW 상속이 동작한다.
- 글자 수 제한이 플랫폼별로 계산된다.
- 이미지 선택/붙여넣기/미리보기/삭제가 동작한다.
- 전송 성공 후 타임라인에 새 글이 반영된다.

게시글:

- Mastodon HTML과 Misskey Markdown이 안전하게 렌더링된다.
- 콘텐츠 경고가 기본 숨김으로 동작한다.
- 부스트/리노트, 알림, 답글 라벨이 표시된다.
- 이미지/비디오/오디오/unknown 첨부가 표시된다.
- 링크 미리보기가 조건부로 표시된다.
- 좋아요, 부스트, 북마크, 리액션, 번역, 삭제가 동작한다.

프로필/상세:

- 상세 모달에서 ancestors/descendants가 표시된다.
- 프로필 모달에서 bio, fields, 작성글이 표시된다.
- 팔로우/요청 취소/언팔로우/뮤트/차단이 롤백 정책대로 동작한다.
- 프로필 모달 스택이 정상적으로 닫힌다.

설정/디자인:

- 모든 테마와 색상 모드가 적용된다.
- 섹션 설정이 저장되고 섹션별로 적용된다.
- 오버레이는 외부 클릭과 ESC로 닫힌다.
- 900px 이하에서 모바일 차단 안내가 표시된다.

품질:

- `pnpm run test`가 통과한다.
- `pnpm run build`가 통과한다.
- `rg -n $'\uFFFD' src`가 결과를 내지 않는다.
- 새/수정 소스 파일에 UTF-8 BOM이 없다.

## 구현상 주의할 점

- `MastodonApi`라는 인터페이스 이름을 바꾸고 싶더라도 기존 코드와 문서를 그대로 재현하려면 공통 포트 이름으로 유지한다.
- Misskey 북마크/좋아요는 현재 공통 즐겨찾기 API에 연결되어 있다.
- Misskey 리액션은 한 번에 하나만 허용하는 UI 정책이 있다.
- 상세 모달의 스레드 항목은 리액션 액션을 비활성화한다.
- 링크 미리보기는 GitHub Pages에서는 꺼져 있다.
- 모바일 컴포넌트가 있어도 900px 이하에서는 차단 안내가 우선이다.
