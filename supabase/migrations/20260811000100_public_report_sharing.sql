alter table public.report_share_links
  add column if not exists view_mode text not null default 'CLIENT';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'report_share_links_view_mode_check'
      and conrelid = 'public.report_share_links'::regclass
  ) then
    alter table public.report_share_links
      add constraint report_share_links_view_mode_check
      check (view_mode in ('CLIENT','AM'));
  end if;
end $$;

create or replace function public.get_shared_report(share_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'share', jsonb_build_object(
      'viewMode', link.view_mode,
      'expiresAt', link.expires_at
    ),
    'account', jsonb_build_object(
      'name', account.name,
      'location', account.location,
      'logoUrl', account.logo_url,
      'logoDataUrl', account.logo_data_url
    ),
    'report', jsonb_build_object(
      'id', report.id,
      'reportMonth', report.report_month,
      'dateRange', report.date_range,
      'campaigns', report.campaigns,
      'draft', case
        when link.view_mode = 'AM' then report.draft
        else report.draft - 'internal'
      end,
      'hiddenKpis', report.hidden_kpis,
      'metrics', report.metrics,
      'status', report.status,
      'updatedAt', report.updated_at
    )
  )
  from public.report_share_links as link
  join public.saved_reports as report on report.id = link.report_id
  join public.client_accounts as account on account.id = report.account_id
  where link.token = share_token
    and link.revoked_at is null
    and (link.expires_at is null or link.expires_at > now())
  limit 1;
$$;

revoke all on function public.get_shared_report(uuid) from public;
grant execute on function public.get_shared_report(uuid) to anon, authenticated;
