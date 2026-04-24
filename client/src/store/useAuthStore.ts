import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  userNum: number | null;
  userEmail: string | null;
  userName: string | null;
  // sessionStorage 복원 완료 여부 — 복원 전엔 token이 null이라도 미로그인으로 판단하지 않음
  _hasHydrated: boolean;
  setAuth: (token: string) => void;
  clearAuth: () => void;
  _setHasHydrated: (v: boolean) => void;
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
      _hasHydrated: false,
      setAuth: (token) => {
        const decoded = decodeToken(token);
        if (!decoded) return;
        const { sub, email, name } = decoded;
        set({ token, userNum: sub, userEmail: email, userName: name });
      },
      clearAuth: () => set({ token: null, userNum: null, userEmail: null, userName: null }),
      _setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'planit-auth',
      // sessionStorage — 탭/브라우저 종료 시 자동 로그아웃, 새로고침은 유지
      storage: createJSONStorage(() => sessionStorage),
      // _hasHydrated는 런타임 전용 — sessionStorage에 저장하지 않음
      partialize: (state) => ({
        token: state.token,
        userNum: state.userNum,
        userEmail: state.userEmail,
        userName: state.userName,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.token && isTokenExpired(state.token)) {
          state.clearAuth();
        }
        state?._setHasHydrated(true);
      },
    },
  ),
);
