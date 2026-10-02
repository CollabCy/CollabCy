import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';

const root=process.cwd();
const read=(rel)=>readFileSync(join(root,rel),'utf8');
const out=mkdtempSync(join(tmpdir(),'gohighnet-brand-directory-'));
const main=()=>{
 const build=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','app/data.ts','--outDir',out,'--module','commonjs','--target','es2022','--skipLibCheck'],{encoding:'utf8'});
 assert.equal(build.status,0,build.stdout+build.stderr);
 writeFileSync(join(out,'package.json'),'{"type":"commonjs"}');
 const require=createRequire(import.meta.url);
 const {brandCanBrowseCreators,isCreatorUserId,realDirectoryCreators}=require(join(out,'data.js'));

 assert.equal(brandCanBrowseCreators('brand',[]),true);
 assert.equal(brandCanBrowseCreators('brand',[{id:'draft'}]),true);
 assert.equal(brandCanBrowseCreators('creator',[]),true);
 assert.equal(isCreatorUserId('maya'),false);
 assert.equal(isCreatorUserId('Temp'),false);
 assert.equal(isCreatorUserId(''),false);
 assert.equal(isCreatorUserId('11111111-1111-4111-8111-111111111111'),true);
 assert.deepEqual(realDirectoryCreators([{id:'maya',name:'Maya'},{id:'11111111-1111-4111-8111-111111111111',name:'Real'}]).map(c=>c.id),['11111111-1111-4111-8111-111111111111']);
 const {brandCreatorRelationship}=require(join(out,'data.js'));
 assert.equal(brandCreatorRelationship('c1',[],[]).kind,'none');
 assert.equal(brandCreatorRelationship('c1',[{creatorId:'c1',status:'pending',initiatedBy:'brand',id:'a1',campaignId:'camp'}],[]).kind,'pending');
 assert.equal(brandCreatorRelationship('c1',[],[{creatorId:'c1',brandId:'b1',status:'active',id:'n1',campaignId:'camp'}]).kind,'connected');
 assert.equal(brandCreatorRelationship('c1',[{creatorId:'c1',status:'rejected',initiatedBy:'brand',id:'a2',campaignId:'camp'}],[]).kind,'rejected');
 assert.equal(brandCreatorRelationship('c1',[],[{creatorId:'c1',brandId:'b1',status:'closed',id:'n2',campaignId:'camp'}]).kind,'closed');

 const discovery=read('app/ui/directories.tsx');
 assert.doesNotMatch(discovery,/Create your first campaign to discover creators/);
 assert.doesNotMatch(discovery,/locked-directory/);
 assert.match(discovery,/inviteCreatorToCampaign/);
 assert.match(discovery,/createNetworkConnection/);
 assert.match(discovery,/listPublicCreators/);
 assert.match(discovery,/listPublicBrands/);
 assert.match(discovery,/this creator/);
 assert.doesNotMatch(discovery,/Invitation saved in your preview workspace/);
 assert.doesNotMatch(discovery,/Sample profiles/);
 assert.doesNotMatch(discovery,/demo creator/i);

 const dashboard=read('app/ui/dashboard.tsx');
 assert.doesNotMatch(dashboard,/Your creator directory is waiting/);
 assert.doesNotMatch(dashboard,/Create your first campaign to start discovering creators/);
 assert.match(dashboard,/Campaign listing is free/);

 const marketplace=read('app/marketplace.tsx');
 assert.doesNotMatch(marketplace,/directoryLocked/);
 assert.match(marketplace,/Discover creators/);
 assert.match(marketplace,/Discover brands/);
 assert.match(marketplace,/path==='\/creators'/);
 assert.match(marketplace,/path==='\/brands'/);
 assert.match(marketplace,/login\?next=\$\{encodeURIComponent\(path\)\}/);
 assert.doesNotMatch(marketplace,/CreatorDiscovery publicView/);
 assert.doesNotMatch(marketplace,/attention_products/);
 assert.match(marketplace,/if\(path==='\/discover'\)return <AttentionMarketplace\/>/);

 const migration=read('supabase/migrations/20261001120000_open_marketplace_and_creator_verification.sql');
 assert.match(migration,/public_creators/);
 assert.match(migration,/public_brands/);
 assert.match(migration,/grant select on public\.public_creators to authenticated/);
 assert.match(migration,/grant select on public\.public_brands to authenticated/);
 assert.doesNotMatch(migration,/grant select on public\.public_creators to anon/);
 assert.doesNotMatch(migration,/grant select on public\.public_brands to anon/);
 assert.match(migration,/verification_status = 'approved'/);
 assert.doesNotMatch(migration,/place_attention_bid/);

 const attentionFn=read('supabase/migrations/20260921100000_social_accounts.sql');
 assert.match(attentionFn,/create or replace function public\.current_user_is_brand\(\)/);

 const invites=read('supabase/migrations/20260921250000_brand_creator_invites.sql');
 assert.match(invites,/invite_creator_to_campaign/);
 assert.match(invites,/initiated_by = 'brand'/);
 assert.match(invites,/application_received/);
 assert.doesNotMatch(invites,/place_attention_bid/);

 const dealsUi=read('app/ui/deals.tsx');
 assert.match(dealsUi,/application\.initiatedBy==='brand'/);

 const client=read('lib/supabase.ts');
 assert.doesNotMatch(client,/currentBrandHasCampaign/);
 assert.doesNotMatch(client,/gated: true/);
 assert.match(client,/inviteCreatorToCampaign/);
 assert.match(client,/from\("public_creators"\)/);
 assert.match(client,/from\("public_brands"\)/);
 assert.match(client,/if \(!isCreatorUserId\(input\.creatorId\)\) return \{ error: "Choose a creator to connect with\." \}/);
 assert.match(discovery,/realDirectoryCreators\(directory\.creators/);
 assert.match(client,/realDirectoryCreators\(creators\.creators\)/);
 assert.doesNotMatch(client,/sampleCreators|mockCreators|demoCreators|SAMPLE_PROFILES/);

 console.log('PASS: creator and brand directories require login; authenticated Brand and Creator can browse both; unverified creators stay hidden; campaign invites still persist through Supabase; Attention Marketplace stays unchanged.');
};
try{main()}finally{rmSync(out,{recursive:true,force:true})}
