"""세션 로그 append 스크립트.

오늘 날짜의 .claude/logs/{YYYY-MM-DD}.json 파일에 작업 항목을 추가한다.
파일이 없으면 생성, 있으면 tasks 배열에 append한다.
date·completed_at은 시스템 시각으로 자동 채운다 (수동 입력 시 실수 방지).

사용 예:
  python append_log.py --id add_plan_crud --title "여행 일정 CRUD" \
    --area backend --summary "plan 도메인 8단계 생성" \
    --files server/src/plan/plan.service.ts server/src/plan/plan.controller.ts
"""

import argparse
import json
from datetime import datetime
from pathlib import Path

# 로그 디렉터리 — 이 스크립트(.claude/skills/session-log/) 기준 두 단계 위가 .claude
LOGS_DIR = Path(__file__).resolve().parents[2] / "logs"

VALID_AREAS = ("frontend", "backend", "ai-server", "infra", "docs")


def main() -> None:
    parser = argparse.ArgumentParser(description="세션 JSON 로그에 작업 추가")
    parser.add_argument("--id", required=True, help="snake_case 작업 ID")
    parser.add_argument("--title", required=True, help="작업 제목 (한국어)")
    parser.add_argument("--area", required=True, choices=VALID_AREAS)
    parser.add_argument("--summary", required=True, help="무엇을+왜 요약")
    parser.add_argument("--files", nargs="*", default=[], help="수정·생성한 파일 경로")
    args = parser.parse_args()

    now = datetime.now()
    today = now.strftime("%Y-%m-%d")
    log_path = LOGS_DIR / f"{today}.json"

    task = {
        "id": args.id,
        "title": args.title,
        "status": "completed",
        "area": args.area,
        "files_changed": args.files,
        "summary": args.summary,
        "completed_at": now.strftime("%H:%M"),
    }

    # 파일이 있으면 기존 tasks에 append, 없으면 새 구조 생성
    if log_path.exists():
        data = json.loads(log_path.read_text(encoding="utf-8"))
    else:
        LOGS_DIR.mkdir(parents=True, exist_ok=True)
        data = {"date": today, "tasks": []}

    data["tasks"].append(task)
    # ensure_ascii=False — 한국어 요약을 그대로 저장 (유니코드 이스케이프 방지)
    log_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"기록 완료: {log_path}  (task: {args.id})")


if __name__ == "__main__":
    main()
