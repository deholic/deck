# 정책

## 개발 정책

- SOLID 원칙을 준수한다.
- 패키지 매니저는 pnpm으로 통일한다.
- `pnpm-lock.yaml`은 항상 커밋 대상이다.
- TypeScript는 `strict` 중심으로 유지한다.
- `any`와 `as`는 남용하지 않는다.
- React 컴포넌트는 props 타입을 명확히 한다.
- 상태는 가능한 한 가까운 소유자에 두고 최소화한다.
- 비동기 상태 갱신은 낙관적 업데이트와 실패 롤백을 고려한다.
- 스타일은 목적별 파일로 분리한다.
- 전역 스타일은 최소화한다.
- UI 색상 변경 시 모든 테마의 라이트/다크 모드를 함께 고려한다.
- 소스 파일은 UTF-8, BOM 없음으로 저장한다.
- UI 문자열은 한국어를 기본으로 한다.

## 브랜치와 배포 용어

- 새 작업은 `develop` 최신화 후 `feature/{기능-이름}` 브랜치에서 시작한다.
- `develop`은 beta 기준 브랜치다.
- `main`은 production 기준 브랜치다.
- Cloudflare Pages 배포는 production으로 부른다.
- GitHub Pages 배포는 beta로 부른다.
- 현재 GitHub Actions 구현은 `develop`을 Cloudflare Pages beta 프로젝트로, `main`을 Cloudflare Pages production 프로젝트로 배포한다.

## 개인정보와 저장소 정책

- 서비스는 서버에 사용자 계정 정보나 게시물을 저장하지 않는다.
- 계정 토큰은 브라우저 `localStorage`에 저장된다.
- OAuth 진행 상태와 등록 앱 캐시는 `sessionStorage`에 저장된다.
- 모든 SNS API 요청은 사용자가 등록한 인스턴스로 직접 전송된다.
- 계정 저장소는 마지막 사용 이후 7일이 지나면 자동 삭제된다.
- 사용자는 인스턴스 정책, 법령, 계정 보안, 토큰 관리 책임을 가진다.
- 로컬 저장소 초기화는 사용자 확인 후 모든 `localStorage`를 지우고 페이지를 새로고침한다.

## 인증 정책

- OAuth/MiAuth 콜백은 반드시 `state`를 검증한다.
- Misskey 콜백은 `session`도 pending 세션과 비교한다.
- 잘못된 상태 또는 누락된 코드/세션은 pending OAuth를 삭제하고 다시 시도하도록 오류를 보여준다.
- 신규 계정 추가 전 `verifyAccount`로 토큰 유효성과 표시 정보를 확인한다.
- 같은 플랫폼/인스턴스/핸들 계정은 중복 등록하지 않는다.
- 재인증은 기존 계정 ID를 pending OAuth에 포함하고, 콜백 후 기존 계정만 갱신한다.

## 콘텐츠 보안 정책

- 외부 HTML은 DOMPurify로 정화한 뒤 렌더링한다.
- 허용 HTML 태그:
  - `p`, `br`, `a`, `strong`, `em`, `u`, `s`, `code`, `pre`, `blockquote`, `ul`, `ol`, `li`, `span`, `img`.
- 허용 속성:
  - `href`, `title`, `class`, `src`, `alt`, `loading`, `target`, `rel`.
- 금지 속성:
  - `onclick`, `onload`, `onerror`, `onmouseover`.
- data attribute는 허용하지 않는다.
- HTTP(S) 링크는 target이 없으면 `_blank`, rel이 없으면 `noreferrer`를 추가한다.
- Markdown 렌더러는 HTML escape 후 제한된 heading, paragraph, list, code block, inline code, emphasis, strong, link, image만 만든다.
- Markdown 링크와 이미지 URL은 안전한 URL만 HTML 태그로 렌더링한다.
- bare URL은 trailing punctuation을 제외하고 링크화한다.

## 링크 미리보기 보안 정책

- 링크 미리보기 Function은 HTTP(S) URL만 허용한다.
- localhost, `.local`, 사설 IP, loopback, link-local, carrier-grade NAT, 사설 IPv6를 차단한다.
- redirect는 최대 2회까지만 허용하고 redirect 대상도 동일하게 검증한다.
- 요청 timeout은 5초다.
- 응답 본문은 최대 512KB까지만 읽는다.
- HTML/XHTML content-type만 허용한다.
- Function 응답은 JSON이며 frame, content sniffing, referrer, CSP 보안 헤더를 포함한다.
- 클라이언트는 preview 오류를 사용자 오류로 띄우지 않고 카드 없음으로 처리한다.

## UI 오버레이 정책

- 다른 콘텐츠 위에 뜨는 메뉴, 팝오버, 팝업은 자신 외 영역 클릭 시 닫혀야 한다.
- 이러한 오버레이는 배경을 tint 처리해야 한다.
- ESC로 닫는 동작을 제공한다.
- 오버레이가 열려 있으면 전역 단축키는 충돌을 피하기 위해 대부분 비활성화한다.
- 이모지 패널이 열려 있으면 타임라인 단축키를 막는다.
- 모달은 `role="dialog"`와 `aria-modal="true"`를 가진다.

## 접근성 정책

