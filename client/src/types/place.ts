// /place-search API 응답의 단건 형태 — 공항·호텔·역 검색 모달 공통
export interface PlaceSearchResult {
  place_id: string;
  name: string;
  formatted_address: string;
  location: { lat: number; lng: number };
  types: string[];
}

// 역·터미널 슬롯 판별용 Google 장소 타입 — 공항이 아닌 교통 거점
export const TRANSIT_TYPES = ['train_station', 'transit_station', 'subway_station', 'bus_station', 'ferry_terminal'];
