"""ai-server 단위 테스트 — _extract_json, generate 검증, chat action normalize"""
import json
import pytest
from services.chat_service import (
    _extract_json,
    _normalize_action_places,
    _validate_and_fix_day_plan,
    ALLOWED_CATEGORIES,
)


# ── _extract_json ────────────────────────────────────────────────────────────

class TestExtractJson:
    def test_pure_json(self):
        raw = '{"key": "value"}'
        assert _extract_json(raw) == {"key": "value"}

    def test_code_fence_json(self):
        raw = '```json\n{"key": "value"}\n```'
        assert _extract_json(raw) == {"key": "value"}

    def test_code_fence_no_lang(self):
        raw = '```\n{"key": "value"}\n```'
        assert _extract_json(raw) == {"key": "value"}

    def test_mixed_text_before_after(self):
        raw = '이 장소들을 추천합니다.\n{"reply": "안녕", "action": null}\n참고하세요.'
        assert _extract_json(raw) == {"reply": "안녕", "action": None}

    def test_raises_on_no_json(self):
        with pytest.raises(json.JSONDecodeError):
            _extract_json("JSON이 전혀 없는 텍스트")

    def test_nested_json(self):
        raw = '{"day_plans": [{"date": "2025-06-01", "places": []}]}'
        result = _extract_json(raw)
        assert result["day_plans"][0]["date"] == "2025-06-01"


# ── _normalize_action_places ─────────────────────────────────────────────────

class TestNormalizeActionPlaces:
    def test_string_places(self):
        result = _normalize_action_places(["도쿄타워", "아사쿠사"])
        assert result == [
            {"name": "도쿄타워", "category": None},
            {"name": "아사쿠사", "category": None},
        ]

    def test_dict_places(self):
        result = _normalize_action_places([{"name": "스카이트리", "category": "관광지"}])
        assert result[0]["name"] == "스카이트리"
        assert result[0]["category"] == "관광지"

    def test_empty_name_filtered(self):
        result = _normalize_action_places(["", "  ", "유효한장소"])
        assert len(result) == 1
        assert result[0]["name"] == "유효한장소"

    def test_mixed_types(self):
        result = _normalize_action_places(["스시로", {"name": "일란", "category": "식당"}])
        assert len(result) == 2


# ── _validate_and_fix_day_plan ───────────────────────────────────────────────

class TestValidateAndFixDayPlan:
    def test_valid_categories_pass(self):
        dp = {"date": "2025-06-01", "places": [
            {"name": "도쿄타워", "category": "관광지"},
            {"name": "스시로", "category": "식당"},
            {"name": "스시로2", "category": "식당"},
            {"name": "스타벅스", "category": "카페"},
        ]}
        result = _validate_and_fix_day_plan(dp, "2025-06-01")
        assert len(result["places"]) == 4

    def test_invalid_category_corrected(self):
        dp = {"date": "2025-06-01", "places": [
            {"name": "이상한장소", "category": "unknown_type"},
        ]}
        result = _validate_and_fix_day_plan(dp, "2025-06-01")
        assert result["places"][0]["category"] == "관광지"

    def test_all_allowed_categories_accepted(self):
        for cat in ALLOWED_CATEGORIES:
            dp = {"date": "2025-06-01", "places": [{"name": "테스트", "category": cat}]}
            result = _validate_and_fix_day_plan(dp, "2025-06-01")
            assert result["places"][0]["category"] == cat


# ── generate 응답 검증 (통합 없이 로직만) ────────────────────────────────────

class TestGenerateValidation:
    def test_extra_date_not_in_request(self):
        """요청 날짜 외 날짜는 필터링돼야 한다."""
        req_dates = {"2025-06-01", "2025-06-02"}
        raw_day_plans = [
            {"date": "2025-06-01", "places": [{"name": "A", "category": "관광지"}]},
            {"date": "2025-06-02", "places": [{"name": "B", "category": "식당"}]},
            {"date": "2025-06-03", "places": [{"name": "C", "category": "카페"}]},  # extra
        ]
        filtered = [dp for dp in raw_day_plans if dp.get("date") in req_dates]
        assert len(filtered) == 2
        assert all(dp["date"] in req_dates for dp in filtered)

    def test_duplicate_place_names_removed(self):
        places = [
            {"name": "도쿄타워", "category": "관광지"},
            {"name": "도쿄타워", "category": "관광지"},  # 중복
            {"name": "스카이트리", "category": "관광지"},
        ]
        seen: set[str] = set()
        deduped = []
        for p in places:
            key = p["name"].strip().lower()
            if key not in seen:
                seen.add(key)
                deduped.append(p)
        assert len(deduped) == 2
