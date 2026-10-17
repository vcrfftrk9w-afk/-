'use strict';
/* Куда приложение ходит за данными: база Supabase, функции public.sauda_*.
   Публичный ключ даёт только вызвать эти функции; таблицы закрыты.
   Локальный сервер для проверок (tools/sauda-dev-server.js) подменяет этот файл. */
const Cfg = {
  api: 'https://lgsharkholmydihgtvis.supabase.co/rest/v1/rpc/',
  key: 'sb_publishable_LOhVqfH3mpiVFnziN1lj8w_S3qQFc5B',
};
