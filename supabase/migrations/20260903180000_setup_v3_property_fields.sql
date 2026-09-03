-- v3 property fields: hotel brand; city/country no longer collected in UI.
-- Local migration only. Do not apply to remote without explicit approval.

alter table public.properties drop constraint if exists properties_city_nonempty;
alter table public.properties drop constraint if exists properties_country_nonempty;
alter table public.properties alter column city drop not null;
alter table public.properties alter column country drop not null;

alter table public.properties add column if not exists hotel_brand text null;
