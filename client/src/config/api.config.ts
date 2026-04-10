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

// 요청마다 localStorage에서 JWT를 읽어 Authorization 헤더에 주입
// 서버 사이드(SSR)에서는 window가 없으므로 클라이언트에서만 실행
nestApi.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('planit-auth');
        if (raw) {
            const parsed = JSON.parse(raw) as { state?: { token?: string | null } };
            if (parsed.state?.token) {
                config.headers.Authorization = `Bearer ${parsed.state.token}`;
            }
        }
    }
    return config;
});
