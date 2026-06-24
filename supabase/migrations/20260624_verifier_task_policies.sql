-- RLS support for verifier task queue.
-- Verifiers can see accepted bids, create missing deal tasks, view unassigned tasks,
-- and claim one task by setting verifier_id.

alter table public.deals enable row level security;
alter table public.verification_reports enable row level security;

drop policy if exists "Verifier can view accepted bids" on public.bids;
create policy "Verifier can view accepted bids"
  on public.bids for select to authenticated
  using (
    status = 'accepted'
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and is_verifier = true
    )
  );

drop policy if exists "Verifier can view listings for tasks" on public.listings;
create policy "Verifier can view listings for tasks"
  on public.listings for select to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and is_verifier = true
    )
  );

drop policy if exists "Verifier can view task deals" on public.deals;
create policy "Verifier can view task deals"
  on public.deals for select to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and is_verifier = true
    )
    and (verifier_id is null or verifier_id = auth.uid())
  );

drop policy if exists "Deal participants can view own deals" on public.deals;
create policy "Deal participants can view own deals"
  on public.deals for select to authenticated
  using (
    auth.uid() in (
      side_a_owner_id,
      side_a_recipient_id,
      side_b_owner_id,
      side_b_recipient_id
    )
  );

drop policy if exists "Verifier can create unassigned deal tasks" on public.deals;
create policy "Verifier can create unassigned deal tasks"
  on public.deals for insert to authenticated
  with check (
    verifier_id is null
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and is_verifier = true
    )
  );

drop policy if exists "Verifier can claim unassigned deals" on public.deals;
create policy "Verifier can claim unassigned deals"
  on public.deals for update to authenticated
  using (
    verifier_id is null
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and is_verifier = true
    )
  )
  with check (verifier_id = auth.uid());

drop policy if exists "Verifier can view own verification reports" on public.verification_reports;
create policy "Verifier can view own verification reports"
  on public.verification_reports for select to authenticated
  using (
    verifier_id = auth.uid()
    or exists (
      select 1
      from public.deals
      where deals.id = verification_reports.deal_id
        and auth.uid() in (
          side_a_owner_id,
          side_a_recipient_id,
          side_b_owner_id,
          side_b_recipient_id
        )
    )
  );

drop policy if exists "Verifier can insert reports for claimed deals" on public.verification_reports;
create policy "Verifier can insert reports for claimed deals"
  on public.verification_reports for insert to authenticated
  with check (
    verifier_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and is_verifier = true
    )
    and exists (
      select 1
      from public.deals
      where deals.id = deal_id
        and deals.verifier_id = auth.uid()
        and listing_id in (side_a_listing_id, side_b_listing_id)
    )
  );

drop policy if exists "Verifier can delete own reports before resubmitting" on public.verification_reports;
create policy "Verifier can delete own reports before resubmitting"
  on public.verification_reports for delete to authenticated
  using (
    verifier_id = auth.uid()
    and exists (
      select 1
      from public.deals
      where deals.id = deal_id
        and deals.verifier_id = auth.uid()
        and deals.verification_reported_at is null
    )
  );
