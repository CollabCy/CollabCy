-- Remove abandoned Creator ↔ Brand collaboration objects.
-- Does not drop Attention Marketplace tables, RPCs, views, or payment infrastructure.
-- Does not touch auth.users or authentication providers.
-- Local implementation file. Do not apply to production unless explicitly requested.
--
-- Order:
-- 1. Collaboration views (CASCADE stays on collab views only).
-- 2. Functions whose identity/return types depend on collaboration composites,
--    while those types still exist.
-- 3. Collaboration tables (CASCADE stays on collab tables only; child → parent).
-- 4. Remaining collaboration functions, including trigger helpers.
-- Function DROP statements use exact production identity arguments and do not use CASCADE.

-- ---------------------------------------------------------------------------
-- 1. Collaboration views
-- ---------------------------------------------------------------------------
drop view if exists public.public_creators cascade;
drop view if exists public.public_brands cascade;

-- ---------------------------------------------------------------------------
-- 2. Functions that depend on collaboration composite types
-- ---------------------------------------------------------------------------
drop function if exists public.deal_to_json(public.deals);
drop function if exists public.internal_open_deal_dispute(public.deals, text);
drop function if exists public.invite_creator_to_campaign(uuid, uuid, text, integer);

-- ---------------------------------------------------------------------------
-- 3. Collaboration tables (CASCADE for collab FKs/triggers/policies only)
-- ---------------------------------------------------------------------------
drop table if exists public.messages cascade;
drop table if exists public.notifications cascade;
drop table if exists public.conversations cascade;
drop table if exists public.deal_verification_events cascade;
drop table if exists public.deal_submissions cascade;
drop table if exists public.deal_disputes cascade;
drop table if exists public.deals cascade;
drop table if exists public.campaign_applications cascade;
drop table if exists public.connections cascade;
drop table if exists public.campaigns cascade;
drop table if exists public.social_accounts cascade;
drop table if exists public.creator_verification_requests cascade;
drop table if exists public.marketplace_role_audit cascade;
drop table if exists public.platform_verifiers cascade;
drop table if exists public.profiles cascade;

-- ---------------------------------------------------------------------------
-- 4. Remaining collaboration functions (exact production identities)
-- ---------------------------------------------------------------------------
drop function if exists public.accept_campaign_application(uuid);
drop function if exists public.admin_approve_creator_verification(uuid);
drop function if exists public.admin_reject_creator_verification(uuid, text);
drop function if exists public.brand_is_publicly_listed(uuid);
drop function if exists public.brand_owns_campaign(uuid);
drop function if exists public.campaign_is_open_for_applications(uuid);
drop function if exists public.cancel_deal(uuid, text);
drop function if exists public.complete_deal(uuid);
drop function if exists public.connections_after_insert_ensure_deal();
drop function if exists public.conversation_accepts_messages(uuid);
drop function if exists public.create_network_connection(uuid, text);
drop function if exists public.creator_is_publicly_listed(uuid);
drop function if exists public.current_brand_can_browse_creators();
drop function if exists public.current_user_is_brand();
drop function if exists public.current_user_is_creator();
drop function if exists public.deal_clean_website(text);
drop function if exists public.enforce_brand_creator_application();
drop function if exists public.enforce_brand_creator_connection();
drop function if exists public.enforce_brand_creator_conversation();
drop function if exists public.enforce_brand_creator_deal();
drop function if exists public.enforce_distinct_connection_parties();
drop function if exists public.enforce_distinct_conversation_parties();
drop function if exists public.ensure_conversation(uuid);
drop function if exists public.ensure_my_deals();
drop function if exists public.internal_ensure_conversation(uuid);
drop function if exists public.internal_ensure_deal(uuid);
drop function if exists public.internal_notify_deal(uuid, text, text, text, uuid);
drop function if exists public.internal_notify_platform(text, text, text, uuid);
drop function if exists public.internal_record_deal_event(uuid, uuid, text, text, text, text, text, text);
drop function if exists public.is_conversation_participant(uuid);
drop function if exists public.is_platform_verifier(uuid);
drop function if exists public.list_admin_activity();
drop function if exists public.list_admin_conversations();
drop function if exists public.list_admin_overview();
drop function if exists public.list_creator_verification_queue(text);
drop function if exists public.list_verification_queue(text);
drop function if exists public.mark_deal_disputed(uuid, text);
drop function if exists public.notify_application_inserted();
drop function if exists public.notify_application_status();
drop function if exists public.notify_connection_created();
drop function if exists public.notify_new_message();
drop function if exists public.open_deal_dispute(uuid, text);
drop function if exists public.prepare_message();
drop function if exists public.prevent_second_marketplace_role();
drop function if exists public.profile_has_role(uuid, text);
drop function if exists public.protect_campaign_application_ownership();
drop function if exists public.protect_connection_ownership();
drop function if exists public.protect_conversation_ownership();
drop function if exists public.protect_deal_fields();
drop function if exists public.protect_message_immutability();
drop function if exists public.protect_notification_fields();
drop function if exists public.protect_profile_verification_columns();
drop function if exists public.record_admin_internal_note(uuid, text);
drop function if exists public.request_creator_verification();
drop function if exists public.request_deal_revision(uuid, text);
drop function if exists public.request_platform_revision(uuid, text);
drop function if exists public.resolve_deal_dispute(uuid, text, text);
drop function if exists public.send_platform_message(uuid, text);
drop function if exists public.set_campaign_applications_updated_at();
drop function if exists public.set_campaigns_updated_at();
drop function if exists public.set_connections_updated_at();
drop function if exists public.set_conversations_updated_at();
drop function if exists public.set_creator_verification_requests_updated_at();
drop function if exists public.set_deals_updated_at();
drop function if exists public.set_profiles_updated_at();
drop function if exists public.set_social_accounts_updated_at();
drop function if exists public.snapshot_application_campaign();
drop function if exists public.submit_deal(uuid, text, text);
drop function if exists public.sync_my_conversations();
drop function if exists public.touch_conversation_on_message();
drop function if exists public.verify_deal_brand(uuid, text);
drop function if exists public.verify_deal_platform(uuid, text);
