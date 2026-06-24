-- Reviews submitted by users after a deal is completed.

create table if not exists public.deal_reviews (
  id uuid default gen_random_uuid() primary key,
  deal_id uuid references public.deals(id) on delete cascade not null,
  reviewer_id uuid references public.profiles(id) on delete cascade not null,
  reviewed_user_id uuid references public.profiles(id) on delete cascade not null,
  user_rating int not null check (user_rating between 1 and 5),
  user_review text default '',
  platform_rating int not null check (platform_rating between 1 and 5),
  platform_review text default '',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique (deal_id, reviewer_id)
);

alter table public.deal_reviews enable row level security;

drop policy if exists "Users can view own deal reviews" on public.deal_reviews;
create policy "Users can view own deal reviews"
  on public.deal_reviews for select to authenticated
  using (reviewer_id = auth.uid() or reviewed_user_id = auth.uid());

drop policy if exists "Users can insert own completed deal reviews" on public.deal_reviews;
create policy "Users can insert own completed deal reviews"
  on public.deal_reviews for insert to authenticated
  with check (
    reviewer_id = auth.uid()
    and exists (
      select 1
      from public.deals
      where id = deal_id
        and status = 'completed'
        and auth.uid() in (
          side_a_owner_id,
          side_a_recipient_id,
          side_b_owner_id,
          side_b_recipient_id
        )
    )
  );

drop policy if exists "Users can update own deal reviews" on public.deal_reviews;
create policy "Users can update own deal reviews"
  on public.deal_reviews for update to authenticated
  using (reviewer_id = auth.uid())
  with check (reviewer_id = auth.uid());
