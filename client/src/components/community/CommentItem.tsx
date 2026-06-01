'use client';
import { useState } from 'react';
import { Pencil, Trash2, Send, Flag } from 'lucide-react';
import Button from '@/components/common/Button';
import { Comment } from '@/types/community';
import { formatDateTime } from '@/utils/date';

interface CommentItemProps {
  comment: Comment;
  userNum: number | null;
  onDelete: () => void;
  onEdit: (commentNum: number, content: string) => Promise<void>;
  onReply: (() => void) | null;
  onReport: () => void;
  token: string | null;
}

export default function CommentItem({ comment, userNum, onDelete, onEdit, onReply, onReport, token }: CommentItemProps) {
  const isOwner = userNum !== null && comment.user.userNum === userNum;
  const isEdited = comment.updatedAt && comment.createdAt !== comment.updatedAt;

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!editText.trim() || editText.trim() === comment.content) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    await onEdit(comment.commentNum, editText.trim());
    setIsSaving(false);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditText(comment.content);
    setIsEditing(false);
  };

  return (
    <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl px-4 py-3.5 border border-[#2563EB]/20 dark:border-white/8 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-gray-700 dark:text-white/60">{comment.user.name}</span>
          {isEdited && (
            <span className="text-[10px] text-gray-400 dark:text-white/25 border border-gray-200 dark:border-white/10 rounded px-1 py-0.5 leading-none">
              수정됨
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400 dark:text-white/25">
            {formatDateTime(comment.createdAt)}
          </span>
          {/* 대댓글 버튼 — 최상위 댓글에만 표시 */}
          {onReply && token && (
            <button
              onClick={onReply}
              className="text-[11px] text-[#2563EB] dark:text-[#60A5FA] hover:text-[#1D4ED8] dark:hover:text-[#2563EB] transition-colors cursor-pointer font-semibold"
            >
              답글
            </button>
          )}
          {/* 신고 — 로그인 + 본인 댓글이 아닐 때 */}
          {token && !isOwner && !isEditing && (
            <button
              onClick={onReport}
              className="text-gray-300 hover:text-red-400 dark:text-white/20 dark:hover:text-red-400 transition-colors cursor-pointer"
              title="신고"
            >
              <Flag size={11} />
            </button>
          )}
          {isOwner && !isEditing && (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="text-[#0f172a]/20 hover:text-[#2563EB] dark:text-white/20 dark:hover:text-[#60A5FA] transition-colors cursor-pointer"
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={onDelete}
                className="text-gray-300 hover:text-red-400 dark:text-white/20 dark:hover:text-red-400 transition-colors cursor-pointer"
              >
                <Trash2 size={12} />
              </button>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm rounded-xl bg-gray-50 dark:bg-[#1c1c1e] border border-[#2563EB] dark:border-[#60A5FA]/40 text-[#0f172a] dark:text-white/90 outline-none focus:ring-2 focus:ring-[#2563EB]/30 dark:focus:ring-[#60A5FA]/20 transition-all resize-none leading-relaxed"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancel}>취소</Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleSave()}
              disabled={isSaving || !editText.trim()}
              className="flex items-center gap-1"
            >
              <Send size={11} />
              {isSaving ? '저장 중...' : '저장'}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed whitespace-pre-wrap">
          {comment.content}
        </p>
      )}
    </div>
  );
}
