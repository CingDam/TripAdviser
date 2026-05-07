import subprocess
import sys
import json

result = subprocess.run(
    ["git", "diff", "--name-only", "HEAD"],
    capture_output=True, text=True
)
changed_files = [
    f for f in result.stdout.splitlines()
    if f.endswith((".ts", ".tsx", ".js", ".jsx"))
]

violations = []
for path in changed_files:
    try:
        with open(path, encoding="utf-8") as fh:
            for i, line in enumerate(fh, 1):
                if "console.log" in line and not line.lstrip().startswith("//"):
                    violations.append(f"  {path}:{i}  {line.rstrip()}")
    except OSError:
        continue

if violations:
    msg = "console.log 커밋 금지 — 아래 줄을 제거하세요:\n" + "\n".join(violations)
    print(json.dumps({"systemMessage": msg}))
    sys.exit(0)
