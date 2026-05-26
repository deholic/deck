# 플랫폼 연동

## 공통 원칙

- UI는 플랫폼별 응답을 직접 사용하지 않는다.
- Mastodon과 Misskey 구현체는 `MastodonApi` 공통 포트를 구현한다.
- `UnifiedApiClient`, `UnifiedOAuthClient`, `UnifiedStreamingClient`가 `account.platform` 또는 등록 앱의 `platform`으로 구현체를 선택한다.
- 모든 API 오류는 한국어 사용자 메시지로 `Error`를 던진다.
- 계정 토큰은 브라우저 저장소에 있고, API 요청은 사용자의 브라우저에서 각 인스턴스로 직접 전송된다.

## Mastodon OAuth

앱 등록:

- Endpoint: `POST /api/v1/apps`
- Content-Type: `application/x-www-form-urlencoded`
- Body:
  - `client_name=Deck`
  - `redirect_uris={redirectUri}`
  - `scopes=read write follow`

승인 URL:

- Endpoint: `/oauth/authorize`
- Query:
  - `client_id`
  - `redirect_uri`
  - `response_type=code`
  - `scope`
  - `state`
  - `force_login=true`

토큰 교환:

- Endpoint: `POST /oauth/token`
- Body:
  - `client_id`
  - `client_secret`
  - `redirect_uri`
  - `grant_type=authorization_code`
  - `code`
  - `scope`

정책:

- `code`가 없으면 실패한다.
- `client_id` 또는 `client_secret`이 앱 등록 응답에 없으면 실패한다.
- `access_token`이 토큰 응답에 없으면 실패한다.
- 같은 인스턴스와 같은 redirect URI의 Mastodon 등록 앱은 `sessionStorage`에 캐시한다.

## Misskey MiAuth

앱 등록은 서버 호출 없이 로컬에서 MiAuth 세션 정보를 만든다.

- 앱 이름: `Deck`
- 세션 ID: `crypto.randomUUID()`
- 승인 URL: `/{instance}/miauth/{sessionId}`
- Query:
  - `name=Deck`
  - `callback={redirectUri with state}`
  - `permission={comma separated permissions}`

권한:

- `read:account`
- `read:notifications`
- `read:notes`
- `write:notes`
- `write:drive`
- `write:reactions`
- `write:favorites`
- `write:following`
- `write:mutes`
- `write:blocks`

토큰 확인:

- Endpoint: `POST /api/miauth/{sessionId}/check`
- Body: `{}`

정책:

- 콜백의 `session`이 pending session과 다르면 실패한다.
- 응답의 `ok`가 true이고 `token`이 있어야 성공한다.
- Misskey는 등록 앱을 재사용하지 않고 매번 새 MiAuth 세션을 만든다.

## 플랫폼 감지

`UnifiedOAuthClient`는 먼저 `{instance}/api/meta`에 POST 요청을 보낸다.

- 응답이 OK이고 JSON에 `name` 또는 `version`이 있으면 Misskey.
- 요청 실패 또는 조건 불일치 시 Mastodon.

이 감지는 계정 추가와 재인증 모두에 쓰인다.

## Mastodon HTTP API

모든 인증 요청은 `Authorization: Bearer {accessToken}` 헤더를 사용한다. JSON POST는 `Content-Type: application/json`을 포함한다.

| 기능 | Endpoint |
| --- | --- |
| 계정 검증 | `GET /api/v1/accounts/verify_credentials` |
| 홈 타임라인 | `GET /api/v1/timelines/home?limit&max_id` |
| 로컬/연합 타임라인 | `GET /api/v1/timelines/public?limit&local&max_id` |
| 알림 | `GET /api/v1/notifications?limit&max_id` |
| 북마크 | `GET /api/v1/bookmarks?limit&max_id` |
| 커스텀 이모지 | `GET /api/v1/custom_emojis` |
| 인스턴스 정보 | `GET /api/v2/instance`, fallback `GET /api/v1/instance` |
| 프로필 | `GET /api/v1/accounts/{id}` |
| 관계 | `GET /api/v1/accounts/relationships?id[]={id}` |
| 팔로우 | `POST /api/v1/accounts/{id}/follow` |
| 언팔로우/요청 취소 | `POST /api/v1/accounts/{id}/unfollow` |
| 뮤트/해제 | `POST /api/v1/accounts/{id}/mute`, `POST /api/v1/accounts/{id}/unmute` |
| 차단/해제 | `POST /api/v1/accounts/{id}/block`, `POST /api/v1/accounts/{id}/unblock` |
| 계정 게시글 | `GET /api/v1/accounts/{id}/statuses?limit&max_id` |
| 미디어 업로드 | `POST /api/v2/media` multipart |
| 스레드 컨텍스트 | `GET /api/v1/statuses/{id}/context` |
| 글 작성 | `POST /api/v1/statuses` |
| 글 삭제 | `DELETE /api/v1/statuses/{id}` |
| 좋아요/취소 | `POST /api/v1/statuses/{id}/favourite`, `POST /api/v1/statuses/{id}/unfavourite` |
| 북마크/취소 | `POST /api/v1/statuses/{id}/bookmark`, `POST /api/v1/statuses/{id}/unbookmark` |
| 부스트/취소 | `POST /api/v1/statuses/{id}/reblog`, `POST /api/v1/statuses/{id}/unreblog` |
| 게시글 상태 | `GET /api/v1/statuses/{id}` |
| 번역 | `POST /api/v1/statuses/{id}/translate` |

