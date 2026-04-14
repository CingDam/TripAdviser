import axios from "axios";

export const aiApi = axios.create({
    baseURL: process.env.NEXT_FASTAPI_URL ?? 'http://localhost:8000',
    headers: {
        'Content-Type': 'application/json'
    }
});

export const nestApi = axios.create({
    baseURL: (process.env.NEXT_NEST_URL ?? 'http://localhost:3001') + '/api',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json'
    }
});

// 요청마다 sessionStorage에서 JWT를 읽어 Authorization 헤더에 주입
// 서버 사이드(SSR)에서는 window가 없으므로 클라이언트에서만 실행
// sessionStorage 사용 — auth store와 동일한 스토리지 (탭 종료 시 자동 로그아웃)
nestApi.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const raw = sessionStorage.getItem('planit-auth');
        if (raw) {
            const parsed = JSON.parse(raw) as { state?: { token?: string | null } };
            if (parsed.state?.token) {
                config.headers.Authorization = `Bearer ${parsed.state.token}`;
            }
        }
    }
    return config;
});
