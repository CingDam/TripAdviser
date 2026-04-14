import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  userNum: number | null;
  userEmail: string | null;
  userName: string | null;
  setAuth: (token: string) => void;
  clearAuth: () => void;
}

function decodeToken(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');

    // 서버/브라우저 환경 모두 대응
    const binString = typeof window !== 'undefined'
      ? window.atob(base64)
      : Buffer.from(base64, 'base64').toString('binary');

    const bytes = Uint8Array.from(binString, (m) => m.codePointAt(0)!);
    const decoder = new TextDecoder('utf-8');
    return JSON.parse(decoder.decode(bytes));
  } catch (error) {
    console.error('JWT 디코딩 실패:', error);
    return null;
  }
}

// JWT exp 필드(Unix 초 단위)와 현재 시각 비교 — 만료됐으면 true
function isTokenExpired(token: string): boolean {
  const decoded = decodeToken(token);
  if (!decoded?.exp) return false;
  return decoded.exp * 1000 < Date.now();
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      userNum: null,
      userEmail: null,
      userName: null,
      setAuth: (token) => {
        const decoded = decodeToken(token);
        if (!decoded) return;
        const { sub, email, name } = decoded;
        set({ token, userNum: sub, userEmail: email, userName: name });
      },
      // userName도 함께 초기화
      clearAuth: () => set({ token: null, userNum: null, userEmail: null, userName: null }),
    }),
    {
      name: 'planit-auth',
      // sessionStorage — 탭/브라우저 종료 시 자동 로그아웃, 새로고침은 유지
      storage: createJSONStorage(() => sessionStorage),
      // 복원 시 토큰 만료 여부 검사 — 만료됐으면 자동 로그아웃
      onRehydrateStorage: () => (state) => {
        if (state?.token && isTokenExpired(state.token)) {
          state.clearAuth();
        }
      },
    },
  ),
);
