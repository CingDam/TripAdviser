import CommunityListClient, {
  type PagedCommunityResponse,
} from '@/components/community/CommunityListClient';
import type { CityOption } from '@/components/community/CommunityWriteModal';

// 서버용 — 같은 머신의 NestJS로 직접 요청 (브라우저용 NEXT_PUBLIC_ 변수 아님)
const NEST_BASE = (process.env.NEXT_PUBLIC_NEST_URL ?? 'http://localhost:3001') + '/api';
const PAGE_LIMIT = 20;

const EMPTY_POSTS: PagedCommunityResponse = {
  data: [],
  total: 0,
  page: 1,
  limit: PAGE_LIMIT,
};

export default async function CommunityPage() {
  // SSR — 클라이언트 마운트 후 fetch 대신 서버에서 미리 가져와 첫 페인트에 데이터 포함
  // city 시드는 거의 변하지 않아 1시간 ISR / 게시글은 항상 최신이어야 하므로 no-store
  const [postsRes, citiesRes] = await Promise.allSettled([
    fetch(`${NEST_BASE}/community?page=1&limit=${PAGE_LIMIT}`, { cache: 'no-store' }),
    fetch(`${NEST_BASE}/city`, { next: { revalidate: 3600 } }),
  ]);

  const initialPosts: PagedCommunityResponse =
    postsRes.status === 'fulfilled' && postsRes.value.ok
      ? ((await postsRes.value.json()) as PagedCommunityResponse)
      : EMPTY_POSTS;

  const initialCities: CityOption[] =
    citiesRes.status === 'fulfilled' && citiesRes.value.ok
      ? ((await citiesRes.value.json()) as CityOption[])
      : [];

  return (
    <CommunityListClient
      initialPosts={initialPosts}
      initialCities={initialCities}
    />
  );
}
