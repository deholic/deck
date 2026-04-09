import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SessionType = "focus" | "break" | "longBreak";

type PomodoroTodoItem = {
  id: string;
  text: string;
  completed: boolean;
};

type PomodoroTimerProps = {
  focusMinutes?: number;
  breakMinutes?: number;
  longBreakMinutes?: number;
  onSessionTypeChange?: (type: SessionType) => void;
  onRunningChange?: (isRunning: boolean) => void;
  isTimelineItemSelected?: boolean;
  onRequestClearTimelineSelection?: () => void;
  onRequestSelectTimelineAtY?: (targetCenterY: number) => void;
};

// TOTAL_SESSIONS을 targetCycles에 따라 동적으로 계산

const getSessionLabel = (type: SessionType): string => {
  switch (type) {
    case "focus":
      return "집중";
    case "break":
      return "휴식";
    case "longBreak":
      return "긴 휴식";
  }
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

export const PomodoroTimer = ({
  focusMinutes = 25,
  breakMinutes = 5,
  longBreakMinutes = 30,
  onSessionTypeChange,
  onRunningChange,
  isTimelineItemSelected = false,
  onRequestClearTimelineSelection,
  onRequestSelectTimelineAtY,
}: PomodoroTimerProps) => {
  const targetCycles = 4; // 고정된 4사이클
  const focusDuration = focusMinutes * 60;
  const breakDuration = breakMinutes * 60;
  const longBreakDuration = longBreakMinutes * 60;

  const getSessionInfo = useCallback(
    (sess: number): { type: SessionType; duration: number } => {
      const totalSessions = targetCycles * 2;
      // 마지막 세션은 긴 휴식
      if (sess === totalSessions) {
        return { type: "longBreak", duration: longBreakDuration };
      }
      if (sess % 2 === 0) {
        return { type: "break", duration: breakDuration };
      }
      return { type: "focus", duration: focusDuration };
    },
    [focusDuration, breakDuration, longBreakDuration, targetCycles]
  );

  const [session, setSession] = useState(() => {
    try {
      const stored = localStorage.getItem("textodon.pomodoro.currentSession");
      return stored ? Number(stored) : 1;
    } catch {
      return 1;
    }
  });
  
  const [timeLeft, setTimeLeft] = useState(() => {
    try {
      const stored = localStorage.getItem("textodon.pomodoro.timeLeft");
      const savedSession = localStorage.getItem("textodon.pomodoro.currentSession");
      if (stored && savedSession) {
        return Number(stored);
      }
      return focusDuration;
    } catch {
      return focusDuration;
    }
  });
  
  const [isRunning, setIsRunning] = useState(() => {
    try {
      const stored = localStorage.getItem("textodon.pomodoro.isRunning");
      return stored === "true";
    } catch {
      return false;
    }
  });
  
  const [isBlinking, setIsBlinking] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const [todoInput, setTodoInput] = useState("");
  const [todoItems, setTodoItems] = useState<PomodoroTodoItem[]>(() => {
    try {
      const stored = localStorage.getItem("textodon.pomodoro.todos");
      if (!stored) {
        return [];
      }
      const parsed = JSON.parse(stored) as PomodoroTodoItem[];
      return parsed.map((item) => ({
        ...item,
        completed: item.completed ?? false,
      }));
    } catch {
      return [];
    }
  });

  // 완료된 세션 추적
  const [completedSessions, setCompletedSessions] = useState<Array<{session: number; type: SessionType}>>(() => {
    try {
      const stored = localStorage.getItem("textodon.pomodoro.completedSessions");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [draggingTodoId, setDraggingTodoId] = useState<string | null>(null);
  const [dragOverTodoId, setDragOverTodoId] = useState<string | null>(null);
  const todoListRef = useRef<HTMLDivElement | null>(null);
  const todoInputRef = useRef<HTMLInputElement | null>(null);

  const sessionInfo = useMemo(() => getSessionInfo(session), [session, getSessionInfo]);

  // 세션 타입 변경 시 부모 컴포넌트에 알림
  useEffect(() => {
    onSessionTypeChange?.(sessionInfo.type);
  }, [sessionInfo.type, onSessionTypeChange]);

  // 실행 상태 변경 시 부모 컴포넌트에 알림
  useEffect(() => {
    onRunningChange?.(isRunning);
  }, [isRunning, onRunningChange]);

  // 완료된 세션 localStorage 저장
  useEffect(() => {
    localStorage.setItem("textodon.pomodoro.completedSessions", JSON.stringify(completedSessions));
  }, [completedSessions]);

  // 현재 세션 상태 localStorage 저장
  useEffect(() => {
    localStorage.setItem("textodon.pomodoro.currentSession", String(session));
  }, [session]);

  useEffect(() => {
    localStorage.setItem("textodon.pomodoro.timeLeft", String(timeLeft));
  }, [timeLeft]);

  useEffect(() => {
    localStorage.setItem("textodon.pomodoro.isRunning", String(isRunning));
  }, [isRunning]);

  useEffect(() => {
    localStorage.setItem("textodon.pomodoro.todos", JSON.stringify(todoItems));
  }, [todoItems]);

  useEffect(() => {
    if (!selectedTodoId) {
      return;
    }
    if (!todoItems.some((item) => item.id === selectedTodoId)) {
      setSelectedTodoId(null);
    }
  }, [selectedTodoId, todoItems]);

  useEffect(() => {
    if (!editingTodoId) {
      return;
    }
    if (!todoItems.some((item) => item.id === editingTodoId)) {
      setEditingTodoId(null);
      setTodoInput("");
    }
  }, [editingTodoId, todoItems]);

  useEffect(() => {
    if (!isTimelineItemSelected) {
      return;
    }
    if (selectedTodoId) {
      setSelectedTodoId(null);
    }
    if (editingTodoId) {
      setEditingTodoId(null);
      setTodoInput("");
    }
  }, [editingTodoId, isTimelineItemSelected, selectedTodoId]);


  const playNotificationSound = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = 800;
      oscillator.type = "sine";
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);
    } catch {
      // AudioContext가 지원되지 않는 환경에서는 무시
    }
  }, []);

  const handleSessionToggle = useCallback(() => {
    const totalSessions = targetCycles * 2;
    const nextSession = session >= totalSessions ? 1 : session + 1;
    const nextInfo = getSessionInfo(nextSession);
    setSession(nextSession);
    setTimeLeft(nextInfo.duration);
    setIsRunning(false);
    setIsBlinking(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [session, getSessionInfo, targetCycles]);

  const handleStart = useCallback(() => {
    setIsBlinking(false);
    setIsRunning((prev) => !prev);
  }, []);

  const handleReset = useCallback(() => {
    setIsBlinking(false);
    setSession(1);
    setTimeLeft(focusDuration);
    setIsRunning(false);
    setCompletedSessions([]);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [focusDuration]);

  useEffect(() => {
    const isEditableElement = (element: Element | null) => {
      if (!element) {
        return false;
      }
      return (
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        (element as HTMLElement).isContentEditable
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      if (document.querySelector('[data-emoji-picker-open="true"]')) {
        return;
      }
      const hasOverlayBackdrop = document.querySelector(
        ".overlay-backdrop, .image-modal, .confirm-modal, .profile-modal, .status-modal, .settings-modal, .info-modal"
      );
      if (hasOverlayBackdrop) {
        return;
      }
      if (isEditableElement(document.activeElement)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (
        key === "s" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        !event.altKey
      ) {
        event.preventDefault();
        handleStart();
        return;
      }

      if (
        key === "x" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        !event.altKey
      ) {
        event.preventDefault();
        handleReset();
        return;
      }

      if (
        key === "f" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        !event.altKey
      ) {
        const input = todoInputRef.current;
        if (!input || input.disabled) {
          return;
        }
        event.preventDefault();
        input.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleReset, handleStart]);

  // 설정이 변경되면 현재 세션 시간 업데이트
  useEffect(() => {
    const info = getSessionInfo(session);
    setTimeLeft(info.duration);
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [focusDuration, breakDuration, longBreakDuration]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            playNotificationSound();
            setIsBlinking(true);
            
            const totalSessions = targetCycles * 2;
            
            // 현재 세션을 완료된 세션 목록에 추가
            setCompletedSessions((prev) => {
              const updated = [...prev, { session, type: sessionInfo.type }];
              // 중복 세션 제거 (동일 세션 번호가 있으면 기존 것 제거)
              const filtered = updated.filter((cs, index) => 
                updated.findIndex(item => item.session === cs.session) === index
              );
              
              // 한 사이클이 끝나면 점 초기화
              if (session === totalSessions) {
                return [];
              }
              
              return filtered;
            });
            
            const nextSession = session >= totalSessions ? 1 : session + 1;
            const nextInfo = getSessionInfo(nextSession);
            setSession(nextSession);
            setIsRunning(false);
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            return nextInfo.duration;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, session, playNotificationSound]);

  const focusCount = Math.ceil(session / 2);

  // 진행 상태 점 생성
  const renderProgressDots = useCallback(() => {
    const totalSessions = targetCycles * 2; // 각 사이클은 집중+휴식
    const dots = [];
    
    for (let i = 1; i <= totalSessions; i++) {
      const completedSession = completedSessions.find(cs => cs.session === i);
      const isCompleted = !!completedSession;
      const sessionType = completedSession?.type || getSessionInfo(i).type;
      
      let dotClass = "pomodoro-progress-dot";
      if (isCompleted) {
        if (sessionType === "focus") {
          dotClass += " completed-focus";
        } else if (sessionType === "break") {
          dotClass += " completed-break";
        } else if (sessionType === "longBreak") {
          dotClass += " completed-long-break";
        }
      } else {
        dotClass += " incomplete";
      }
      
      dots.push(
        <div
          key={i}
          className={dotClass}
          aria-label={`세션 ${i}${isCompleted ? ` (${getSessionLabel(sessionType)} 완료)` : ' (진행 전)'}`}
        />
      );
    }
    
    return dots;
  }, [completedSessions, targetCycles, getSessionInfo]);

  const handlePanelClick = useCallback(() => {
    if (isBlinking) {
      setIsBlinking(false);
    }
  }, [isBlinking]);

  const cancelTodoEditing = useCallback(() => {
    setEditingTodoId(null);
    setTodoInput("");
  }, []);

  const startTodoEditing = useCallback(
    (id: string) => {
      const targetItem = todoItems.find((item) => item.id === id);
      if (!targetItem) {
        return;
      }
      setEditingTodoId(id);
      setSelectedTodoId(id);
      setTodoInput(targetItem.text);
      onRequestClearTimelineSelection?.();
      window.setTimeout(() => {
        todoInputRef.current?.focus();
        todoInputRef.current?.select();
      }, 0);
    },
    [onRequestClearTimelineSelection, todoItems]
  );

  const handleSubmitTodo = useCallback(() => {
    const trimmed = todoInput.trim();
    if (!trimmed) {
      return;
    }
    if (editingTodoId) {
      setTodoItems((prev) =>
        prev.map((item) =>
          item.id === editingTodoId ? { ...item, text: trimmed } : item
        )
      );
      setEditingTodoId(null);
      setTodoInput("");
      return;
    }
    const nextItem: PomodoroTodoItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: trimmed,
      completed: false,
    };
    setTodoItems((prev) => [...prev, nextItem]);
    setTodoInput("");
  }, [editingTodoId, todoInput]);

  const handleToggleTodo = useCallback((id: string) => {
    setTodoItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  }, []);

  const handleRemoveTodo = useCallback(
    (id: string) => {
      setTodoItems((prev) => {
        const index = prev.findIndex((item) => item.id === id);
        if (index === -1) {
          return prev;
        }
        if (selectedTodoId === id) {
          const nextId = prev[index + 1]?.id ?? prev[index - 1]?.id ?? null;
          setSelectedTodoId(nextId);
        }
        if (editingTodoId === id) {
          setEditingTodoId(null);
          setTodoInput("");
        }
        return prev.filter((item) => item.id !== id);
      });
    },
    [editingTodoId, selectedTodoId]
  );

  const displayedTodos = useMemo(() => todoItems, [todoItems]);

  const moveTodoByIndex = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) {
      return;
    }
    setTodoItems((prev) => {
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= prev.length || toIndex >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [movedItem] = next.splice(fromIndex, 1);
      if (!movedItem) {
        return prev;
      }
      next.splice(toIndex, 0, movedItem);
      return next;
    });
  }, []);

  const moveTodoById = useCallback((draggedId: string, targetId: string) => {
    if (draggedId === targetId) {
      return;
    }
    const fromIndex = displayedTodos.findIndex((item) => item.id === draggedId);
    const toIndex = displayedTodos.findIndex((item) => item.id === targetId);
    if (fromIndex === -1 || toIndex === -1) {
      return;
    }
    moveTodoByIndex(fromIndex, toIndex);
  }, [displayedTodos, moveTodoByIndex]);

  const moveSelectedTodo = useCallback(
    (direction: "up" | "down") => {
      if (!selectedTodoId) {
        return false;
      }
      const currentIndex = displayedTodos.findIndex((item) => item.id === selectedTodoId);
      if (currentIndex === -1) {
        return false;
      }
      const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (nextIndex < 0 || nextIndex >= displayedTodos.length) {
        return false;
      }
      moveTodoByIndex(currentIndex, nextIndex);
      return true;
    },
    [displayedTodos, moveTodoByIndex, selectedTodoId]
  );

  const selectTodo = useCallback(
    (id: string) => {
      setSelectedTodoId(id);
      onRequestClearTimelineSelection?.();
    },
    [onRequestClearTimelineSelection]
  );

  const handleTodoItemClick = useCallback(
    (id: string) => {
      const isSameSelectedItem = selectedTodoId === id;

      if (editingTodoId === id) {
        cancelTodoEditing();
        setSelectedTodoId(null);
        todoListRef.current?.focus();
        return;
      }

      if (editingTodoId && editingTodoId !== id) {
        cancelTodoEditing();
      }

      if (isSameSelectedItem) {
        setSelectedTodoId(null);
        todoListRef.current?.focus();
        return;
      }

      selectTodo(id);
      todoListRef.current?.focus();
    },
    [cancelTodoEditing, editingTodoId, selectTodo, selectedTodoId]
  );

  const handleTodoItemDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, id: string) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest(".pomodoro-todo-checkbox, .pomodoro-todo-remove")
      ) {
        return;
      }
      startTodoEditing(id);
    },
    [startTodoEditing]
  );

  const handleTodoDragStart = useCallback(
    (event: React.DragEvent<HTMLDivElement>, id: string) => {
      setDraggingTodoId(id);
      setDragOverTodoId(id);
      setSelectedTodoId(id);
      onRequestClearTimelineSelection?.();
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", id);
    },
    [onRequestClearTimelineSelection]
  );

  const handleTodoDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>, id: string) => {
      if (!draggingTodoId) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (draggingTodoId !== id && dragOverTodoId !== id) {
        setDragOverTodoId(id);
      }
    },
    [dragOverTodoId, draggingTodoId]
  );

  const handleTodoDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>, targetId: string) => {
      event.preventDefault();
      const draggedId = draggingTodoId;
      if (!draggedId) {
        return;
      }
      moveTodoById(draggedId, targetId);
      setSelectedTodoId(draggedId);
      setDraggingTodoId(null);
      setDragOverTodoId(null);
    },
    [draggingTodoId, moveTodoById]
  );

  const handleTodoDragEnd = useCallback(() => {
    setDraggingTodoId(null);
    setDragOverTodoId(null);
  }, []);

  const handleTodoKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      const { key } = event;
      const lowerKey = key.length === 1 ? key.toLowerCase() : key;
      if (key === "Escape") {
        if (selectedTodoId) {
          event.preventDefault();
          setSelectedTodoId(null);
        }
        if (editingTodoId) {
          cancelTodoEditing();
        }
        return;
      }

      if (key === " " || key === "Spacebar") {
        if (!selectedTodoId) {
          return;
        }
        event.preventDefault();
        handleToggleTodo(selectedTodoId);
        return;
      }

      if (lowerKey === "d") {
        if (!selectedTodoId) {
          return;
        }
        event.preventDefault();
        handleRemoveTodo(selectedTodoId);
        return;
      }

      if (
        (key === "ArrowUp" || key === "ArrowDown") &&
        event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey
      ) {
        const moved = moveSelectedTodo(key === "ArrowUp" ? "up" : "down");
        if (moved) {
          event.preventDefault();
        }
        return;
      }

      if (key === "ArrowRight") {
        if (!selectedTodoId || !onRequestSelectTimelineAtY) {
          return;
        }
        const currentItem = todoListRef.current?.querySelector<HTMLElement>(
          `[data-todo-id="${selectedTodoId}"]`
        );
        if (!currentItem) {
          return;
        }
        const targetY = currentItem.getBoundingClientRect().top + currentItem.getBoundingClientRect().height / 2;
        event.preventDefault();
        onRequestSelectTimelineAtY(targetY);
        return;
      }
      if (key !== "ArrowUp" && key !== "ArrowDown") {
        return;
      }
      if (!selectedTodoId) {
        return;
      }
      const currentIndex = displayedTodos.findIndex((item) => item.id === selectedTodoId);
      if (currentIndex === -1) {
        return;
      }
      const nextIndex = key === "ArrowUp" ? currentIndex - 1 : currentIndex + 1;
      if (key === "ArrowDown" && nextIndex >= displayedTodos.length) {
        event.preventDefault();
        todoInputRef.current?.focus();
        return;
      }
      if (nextIndex < 0 || nextIndex >= displayedTodos.length) {
        return;
      }
      event.preventDefault();
      selectTodo(displayedTodos[nextIndex].id);
    },
    [cancelTodoEditing, displayedTodos, editingTodoId, handleRemoveTodo, handleToggleTodo, moveSelectedTodo, onRequestSelectTimelineAtY, selectTodo, selectedTodoId]
  );

  const handleTodoInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (editingTodoId) {
          cancelTodoEditing();
        }
        todoInputRef.current?.blur();
        return;
      }
      if (event.key !== "ArrowUp") {
        return;
      }
      if (displayedTodos.length === 0) {
        return;
      }
      event.preventDefault();
      const lastTodo = displayedTodos[displayedTodos.length - 1];
      if (!lastTodo) {
        return;
      }
      selectTodo(lastTodo.id);
      todoListRef.current?.focus();
    },
    [cancelTodoEditing, displayedTodos, editingTodoId, selectTodo]
  );

  return (
    <section
      className={`panel pomodoro-panel${isBlinking ? " blinking" : ""}`}
      onPointerDown={handlePanelClick}
    >
      <div className="pomodoro-row">
        <button
          type="button"
          className={`pomodoro-mode-toggle${sessionInfo.type === "break" ? " break" : ""}${sessionInfo.type === "longBreak" ? " long-break" : ""}`}
          onClick={handleSessionToggle}
          aria-label="다음 세션으로 전환"
        >
          {getSessionLabel(sessionInfo.type)} {sessionInfo.type === "focus" ? focusCount : ""}
        </button>
        
        <div className="pomodoro-timer-section">
          <span className="pomodoro-time" aria-live="polite" aria-atomic="true">
            {formatTime(timeLeft)}
          </span>
          <div className="pomodoro-progress-dots">
            {renderProgressDots()}
          </div>
        </div>
        
        <div className="pomodoro-controls">
          <button
            type="button"
            className="pomodoro-button pomodoro-start"
            onClick={handleStart}
            title="시작/정지 (S)"
          >
            {isRunning ? "정지" : "시작"}
          </button>
          <button
            type="button"
            className="pomodoro-button pomodoro-reset"
            onClick={handleReset}
            title="리셋 (X)"
          >
            리셋
          </button>
        </div>
      </div>
      <div className="compose-emoji-divider pomodoro-divider" />
      <fieldset className="pomodoro-todos" aria-label="뽀모도로 투두">
        {displayedTodos.length > 0 ? (
          <div
            className="pomodoro-todo-list"
            ref={todoListRef}
            role="listbox"
            aria-label="할 일 목록"
            tabIndex={displayedTodos.length > 0 ? 0 : -1}
            onKeyDownCapture={handleTodoKeyDown}
            title="↑/↓ 이동 · Alt+↑/↓ 순서 변경 · Space 완료 · D 삭제 · → 타임라인 이동 · ESC 선택 해제"
          >
            {displayedTodos.map((item) => (
              <div
                key={item.id}
                data-todo-id={item.id}
                className={`pomodoro-todo-item${item.completed ? " is-completed" : ""}${selectedTodoId === item.id ? " is-selected" : ""}${editingTodoId === item.id ? " is-editing" : ""}${draggingTodoId === item.id ? " is-dragging" : ""}${dragOverTodoId === item.id && draggingTodoId !== item.id ? " is-drag-over" : ""}`}
                role="option"
                aria-selected={selectedTodoId === item.id}
                tabIndex={-1}
                draggable
                onClick={() => handleTodoItemClick(item.id)}
                onDoubleClick={(event) => handleTodoItemDoubleClick(event, item.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleTodoItemClick(item.id);
                  }
                }}
                onDragStart={(event) => handleTodoDragStart(event, item.id)}
                onDragOver={(event) => handleTodoDragOver(event, item.id)}
                onDrop={(event) => handleTodoDrop(event, item.id)}
                onDragEnd={handleTodoDragEnd}
              >
                <input
                  type="checkbox"
                  className="pomodoro-todo-checkbox"
                  checked={item.completed}
                  onChange={() => handleToggleTodo(item.id)}
                  aria-label={`할 일 완료: ${item.text}`}
                />
                <span className="pomodoro-todo-text">{item.text}</span>
              <button
                type="button"
                className="pomodoro-todo-remove"
                aria-label={`할 일 삭제: ${item.text}`}
                onClick={() => handleRemoveTodo(item.id)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </div>
          ))}
          </div>
        ) : null}
        <form
          className="pomodoro-todo-input"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmitTodo();
          }}
        >
          <input
            type="text"
            ref={todoInputRef}
            value={todoInput}
            onChange={(event) => setTodoInput(event.target.value)}
            onKeyDown={handleTodoInputKeyDown}
            onFocus={() => {
              if (!editingTodoId) {
                setSelectedTodoId(null);
              }
            }}
            placeholder={editingTodoId ? "할 일 수정" : "할 일 추가"}
            aria-label="뽀모도로 투두 입력"
            title={editingTodoId ? "할 일 수정 · ESC 수정 취소" : "할 일 추가 (F) · ↑ 목록 이동 · ESC 포커스 해제"}
          />
          <button type="submit" aria-label={editingTodoId ? "투두 수정" : "투두 추가"}>
            {editingTodoId ? "수정" : "추가"}
          </button>
        </form>
      </fieldset>
    </section>
  );
};
