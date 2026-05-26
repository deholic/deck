# Deck 코드베이스 문서

이 문서는 AI 에이전트가 Deck 코드베이스를 빠르게 이해하고, 동일한 제품을 바닥부터 다시 구현할 수 있도록 작성한 진입점입니다. 구현된 기능, 정책, 아키텍처, 플랫폼 연동, 디자인 규칙을 코드 기준으로 정리합니다.

## 제품 요약

Deck은 Mastodon과 Misskey 계정을 등록해 여러 타임라인 컬럼을 동시에 보는 페디버스 웹 클라이언트입니다. React/Vite 기반 SPA이며, 계정 토큰과 사용자 설정은 브라우저 저장소에만 저장합니다. 실시간 타임라인은 WebSocket 스트리밍으로 갱신하고, 글쓰기, 답글, 미디어 첨부, 이모지, 리액션, 프로필, 스레드, 뽀모도로 타이머를 포함합니다.

## 문서 지도

- [기능 명세](./product-features.md): 사용자에게 노출되는 모든 기능과 화면별 동작.
- [아키텍처](./architecture.md): 레이어 구조, 상태 소유권, 주요 데이터 흐름.
- [도메인과 데이터 모델](./domain-and-data.md): 핵심 타입, 정규화 규칙, 저장소 키.
- [플랫폼 연동](./platform-integrations.md): Mastodon/Misskey OAuth, HTTP API, 스트리밍, 링크 미리보기.
- [UI 디자인 시스템](./ui-design.md): 레이아웃, 테마, 컴포넌트 시각 정책, 접근성.
- [정책](./policies.md): 개발/보안/저장소/콘텐츠/키보드/배포 정책.
- [재구현 가이드](./rebuild-guide.md): 새 코드베이스로 다시 만들 때의 구현 순서와 검수 체크리스트.

## AI 에이전트용 읽기 순서

1. [정책](./policies.md)을 먼저 읽어 개발 제약, 보안 제약, 저장소 제약을 확정한다.
2. [아키텍처](./architecture.md)와 [도메인과 데이터 모델](./domain-and-data.md)로 코드 구조와 데이터 계약을 잡는다.
3. [플랫폼 연동](./platform-integrations.md)으로 외부 API 어댑터를 구현한다.
4. [기능 명세](./product-features.md)로 사용자 흐름을 빠짐없이 구현한다.
5. [UI 디자인 시스템](./ui-design.md)으로 화면과 상호작용을 맞춘다.
6. [재구현 가이드](./rebuild-guide.md)의 체크리스트로 누락 여부를 검수한다.

## 주요 소스 위치

- `src/domain/types.ts`: 공통 도메인 모델.
- `src/services`: API, OAuth, 스트리밍, 계정 저장소 인터페이스.
- `src/infra`: Mastodon/Misskey 구현체와 통합 클라이언트.
- `src/ui/state`: 앱 전역 상태와 토스트 상태.
- `src/ui/hooks`: 타임라인, 이모지, 이미지 줌, 외부 클릭 처리 훅.
- `src/ui/components`: 사용자 기능을 구성하는 React 컴포넌트.
- `src/ui/styles`: 레이아웃, 컴포넌트, 테마 CSS.
- `functions/api/preview.ts`: Cloudflare Pages Functions 링크 미리보기 API.
- `.github/workflows`: 테스트와 beta/production 배포 워크플로우.
