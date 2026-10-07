import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const root=process.cwd();
const read=(rel)=>readFileSync(join(root,rel),'utf8');

const sql=read('supabase/migrations/20261001120000_open_marketplace_and_creator_verification.sql');
const client=read('lib/supabase.ts');
const data=read('app/data.ts');
const directories=read('app/ui/directories.tsx');
const marketplace=read('app/marketplace.tsx');
const admin=read('app/ui/admin.tsx');
const account=read('app/ui/account.tsx');
const publicUi=read('app/ui/public.tsx');
const brand=read('app/ui/brand.tsx');
const auth=read('app/ui/auth.tsx');
const connectionsRpc=read('supabase/migrations/20260922120000_connections_rpc_only.sql');
const roleSql=read('supabase/migrations/20260921260000_marketplace_role_separation.sql');

// A. Free campaign listing
assert.match(publicUi,/Campaign listing is also free for brands/);
assert.match(publicUi,/Campaign listing is free for brands/);
assert.match(brand,/You can create, publish, and manage campaigns for free/);
assert.match(brand,/Publish campaign/);
assert.doesNotMatch(brand,/pay \$5/);
assert.doesNotMatch(brand,/listing fee/);
assert.doesNotMatch(client,/campaign listing fee/);
assert.match(brand,/updateCampaign/);

// B. Authenticated directories (guests cannot browse)
assert.match(sql,/grant select on public\.public_creators to authenticated/);
assert.match(sql,/grant select on public\.public_brands to authenticated/);
assert.doesNotMatch(sql,/grant select on public\.public_creators to anon/);
assert.doesNotMatch(sql,/grant select on public\.public_brands to anon/);
assert.match(sql,/verification_status = 'approved'/);
assert.match(sql,/create view public\.public_brands/);
assert.doesNotMatch(sql,/p\.email/);
assert.match(client,/from\("public_creators"\)/);
assert.match(client,/from\("public_brands"\)/);
assert.match(client,/requireAuthenticatedUser/);
assert.doesNotMatch(client,/function publicDataClient/);
assert.doesNotMatch(client,/currentBrandHasCampaign/);
assert.match(marketplace,/path==='\/creators'/);
assert.match(marketplace,/path==='\/brands'/);
assert.match(marketplace,/login\?next=\$\{encodeURIComponent\(path\)\}/);
assert.doesNotMatch(marketplace,/CreatorDiscovery publicView/);
assert.doesNotMatch(marketplace,/BrandDiscovery publicView/);
assert.match(marketplace,/if\(path==='\/'\)return <AttentionMarketplace\/>/);
assert.match(marketplace,/if\(path==='\/discover'\)\{router\.replace\('\/'\);return\}/);
assert.doesNotMatch(marketplace,/if\(path==='\/discover'\)return <AttentionMarketplace\/>/);
assert.match(directories,/listPublicCreators/);
assert.match(directories,/listPublicBrands/);
assert.match(directories,/if\(!s\.session\)return/);
const publicHeader=publicUi.slice(publicUi.indexOf('export function PublicHeader'),publicUi.indexOf('export function PublicFooter'));
const publicFooter=publicUi.slice(publicUi.indexOf('export function PublicFooter'),publicUi.indexOf('export const faq'));
assert.doesNotMatch(publicHeader,/href="\/creators"/);
assert.doesNotMatch(publicHeader,/href="\/brands"/);
assert.doesNotMatch(publicHeader,/href="\/login"/);
assert.doesNotMatch(publicHeader,/href="\/signup"/);
assert.match(publicHeader,/href="\/"/);
assert.doesNotMatch(publicFooter,/href="\/creators"/);
assert.doesNotMatch(publicFooter,/href="\/brands"/);
assert.doesNotMatch(publicFooter,/href="\/login"/);
assert.doesNotMatch(publicFooter,/href="\/signup"/);

// C. Verification
assert.match(sql,/create table if not exists public\.creator_verification_requests/);
assert.match(sql,/creator_verification_requests_one_pending_idx/);
assert.match(sql,/request_creator_verification\(\)/);
assert.match(sql,/admin_approve_creator_verification\(p_creator_id uuid\)/);
assert.match(sql,/admin_reject_creator_verification\(p_creator_id uuid, p_reason text\)/);
assert.match(sql,/if not public\.is_platform_verifier\(\)/);
assert.match(sql,/if not public\.current_user_is_creator\(\)/);
assert.match(sql,/internal_notify_platform/);
assert.match(sql,/creator_verification_approved/);
assert.match(sql,/creator_verification_rejected/);
assert.match(sql,/collabcy\.verification_write/);
assert.match(sql,/grant execute on function public\.request_creator_verification\(\) to authenticated/);
assert.match(sql,/revoke all on table public\.creator_verification_requests from anon, public, authenticated/);
assert.match(account,/Request for Verification/);
assert.match(account,/Verification Pending/);
assert.match(account,/Verification Rejected/);
assert.match(admin,/AdminCreatorVerification/);
assert.match(admin,/adminApproveCreatorVerification/);
assert.match(admin,/adminRejectCreatorVerification/);
assert.match(admin,/A meaningful reason is required/);
assert.match(directories,/Profile unavailable/);
assert.match(directories,/not publicly available/);

// D. Same-role connections
assert.match(sql,/create_network_connection/);
assert.match(sql,/kind = 'network'/);
assert.match(sql,/Campaign collaborations must be between a Brand and a Creator/);
assert.match(sql,/grant execute on function public\.create_network_connection\(uuid, text\) to authenticated/);
assert.match(client,/createNetworkConnection/);
assert.match(directories,/createNetworkConnection/);
assert.match(connectionsRpc,/revoke insert on table public\.connections/);
assert.doesNotMatch(connectionsRpc,/grant insert on table public\.connections/);
assert.match(roleSql,/campaign_applications_brand_creator_only/);
assert.match(roleSql,/deals_brand_creator_only/);
assert.match(sql,/internal_ensure_deal/);
assert.match(sql,/coalesce\(conn\.kind, 'collaboration'\) is distinct from 'collaboration'/);

// E. Existing flows remain
assert.match(client,/invite_creator_to_campaign/);
assert.match(client,/accept_campaign_application/);
assert.match(client,/list_verification_queue/);
assert.match(client,/publish_attention_listing/);
assert.doesNotMatch(marketplace,/startDemo/);
assert.doesNotMatch(client,/demoDeals/);
assert.match(data,/profiles_one_identity|canonicalMarketplaceRole/);
assert.match(auth,/One email can be a Brand or a Creator, not both/);

console.log('PASS: marketplace policy — free campaign listing, login-required directories, creator verification, same-role networking, Attention Marketplace at /.');
