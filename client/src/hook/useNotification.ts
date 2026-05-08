'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/useAuthStore';

export interface Notification {
  id: string;
  type: 'comment' | 'like';
  communityNum: number;
  communityTitle: string;
  actorName: string;
  createdAt: Date;
  read: boolean;
}

const NEST_URL = process.env.NEXT_PUBLIC_NEST_URL || 'http://localhost:3001';

export function useNotification() {
  const token = useAuthStore((s) => s.token);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const socketRef = useRef<Socket | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  useEffect(() => {
    if (!token) return;

    const socket = io(`${NEST_URL}/notification`, {
      auth: { token },
      // 재연결 무한 시도 방지 — 토큰 만료 시 계속 연결 시도하는 낭비 차단
      reconnectionAttempts: 3,
    });
    socketRef.current = socket;

    socket.on('notification', (payload: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
      const newNotification: Notification = {
        ...payload,
        id: `${Date.now()}-${Math.random()}`,
        createdAt: new Date(),
        read: false,
      };
      setNotifications((prev) => [newNotification, ...prev].slice(0, 30));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  return { notifications, unreadCount, markAllRead, dismiss, clearAll };
}
