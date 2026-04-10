import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
    console.error("JWT Decoding Error:", error);
    return null;
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      userNum: null,
      userEmail: null,
      userName: null,
      setAuth: (token) => {
        const { sub, email, name } = decodeToken(token);
        set({ token, userNum: sub, userEmail: email, userName: name });
      },
      clearAuth: () => set({ token: null, userNum: null, userEmail: null }),
    }),
    { name: 'planit-auth' },
  ),
);