Mastodon에서 `createReaction`과 `deleteReaction`은 지원하지 않으며 호출 시 `리액션은 미스키 계정에서만 사용할 수 있습니다.` 오류를 던진다.

## Mastodon 스트리밍

Endpoint:

- Base: `{instance}/api/v1/streaming`
- WebSocket URL은 `http`를 `ws`로 바꾼다.

스트림 매핑:

- 홈, 알림: `user`
- 로컬: `public:local`
- 연합: `public`
- 기타: `user`

인증:

1. 먼저 WebSocket protocol 인자로 access token을 전달한다.
2. 연결이 열리기 전에 닫히면 `access_token` query 방식으로 재시도한다.

이벤트:

- `update`: payload를 JSON 파싱해 `Status`로 매핑.
- `delete`: payload를 삭제 ID로 사용.
- `notification`: 알림 이벤트로 전달.

재연결:

- 닫히면 2의 지수승 backoff로 재연결한다.
- 최대 지연은 15초다.
- cleanup 시 retry timer와 socket을 닫는다.

## Misskey HTTP API

Misskey JSON API는 대부분 POST이며 인증 토큰은 body의 `i` 필드에 넣는다. 인스턴스 URL은 마지막 `/`를 제거한다.

| 기능 | Endpoint |
| --- | --- |
| 계정 검증 | `POST /api/i` |
| 홈 타임라인 | `POST /api/notes/timeline` |
| 로컬 타임라인 | `POST /api/notes/local-timeline` |
| 소셜 타임라인 | `POST /api/notes/hybrid-timeline` |
| 글로벌 타임라인 | `POST /api/notes/global-timeline` |
| 알림 | `POST /api/i/notifications` |
| 커스텀 이모지 | `POST /api/emojis`, 실패 시 인증 없는 `GET /api/emojis` fallback |
| 인스턴스 정보 | `POST /api/meta` |
| 프로필/관계 | `POST /api/users/show` |
| 팔로우 | `POST /api/following/create` |
| 언팔로우 | `POST /api/following/delete` |
| 팔로우 요청 취소 | `POST /api/following/requests/cancel` |
| 뮤트/해제 | `POST /api/mute/create`, `POST /api/mute/delete` |
| 차단/해제 | `POST /api/blocking/create`, `POST /api/blocking/delete` |
| 계정 게시글 | `POST /api/users/notes` |
| 즐겨찾기 목록 | `POST /api/i/favorites` |
| 미디어 업로드 | `POST /api/drive/files/create` multipart |
| 대화 | `POST /api/notes/conversation` |
| 답글 children | `POST /api/notes/children` |
| 글 작성 | `POST /api/notes/create` |
| 글 삭제 | `POST /api/notes/delete` |
| 즐겨찾기/취소 | `POST /api/notes/favorites/create`, `POST /api/notes/favorites/delete` |
| 리액션/취소 | `POST /api/notes/reactions/create`, `POST /api/notes/reactions/delete` |
| 노트 상태 | `POST /api/notes/state` |
| 노트 조회 | `POST /api/notes/show` |
| 번역 | `POST /api/notes/translate` |

Misskey 공개 범위 매핑:

- `public` -> `public`
- `unlisted` -> `home`
- `private` -> `followers`
- `direct` -> `specified`

Misskey 북마크 정책:

- 앱의 공통 모델에서는 `bookmark`와 `favourite`가 모두 즐겨찾기 API에 연결된다.
- `fetchBookmarks`는 `i/favorites`를 읽고 item의 `note`가 있으면 note를 매핑한다.

Misskey 리노트 취소:

- `notes/show`로 대상 노트의 `myRenoteId`를 확인한다.
- ID가 없으면 `취소할 리노트를 찾지 못했습니다.` 오류를 던진다.
- 찾은 리노트 ID를 `notes/delete`로 삭제한다.

