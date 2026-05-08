'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Eye, Heart, MapPin, Trash2, Pencil,
  MessageSquare, Send, X, ChevronRight,
  CalendarDays, Copy,
} from 'lucide-react';
import { nestApi } from '@/config/api.config';
import { useAuthStore } from '@/store/useAuthStore';
import { useSnackbar } from '@/components/common/SnackbarProvider';
import Button from '@/components/common/Button';

interface PostImage {
  imageNum: number;
  imageUrl: string;
}

// 게시글에 첨부된 일정 — 일자별 장소까지 펼침 표시용
interface AttachedDayPlan {
  dayPlanNum: number;
  planDate: string;
  sortOrder: number;
  locationName: string | null;
  address: string | null;
}

interface AttachedPlan {
  planNum: number;
  planName: string;
  startDate: string | null;
  endDate: string | null;
  city: { cityName: string; country: string } | null;
  dayPlans: AttachedDayPlan[];
}

interface Post {
  communityNum: number;
  title: string;
  content: string;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  user: { userNum: number; name: string };
  city: { cityName: string; country: string } | null;
  images: PostImage[];
  plan: AttachedPlan | null;
}

interface Comment {
  commentNum: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: { userNum: number; name: string };
  replies: Comment[];
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface Props {
  id: number;
}

export default function CommunityDetailClient({ id }: Props) {
  const router = useRouter();
  const { show } = useSnackbar();
  const { token, userNum } = useAuthStore();

  const [post, setPost] = useState<Post | null>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 게시글 수정 모달
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  // 삭제 확인 상태
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmDeleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 댓글 입력
  const [commentText, setCommentText] = useState('');
  // 대댓글 입력 — 부모 commentNum을 키로 사용
  const [replyTarget, setReplyTarget] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false);

