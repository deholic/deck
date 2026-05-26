# 도메인과 데이터 모델

## 핵심 타입

### Visibility

```ts
type Visibility = "public" | "unlisted" | "private" | "direct";
```

- Mastodon 값은 그대로 사용한다.
- Misskey 값은 `public -> public`, `home -> unlisted`, `followers -> private`, `specified -> direct`로 매핑한다.

### AccountPlatform

```ts
type AccountPlatform = "mastodon" | "misskey";
```

모든 계정과 인스턴스 정보는 플랫폼 값을 가진다. 플랫폼별 분기는 UI가 아니라 통합 클라이언트와 정규화 함수에서 처리하는 것이 원칙이다.

### TimelineType

```ts
type TimelineType =
  | "home"
  | "local"
  | "federated"
  | "social"
  | "global"
  | "notifications"
  | "bookmarks";
```

- Mastodon 허용 목록: `home`, `local`, `federated`, `notifications`, `bookmarks`.
- Misskey 허용 목록: `home`, `local`, `social`, `global`, `notifications`.
- 허용되지 않는 값은 `home`으로 정규화한다.

### Account

계정은 다음 정보를 가진다.

- `id`: 앱 내부 계정 ID. `crypto.randomUUID()`로 생성한다.
- `instanceUrl`: 정규화된 인스턴스 URL.
- `accessToken`: API 호출 토큰.
- `platform`: Mastodon 또는 Misskey.
- `name`: 표시명과 핸들을 합친 레거시 라벨.
- `displayName`: UI 표시명.
- `handle`: 도메인을 포함한 핸들로 정규화한다.
- `url`: 원본 프로필 URL.
- `avatarUrl`: 아바타 URL.
- `emojis`: 계정 표시명에 쓰는 커스텀 이모지 목록.

### Status

`Status`는 Mastodon status, Misskey note, 알림, 부스트/리노트를 모두 담는 단일 UI 모델이다.

주요 필드:

- 작성자: `accountId`, `accountName`, `accountHandle`, `accountUrl`, `accountAvatarUrl`.
- 본문: `content`, `htmlContent`, `hasRichContent`.
- 메타: `createdAt`, `url`, `visibility`, `spoilerText`, `sensitive`.
- 링크 카드: `card`.
- 카운트: `repliesCount`, `reblogsCount`, `favouritesCount`.
- 상태: `reblogged`, `favourited`, `bookmarked`, `myReaction`.
- 관계: `inReplyToId`, `mentions`.
- 첨부: `mediaAttachments`.
- 래핑: `reblog`, `boostedBy`, `notification`.
- 이모지: `customEmojis`, `accountEmojis`.
- 리액션: `reactions`.

부스트/리노트는 외부 `Status`가 `reblog`에 대상 글을 들고, `boostedBy`에 부스트한 사용자 정보를 가진다. 알림은 `notification`에 알림 메타와 대상 글을 가진다.

### MediaAttachment

```ts
type MediaAttachmentKind = "image" | "video" | "gifv" | "audio" | "unknown";
```

- `id`, `url`, `previewUrl`, `description`, `kind`를 가진다.
- API 타입이 불명확하면 URL 확장자로 종류를 추정한다.
- Misskey 파일 MIME 타입은 `image/`, `video/`, `audio/` prefix를 우선 사용한다.

### Reaction

리액션은 Misskey 중심 모델이지만 Mastodon 호환 mapper도 값을 받을 수 있다.

- `name`: 유니코드 이모지 또는 `:shortcode:`/원격 shortcode.
- `count`: 1 이상 정수.
- `url`: 커스텀 이모지 이미지 URL.
- `isCustom`: 커스텀 여부.
- `host`: 커스텀 이모지 호스트.

리액션은 count 내림차순, 이름 오름차순으로 정렬한다.

### UserProfile과 AccountRelationship

`UserProfile`은 프로필 모달용 모델이다.

- `id`, `name`, `handle`, `url`, `avatarUrl`, `headerUrl`, `locked`, `bio`, `fields`, `emojis`.

