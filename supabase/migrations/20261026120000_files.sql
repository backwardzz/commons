-- Файлы во вкладах. Корзина files открыта на чтение по ссылке (вклады публичны),
-- загружать можно только вошедшим и только в свою папку: files/<id пользователя>/…
-- Типы — по списку; всё остальное браузер загружает как application/octet-stream,
-- такие файлы скачиваются, а не открываются на странице.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('files', 'files', true, 20971520, array[
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif',
  'video/mp4', 'video/webm', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm',
  'application/pdf', 'text/plain', 'text/markdown', 'text/csv', 'application/json',
  'application/zip', 'application/x-zip-compressed', 'application/x-7z-compressed', 'application/vnd.rar',
  'model/gltf-binary', 'model/gltf+json', 'model/obj', 'model/stl', 'font/ttf', 'font/otf', 'font/woff', 'font/woff2',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/octet-stream'
])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy files_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'files' and (storage.foldername(name))[1] = (auth.uid())::text);

-- удалить свой файл (например, убранный из формы до отправки); для удаления нужно и право видеть
create policy files_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'files' and owner_id = (auth.uid())::text);

create policy files_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'files' and owner_id = (auth.uid())::text);
