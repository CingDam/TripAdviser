export interface PostImage {
  imageNum: number;
  imageUrl: string;
}

// 게시글에 첨부된 일정 — 일자별 장소까지 펼침 표시용
export interface AttachedDayPlan {
  dayPlanNum: number;
  planDate: string;
  sortOrder: number;
  locationName: string | null;
  address: string | null;
}

export interface AttachedPlan {
  planNum: number;
  planName: string;
  startDate: string | null;
  endDate: string | null;
  city: { cityName: string; country: string } | null;
  dayPlans: AttachedDayPlan[];
}

export interface Post {
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

export interface Comment {
  commentNum: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: { userNum: number; name: string };
  replies: Comment[];
}