- 버튼과 아이콘에는 의미 있는 `aria-label`을 제공한다.
- 장식 아이콘은 `aria-hidden="true"`를 사용한다.
- 토스트는 live region으로 전달한다.
- 오류 토스트는 alert로 전달한다.
- 선택 가능한 목록은 listbox/option 또는 menu 역할을 사용한다.
- 클릭 가능한 비버튼 요소에는 role, tabIndex, keyboard handler를 제공한다.
- 이미지에는 가능한 경우 대체 텍스트를 제공한다.

## 타임라인 정책

- 최초 로딩은 30개, 추가 로딩은 20개다.
- 최상단이 아닌 상태에서 들어온 스트리밍 업데이트는 대기열에 쌓는다.
- 대기열은 사용자가 명시적으로 `새 글 N개` 버튼을 누를 때 반영한다.
- 대기열이 꽉 차면 오래된 대기 업데이트를 버리고 최신 대기 업데이트를 유지한다.
- 북마크 타임라인은 스트리밍하지 않는다.
- 알림 감지는 각 일반 컬럼에서 별도 notification stream으로 처리할 수 있다.
- 계정 또는 타임라인이 바뀌면 기존 stream 연결과 timer를 정리한다.

## 게시 액션 정책

- 비동기 액션 실패 메시지는 토스트 또는 상위 오류 상태로 보여준다.
- 부스트와 북마크는 낙관적으로 UI를 바꾸고 실패 시 원래 status로 롤백한다.
- 리액션은 낙관적 업데이트를 적용하고 실패 시 롤백한다.
- 서버 응답의 리액션 상태가 낙관적 상태와 다르면 서버 응답을 우선한다.
- 자기 글, 비공개 글, DM은 새 부스트를 막는다.
- 삭제는 작성자와 활성 계정이 같다고 판단될 때만 버튼을 보여준다.
- 삭제는 확인 모달을 거친다.
- Misskey에서 이미 다른 리액션을 남긴 상태로 새 리액션을 추가하지 않는다.
- Mastodon 계정에서 리액션 액션을 호출하면 오류 처리한다.

## 프로필 관계 정책

- 프로필 대상이 현재 계정 자신이면 팔로우/뮤트/차단 컨트롤을 숨기거나 비활성화한다.
- 잠긴 계정 팔로우는 요청 상태로 표시한다.
- 팔로잉 상태에서 버튼을 누르면 즉시 언팔로우하지 않고 확인 팝업을 띄운다.
- 팔로우 요청 상태에서 버튼을 누르면 요청 취소를 수행한다.
- 뮤트/차단은 프로필 메뉴에 둔다.
- 차단 시 optimistic relationship은 following/requested를 false로 만든다.
- 관계 API 실패 시 이전 관계 상태로 롤백한다.

## 글쓰기 정책

- 본문이 공백뿐이면 전송하지 않는다.
- 글자 수 제한을 초과하면 전송하지 않는다.
- Mastodon URL은 23자로 계산한다.
- Misskey는 문자열 길이 그대로 계산한다.
- CW가 켜져 있을 때만 spoiler text를 전송한다.
- 답글 대상 CW가 있으면 답글 CW를 자동으로 켠다.
- 이미지 첨부 object URL은 성공, 삭제, 언마운트 시 revoke한다.
- 전송 성공 후 본문과 첨부는 비우지만 CW는 답글 상태 처리에 맞춰 유지/초기화한다.

## 이모지 정책

- 커스텀 이모지는 인스턴스별로 로드하고 메모리 캐시한다.
- 최근 이모지는 인스턴스별로 최대 24개 저장한다.
- 패널을 열거나 검색/추천이 필요할 때만 이모지를 로드한다.
- 이모지 로드 오류는 같은 메시지를 반복 토스트하지 않는다.
- 커스텀 이모지 shortcode는 앞뒤 `:`를 제거해 정규화한다.
- Misskey 원격 이모지 URL이 없으면 인스턴스 host 기준 `/emoji/{shortcode}.webp` fallback을 만든다.

## 키보드 정책

- 입력 요소, contenteditable, 모달/팝오버, 이모지 패널이 활성화된 상태에서는 충돌하는 전역 단축키를 실행하지 않는다.
- 타임라인 선택 이동은 DOM 위치와 글 중심 y 좌표를 사용해 인접 컬럼에서 가장 가까운 글을 찾는다.
- 메뉴가 열린 상태의 방향키와 Enter는 메뉴 항목 탐색/선택에 우선한다.
- ESC는 가장 안쪽 열린 UI를 닫거나 현재 선택을 해제한다.

## 모바일 정책

- 현재 제품은 모바일 사용을 지원하지 않는다.
- 900px 이하에서는 모바일 차단 안내를 전체 화면으로 보여준다.
- 모바일 메뉴 컴포넌트는 존재하지만 실제 사용 가능 UI보다 안내 블로커가 우선한다.

## 테스트와 품질 정책

- 유틸리티 단위 테스트는 Vitest로 작성한다.
- 현재 테스트 대상:
  - 계정 URL/핸들 유틸.
  - OAuth sessionStorage 유틸.
  - Markdown 렌더러.
- 배포 전 기본 검증 명령:
  - `pnpm run test`
  - `pnpm run build`
- 텍스트 깨짐 검사:
  - `rg -n $'\uFFFD' src`
  - `rg -n "[\u00C0-\u00FF]" src`