`AccountRelationship`은 현재 계정과 대상 계정의 관계다.

- `following`, `requested`, `muting`, `blocking`.

### ThreadContext

```ts
type ThreadContext = {
  ancestors: Status[];
  descendants: Status[];
  conversation?: Status[];
};
```

- Mastodon은 ancestors와 descendants를 API 응답에서 직접 가져온다.
- Misskey는 conversation을 시간순 보존하고, 현재 노트 기준으로 ancestors를 만들며, 별도 children 탐색으로 descendants를 만든다.

## Mastodon 정규화 규칙

### 계정 검증

`verify_credentials` 응답에서 `display_name`, `username`, `acct`, `avatar`, `emojis`를 읽어 계정 표시 정보를 만든다.

### 게시글

- `content` HTML은 plain text로도 변환한다.
- 링크는 plain text 변환 시 `텍스트 (url)` 형태로 보존한다.
- `<br>`, `</p>`, `</div>`, `</li>`는 줄바꿈으로 변환한다.
- `htmlContent`에는 원본 HTML을 저장하고 `hasRichContent`는 true로 둔다.
- 카드가 있고 제목/설명/이미지가 의미 있는 경우에만 `card`를 만든다.
- `reblog`가 있으면 재귀적으로 `Status`로 변환하고 `boostedBy`를 현재 응답의 account에서 만든다.
- `emojis`는 본문 커스텀 이모지, `account.emojis`는 작성자 이름 이모지로 저장한다.
- `reactions` 객체가 있으면 count가 양수인 항목만 취한다.

### 알림

Mastodon 알림은 `Status`처럼 렌더링할 수 있도록 변환한다.

- `follow`: 팔로우함.
- `follow_request`: 팔로우 요청함.
- `favourite`: 좋아요함.
- `reblog`: 부스트함.
- `poll`: 투표함.
- `status`: 글 작성함.
- `update`: 게시글 수정함.
- `mention`: 멘션함.
- 기타: 알림.

`mention`, `status`, `update`처럼 대상 글과 같은 성격의 알림은 fallback 본문을 비우고 대상 글을 보여준다.

## Misskey 정규화 규칙

### 계정과 프로필

- 사용자 URL이 있으면 그대로 사용한다.
- `uri`가 있으면 URL로 사용한다.
- URL이 없으면 `instanceUrl` 또는 원격 host로 `https://host/@username`을 만든다.
- `name`이 없으면 `username`을 표시명으로 사용한다.
- `isLocked` 또는 `isPrivate`이면 잠긴 계정이다.

### 게시글

- `text`가 본문이며 `hasRichContent`는 false다.
- `cw`는 `spoilerText`로 저장한다.
- `cw`가 있거나 파일이 sensitive이면 `sensitive` true로 둔다.
- `renote`는 `reblog`로 변환하고 `boostedBy`를 현재 note의 user에서 만든다.
- `myRenoteId`가 있으면 `reblogged` true다.
- `myReaction`이 있으면 `favourited` true로 본다.
- `isFavorited`는 `bookmarked`와 `favourited`에 반영한다.
- `renoteCount`는 `reblogsCount`, reactions 합계는 `favouritesCount`로 사용한다.
- `mentions`와 reply user를 합쳐 멘션 목록을 만든다.
- 커스텀 이모지 목록이 없으면 본문 shortcode와 인스턴스 host로 `/emoji/{shortcode}.webp` fallback URL을 만든다.

### 리액션

- `reactions` 객체의 key가 리액션 이름, value가 count다.
- `reactionEmojis`, note emojis, fallback URL을 조합해 커스텀 이모지 URL을 찾는다.
- 이름에 원격 host가 있으면 host를 추출한다.
- URL이 있거나 이름이 `:...:` 또는 원격 이모지 형식이면 커스텀으로 본다.

### 알림

Misskey 알림은 사용자 알림과 시스템 알림을 모두 `Status`로 변환한다.

지원 라벨:

