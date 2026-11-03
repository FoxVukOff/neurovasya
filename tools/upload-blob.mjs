/* Необязательный вариант: залить серии в Vercel Blob (если хотите всё в Vercel).
   Требует платный тариф Pro и установку зависимостей:
     npm i @vercel/blob
   Запуск из папки tools:  BLOB_TOKEN=… node upload-blob.mjs /путь/к/папке/с/файлами
   Файлы должны называться s01e01.mp4 … s02e16.mp4.
   После загрузки впишите полученные url в assets/js/data.js:
     NV.VIDEO_SRC['1:01'] = 'https://….blob.vercel-storage.com/s01e01.mp4';
   либо соберите videoBase из общего префикса.
   Помните: egress (просмотры) у Blob платный — для 14 ГБ и активного трафика
   дешевле Cloudflare R2 / Backblaze B2 (см. README.md). */
import { uploadFile } from '@vercel/blob';
import { readdirSync } from 'node:fs';
import path from 'node:path';

const dir = process.argv[2] || '.';
const files = readdirSync(dir).filter((f) => /^s0[12]e\d{2}\.(mp4|m4v|webm)$/.test(f)).sort();

for (const f of files) {
  const p = path.join(dir, f);
  process.stdout.write(`→ ${f} … `);
  const blob = await uploadFile(p, { access: 'public', multipart: true, addRandomSuffix: false });
  console.log('ok', blob.url);
}
console.log('Готово: впишите URL в assets/js/data.js (NV.VIDEO_SRC).');
