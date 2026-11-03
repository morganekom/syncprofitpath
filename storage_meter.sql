-- Admin-only function that returns file storage totals for the admin dashboard meter.
-- Read-only. Creates one function, changes no tables or data.
create or replace function public.admin_storage_usage()
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  if not exists (select 1 from public.users where id = auth.uid() and role = 'admin') then
    raise exception 'not authorized';
  end if;

  return jsonb_build_object(
    'total_bytes', coalesce((select sum((metadata->>'size')::bigint) from storage.objects), 0),
    'buckets', coalesce((
      select jsonb_agg(jsonb_build_object('bucket', bucket_id, 'files', files, 'bytes', bytes) order by bytes desc)
      from (
        select bucket_id, count(*) as files, coalesce(sum((metadata->>'size')::bigint), 0) as bytes
        from storage.objects
        group by bucket_id
      ) s
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_storage_usage() from public, anon;
grant execute on function public.admin_storage_usage() to authenticated;
