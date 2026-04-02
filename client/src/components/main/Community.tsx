import Link from 'next/link';
import { MessageCircle, ThumbsUp, Eye, ArrowRight } from 'lucide-react';

const POSTS = [
  {
    id: 1,
    category: '여행 후기',
    categoryColor: 'bg-indigo-100 text-indigo-600',
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
    categoryColor: 'bg-emerald-100 text-emerald-600',
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
    categoryColor: 'bg-amber-100 text-amber-600',
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
    <section id="community" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4">

        {/* 섹션 헤더 */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-sm font-semibold text-indigo-600 mb-2">COMMUNITY</p>
            <h2 className="text-3xl font-extrabold text-gray-900">인기 게시글</h2>
            <p className="text-gray-500 mt-2">다른 여행자들의 생생한 후기와 일정을 참고해보세요</p>
          </div>
          <Link
            href="/community"
            className="hidden md:flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            전체 보기 <ArrowRight size={15} />
          </Link>
        </div>

        {/* 게시글 카드 */}
        <div className="grid md:grid-cols-3 gap-5">
          {POSTS.map((post) => (
            <Link
              key={post.id}
              href={`/community/${post.id}`}
              className="group bg-white rounded-2xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all p-5 flex flex-col gap-3"
            >
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full w-fit ${post.categoryColor}`}>
                {post.category}
              </span>

              <div>
                <h3 className="font-bold text-gray-900 leading-snug group-hover:text-indigo-600 transition-colors line-clamp-2">
                  {post.title}
                </h3>
                <p className="text-sm text-gray-500 mt-2 leading-relaxed line-clamp-2">
                  {post.excerpt}
                </p>
              </div>

              <div className="mt-auto pt-3 border-t border-gray-50 flex items-center justify-between text-xs text-gray-400">
                <span className="font-medium text-gray-500">{post.author}</span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><ThumbsUp size={11} />{post.likes}</span>
                  <span className="flex items-center gap-1"><Eye size={11} />{post.views.toLocaleString()}</span>
                  <span className="flex items-center gap-1"><MessageCircle size={11} />{post.comments}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-6 flex justify-center md:hidden">
          <Link
            href="/community"
            className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 border border-indigo-200 px-5 py-2.5 rounded-xl hover:bg-indigo-50 transition-colors"
          >
            전체 보기 <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default Community;
