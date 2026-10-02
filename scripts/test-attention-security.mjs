import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const root = process.cwd();
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const sql = read('supabase/migrations/20261003120000_attention_public_identity_hardening.sql');
const listingSql = read('supabase/migrations/20261002120000_attention_min_bid_and_demo_cleanup.sql');
const hardening = read('supabase/migrations/20260921190000_attention_hardening.sql');
const triggerSql = read('supabase/migrations/20260921230000_attention_bid_definer_trigger.sql');
const client = read('lib/supabase.ts');
const model = read('app/attention/model.ts');
const validation = read('app/attention/validation.ts');
const pages = read('app/attention/pages.tsx');
const chipsCss = read('app/attention/attention.css');
const collabcyCss = read('app/collabcy.css');

assert.match(sql, /create or replace view public\.attention_products_public/);
assert.match(sql, /create or replace view public\.attention_bids_public/);
assert.match(sql, /create or replace view public\.attention_activity_public/);
assert.match(sql, /security_invoker = false/);
assert.match(sql, /grant select on public\.attention_products_public to anon, authenticated/);
assert.match(sql, /grant select on public\.attention_bids_public to anon, authenticated/);
assert.match(sql, /grant select on public\.attention_activity_public to anon, authenticated/);
assert.doesNotMatch(sql, /grant select on table public\.attention_products to anon/);
assert.match(sql, /revoke select, insert, update, delete, truncate on table public\.attention_products from anon, authenticated, public/);
assert.match(sql, /revoke select, insert, update, delete, truncate on table public\.attention_bids from anon, authenticated, public/);
assert.match(sql, /revoke select, insert, update, delete, truncate on table public\.attention_activity from anon, authenticated, public/);
assert.match(sql, /grant select \(id, product_id, amount, created_at\)/);
assert.doesNotMatch(sql, /grant select \(owner_id/);
assert.doesNotMatch(sql, /grant select \(bidder_id/);
assert.match(sql, /values \(p_product_id, null, v_new, v_now\)/);
assert.match(sql, /v_new := v_product\.current_bid \+ p_increment/);
assert.match(sql, /for update/);
assert.match(sql, /set search_path = public/);
assert.match(sql, /attention_rate_limit/);
assert.match(sql, /revoke all on table public\.attention_rate_windows from public, anon, authenticated/);
assert.match(sql, /grant execute on function public\.place_attention_bid\(uuid, integer\) to anon, authenticated/);

assert.doesNotMatch(sql.split('attention_products_public')[1].split(';')[0], /owner_id/);
assert.doesNotMatch(sql.split('attention_bids_public')[1].split(';')[0], /bidder_id/);

assert.match(listingSql, /p_initial_bid < 2/);
assert.match(model, /MIN_INITIAL_BID=2/);
assert.match(validation, /input\.initialBid < MIN_INITIAL_BID/);
assert.match(hardening, /protect_attention_product_fields/);
assert.match(triggerSql, /current_user in \('authenticated', 'anon'\)/);
assert.match(triggerSql, /new\.current_bid is distinct from old\.current_bid/);

assert.match(client, /from\("attention_products_public"\)/);
assert.match(client, /from\("attention_bids_public"\)/);
assert.match(client, /from\("attention_activity_public"\)/);
assert.doesNotMatch(client, /from\("attention_products"\)/);
assert.doesNotMatch(client, /from\("attention_bids"\)/);
assert.doesNotMatch(client, /from\("attention_activity"\)/);
assert.doesNotMatch(client, /ATTENTION_PRODUCT_COLUMNS[\s\S]*owner_id/);
assert.doesNotMatch(client, /select\("id, product_id, bidder_id/);
assert.doesNotMatch(client, /JSON\.stringify\(data\)/);
assert.match(client, /console\.error\("\[attention\]", operation, parts\.code \|\| "error"\)/);
assert.match(client, /brandId: ""/);
assert.doesNotMatch(client, /NEXT_PUBLIC_SUPABASE_SERVICE/);
assert.doesNotMatch(client, /SERVICE_ROLE/);
assert.doesNotMatch(client, /client_secret/);

assert.match(pages, /attention-chip-strip/);
assert.match(pages, /aria-label="Scroll categories right"/);
assert.match(chipsCss, /attention-chip-strip/);
assert.match(chipsCss, /attention-chip-next/);
assert.match(collabcyCss, /\.attention-chips button/);

console.log('PASS: attention public identity hardening, RPC write path, client views, sanitized logs, chip UI files unchanged.');
