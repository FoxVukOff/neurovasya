#!/usr/bin/env bash
# Загрузка 14 ГБ видео серий в объектное хранилище через rclone.
# Один раз: rclone config  →  имя "remote", тип s3:
#   provider: Cloudflare (R2)  |  Backblaze (B2)  |  Other (S3-совместимые, напр. Bunny)
#   access_key_id / secret_access_key — из консоли провайдера.
#   endpoint для R2: https://<account-id>.r2.cloudflarestorage.com
set -euo pipefail

SRC="${1:-./серии}"            # папка с файлами s01e01.mp4 … s02e16.mp4
REMOTE="${2:-remote:neurovasya}"

echo "→ Проверяю имена файлов…"
ls "$SRC" | grep -E '^s0[12]e[0-9]{2}\.(mp4|m4v|webm)$' >/dev/null || {
  echo "Ошибка: нужны файлы вида s01e01.mp4 … s02e16.mp4"; exit 1; }

echo "→ Заливаю (докачка при обрыве, 4 потока)…"
rclone copy "$SRC" "$REMOTE" --progress --transfers 4 --checkers 8

echo "→ Готово. Проверка:"
rclone lsf "$REMOTE" | head -40
echo
echo "Теперь впишите base-URL в assets/js/data.js → videoBase:"
echo "  R2:  https://<публичный домен бакета>/   (Settings → Public access / свой домен)"
echo "  B2:  https://fXXX.backblazeb2.com/file/<бакет>/  или домен через Cloudflare"
