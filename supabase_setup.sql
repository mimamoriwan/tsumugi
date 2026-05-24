-- memosテーブル作成
create table memos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- updated_at自動更新トリガー
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger memos_updated_at
  before update on memos
  for each row execute function update_updated_at();

-- RLS有効化
alter table memos enable row level security;

-- 全操作を許可するポリシー（シングルユーザー用）
create policy "allow_all" on memos
  for all
  using (true)
  with check (true);

-- anonロールにテーブル権限を付与
grant all on table memos to anon;
grant all on table memos to authenticated;

-- archivedカラム追加（マイグレーション）
-- Supabaseのダッシュボード > SQL Editor で実行すること
alter table memos add column if not exists archived boolean not null default false;
