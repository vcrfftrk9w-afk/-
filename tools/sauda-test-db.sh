#!/bin/sh
# Чистая локальная база для проверок маркетплейса Sauda: окружение как в Supabase (роли anon/authenticated,
# схема extensions) и все миграции sauda по порядку.
#   tools/sauda-test-db.sh [каталог сокета] [порт] [имя базы]
set -e
HOST=${1:-/var/tmp/saudapg}
PORT=${2:-54329}
NAME=${3:-sauda}
P="psql -h $HOST -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
DIR=$(dirname "$0")/..
$P -c "drop database if exists $NAME with (force)" -c "create database $NAME"
$P -d $NAME <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
SQL
for f in "$DIR"/supabase/migrations/*_sauda_*.sql; do
  $P -d $NAME -1 -f "$f" > /dev/null
done
echo "$NAME: база готова"
