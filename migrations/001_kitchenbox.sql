-- Run once in Supabase SQL Editor. No browser permissions, no public storage.
create table if not exists public.kb_config(id text primary key check(id='main'),data jsonb not null);
create table if not exists public.kb_quotes(
 id text primary key, fingerprint text unique not null, contact jsonb not null, config jsonb not null,
 calculation jsonb not null,status text not null,issues jsonb not null default '[]',created_at timestamptz not null default now(),pdf text,provider_id text
);
alter table public.kb_config enable row level security;
alter table public.kb_quotes enable row level security;
revoke all on public.kb_config,public.kb_quotes from anon,authenticated;
create or replace function public.kb_save_config(p_data jsonb) returns void language sql security invoker set search_path=public as $$
 insert into kb_config(id,data) values('main',p_data) on conflict(id) do update set data=excluded.data;
$$;
create or replace function public.kb_claim_quote(p_quote jsonb) returns jsonb language plpgsql security invoker set search_path=public as $$
declare q kb_quotes; claimed boolean;
begin
 insert into kb_quotes(id,fingerprint,contact,config,calculation,status,issues,created_at)
 values(p_quote->>'id',p_quote->>'fingerprint',p_quote->'contact',p_quote->'config',p_quote->'calculation',p_quote->>'status',p_quote->'issues',(p_quote->>'created_at')::timestamptz)
 on conflict(fingerprint) do nothing returning * into q;
 claimed := found;
 if not claimed then select * into q from kb_quotes where fingerprint=p_quote->>'fingerprint'; end if;
 return jsonb_build_object('quote',to_jsonb(q),'claimed',claimed);
end; $$;
create or replace function public.kb_claim_send(p_id text) returns boolean language plpgsql security invoker set search_path=public as $$
begin
 update kb_quotes set status='sending' where id=p_id and status='ready';
 return found;
end; $$;
revoke all on function public.kb_save_config(jsonb),public.kb_claim_quote(jsonb),public.kb_claim_send(text) from public,anon,authenticated;
grant execute on function public.kb_save_config(jsonb),public.kb_claim_quote(jsonb),public.kb_claim_send(text) to service_role;
