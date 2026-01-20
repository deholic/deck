import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SessionType = "focus" | "break" | "longBreak";

type PomodoroTimerProps = {
  focusMinutes?: number;
  breakMinutes?: number;
  longBreakMinutes?: number;
  targetCycles?: number;
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
  targetCycles = 4,
}: PomodoroTimerProps) => {
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

  // 완료된 세션 추적
  const [completedSessions, setCompletedSessions] = useState<Array<{session: number; type: SessionType}>>(() => {
    try {
      const stored = localStorage.getItem("textodon.pomodoro.completedSessions");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const sessionInfo = useMemo(() => getSessionInfo(session), [session, getSessionInfo]);

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

  return (
    <section
      className={`panel pomodoro-panel${isBlinking ? " blinking" : ""}`}
      onClick={handlePanelClick}
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
        <span className="pomodoro-time" aria-live="polite" aria-atomic="true">
          {formatTime(timeLeft)}
        </span>
        <div className="pomodoro-controls">
          <button
            type="button"
            className="pomodoro-button pomodoro-start"
            onClick={handleStart}
          >
            {isRunning ? "정지" : "시작"}
          </button>
          <button
            type="button"
            className="pomodoro-button pomodoro-reset"
            onClick={handleReset}
          >
            리셋
          </button>
        </div>
      </div>
      <div className="pomodoro-progress-dots">
        {renderProgressDots()}
      </div>
    </section>
  );
};
