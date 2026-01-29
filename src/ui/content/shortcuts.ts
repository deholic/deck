export const shortcutSections: Array<{
  title: string;
  note?: string;
  items: Array<{ keys: string; description: string }>;
}> = [
  {
    title: "타임라인 이동",
    items: [
      { keys: "M", description: "선택이 없을 때 왼쪽 첫 글을 선택" },
      { keys: "↑ / ↓", description: "선택된 글 위아래 이동" },
      { keys: "← / →", description: "이웃 컬럼으로 이동" },
      { keys: "ESC", description: "선택 해제" }
    ]
  },
  {
    title: "선택된 글 컨트롤",
    note: "글을 선택한 상태에서만 동작합니다.",
    items: [
      { keys: "R", description: "답글 작성" },
      { keys: "B", description: "부스트" },
      { keys: "L", description: "좋아요 (마스토돈) / ❤️ 리액션 (미스키)" },
      { keys: "C", description: "리액션 팔레트 열기 (미스키)" },
      { keys: "I", description: "첨부 이미지 열기" },
      { keys: "Enter", description: "글 팝업 열기 (열린 메뉴에서는 항목 선택)" },
      { keys: "P", description: "작성자 프로필 팝업 열기" },
      { keys: "A", description: "계정 선택 열기" },
      { keys: "T", description: "타임라인 메뉴 열기" },
      { keys: "M", description: "컬럼 메뉴 열기" },
      { keys: "G", description: "알림 열기" },
      { keys: "↑ / ↓", description: "열린 메뉴에서 항목 이동" },
      { keys: "ESC", description: "열린 메뉴 닫기" }
    ]
  },
  {
    title: "글쓰기",
    note: "글쓰기 영역 기준으로 동작합니다.",
    items: [
      { keys: "N", description: "글쓰기 입력으로 이동" },
      { keys: "Ctrl+Shift+N", description: "글쓰기 입력으로 이동 (포커스 중)" },
      { keys: "Ctrl+Shift+W", description: "내용 경고 토글" },
      { keys: "Ctrl+Shift+A", description: "계정 선택 열기" },
      { keys: "Ctrl+Shift+O", description: "공개 범위 선택" },
      { keys: "Ctrl+Shift+I", description: "미디어 첨부" },
      { keys: "Ctrl+Shift+E", description: "이모지 패널 토글" },
      { keys: "Ctrl/Command+Enter", description: "글 올리기" },
      { keys: "ESC", description: "글쓰기 입력 포커스 해제" }
    ]
  },
  {
    title: "이모지 추천",
    note: "추천 목록이 열려 있을 때만 동작합니다.",
    items: [
      { keys: "↑ / ↓", description: "추천 항목 이동" },
      { keys: "Enter", description: "추천 이모지 입력" },
      { keys: "ESC", description: "추천 닫기" }
    ]
  },
  {
    title: "이모지 패널/리액션",
    note: "이모지 선택 팝오버가 열려 있을 때만 동작합니다.",
    items: [
      { keys: "↑ / ↓", description: "이모지/카테고리 이동" },
      { keys: "← / →", description: "카테고리 접기/펼치기" },
      { keys: "Enter", description: "선택된 이모지 입력/리액션" },
      { keys: "ESC", description: "이모지 선택 닫기" }
    ]
  },
  {
    title: "뽀모도로 타이머",
    items: [
      { keys: "S", description: "뽀모도로 타이머 시작/정지" },
      { keys: "X", description: "뽀모도로 타이머 리셋" },
      { keys: "F", description: "할 일 추가 입력으로 이동" }
    ]
  },
  {
    title: "이미지 뷰어",
    items: [
      { keys: "← / →", description: "이미지 이동" },
      { keys: "ESC", description: "이미지 보기 닫기" }
    ]
  }
];
