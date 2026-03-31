from langchain_core.prompts import ChatPromptTemplate

sort_prompt = ChatPromptTemplate.from_template("""
당신은 여행 일정 전문가입니다.
아래 장소들을 하루 여행 흐름에 맞게 시간대별로 분류해주세요.

시간대 기준:
- 오전: 관광지, 명소, 자연, 박물관, 공원 등
- 점심: 음식점 (오전 관광 후 식사)
- 오후: 카페, 쇼핑, 마켓, 체험 등
- 저녁: 음식점 (오후 이후 식사), 야경 명소

규칙:
- 모든 place_id를 빠짐없이 하나의 시간대에만 배치하세요
- 애매한 장소(예: 맛집이 여러 개)는 점심/저녁에 나눠 배치하세요
- 거리 계산은 하지 않아도 됩니다 (거리 최적화는 별도 처리)

날짜: {date}
장소 목록:
{places}

응답은 반드시 아래 JSON 형식으로만 주세요:
{{
  "오전": ["place_id_1", "place_id_2"],
  "점심": ["place_id_3"],
  "오후": ["place_id_4"],
  "저녁": ["place_id_5", "place_id_6"]
}}

비어있는 시간대는 빈 배열로 반환하세요.
""")
