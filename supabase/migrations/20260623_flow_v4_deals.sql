-- Flow TREDIT v4 support.
-- Run this in Supabase SQL Editor after confirming the current tables exist.

do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.listings'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%status%';

  if constraint_name is not null then
    execute format('alter table public.listings drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.listings
  add constraint listings_status_check
  check (status in (
    'active',
    'pending_offer',
    'locked_in_deal',
    'completed',
    'inactive',
    'locked',
    'cancelled'
  ));

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
  check (status in ('pending', 'accepted', 'rejected', 'cancelled', 'expired'));

create or replace function public.accept_bid_v4(p_bid_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_bid public.bids%rowtype;
  target_listing public.listings%rowtype;
begin
  select * into selected_bid
  from public.bids
  where id = p_bid_id
  for update;

  if not found then
    raise exception 'Bid not found';
  end if;

  select * into target_listing
  from public.listings
  where id = selected_bid.listing_id
  for update;

  if target_listing.owner_id <> auth.uid() then
    raise exception 'Only the Pitcher can accept this bid';
  end if;

  update public.bids
  set status = 'accepted'
  where id = selected_bid.id;

  update public.bids
  set status = 'cancelled'
  where status = 'pending'
    and id <> selected_bid.id
    and (
      listing_id = selected_bid.listing_id
      or offered_listing_id = selected_bid.offered_listing_id
    );

  update public.listings
  set status = 'locked_in_deal'
  where id in (selected_bid.listing_id, selected_bid.offered_listing_id);
end;
$$;

create or replace function public.reject_bid_v4(p_bid_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_bid public.bids%rowtype;
  target_listing public.listings%rowtype;
  remaining_pending int;
begin
  select * into selected_bid
  from public.bids
  where id = p_bid_id
  for update;

  if not found then
    raise exception 'Bid not found';
  end if;

  select * into target_listing
  from public.listings
  where id = selected_bid.listing_id;

  if target_listing.owner_id <> auth.uid() then
    raise exception 'Only the Pitcher can reject this bid';
  end if;

  update public.bids
  set status = 'rejected'
  where id = selected_bid.id;

  select count(*) into remaining_pending
  from public.bids
  where offered_listing_id = selected_bid.offered_listing_id
    and status = 'pending';

  if remaining_pending = 0 then
    update public.listings
    set status = 'active'
    where id = selected_bid.offered_listing_id
      and status = 'pending_offer';
  end if;
end;
$$;

grant execute on function public.accept_bid_v4(uuid) to authenticated;
grant execute on function public.reject_bid_v4(uuid) to authenticated;
