-- Let bid participants view both listings involved in a bid, including pending bids.
-- This lets Pitchers see the Catcher's offered listing in /deals before accepting.

create or replace function public.can_view_listing_through_bid(p_listing_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bids b
    join public.listings target_listing
      on target_listing.id = b.listing_id
    where (
      b.listing_id = p_listing_id
      or b.offered_listing_id = p_listing_id
    )
    and (
      b.bidder_id = auth.uid()
      or target_listing.owner_id = auth.uid()
    )
  );
$$;

grant execute on function public.can_view_listing_through_bid(uuid) to authenticated;

drop policy if exists "Bid participants can view bid listings" on public.listings;

create policy "Bid participants can view bid listings"
  on public.listings for select to authenticated
  using (public.can_view_listing_through_bid(id));
