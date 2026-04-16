import subprocess
import datetime
import json
import sys

# Windows CP949 환경에서 한글 출력을 위해 UTF-8 강제 설정
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)

result = subprocess.run(
    ['git', 'status', '--short'],
    cwd='c:/Users/user/Desktop/Personal',
    capture_output=True,
    text=True,
)

SKIP = ['WORKLOG', 'logs/']
CODE_EXT = ('.ts', '.tsx', '.py')

changed = [
    line.strip()
    for line in result.stdout.splitlines()
    if not any(s in line for s in SKIP)
    and any(line.rstrip().endswith(e) for e in CODE_EXT)
]

if changed:
    d = datetime.date.today().strftime('%Y-%m-%d')
    msg = (
        f'[로그 체크] 코드 파일 {len(changed)}개 수정 감지 - '
        f'WORKLOG.md와 .claude/logs/{d}.json에 로그를 기록했는가? '
        '아직 안 했으면 지금 작성하세요.'
    )
    print(json.dumps({
        'hookSpecificOutput': {
            'hookEventName': 'Stop',
            'additionalContext': msg,
        }
    }, ensure_ascii=False))