  // 대댓글 펼침 상태 — 기본 접힘, Set에 있으면 펼쳐진 상태
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());

  const toggleReplies = (commentNum: number) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(commentNum)) next.delete(commentNum);
      else next.add(commentNum);
      return next;
    });
  };

  useEffect(() => {
    void loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [postRes, likeRes, commentRes] = await Promise.all([
        nestApi.get<Post>(`/community/${id}`),
        nestApi.get<{ count: number }>(`/community/${id}/like`),
        nestApi.get<Comment[]>(`/community/${id}/comments`),
      ]);
      setPost(postRes.data);
      setLikeCount(likeRes.data.count);
      setComments(commentRes.data);
    } catch {
      show('게시글을 불러오지 못했습니다', 'error');
      router.replace('/community');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = async () => {
    if (!token) {
      show('로그인이 필요합니다', 'warning');
      return;
    }
    try {
      const res = await nestApi.post<{ liked: boolean }>(`/community/${id}/like`);
      setLiked(res.data.liked);
      setLikeCount((prev) => (res.data.liked ? prev + 1 : prev - 1));
    } catch {
      show('오류가 발생했습니다', 'error');
    }
  };

  const openEdit = () => {
    if (!post) return;
    setEditTitle(post.title);
    setEditContent(post.content);
    setIsEditOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editTitle.trim() || !editContent.trim()) {
      show('제목과 내용을 입력해주세요', 'warning');
      return;
    }
    setIsEditSubmitting(true);
    try {
      const res = await nestApi.patch<Post>(`/community/${id}`, {
        title: editTitle.trim(),
        content: editContent.trim(),
      });
      setPost(res.data);
      setIsEditOpen(false);
      show('수정되었습니다', 'success');
    } catch {
      show('수정에 실패했습니다', 'error');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleDeleteClick = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      // 3초 후 확인 상태 자동 해제
      confirmDeleteTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    if (confirmDeleteTimerRef.current) clearTimeout(confirmDeleteTimerRef.current);
    void handleDeleteConfirm();
  };

  const handleDeleteConfirm = async () => {
    try {
      await nestApi.delete(`/community/${id}`);
      show('게시글이 삭제되었습니다', 'info');
      router.replace('/community');
    } catch {
      show('삭제에 실패했습니다', 'error');
      setConfirmDelete(false);
    }
  };

  const handleCommentSubmit = async () => {
    if (!commentText.trim()) return;
    setIsCommentSubmitting(true);
    try {
      await nestApi.post(`/community/${id}/comments`, { content: commentText.trim() });
      setCommentText('');
      const res = await nestApi.get<Comment[]>(`/community/${id}/comments`);
      setComments(res.data);
    } catch {
      show('댓글 등록에 실패했습니다', 'error');
    } finally {
      setIsCommentSubmitting(false);
    }
  };

  const handleReplySubmit = async (parentCommentNum: number) => {
    if (!replyText.trim()) return;
    setIsCommentSubmitting(true);
    try {
      await nestApi.post(`/community/${id}/comments`, {
        content: replyText.trim(),
        parentCommentNum,
      });
      setReplyText('');
      setReplyTarget(null);
      const res = await nestApi.get<Comment[]>(`/community/${id}/comments`);
      setComments(res.data);
      // 방금 등록한 댓글의 대댓글이 보이도록 자동 펼침
      setExpandedReplies((prev) => new Set(prev).add(parentCommentNum));
    } catch {
      show('대댓글 등록에 실패했습니다', 'error');
    } finally {
      setIsCommentSubmitting(false);
    }
  };

  const handleCommentEdit = async (commentNum: number, content: string) => {
    try {
      await nestApi.patch(`/community/${id}/comments/${commentNum}`, { content });
      const res = await nestApi.get<Comment[]>(`/community/${id}/comments`);
      setComments(res.data);
    } catch {
      show('댓글 수정에 실패했습니다', 'error');
    }
  };

  const handleCommentDelete = async (commentNum: number) => {
    try {
      await nestApi.delete(`/community/${id}/comments/${commentNum}`);
      const res = await nestApi.get<Comment[]>(`/community/${id}/comments`);
      setComments(res.data);
    } catch {
      show('댓글 삭제에 실패했습니다', 'error');
    }
  };

  // 첨부된 일정을 내 일정으로 복제 후 새로 만든 plan 페이지로 이동
  const [isCloning, setIsCloning] = useState(false);
  const handleClonePlan = async () => {
    if (!token) {
      show('로그인이 필요합니다', 'warning');
      return;
    }
    setIsCloning(true);
    try {
      const res = await nestApi.post<{ planNum: number }>(`/community/${id}/clone-plan`);
      show('내 일정으로 복사했습니다', 'success');
      // 복사된 일정은 마이페이지의 일정 상세에서 확인·편집 가능
      router.push(`/mypage/${res.data.planNum}`);
    } catch {
      show('일정 가져오기에 실패했습니다', 'error');
    } finally {
      setIsCloning(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-white dark:bg-[#1c1c1e]">
        <div className="max-w-3xl mx-auto px-4 py-12 flex flex-col gap-6">
          <div className="skeleton h-8 w-24 rounded-xl" />
          <div className="bg-white dark:bg-[#2c2c2e] rounded-3xl p-8 flex flex-col gap-4 border border-[#2563EB]/20 dark:border-white/8">
            <div className="skeleton h-6 w-2/3 rounded-full" />
            <div className="skeleton h-4 w-1/3 rounded-full" />
            <div className="flex flex-col gap-2 mt-4">
              <div className="skeleton h-4 w-full rounded-full" />
              <div className="skeleton h-4 w-full rounded-full" />
              <div className="skeleton h-4 w-3/4 rounded-full" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!post) return null;

  const isOwner = userNum !== null && post.user.userNum === userNum;
  const totalComments = comments.reduce((acc, c) => acc + 1 + c.replies.length, 0);

  return (
    <main className="min-h-screen bg-white dark:bg-[#1c1c1e]">
      <div className="max-w-3xl mx-auto px-4 py-12 flex flex-col gap-6">

        {/* 뒤로가기 */}
        <button
          onClick={() => router.push('/community')}
          className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-white/30 hover:text-gray-700 dark:hover:text-white/70 transition-colors w-fit cursor-pointer"
        >
          <ArrowLeft size={15} />
          목록으로
        </button>

        {/* 게시글 본문 */}
        <article className="bg-white dark:bg-[#2c2c2e] rounded-3xl p-8 border border-[#2563EB]/20 dark:border-white/8 shadow-sm flex flex-col gap-5">
          {/* 도시 태그 */}
          {post.city && (
            <span className="flex items-center gap-1 text-xs text-[#2563EB] dark:text-[#60A5FA] font-semibold w-fit">
              <MapPin size={11} />
              {post.city.cityName} · {post.city.country}
            </span>
          )}

          {/* 제목 */}
          <h1 className="text-xl font-bold text-gray-900 dark:text-white/90 leading-snug">
            {post.title}
          </h1>

          {/* 작성자·날짜·조회수 */}
          <div className="flex items-center justify-between pb-5 border-b border-gray-100 dark:border-white/8">
            <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-white/35">
              <span className="font-semibold text-gray-600 dark:text-white/60">{post.user.name}</span>
              <span>·</span>
              <span>{formatDate(post.createdAt)}</span>
            </div>
            <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-white/30">
              <Eye size={12} />
              {post.viewCount}
            </span>
          </div>

          {/* 본문 */}
          <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed whitespace-pre-wrap">
            {post.content}
          </p>

          {/* 첨부된 일정 카드 */}
          {post.plan && (
            <AttachedPlanCard
              plan={post.plan}
              isOwnPost={isOwner}
              isCloning={isCloning}
              onClone={() => void handleClonePlan()}
            />
          )}

          {/* 첨부 이미지 */}
          {post.images && post.images.length > 0 && (
            <div className="flex flex-col gap-3 pt-2">
              {post.images.map((img) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={img.imageNum}
                  src={img.imageUrl}
                  alt="첨부 이미지"
                  className="w-full rounded-2xl object-cover border border-[#2563EB]/20 dark:border-white/8"
                />
              ))}
            </div>
          )}

          {/* 좋아요 + 수정/삭제 버튼 */}
          <div className="flex items-center justify-between pt-5 border-t border-gray-100 dark:border-white/8">
            {/* 좋아요 버튼 */}
            <button
              onClick={() => void handleLike()}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold transition-all cursor-pointer border
                ${liked
                  ? 'border-[#2563EB] text-[#2563EB] bg-[#2563EB]/10 dark:border-[#60A5FA]/50 dark:text-[#60A5FA] dark:bg-[#60A5FA]/10'
                  : 'border-[#DBEAFE] text-[#0f172a]/40 hover:border-[#2563EB] hover:text-[#2563EB] dark:border-white/8 dark:text-white/30 dark:hover:border-[#60A5FA]/40 dark:hover:text-[#60A5FA]'
                }`}
            >
              <Heart size={14} className={liked ? 'fill-current' : ''} />
              <span>{likeCount}</span>
            </button>

            {/* 수정/삭제 — 작성자만 표시 */}
            {isOwner && (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={openEdit} className="flex items-center gap-1">
                  <Pencil size={12} />
                  수정
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDeleteClick}
                  className={`flex items-center gap-1 transition-all ${
                    confirmDelete
                      ? 'border-red-400 dark:border-red-500/60 text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10'
                      : ''
                  }`}
                >
                  <Trash2 size={12} />
                  {confirmDelete ? '확인' : '삭제'}
                </Button>
              </div>
            )}
          </div>
        </article>

        {/* 댓글 섹션 */}
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white/90 flex items-center gap-2">
            <MessageSquare size={15} />
            댓글
            <span className="text-gray-400 dark:text-white/30 font-normal">{totalComments}</span>
          </h2>

          {/* 댓글 목록 */}
          <div className="flex flex-col gap-3">
            {comments.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-white/25 text-center py-8">
                첫 번째 댓글을 남겨보세요
              </p>
            )}

            {comments.map((comment) => (
              <div key={comment.commentNum} className="flex flex-col gap-2">
                {/* 댓글 */}
                <CommentItem
                  comment={comment}
                  userNum={userNum}
                  onDelete={() => void handleCommentDelete(comment.commentNum)}
                  onEdit={handleCommentEdit}
                  onReply={() => {
                    setReplyTarget(replyTarget === comment.commentNum ? null : comment.commentNum);
                    setReplyText('');
                  }}
                  token={token}
                />

                {/* 대댓글 더보기 버튼 */}
                {comment.replies.length > 0 && (
                  <button
                    onClick={() => toggleReplies(comment.commentNum)}
                    className="ml-8 flex items-center gap-1 text-xs text-[#2563EB] dark:text-[#60A5FA] font-semibold hover:text-[#1D4ED8] dark:hover:text-[#2563EB] transition-colors w-fit cursor-pointer"
                  >
                    <ChevronRight
                      size={13}
                      className={`transition-transform duration-200 ${expandedReplies.has(comment.commentNum) ? 'rotate-90' : ''}`}
                    />
                    {expandedReplies.has(comment.commentNum)
                      ? '답글 접기'
                      : `답글 ${comment.replies.length}개 보기`}
                  </button>
                )}

                {/* 대댓글 목록 — 펼쳐진 상태에서만 표시 */}
                {expandedReplies.has(comment.commentNum) && comment.replies.map((reply) => (
                  <div key={reply.commentNum} className="ml-8 flex items-start gap-2">
                    <ChevronRight size={12} className="text-gray-300 dark:text-white/20 mt-3.5 flex-shrink-0" />
                    <div className="flex-1">
                      <CommentItem
                        comment={reply}
                        userNum={userNum}
                        onDelete={() => void handleCommentDelete(reply.commentNum)}
                        onEdit={handleCommentEdit}
                        onReply={null}
                        token={token}
                      />
                    </div>
                  </div>
                ))}

                {/* 대댓글 입력창 */}
                {replyTarget === comment.commentNum && token && (
                  <div className="ml-8 flex items-start gap-2">
                    <ChevronRight size={12} className="text-gray-300 dark:text-white/20 mt-3.5 flex-shrink-0" />
                    <div className="flex-1 flex gap-2">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="대댓글을 입력하세요"
                        rows={2}
                        className="flex-1 px-3 py-2 text-sm rounded-xl bg-white dark:bg-[#2c2c2e] border border-[#DBEAFE] dark:border-white/8 text-gray-900 dark:text-white/90 placeholder:text-gray-400 dark:placeholder:text-white/30 outline-none focus:ring-2 focus:ring-[#2563EB]/30 dark:focus:ring-[#60A5FA]/20 focus:border-[#2563EB] transition-all resize-none"
                      />
                      <div className="flex flex-col gap-1.5">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => void handleReplySubmit(comment.commentNum)}
                          disabled={isCommentSubmitting || !replyText.trim()}
                          className="flex items-center gap-1"
                        >
                          <Send size={11} />
                          등록
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setReplyTarget(null); setReplyText(''); }}
                        >
                          취소
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 댓글 입력 */}
          {token ? (
            <div className="flex gap-3 items-start">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="댓글을 입력하세요"
                rows={3}
                className="flex-1 px-4 py-3 text-sm rounded-2xl bg-white dark:bg-[#2c2c2e] border border-[#DBEAFE] dark:border-white/8 text-gray-900 dark:text-white/90 placeholder:text-gray-400 dark:placeholder:text-white/30 outline-none focus:ring-2 focus:ring-[#2563EB]/30 dark:focus:ring-[#60A5FA]/20 focus:border-[#2563EB] transition-all resize-none"
              />
              <Button
                variant="primary"
                onClick={() => void handleCommentSubmit()}
                disabled={isCommentSubmitting || !commentText.trim()}
                className="flex items-center gap-1.5 flex-shrink-0"
              >
                <Send size={13} />
                등록
              </Button>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl border border-[#2563EB]/20 dark:border-white/8 px-5 py-4 text-sm text-gray-400 dark:text-white/30 text-center">
              댓글을 작성하려면{' '}
              <button
                onClick={() => router.push('/login')}
                className="text-[#2563EB] dark:text-[#60A5FA] font-semibold hover:underline cursor-pointer"
              >
                로그인
              </button>
              이 필요합니다
            </div>
          )}
        </section>
      </div>

      {/* 수정 모달 */}
      {isEditOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setIsEditOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg bg-white dark:bg-[#2c2c2e] rounded-3xl shadow-2xl p-6 flex flex-col gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 dark:text-white/90">게시글 수정</h2>
              <button
                onClick={() => setIsEditOpen(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-white/30 dark:hover:text-white/70 dark:hover:bg-white/8 transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500 dark:text-white/40">제목</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={100}
                className="w-full px-4 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-[#1c1c1e] border border-[#DBEAFE] dark:border-white/8 text-gray-900 dark:text-white/90 placeholder:text-gray-400 dark:placeholder:text-white/30 outline-none focus:ring-2 focus:ring-[#2563EB]/30 dark:focus:ring-[#60A5FA]/20 focus:border-[#2563EB] transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500 dark:text-white/40">내용</label>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={6}
                className="w-full px-4 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-[#1c1c1e] border border-[#DBEAFE] dark:border-white/8 text-gray-900 dark:text-white/90 placeholder:text-gray-400 dark:placeholder:text-white/30 outline-none focus:ring-2 focus:ring-[#2563EB]/30 dark:focus:ring-[#60A5FA]/20 focus:border-[#2563EB] transition-all resize-none leading-relaxed"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsEditOpen(false)}>취소</Button>
              <Button variant="primary" onClick={() => void handleEditSubmit()} disabled={isEditSubmitting}>
                {isEditSubmitting ? '수정 중...' : '저장'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ── 댓글 아이템 컴포넌트 ─────────────────────────────────────────────

interface CommentItemProps {
  comment: Comment;
  userNum: number | null;
  onDelete: () => void;
  onEdit: (commentNum: number, content: string) => Promise<void>;
  onReply: (() => void) | null;
  token: string | null;
}

function CommentItem({ comment, userNum, onDelete, onEdit, onReply, token }: CommentItemProps) {
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
            {formatDate(comment.createdAt)}
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

// ── 첨부된 일정 카드 ─────────────────────────────────────────────

interface AttachedPlanCardProps {
  plan: AttachedPlan;
  isOwnPost: boolean;
  isCloning: boolean;
  onClone: () => void;
}

// 일자별 dayPlans를 planDate 기준으로 그룹화 — Map으로 순서 보장
function groupByDate(dayPlans: AttachedDayPlan[]): Map<string, AttachedDayPlan[]> {
  const map = new Map<string, AttachedDayPlan[]>();
  for (const dp of dayPlans) {
    const arr = map.get(dp.planDate) ?? [];
    arr.push(dp);
    map.set(dp.planDate, arr);
  }
  return map;
}

function formatPlanPeriod(start: string | null, end: string | null): string {
  if (!start || !end) return '';
  // 같은 달이면 '5.1 ~ 5.4', 다른 달이면 '4.30 ~ 5.4' — 짧고 가독성 좋게
  const [, sm, sd] = start.split('-');
  const [, em, ed] = end.split('-');
  const left = `${Number(sm)}.${Number(sd)}`;
  const right = sm === em ? `${Number(ed)}` : `${Number(em)}.${Number(ed)}`;
  return `${left} ~ ${right}`;
}

function AttachedPlanCard({ plan, isOwnPost, isCloning, onClone }: AttachedPlanCardProps) {
  const grouped = groupByDate(plan.dayPlans);
  const dates = Array.from(grouped.keys());
  const totalPlaces = plan.dayPlans.length;
  const period = formatPlanPeriod(plan.startDate, plan.endDate);

  // 모든 일자를 기본 펼친 상태로 시작 — 사용자 결정에 따라 1번 옵션이 일자별 펼침이라 처음부터 보여줌
  const [expanded, setExpanded] = useState<Set<string>>(new Set(dates));

  const toggle = (date: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  return (
    <div className="rounded-2xl border border-[#2563EB]/30 dark:border-[#60A5FA]/20 bg-[#EFF6FF]/60 dark:bg-[#252527] flex flex-col">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[#DBEAFE] dark:border-white/8">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#2563EB] dark:text-[#60A5FA]">
            <CalendarDays size={12} />
            첨부된 일정
          </span>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white/90 truncate">
            {plan.planName}
          </h3>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-white/40">
            {plan.city && <span>{plan.city.cityName} · {plan.city.country}</span>}
            {period && plan.city && <span className="text-gray-300 dark:text-white/15">·</span>}
            {period && <span>{period}</span>}
            <span className="text-gray-300 dark:text-white/15">·</span>
            <span>장소 {totalPlaces}개</span>
          </div>
        </div>
        {/* 본인 게시글에는 가져가기 숨김 — 본인 일정 복제는 의미 없음 */}
        {!isOwnPost && (
          <Button
            variant="primary"
            size="sm"
            onClick={onClone}
            disabled={isCloning}
            className="flex items-center gap-1 flex-shrink-0"
          >
            <Copy size={11} />
            {isCloning ? '가져오는 중...' : '내 일정으로 가져가기'}
          </Button>
        )}
      </div>

      {/* 일자별 장소 — 아코디언 */}
      <div className="flex flex-col">
        {dates.map((date, dayIdx) => {
          const items = grouped.get(date) ?? [];
          const isOpen = expanded.has(date);
          return (
            <div key={date} className="border-b border-[#DBEAFE]/60 dark:border-white/5 last:border-b-0">
              <button
                type="button"
                onClick={() => toggle(date)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/60 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#2563EB] dark:text-[#60A5FA]">Day {dayIdx + 1}</span>
                  <span className="text-xs text-gray-500 dark:text-white/40">{date}</span>
                  <span className="text-[11px] text-gray-400 dark:text-white/30">· {items.length}개</span>
                </div>
                <ChevronRight
                  size={14}
                  className={`text-gray-400 dark:text-white/30 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                />
              </button>
              {isOpen && (
                <ul className="px-5 pb-3 flex flex-col gap-1.5">
                  {items.map((item, idx) => (
                    <li
                      key={item.dayPlanNum}
                      className="flex items-start gap-2 text-xs text-gray-700 dark:text-white/70"
                    >
                      <span className="w-5 h-5 rounded-full bg-[#2563EB]/10 dark:bg-[#60A5FA]/15 text-[#2563EB] dark:text-[#60A5FA] flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-semibold text-gray-900 dark:text-white/85 truncate">
                          {item.locationName ?? '이름 없음'}
                        </span>
                        {item.address && (
                          <span className="text-[11px] text-gray-400 dark:text-white/30 truncate">
                            {item.address}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