## Misskey 스트리밍

Endpoint:

- `{instance}/streaming?i={accessToken}`

채널 매핑:

- 홈: `homeTimeline`
- 로컬: `localTimeline`
- 소셜: `hybridTimeline`
- 글로벌: `globalTimeline`
- 알림: `main`
- 기타: `homeTimeline`

연결 절차:

1. 연결마다 `crypto.randomUUID()`로 channel ID를 만든다.
2. WebSocket open 후 `{ type: "connect", body: { channel, id } }`를 보낸다.
3. 30초마다 `{ type: "ping" }`을 보낸다.
4. 서버 `ping`에는 `{ type: "pong" }`으로 응답한다.
5. cleanup 시 열린 socket에 `{ type: "disconnect", body: { id } }`를 보낸다.

이벤트:

- `channel` 메시지의 `id`가 현재 channel ID와 같아야 처리한다.
- `note`: 업데이트 이벤트.
- `notification`: 알림 이벤트.
- `deleted`: 삭제 이벤트.
- 일부 서버 호환을 위해 top-level `note`, `notification`도 처리한다.

재연결:

- 닫히면 timer를 정리하고 2의 지수승 backoff로 재연결한다.
- 최대 지연은 15초다.

## 링크 미리보기 Function

경로:

- `GET /api/preview?url={encodedUrl}`

사용 조건:

- 클라이언트 production 빌드에서만 사용한다.
- `window.location.hostname`이 `github.io`로 끝나면 사용하지 않는다.
- Misskey 게시글에서 서버 제공 카드가 없고 본문에 URL이 있을 때만 호출한다.

보안 정책:

- 요청 URL은 `http:` 또는 `https:`만 허용한다.
- `localhost`, `.local`, 사설 IPv4, loopback, link-local, carrier-grade NAT, 사설/링크로컬 IPv6를 차단한다.
- redirect는 수동 처리하며 최대 2회만 따라간다.
- redirect 대상도 동일하게 URL 검증과 사설 host 차단을 통과해야 한다.
- 요청 timeout은 5초다.
- 최대 응답 읽기 크기는 512KB다.
- 허용 content-type은 `text/html`, `application/xhtml+xml`이다.
- 응답에는 `Content-Security-Policy: default-src 'none'`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`을 넣는다.
- CORS는 현재 요청 origin만 `Access-Control-Allow-Origin`으로 허용한다.

추출 규칙:

- `og:title`, `<title>` 순으로 제목을 찾는다.
- `og:description`, `meta[name=description]` 순으로 설명을 찾는다.
- `og:image`는 절대 HTTP(S) URL로 변환한다.
- `og:url`이 있으면 canonical URL로 사용하고, 없으면 요청 URL을 사용한다.
- YouTube 호스트에서 제목이 없거나 `YouTube`이면 oEmbed로 제목과 썸네일을 보강한다.

오류 응답:

- 파라미터 없음: HTTP 400, `{ error: "missing_url" }`.
- 유효하지 않거나 차단된 URL: HTTP 400, `{ error: "invalid_url" }`.
- fetch 실패, unsupported content, empty body, missing title, timeout, redirect 오류는 대부분 HTTP 200과 `{ error }` JSON으로 반환한다. 클라이언트가 카드 없음으로 처리하기 위함이다.

## 보안 헤더

`public/_headers`는 모든 정적 응답에 다음 정책을 적용한다.

- CSP:
  - `default-src 'self'`
  - `script-src 'self'`
  - `style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net`
  - `img-src 'self' https: data: blob:`
  - `media-src 'self' https: blob: data:`
  - `font-src 'self' https://cdn.jsdelivr.net data:`
  - `connect-src 'self' https: wss:`
  - `object-src 'none'`
  - `base-uri 'self'`
  - `form-action 'self'`
  - `frame-ancestors 'none'`
  - `worker-src 'self' blob:`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`

## 배포 워크플로우

- `deploy.yml`
  - 이름: Beta Deploy.
  - 트리거: `develop` push, manual dispatch.
  - pnpm 11.3.0, Node 24.
  - `pnpm install --frozen-lockfile`, `pnpm run build`.
  - Cloudflare Pages beta 프로젝트에 `--branch develop`로 배포한다.
- `deploy-prod.yml`
  - 이름: Production Deploy.
  - 트리거: `main` push.
  - 동일한 install/build 후 Cloudflare Pages production 프로젝트에 배포한다.
- `test.yml`
  - 이름: Test.
  - 트리거: `main` 대상 PR.
  - `pnpm run test`를 실행한다.
