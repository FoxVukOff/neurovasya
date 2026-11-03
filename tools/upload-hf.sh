#!/usr/bin/env bash
# ============================================================
# Заливка 14 ГБ видео серий на Hugging Face (бесплатно).
# Использование:  bash tools/upload-hf.sh ВАШ_НИК [имя_репо] [папка_с_файлами]
# Пример:         bash tools/upload-hf.sh vasya-pupkin neurovasya-videos ./серии
#
# Что сделает: поставит huggingface_hub, попросит токен (если не залогинены),
# создаст ПУБЛИЧНЫЙ датасет-репозиторий и зальёт папку с докачкой при обрыве.
# Файлы внутри папки должны называться s01e01.mp4 … s02e16.mp4 и лежать
# в её корне (или подпапках — структура сохранится).
#
# Windows (PowerShell): то же самое вручную:
#   pip install -U huggingface_hub
#   hf auth login
#   hf repo create НИК/neurovasya-videos --repo-type dataset
#   hf upload-large-folder НИК/neurovasya-videos .\серии --repo-type dataset
# ============================================================
set -euo pipefail

USER="${1:?Укажите ник Hugging Face: bash tools/upload-hf.sh НИК [репо] [папка]}"
REPO="${2:-neurovasya-videos}"
SRC="${3:-./серии}"

echo "→ Проверяю huggingface_hub…"
python3 -c 'import huggingface_hub' 2>/dev/null || pip install -U huggingface_hub
HF="$(command -v hf || command -v huggingface-cli)"

echo "→ Проверяю файлы (нужны s01e01.mp4 … s02e16.mp4)…"
ls "$SRC" | grep -E '^s0[12]e[0-9]{2}\.(mp4|m4v|webm)$' >/dev/null || {
  echo "Ошибка: в $SRC нет файлов вида s01e01.mp4"; exit 1; }
du -sh "$SRC" | sed 's/^/   размер: /'

echo "→ Логин на HF (токен с правом write: https://huggingface.co/settings/tokens)…"
"$HF" auth whoami >/dev/null 2>&1 || "$HF" auth login

echo "→ Создаю публичный репозиторий $USER/$REPO (dataset)…"
"$HF" repo create "$USER/$REPO" --repo-type dataset --exist-ok 2>/dev/null || true

echo "→ Заливаю (LFS, с докачкой, может занять часы на 14 ГБ)…"
"$HF" upload-large-folder "$USER/$REPO" "$SRC" --repo-type dataset \
     --ignore "*.txt" --ignore ".DS_Store"

URL="https://huggingface.co/datasets/$USER/$REPO/resolve/main/s01e01.mp4"
echo
echo "✔ Готово! Проверка: $URL"
echo
echo "Осталось одно действие: впишите в assets/js/data.js:"
echo "    hf: { user: '$USER', repo: '$REPO', type: 'datasets' },"
echo "и задеплойте обновлённый сайт на Vercel. Плеер подхватит все серии сам."
