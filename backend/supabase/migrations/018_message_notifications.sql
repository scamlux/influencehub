-- ─────────────────────────────────────────────────────────────────────────────
-- T-08: notify the chat counterpart when a message is sent.
--
-- Same pattern as 004_realtime.sql: clients cannot INSERT notifications for
-- other users, so the row is created by a SECURITY DEFINER trigger and then
-- streamed to the recipient over Realtime. One unread notification per chat
-- (deal): while an unread "message" notification for that chat exists, new
-- messages don't stack another row.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.notify_message_received()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  brand_user uuid;
  inf_user uuid;
  recipient uuid;
  chat_link text;
begin
  select b.user_id, i.user_id
    into brand_user, inf_user
  from public.deals d
  left join public.brand_profiles b on b.id = d.brand_id
  left join public.influencer_profiles i on i.id = d.influencer_id
  where d.id = new.deal_id;

  if new.sender_id = brand_user then
    recipient := inf_user;
    chat_link := '/influencer/chat/' || new.deal_id;
  elsif new.sender_id = inf_user then
    recipient := brand_user;
    chat_link := '/brand/chat/' || new.deal_id;
  else
    return new; -- admin or unknown sender: no counterpart notification
  end if;

  if recipient is not null and not exists (
    select 1 from public.notifications
    where user_id = recipient and type = 'message' and link = chat_link and is_read = false
  ) then
    insert into public.notifications (user_id, type, title, message, link)
    values (
      recipient, 'message', 'New message',
      left(new.content, 120), chat_link
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_message_received on public.messages;
create trigger trg_notify_message_received
  after insert on public.messages
  for each row execute function public.notify_message_received();
