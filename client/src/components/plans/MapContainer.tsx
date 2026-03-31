"use client"
import { usePlaceSearch } from '@/hook/usePlaceSearch';
import usePlanStore from '@/store/usePlanStore'
import { AdvancedMarker, APIProvider, Map, useMap, useMapsLibrary} from '@vis.gl/react-google-maps'
import React, { useEffect, useRef, useState } from 'react'

const INITIAL_CENTER = {lat: 37.5516, lng: 126.9886};

const PolylinePath = ({ path, color = "#4F46E5" }: { path: { lat: number; lng: number }[], color?: string }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || path.length < 2) return;

    const polyline = new google.maps.Polyline({
      path,
      strokeColor: color, // ← color prop 사용
      strokeWeight: 3,
      strokeOpacity: 0.8,
      map,
    });

    return () => polyline.setMap(null);
  }, [map, path, color]);

  return null;
};

const MapHandler = () => {
  const map = useMap();
  const placeLib = useMapsLibrary('places');
  const searchParams = usePlanStore((state) => state.searchParams);
  const searchTypes = usePlanStore((state) => state.searchTypes);
  const searchTrigger = usePlanStore((state) => state.searchTrigger);
  const { search } = usePlaceSearch(placeLib, map);
  const isPanning = useRef(false);
  const searchRef = useRef(search);
  const selectedPlace = usePlanStore((state) => state.selectedPlace);

  // searchTypes가 비었으면 기본 전체 타입, 아니면 선택된 타입만 사용
  const ALL_TYPES = ['tourist', 'restaurant', 'cafe', 'shopping', 'bar', 'train_station'] as const;
  const activeTypes = searchTypes.length > 0 ? searchTypes : [...ALL_TYPES];


  // search 최신값 동기화
  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  // 최초 진입 시 초기 위치로 검색
  useEffect(() => {
    if (!map || !placeLib) return;
    searchRef.current('', activeTypes, false);
  }, [map, placeLib]);

  // 검색어로 검색
  useEffect(() => {
    if (!searchParams) return;
    isPanning.current = true;
    searchRef.current(searchParams, activeTypes, true).then(() => {
      isPanning.current = false;
    });
  }, [searchParams]);

  // 카테고리 버튼 클릭 시 현재 지도 위치 기준으로 재검색
  useEffect(() => {
    if (!searchTrigger) return; // 초기값 0일 때 실행 안 함
    searchRef.current('', activeTypes, false);
  }, [searchTrigger]);

  // 선택된 장소로 이동 — isPanning을 true로 설정해 idle 재검색 방지 후 panTo
  useEffect(() => {
    if (!map || !selectedPlace) return;
    isPanning.current = true;
    map.panTo(selectedPlace.location);
  }, [selectedPlace, map]);

  // 지도 이동 시
  useEffect(() => {
    if (!map) return;

    const listener = map.addListener('idle', () => {
      if (isPanning.current) {
        isPanning.current = false; // ← idle 발동 시 플래그 해제
        return;
      }
      searchRef.current('', activeTypes, false);
    });

    return () => listener.remove();
  }, [map]);

  return null;
};

const MapContainer = () => {
  const selectedPlace = usePlanStore(state => state.selectedPlace);
  const dayPlans = usePlanStore(state => state.dayPlans);
  const selectedDate = usePlanStore(state => state.selectedDate);

  const isAllView = selectedDate === 'all';

  // 날짜별 색상
  const DAY_COLORS = [
    '#4F46E5', // 파랑
    '#E54646', // 빨강
    '#46E554', // 초록
    '#E5A646', // 주황
    '#A646E5', // 보라
    '#46E5E5', // 청록
  ];

  const currentPlaces = isAllView
    ? dayPlans.flatMap((d) => d.places)
    : dayPlans.find((d) => d.date === selectedDate)?.places ?? [];

    // flex-1: 나머지 너비를 모두 차지. width:100%는 flex 컨테이너에서 170% 계산을 유발해 너비 흔들림 발생
    return (
      <div style={{flex:1, height:"100%", minWidth:0}}>
        <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string}>
          <Map
            mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID}
            defaultCenter={INITIAL_CENTER}
            defaultZoom={15}
            gestureHandling={'greedy'}
          >
            {selectedPlace && (
              <AdvancedMarker position={selectedPlace.location} />
            )}
    
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
                  day.places.map((place, index) => (
                    <AdvancedMarker key={place.place_id} position={place.location}>
                      <div style={{
                        background: DAY_COLORS[dayIndex % DAY_COLORS.length],
                        color: "white",
                        borderRadius: "50%",
                        width: "32px",
                        height: "32px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "bold",
                        fontSize: "14px",
                        border: "2px solid white",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                      }}>
                        {index + 1}
                      </div>
                    </AdvancedMarker>
                  ))
                )
              : currentPlaces.map((place, index) => (
                  <AdvancedMarker key={place.place_id} position={place.location}>
                    <div style={{
                      background: DAY_COLORS[dayPlans.findIndex(d => d.date === selectedDate) % DAY_COLORS.length],
                      color: "white",
                      borderRadius: "50%",
                      width: "32px",
                      height: "32px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "bold",
                      fontSize: "14px",
                      border: "2px solid white",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                    }}>
                      {index + 1}
                    </div>
                  </AdvancedMarker>
                ))
            }
    
            <MapHandler />
          </Map>
        </APIProvider>
      </div>
    );
};

export default MapContainer;