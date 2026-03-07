import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const TRIAL_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TRIAL_MS = TRIAL_DAYS * MS_PER_DAY;

export type TrialStatus =
  | {
      active: true;
      firstRunAtMs: number;
      expiresAtMs: number;
      remainingMs: number;
      reason?: undefined;
    }
  | {
      active: false;
      firstRunAtMs: number;
      expiresAtMs: number;
      remainingMs: 0;
      reason: string;
    };

type TrialState = {
  firstRunAtMs: number | null;
  lastSeenAtMs: number | null;
  setFirstRunAtMs: (ms: number) => void;
  setLastSeenAtMs: (ms: number) => void;
  /**
   * 初始化试用计时：
   * - 首次启动写入 firstRunAtMs
   * - 每次启动更新 lastSeenAtMs（用于简单防调时）
   */
  init: (nowMs?: number) => TrialStatus;
  getStatus: (nowMs?: number) => TrialStatus;
};

function computeStatus(state: Pick<TrialState, 'firstRunAtMs' | 'lastSeenAtMs'>, nowMs: number): TrialStatus {
  const first = state.firstRunAtMs ?? nowMs;
  const expiresAtMs = first + TRIAL_MS;

  // 简单防调时：如果系统时间明显回拨（超过 6 小时），直接判定到期
  const last = state.lastSeenAtMs;
  if (typeof last === 'number' && nowMs + 6 * 60 * 60 * 1000 < last) {
    return {
      active: false,
      firstRunAtMs: first,
      expiresAtMs,
      remainingMs: 0,
      reason: '检测到系统时间回拨，试用已失效，请输入开门密钥',
    };
  }

  const remainingMs = expiresAtMs - nowMs;
  if (remainingMs > 0) {
    return {
      active: true,
      firstRunAtMs: first,
      expiresAtMs,
      remainingMs,
    };
  }

  return {
    active: false,
    firstRunAtMs: first,
    expiresAtMs,
    remainingMs: 0,
    reason: '3 天试用已到期，请输入开门密钥',
  };
}

export const useTrialStore = create<TrialState>()(
  persist(
    (set, get) => ({
      firstRunAtMs: null,
      lastSeenAtMs: null,
      setFirstRunAtMs: (ms) => set({ firstRunAtMs: ms }),
      setLastSeenAtMs: (ms) => set({ lastSeenAtMs: ms }),
      init: (nowMs = Date.now()) => {
        const { firstRunAtMs, lastSeenAtMs } = get();
        const hasFirst = typeof firstRunAtMs === 'number' && firstRunAtMs > 0;
        const first = hasFirst ? firstRunAtMs! : nowMs;
        if (!hasFirst) set({ firstRunAtMs: first });

        // 更新 lastSeenAtMs
        set({ lastSeenAtMs: nowMs });
        return computeStatus({ firstRunAtMs: first, lastSeenAtMs }, nowMs);
      },
      getStatus: (nowMs = Date.now()) => {
        const { firstRunAtMs, lastSeenAtMs } = get();
        return computeStatus({ firstRunAtMs, lastSeenAtMs }, nowMs);
      },
    }),
    {
      name: 'manguo-trial',
      version: 1,
      partialize: (s) => ({ firstRunAtMs: s.firstRunAtMs, lastSeenAtMs: s.lastSeenAtMs }),
    }
  )
);

export function formatRemaining(remainingMs: number) {
  if (remainingMs <= 0) return '已到期';
  const totalMinutes = Math.ceil(remainingMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes - days * 60 * 24) / 60);
  const minutes = totalMinutes - days * 60 * 24 - hours * 60;
  if (days > 0) return `${days} 天 ${hours} 小时`;
  if (hours > 0) return `${hours} 小时 ${minutes} 分钟`;
  return `${minutes} 分钟`;
}

