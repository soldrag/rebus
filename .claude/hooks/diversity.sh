#!/usr/bin/env bash
# Хук Claude Code (PostToolUse): после правки ребусов или замыслов пересчитывает доли приёмов
# (tools/diversity.mjs). Если какой-то приём занял больше двух честных долей уровня —
# код 2: агент видит таблицу и должен выровнять набор (docs/REBUSES.md, «Разнообразие»).
# Проверяется только то, что правили: набор (public/data/rebuses.json) или замыслы (data/proposals/).
cd "$CLAUDE_PROJECT_DIR" || exit 0
input=$(cat)
stamp=.git/diversity-checked
newer() { for f in "$@"; do [ -f "$f" ] && { [ ! -f "$stamp" ] || [ "$f" -nt "$stamp" ]; } && return 0; done; return 1; }
# Путь правленого файла (у Edit/Write); у Bash его нет — там смотрим на время изменения файлов.
path=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write((j.tool_input&&j.tool_input.file_path)||"")}catch{}})')
check=()
case "$path" in
  *public/data/rebuses.json) check=(set) ;;
  *data/proposals/*.json) check=(proposals) ;;
  ?*) exit 0 ;;
  *)  # Bash и прочее: только если файлы изменились после прошлой проверки
    newer public/data/rebuses.json && check+=(set)
    newer data/proposals/*.json && check+=(proposals)
    ;;
esac
[ ${#check[@]} -eq 0 ] && exit 0
touch "$stamp" 2>/dev/null
status=0
for what in "${check[@]}"; do
  out=$(node tools/diversity.mjs --strict --only="$what" 2>&1) || { echo "$out" >&2; status=2; }
done
[ $status -eq 2 ] && echo "Правило разнообразия нарушено: ни один приём не больше 2 × (100 % / число приёмов уровня)." >&2
exit $status
