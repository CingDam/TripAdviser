# 데이터베이스 명세 (tripit)

스키마: `tripit` — `utf8mb4_unicode_ci`
원본: `document/foward_engineering_sql.sql`

## 테이블 목록

| 테이블 | 역할 |
|---|---|
| `tb_user` | 회원 |
| `tb_social_login` | 소셜 로그인 연동 (google·kakao·naver) |
| `tb_city` | 도시 (시드 데이터 15개) |
| `tb_plan` | 여행 일정 |
| `tb_day_plan` | 일정 내 날짜별 장소 |
| `tb_community` | 커뮤니티 게시글 |
| `tb_comment` | 게시글 댓글 (대댓글 지원) |
| `tb_community_like` | 게시글 좋아요 |
| `tb_review` | 장소 리뷰 |
| `tb_review_like` | 리뷰 좋아요 |
| `tb_chat_room` | 채팅방 |
| `tb_chat_room_member` | 채팅방 멤버 |
| `tb_community_image` | 커뮤니티 게시글 이미지 |
| `tb_review_image` | 리뷰 이미지 |

---

## tb_user

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `user_num` | INT PK AI | 회원 번호 |
| `name` | VARCHAR(15) NOT NULL | 이름 |
| `email` | VARCHAR(100) NULL | 이메일 (소셜 로그인 시 NULL 가능) |
| `pw` | VARCHAR(255) NULL | 비밀번호 해시 (소셜 전용 계정은 NULL) |
| `profile_img` | VARCHAR(255) NULL | 프로필 이미지 URL |
| `is_verified` | TINYINT(1) DEFAULT 0 | 이메일 인증 여부 (0=미인증, 1=인증) |
| `created_at` | DATETIME DEFAULT NOW() | 가입일 |

---

## tb_social_login

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `social_num` | INT PK AI | 소셜 로그인 번호 |
| `user_num` | INT FK → tb_user (CASCADE) | 연결된 회원 |
| `provider` | ENUM('google','kakao','naver') NOT NULL | 소셜 플랫폼 |
| `provider_id` | VARCHAR(255) NOT NULL | 플랫폼에서 발급한 고유 ID |
| `created_at` | DATETIME DEFAULT NOW() | 연동일 |

**제약**: `uq_social_login (provider, provider_id)` — 동일 플랫폼 계정 중복 연동 방지

---

## tb_city

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `city_num` | INT PK AI | 도시 번호 |
| `city_name` | VARCHAR(50) NOT NULL | 도시명 |
| `country` | VARCHAR(50) NOT NULL | 국가명 |
| `lat` | DOUBLE NOT NULL | 위도 |
| `lng` | DOUBLE NOT NULL | 경도 |
| `image_url` | VARCHAR(255) NULL | 대표 이미지 |
| `plan_count` | INT DEFAULT 0 | 해당 도시 일정 수 |
| `created_at` | DATETIME DEFAULT NOW() | 등록일 |

**시드 데이터**: 서울·부산·제주 / 도쿄·오사카·후쿠오카·교토·삿포로 / 방콕·싱가포르·발리·다낭 / 파리·로마·바르셀로나

---

## tb_plan

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `plan_num` | INT PK AI | 일정 번호 |
| `user_num` | INT FK → tb_user (CASCADE) | 작성자 |
| `city_num` | INT FK → tb_city (SET NULL) | 도시 (삭제 시 NULL) |
| `plan_name` | VARCHAR(45) NOT NULL | 일정 제목 |
| `start_date` | DATE NULL | 여행 시작일 |
| `end_date` | DATE NULL | 여행 종료일 |
| `is_public` | TINYINT(1) DEFAULT 0 | 공개 여부 (0=비공개) |
| `created_at` | DATETIME DEFAULT NOW() | 생성일 |
| `updated_at` | DATETIME ON UPDATE NOW() | 수정일 |

---

## tb_day_plan

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `day_plan_num` | INT PK AI | 일별 일정 번호 |
| `plan_num` | INT FK → tb_plan (CASCADE) | 상위 일정 |
| `plan_date` | DATE NOT NULL | 해당 날짜 |
| `sort_order` | INT DEFAULT 0 | 장소 순서 |
| `place_id` | VARCHAR(100) NULL | Google Places ID |
| `location_name` | VARCHAR(50) NULL | 장소명 |
| `address` | VARCHAR(100) NULL | 주소 |
| `lat` | DOUBLE NULL | 위도 |
| `lng` | DOUBLE NULL | 경도 |
| `tel` | VARCHAR(20) NULL | 전화번호 |
| `created_at` | DATETIME DEFAULT NOW() | 추가일 |

---

