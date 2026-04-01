"use client"
import { usePlaceSearch } from '@/hook/usePlaceSearch';
import usePlanStore, { GooglePlace } from '@/store/usePlanStore'
import { AdvancedMarker, APIProvider, InfoWindow, Map, useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import { Search } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'

const INITIAL_CENTER = { lat: 37.5516, lng: 126.9886 };

const PolylinePath = ({ path, color = "#4F46E5" }: { path: { lat: number; lng: number }[], color?: string }) => {
  const map = useMap();
  useEffect(() => {
    if (!map || path.length < 2) return;
    const polyline = new google.maps.Polyline({
      path, strokeColor: color, strokeWeight: 3, strokeOpacity: 0.8, map,
    });
    return () => polyline.setMap(null);
  }, [map, path, color]);
  return null;
};

const MapHandler = () => {
  const map          = useMap();
  const placeLib     = useMapsLibrary('places');
  const searchParams = usePlanStore((s) => s.searchParams);
  const searchTypes  = usePlanStore((s) => s.searchTypes);
  const searchTrigger = usePlanStore((s) => s.searchTrigger);
  const selectedPlace = usePlanStore((s) => s.selectedPlace);
  const detailPlace   = usePlanStore((s) => s.detailPlace);
  const setDetailPlace = usePlanStore((s) => s.setDetailPlace);
  const setShowAreaSearch = usePlanStore((s) => s.setShowAreaSearch);

  const { search } = usePlaceSearch(placeLib, map);
  const isPanning  = useRef(false);
  const searchRef  = useRef(search);

  // 자동 검색 기본값: 핵심 3개만 — 6개 동시 호출 시 Rate Limit(429) 위험
  const DEFAULT_TYPES = ['tourist', 'restaurant', 'cafe'] as const;
  const activeTypes = searchTypes.length > 0 ? searchTypes : [...DEFAULT_TYPES];

  useEffect(() => { searchRef.current = search; }, [search]);

  // 최초 진입 시 1회 검색
  useEffect(() => {
    if (!map || !placeLib) return;
    searchRef.current('', activeTypes, false);
  }, [map, placeLib]);

  // 텍스트 검색
  useEffect(() => {
    if (!searchParams) return;
    isPanning.current = true;
    setShowAreaSearch(false);
    searchRef.current(searchParams, activeTypes, true).then(() => {
      isPanning.current = false;
    });
  }, [searchParams]);

  // "이 지역 검색" 버튼 클릭 → searchTrigger 증가 → 여기서 실제 검색 실행
  useEffect(() => {
    if (!searchTrigger) return;
    searchRef.current('', activeTypes, false);
  }, [searchTrigger]);

  // 위치보기 panTo
  useEffect(() => {
    if (!map || !selectedPlace) return;
    isPanning.current = true;
    map.panTo(selectedPlace.location);
  }, [selectedPlace, map]);

  // 지도 드래그/줌 시 "이 지역 검색" 버튼 표시 — idle 자동검색 제거
  // isPanning 체크 제거: idle 자동검색이 없으므로 프로그래매틱 이동 여부와 무관하게 버튼 표시해도 됨
  useEffect(() => {
    if (!map) return;

    const showButton = () => setShowAreaSearch(true);

    const dragListener = map.addListener('dragend', showButton);
    const zoomListener = map.addListener('zoom_changed', showButton);

    return () => {
      dragListener.remove();
      zoomListener.remove();
    };
  }, [map]);

  // 상세 패널 열릴 때 Enterprise 필드 별도 조회 (Basic SKU로 검색 → 상세 열 때 1회만 호출)
  // weekdayDescriptions === undefined → 아직 미조회 / null → 조회했지만 데이터 없음
  useEffect(() => {
    if (!detailPlace || !placeLib) return;
    if (detailPlace.weekdayDescriptions !== undefined) return;

    const fetchDetails = async () => {
      try {
        const place = new google.maps.places.Place({ id: detailPlace.place_id });
        await place.fetchFields({ fields: ['regularOpeningHours', 'nationalPhoneNumber', 'websiteURI'] });
        setDetailPlace({
          ...detailPlace,
          openNow: null,
          weekdayDescriptions: place.regularOpeningHours?.weekdayDescriptions ?? null,
          phone: place.nationalPhoneNumber ?? null,
          website: place.websiteURI ?? null,
        });
      } catch (err) {
        console.error('Place details fetch 실패', err);
      }
    };

    fetchDetails();
    // place_id 변경 시에만 실행 — detailPlace 전체를 deps에 넣으면 setDetailPlace 후 루프 발생
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailPlace?.place_id, placeLib, setDetailPlace]);

  return null;
};

// 마커 클릭 시 지도 위에 뜨는 미니 카드
const MarkerInfoCard = ({
  place, color, index, onClose, onDetail,
}: {
  place: GooglePlace;
  color: string;
  index: number;
  onClose: () => void;
  onDetail: () => void;
}) => (
  <InfoWindow position={place.location} onCloseClick={onClose}>
    <div style={{ minWidth: 180, maxWidth: 220, fontFamily: 'Arial, sans-serif' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: color, color: 'white',
        borderRadius: 20, padding: '2px 10px',
        fontSize: 12, fontWeight: 'bold', marginBottom: 8,
      }}>
        {index + 1}
      </div>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1a1a', marginBottom: 2 }}>
        {place.name}
      </div>
      {place.rating && (
        <div style={{ fontSize: 12, color: '#f59e0b', marginBottom: 6 }}>
          ★ {place.rating}
          <span style={{ color: '#9ca3af', marginLeft: 4 }}>
            ({place.user_ratings_total?.toLocaleString() ?? 0})
          </span>
        </div>
      )}
      <button
        onClick={onDetail}
        style={{
          width: '100%', padding: '6px 0',
          background: '#4F46E5', color: 'white',
          border: 'none', borderRadius: 8,
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}
      >
        자세히보기
      </button>
    </div>
  </InfoWindow>
);

const MapContainer = () => {
  const selectedPlace      = usePlanStore((s) => s.selectedPlace);
  const dayPlans           = usePlanStore((s) => s.dayPlans);
  const selectedDate       = usePlanStore((s) => s.selectedDate);
  const setDetailPlace     = usePlanStore((s) => s.setDetailPlace);
  const showAreaSearch     = usePlanStore((s) => s.showAreaSearch);
  const setShowAreaSearch  = usePlanStore((s) => s.setShowAreaSearch);
  const incrementSearchTrigger = usePlanStore((s) => s.incrementSearchTrigger);

  const [activeMarker, setActiveMarker] = useState<{ place: GooglePlace; color: string; index: number } | null>(null);

  const isAllView = selectedDate === 'all';
  const DAY_COLORS = ['#4F46E5', '#E54646', '#46E554', '#E5A646', '#A646E5', '#46E5E5'];

  const currentPlaces = isAllView
    ? dayPlans.flatMap((d) => d.places)
    : dayPlans.find((d) => d.date === selectedDate)?.places ?? [];

  const handleAreaSearch = () => {
    setShowAreaSearch(false);
    incrementSearchTrigger(); // MapHandler의 searchTrigger useEffect가 실제 검색 실행
  };

  // flex-1: 나머지 너비를 모두 차지. width:100%는 flex에서 170% 계산을 유발해 너비 흔들림 발생
  return (
    <div style={{ flex: 1, height: '100%', minWidth: 0, position: 'relative' }}>

      {/* "이 지역 검색" 플로팅 버튼 — 지도 드래그/줌 후 표시, 클릭 시 현재 영역 검색 */}
      {showAreaSearch && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={handleAreaSearch}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-full shadow-lg border border-gray-200 transition-all active:scale-95 cursor-pointer"
          >
            <Search size={14} className="text-indigo-500" />
            이 지역 검색
          </button>
        </div>
      )}

      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string}>
        <Map
          mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID}
          defaultCenter={INITIAL_CENTER}
          defaultZoom={15}
          gestureHandling={'greedy'}
          onClick={() => setActiveMarker(null)}
        >
          {selectedPlace && <AdvancedMarker position={selectedPlace.location} />}

          {/* 폴리라인 */}
          {isAllView
            ? dayPlans.map((day, dayIndex) =>
                day.places.length > 1 && (
                  <PolylinePath
                    key={day.date}
                    path={day.places.map((p) => p.location)}
                    color={DAY_COLORS[dayIndex % DAY_COLORS.length]}
                  />
                )
              )
            : currentPlaces.length > 1 && (
                <PolylinePath
                  path={currentPlaces.map((p) => p.location)}
                  color={DAY_COLORS[dayPlans.findIndex(d => d.date === selectedDate) % DAY_COLORS.length]}
                />
              )
          }

          {/* 마커 */}
          {isAllView
            ? dayPlans.map((day, dayIndex) =>
                day.places.map((place, index) => {
                  const color = DAY_COLORS[dayIndex % DAY_COLORS.length];
                  return (
                    <AdvancedMarker key={place.place_id} position={place.location} onClick={() => setActiveMarker({ place, color, index })}>
                      <div style={{
                        background: color, color: 'white',
                        borderRadius: '50%', width: 32, height: 32,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 'bold', fontSize: 14,
                        border: '2px solid white', boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                        transform: activeMarker?.place.place_id === place.place_id ? 'scale(1.25)' : 'scale(1)',
                        transition: 'transform 0.15s ease', cursor: 'pointer',
                      }}>
                        {index + 1}
                      </div>
                    </AdvancedMarker>
                  );
                })
              )
            : currentPlaces.map((place, index) => {
                const color = DAY_COLORS[dayPlans.findIndex(d => d.date === selectedDate) % DAY_COLORS.length];
                return (
                  <AdvancedMarker key={place.place_id} position={place.location} onClick={() => setActiveMarker({ place, color, index })}>
                    <div style={{
                      background: color, color: 'white',
                      borderRadius: '50%', width: 32, height: 32,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 'bold', fontSize: 14,
                      border: '2px solid white', boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                      transform: activeMarker?.place.place_id === place.place_id ? 'scale(1.25)' : 'scale(1)',
                      transition: 'transform 0.15s ease', cursor: 'pointer',
                    }}>
                      {index + 1}
                    </div>
                  </AdvancedMarker>
                );
              })
          }

          {activeMarker && (
            <MarkerInfoCard
              place={activeMarker.place}
              color={activeMarker.color}
              index={activeMarker.index}
              onClose={() => setActiveMarker(null)}
              onDetail={() => { setDetailPlace(activeMarker.place); setActiveMarker(null); }}
            />
          )}

          <MapHandler />
        </Map>
      </APIProvider>
    </div>
  );
};

export default MapContainer;
