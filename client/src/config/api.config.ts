import axios from "axios";

export const aiApi = axios.create({
    baseURL: process.env.NEXT_FASTAPI_URL ?? 'http://localhost:8000',
    // withCredentials: true,
    headers: {
        'Content-Type' : 'application/json'
    }
})

export const nestApi = axios.create({
    baseURL: process.env.NEXT_NEST_URL ?? 'http://localhost:3001',
    withCredentials: true,
    headers: {
        'Content-Type' : 'application/json'
    }
})