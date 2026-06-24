-- Let deal participants view both listings inside their own deals.

drop policy if exists "Deal participants can view deal listings" on public.listings;

create policy "Deal participants can view deal listings"
  on public.listings for select to authenticated
  using (
    exists (
      select 1
      from public.deals
      where (
        side_a_listing_id = listings.id
        or side_b_listing_id = listings.id
      )
      and auth.uid() in (
        side_a_owner_id,
        side_a_recipient_id,
        side_b_owner_id,
        side_b_recipient_id,
        verifier_id
      )
    )
  );
