import Link from 'next/link';
import { MessageCircle, ThumbsUp, Eye, ArrowRight } from 'lucide-react';
import FadeIn from '@/components/common/FadeIn';

const POSTS = [
  {
    id: 1,
    category: '여행 후기',
    categoryClass: 'bg-indigo-50 text-indigo-600 border border-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-400 dark:border-indigo-500/20',
    title: '도쿄 5박 6일 완벽 코스 공유해요 🗼',
    excerpt: '신주쿠, 시부야, 아사쿠사까지 알차게 돌아본 일정입니다. AI 정렬 기능 덕분에 이동 거리를 확 줄였어요.',
    author: '여행왕민지',
    date: '2026.03.28',
    likes: 142,
    views: 2841,
    comments: 38,
  },
  {
    id: 2,
    category: '일정 공유',
    categoryClass: 'bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20',
    title: '유럽 3개국 14일 일정 — 파리·바르셀로나·로마',
    excerpt: '예산 200만원으로 떠난 유럽 여행. 숙소 선택부터 교통 패스 팁까지 모두 담았습니다.',
    author: '백패커준혁',
    date: '2026.03.25',
    likes: 98,
    views: 1923,
    comments: 21,
  },
  {
    id: 3,
    category: '꿀팁',
    categoryClass: 'bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/20',
    title: '태국 방콕 환전 꿀팁 — 공항 말고 이곳에서',
    excerpt: '공항 환전소보다 30% 저렴하게 환전하는 방법. 현지에서 직접 확인한 슈퍼리치 환전소 후기.',
    author: '알뜰여행러',
    date: '2026.03.22',
    likes: 211,
    views: 4102,
    comments: 55,
  },
];

const Community = () => {
  return (
    <section id="community" className="py-20 bg-white dark:bg-[#252527]">
      <div className="max-w-7xl mx-auto px-4">

        {/* 섹션 헤더 */}
        <FadeIn className="flex items-end justify-between mb-10">
          <div>
            <p className="text-sm font-semibold text-violet-600 dark:text-violet-400 mb-2 tracking-widest uppercase">Community</p>
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">인기 게시글</h2>
            <p className="text-gray-500 dark:text-white/40 mt-2">다른 여행자들의 생생한 후기와 일정을 참고해보세요</p>
          </div>
          <Link
            href="/community"
            className="hidden md:flex items-center gap-1.5 text-sm font-semibold text-gray-400 dark:text-white/40 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            전체 보기 <ArrowRight size={15} />
          </Link>
        </FadeIn>

        {/* 게시글 카드 */}
        <div className="grid md:grid-cols-3 gap-4">
          {POSTS.map((post, i) => (
            <FadeIn key={post.id} delay={i * 100}>
              <Link
                href={`/community/${post.id}`}
                className="group bg-white dark:bg-[#2c2c2e] rounded-2xl border border-gray-100 dark:border-white/8 hover:border-gray-200 dark:hover:border-white/15 hover:shadow-md dark:hover:bg-[#343436] transition-all p-5 flex flex-col gap-3 h-full"
              >
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full w-fit ${post.categoryClass}`}>
                  {post.category}
                </span>

                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white/90 leading-snug group-hover:text-indigo-600 dark:group-hover:text-white transition-colors line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-white/35 mt-2 leading-relaxed line-clamp-2">
                    {post.excerpt}
                  </p>
                </div>

                <div className="mt-auto pt-3 border-t border-gray-50 dark:border-white/6 flex items-center justify-between text-xs text-gray-400 dark:text-white/30">
                  <span className="font-medium text-gray-500 dark:text-white/45">{post.author}</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><ThumbsUp size={11} />{post.likes}</span>
                    <span className="flex items-center gap-1"><Eye size={11} />{post.views.toLocaleString()}</span>
                    <span className="flex items-center gap-1"><MessageCircle size={11} />{post.comments}</span>
                  </div>
                </div>
              </Link>
            </FadeIn>
          ))}
        </div>

        <div className="mt-6 flex justify-center md:hidden">
          <Link
            href="/community"
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 dark:text-white/40 border border-gray-200 dark:border-white/10 px-5 py-2.5 rounded-xl hover:border-gray-300 dark:hover:border-white/20 hover:text-gray-900 dark:hover:text-white transition-all"
          >
            전체 보기 <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default Community;
