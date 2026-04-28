'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ThumbsUp, Eye, ArrowRight, MapPin } from 'lucide-react';
import { nestApi } from '@/config/api.config';
import FadeIn from '@/components/common/FadeIn';

interface Post {
  communityNum: number;
  title: string;
  content: string;
  viewCount: number;
  createdAt: string;
  user: { name: string };
  city: { cityName: string } | null;
}

// viewCount 기준 상위 3개 — 메인 랜딩용이므로 likeCount 별도 조회 생략
const TOP_COUNT = 3;

// 스켈레톤 카드
const SkeletonCard = () => (
  <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl border border-[#C5BAFF]/20 dark:border-white/8 p-5 flex flex-col gap-3">
    <div className="skeleton h-4 w-16 rounded-full" />
    <div className="skeleton h-5 w-3/4 rounded-full" />
    <div className="skeleton h-4 w-full rounded-full" />
    <div className="skeleton h-4 w-2/3 rounded-full" />
    <div className="flex justify-between mt-auto pt-3">
      <div className="skeleton h-3 w-20 rounded-full" />
      <div className="skeleton h-3 w-24 rounded-full" />
    </div>
  </div>
);

const Community = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    nestApi
      .get<{ data: Post[] }>('/community')
      .then((res) => {
        // viewCount 내림차순으로 상위 3개 선택
        const top = [...res.data.data]
          .sort((a, b) => b.viewCount - a.viewCount)
          .slice(0, TOP_COUNT);
        setPosts(top);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <section id="community" className="py-20 bg-[#FBFBFB] dark:bg-[#252527]">
      <div className="max-w-7xl mx-auto px-4">

        {/* 섹션 헤더 */}
        <FadeIn className="flex items-end justify-between mb-10">
          <div>
            <p className="text-sm font-semibold text-[#7B6FD0] dark:text-[#A89AFF] mb-2 tracking-widest uppercase">Community</p>
            <h2 className="text-3xl font-extrabold text-[#1a1a2e] dark:text-white">인기 게시글</h2>
            <p className="text-[#1a1a2e]/50 dark:text-white/40 mt-2">다른 여행자들의 생생한 후기와 일정을 참고해보세요</p>
          </div>
          <Link
            href="/community"
            className="hidden md:flex items-center gap-1.5 text-sm font-semibold text-[#7B6FD0] dark:text-[#A89AFF] hover:text-[#5A4FB0] dark:hover:text-[#C5BAFF] transition-colors"
          >
            전체 보기 <ArrowRight size={15} />
          </Link>
        </FadeIn>

        {/* 게시글 카드 */}
        <div className="grid md:grid-cols-3 gap-4">
          {isLoading && (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          )}

          {!isLoading && posts.length === 0 && (
            // 게시글이 없을 때도 레이아웃 높이 유지
            <div className="md:col-span-3 text-center py-16 text-sm text-gray-300 dark:text-white/20">
              아직 게시글이 없습니다
            </div>
          )}

          {posts.map((post, i) => (
            <FadeIn key={post.communityNum} delay={i * 100}>
              <Link
                href={`/community/${post.communityNum}`}
                className="group bg-white dark:bg-[#2c2c2e] rounded-2xl border border-[#C5BAFF]/20 dark:border-white/8 hover:border-[#C5BAFF]/50 dark:hover:border-white/15 hover:shadow-md dark:hover:bg-[#343436] transition-all p-5 flex flex-col gap-3 h-full"
              >
                {/* 도시 태그 */}
                {post.city ? (
                  <span className="flex items-center gap-1 text-xs font-bold text-[#7B6FD0] dark:text-[#A89AFF] w-fit">
                    <MapPin size={10} />
                    {post.city.cityName}
                  </span>
                ) : (
                  <span className="text-xs font-bold text-[#1a1a2e]/35 dark:text-white/30 w-fit">자유</span>
                )}

                <div>
                  <h3 className="font-bold text-[#1a1a2e] dark:text-white/90 leading-snug group-hover:text-[#7B6FD0] dark:group-hover:text-white transition-colors line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="text-sm text-[#1a1a2e]/50 dark:text-white/35 mt-2 leading-relaxed line-clamp-2">
                    {post.content}
                  </p>
                </div>

                <div className="mt-auto pt-3 border-t border-[#C5BAFF]/15 dark:border-white/6 flex items-center justify-between text-xs text-[#1a1a2e]/35 dark:text-white/30">
                  <span className="font-medium text-[#1a1a2e]/50 dark:text-white/45">{post.user.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><ThumbsUp size={11} />0</span>
                    <span className="flex items-center gap-1"><Eye size={11} />{post.viewCount.toLocaleString()}</span>
                  </div>
                </div>
              </Link>
            </FadeIn>
          ))}
        </div>

        <div className="mt-6 flex justify-center md:hidden">
          <Link
            href="/community"
            className="flex items-center gap-1.5 text-sm font-semibold text-[#7B6FD0] dark:text-[#A89AFF] border border-[#C5BAFF]/40 dark:border-white/10 px-5 py-2.5 rounded-xl hover:border-[#C5BAFF] dark:hover:border-white/20 hover:text-[#5A4FB0] dark:hover:text-[#C5BAFF] transition-all"
          >
            전체 보기 <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default Community;