## tb_community

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `community_num` | INT PK AI | 게시글 번호 |
| `user_num` | INT FK → tb_user (CASCADE) | 작성자 |
| `city_num` | INT FK → tb_city (SET NULL) | 관련 도시 |
| `title` | VARCHAR(100) NOT NULL | 제목 |
| `content` | TEXT NOT NULL | 본문 |
| `view_count` | INT DEFAULT 0 | 조회수 |
| `created_at` | DATETIME DEFAULT NOW() | 작성일 |
| `updated_at` | DATETIME ON UPDATE NOW() | 수정일 |

---

## tb_comment

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `comment_num` | INT PK AI | 댓글 번호 |
| `community_num` | INT FK → tb_community (CASCADE) | 게시글 |
| `user_num` | INT FK → tb_user (CASCADE) | 작성자 |
| `parent_comment_num` | INT FK → tb_comment (CASCADE) NULL | 부모 댓글 (대댓글용, NULL=최상위) |
| `content` | TEXT NOT NULL | 내용 |
| `created_at` | DATETIME DEFAULT NOW() | 작성일 |

---

## tb_community_like

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `like_num` | INT PK AI | 좋아요 번호 |
| `community_num` | INT FK → tb_community (CASCADE) | 게시글 |
| `user_num` | INT FK → tb_user (CASCADE) | 사용자 |
| `created_at` | DATETIME DEFAULT NOW() | 좋아요 일시 |

**제약**: `uq_community_like (community_num, user_num)` — 중복 좋아요 방지

---

## tb_review

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `review_num` | INT PK AI | 리뷰 번호 |
| `user_num` | INT FK → tb_user (CASCADE) | 작성자 |
| `city_num` | INT FK → tb_city (SET NULL) | 도시 |
| `place_id` | VARCHAR(100) NULL | Google Places ID |
| `location_name` | VARCHAR(50) NULL | 장소명 |
| `rating` | INT NOT NULL | 평점 |
| `content` | TEXT NULL | 내용 |
| `created_at` | DATETIME DEFAULT NOW() | 작성일 |
| `updated_at` | DATETIME ON UPDATE NOW() | 수정일 |

---

## tb_review_like

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `like_num` | INT PK AI | 좋아요 번호 |
| `review_num` | INT FK → tb_review (CASCADE) | 리뷰 |
| `user_num` | INT FK → tb_user (CASCADE) | 사용자 |
| `created_at` | DATETIME DEFAULT NOW() | 좋아요 일시 |

**제약**: `uq_review_like (review_num, user_num)` — 중복 좋아요 방지

---

## tb_chat_room

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `room_num` | INT PK AI | 채팅방 번호 |
| `room_name` | VARCHAR(100) NULL | 방 이름 |
| `room_type` | ENUM('private','open') DEFAULT 'private' | 방 유형 |
| `created_at` | DATETIME DEFAULT NOW() | 생성일 |

---

## tb_chat_room_member

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `member_num` | INT PK AI | 멤버 번호 |
| `room_num` | INT FK → tb_chat_room (CASCADE) | 채팅방 |
| `user_num` | INT FK → tb_user (CASCADE) | 사용자 |
| `joined_at` | DATETIME DEFAULT NOW() | 입장일 |
| `last_read_at` | DATETIME NULL | 마지막 읽은 시각 (읽음 처리용) |

**제약**: `uq_room_member (room_num, user_num)` — 중복 입장 방지

---

## tb_community_image

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `image_num` | INT PK AI | 이미지 번호 |
| `community_num` | INT FK → tb_community (CASCADE) | 게시글 |
| `image_url` | VARCHAR(255) NOT NULL | 이미지 URL |
| `created_at` | DATETIME DEFAULT NOW() | 업로드일 |

---

## tb_review_image

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `image_num` | INT PK AI | 이미지 번호 |
| `review_num` | INT FK → tb_review (CASCADE) | 리뷰 |
| `image_url` | VARCHAR(255) NOT NULL | 이미지 URL |
| `created_at` | DATETIME DEFAULT NOW() | 업로드일 |

---

## 관계 다이어그램 (요약)

```
tb_user ──< tb_social_login (google·kakao·naver)
tb_user ──< tb_plan >── tb_city
tb_user ──< tb_day_plan (plan_num → tb_plan)
tb_user ──< tb_community >── tb_city
tb_user ──< tb_comment >── tb_community
                tb_comment ──< tb_comment (대댓글)
tb_user ──< tb_community_like >── tb_community
tb_user ──< tb_review >── tb_city
tb_user ──< tb_review_like >── tb_review
tb_user ──< tb_chat_room_member >── tb_chat_room
tb_community ──< tb_community_image
tb_review ──< tb_review_image
```