- 팔로우, 팔로우 요청, 팔로우 요청 승인.
- 리노트, 리액션, 투표 종료, 투표, 글 작성, 인용, 답글, 멘션.
- 예약 글 게시/실패.
- 도전과제, 로그인, 테스트, 역할 부여, 공지, 앱 알림, 채팅방 초대, 내보내기 완료, 토큰 생성.
- 그룹 리액션/리노트.

시스템 알림은 행위자를 `시스템`, 앱 알림은 `앱`, 그룹 알림은 `여러 사용자`로 정규화한다.

## 인스턴스 정보

`InstanceInfo`는 글자 수 제한 계산에 사용한다.

- Mastodon:
  - 먼저 `/api/v2/instance`를 호출한다.
  - `configuration.statuses.max_characters`를 우선 사용한다.
  - 없으면 `max_toot_chars`, 최종 fallback은 500.
  - 실패하면 `/api/v1/instance`로 fallback한다.
- Misskey:
  - `/api/meta`에서 `maxNoteLength`를 읽는다.
  - 없으면 3000.

## 저장소 키

### localStorage

| 키 | 용도 |
| --- | --- |
| `textodon.accounts` | 계정 목록과 토큰 |
| `textodon.accounts.lastUsedAt` | 계정 저장소 마지막 사용 시각 |
| `textodon.accounts.activeId` | 활성 계정 ID |
| `textodon.sections` | 타임라인 섹션 배열 |
| `textodon.compose.accountId` | 글쓰기 계정 ID |
| `textodon.compose.visibility.{accountId}` | 계정별 공개 범위 |
| `textodon.compose.visibility` | 계정 없는 경우 fallback 공개 범위 |
| `textodon.compose.recentEmojis.{encodedInstanceUrl}` | 인스턴스별 최근 이모지 |
| `textodon.theme` | 테마 |
| `textodon.christmas` | 구형 크리스마스 테마 호환 플래그 |
| `textodon.colorScheme` | 시스템/라이트/다크 모드 |
| `textodon.profileImages` | 섹션 기본 프로필 이미지 표시 여부 |
| `textodon.customEmojis` | 섹션 기본 커스텀 이모지 표시 여부 |
| `textodon.reactions` | 섹션 기본 리액션 표시 여부 |
| `textodon.sectionSize` | 섹션 기본 폭 |
| `textodon.pomodoro` | 뽀모도로 표시 여부 |
| `textodon.pomodoro.focus` | 집중 시간 분 |
| `textodon.pomodoro.break` | 휴식 시간 분 |
| `textodon.pomodoro.longBreak` | 긴 휴식 시간 분 |
| `textodon.pomodoro.currentSession` | 현재 뽀모도로 세션 |
| `textodon.pomodoro.timeLeft` | 남은 초 |
| `textodon.pomodoro.isRunning` | 실행 상태 |
| `textodon.pomodoro.completedSessions` | 완료 세션 목록 |
| `textodon.pomodoro.todos` | 뽀모도로 투두 목록 |

### sessionStorage

| 키 | 용도 |
| --- | --- |
| `textodon.oauth.pending` | OAuth/MiAuth 진행 중 등록 정보, state, 재인증 계정 ID |
| `textodon.oauth.apps` | 인스턴스별 등록 앱 정보 캐시 |

## 레거시 데이터 호환

앱 시작 시 저장된 계정에 `displayName` 또는 `handle`이 없으면 `name` 라벨을 파싱해 채운다. 현재 파서 구현은 `displayName \s@handle` 형태의 레거시 문자열을 대상으로 한다. 파싱 실패 시 `name` 또는 `instanceUrl`을 표시명으로 사용한다.

## 메모리 캐시

- 커스텀 이모지는 인스턴스 URL 기준 `Map<string, CustomEmoji[]>`에 캐시한다.
- 링크 미리보기는 URL 기준 `Map<string, LinkCard | null>`에 캐시한다.
- 이 캐시는 새로고침 시 사라진다.
