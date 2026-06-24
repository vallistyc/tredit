-- Flow TREDIT v4 verifier, completion, and refund demo support.
-- Run after 20260623_flow_v4_deals.sql.

do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.bids'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%status%';

  if constraint_name is not null then
    execute format('alter table public.bids drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.bids
  add constraint bids_status_check
  check (status in (
    'pending',
    'accepted',
    'rejected',
    'cancelled',
    'expired',
    'verification_passed',
    'completed',
    'refund_pitcher_invalid',
    'refund_catcher_invalid',
    'refund_both_invalid'
  ));

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'bids'
      and policyname = 'Verifier demo can view active deals'
  ) then
    create policy "Verifier demo can view active deals"
      on public.bids for select to authenticated
      using (status in (
        'accepted',
        'verification_passed',
        'completed',
        'refund_pitcher_invalid',
        'refund_catcher_invalid',
        'refund_both_invalid'
      ));
  end if;
end $$;

create or replace function public.verify_bid_v4(
  p_bid_id uuid,
  p_pitcher_valid boolean,
  p_catcher_valid boolean
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_bid public.bids%rowtype;
  next_status text;
begin
  select * into selected_bid
  from public.bids
  where id = p_bid_id
  for update;

  if not found then
    raise exception 'Bid not found';
  end if;

  if selected_bid.status not in ('accepted', 'verification_passed') then
    raise exception 'Only accepted deals can be verified';
  end if;

  if p_pitcher_valid and p_catcher_valid then
    next_status := 'verification_passed';
  elsif not p_pitcher_valid and p_catcher_valid then
    next_status := 'refund_pitcher_invalid';
  elsif p_pitcher_valid and not p_catcher_valid then
    next_status := 'refund_catcher_invalid';
  else
    next_status := 'refund_both_invalid';
  end if;

  update public.bids
  set status = next_status
  where id = selected_bid.id;

  if next_status <> 'verification_passed' then
    update public.listings
    set status = 'cancelled'
    where id in (selected_bid.listing_id, selected_bid.offered_listing_id);
  end if;

  return next_status;
end;
$$;

create or replace function public.complete_bid_v4(p_bid_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_bid public.bids%rowtype;
begin
  select * into selected_bid
  from public.bids
  where id = p_bid_id
  for update;

  if not found then
    raise exception 'Bid not found';
  end if;

  if selected_bid.status <> 'verification_passed' then
    raise exception 'Only verified deals can be completed';
  end if;

  update public.bids
  set status = 'completed'
  where id = selected_bid.id;

  update public.listings
  set status = 'completed'
  where id in (selected_bid.listing_id, selected_bid.offered_listing_id);
end;
$$;

grant execute on function public.verify_bid_v4(uuid, boolean, boolean) to authenticated;
grant execute on function public.complete_bid_v4(uuid) to authenticated;
