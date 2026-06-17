-- Hardening de la tabla coupons
--
--  * code   : UNIQUE (no se repiten cupones)
--  * type   : CHECK contra el set de juegos/experiencias válidos
--  * índice : (code, redeemed) para validar/redimir rápido
--
-- Aplicado originalmente vía dashboard de Supabase. Idempotente.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.coupons'::regclass
      and conname  = 'coupons_code_unique'
  ) then
    alter table public.coupons
      add constraint coupons_code_unique unique (code);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.coupons'::regclass
      and conname  = 'coupons_type_check'
  ) then
    alter table public.coupons
      add constraint coupons_type_check
      check (type = any (array[
        'trivia', 'rey_orto', 'desafio_demente', 'suma', 'palabra',
        'karaoke', 'ftl', 'pt', 'duelo'
      ]));
  end if;
end $$;

create index if not exists idx_coupons_code_redeemed
  on public.coupons using btree (code, redeemed);
