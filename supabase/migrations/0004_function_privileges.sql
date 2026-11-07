-- Functions are executable by PUBLIC by default; tighten.
revoke execute on all functions in schema public from public, anon;
alter default privileges in schema public revoke execute on functions from public, anon;

-- Trigger-only functions: nobody calls these directly (triggers still fire).
revoke execute on function handle_new_user(), notify_task_assignee(), notify_mention(), enforce_review_rules(),
  log_rights_change(), set_song_code(), seed_mix_thresholds(), enforce_post_approval(), check_splits()
  from authenticated;

-- Helpers used inside RLS policies + the stage-gate RPC stay callable by signed-in users.
grant execute on function has_page_role(uuid, page_role[]), can_see_song(uuid), can_work_on_song(uuid),
  song_page(uuid), deliverable_song(uuid), version_song(uuid), is_member_anywhere(), is_rights_owner(),
  stage_gate_ok(uuid, stage_key), post_signoff_page(uuid, uuid), advance_song_stage(uuid, stage_key)
  to authenticated;
