import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
const out=mkdtempSync(join(tmpdir(),'collabcy-preview-'));
try{
 const build=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','app/attention/demo.ts','app/attention/repository.ts','app/attention/click-counts.ts','--outDir',out,'--module','commonjs','--target','es2022','--skipLibCheck'],{encoding:'utf8'});
 assert.equal(build.status,0,build.stdout+build.stderr);writeFileSync(join(out,'package.json'),'{"type":"commonjs"}');
 const require=createRequire(import.meta.url);const {demoMarketplace}=require(join(out,'demo.js'));const {createMarketplaceRepository}=require(join(out,'repository.js'));const {getRankedProducts,getProjectedRank}=require(join(out,'model.js'));
 const {incrementBrandClick}=require(join(out,'click-counts.js'));
 const state=demoMarketplace();assert.equal(state.products.length,4);assert.equal(new Set(state.products.map(p=>p.id)).size,4);assert.ok(state.products.every(p=>p.brandId==='demo'&&p.tags.includes('Demo')&&p.clickCount===0));
 const repo=createMarketplaceRepository(state);const before={...repo.getSnapshot().products[1]};const brandCounts=incrementBrandClick({},state.products[1].id);assert.equal(brandCounts[state.products[1].id],1);assert.equal(repo.getSnapshot().products[1].clickCount,before.clickCount);repo.simulateVisit(state.products[1].id);assert.equal(repo.getSnapshot().products[1].clickCount,1);assert.equal(repo.getSnapshot().products[0].clickCount,0);assert.equal(brandCounts[state.products[1].id],1);assert.equal(incrementBrandClick(brandCounts,state.products[1].id)[state.products[1].id],2);
 const real={...state.products[0],id:'real',brandId:'real-owner',currentBid:2};assert.equal(getRankedProducts([...state.products,real])[0].id,state.products[0].id);assert.equal(getProjectedRank(state.products,2),1);assert.deepEqual(createMarketplaceRepository().getSnapshot().products,[]);
 console.log('PASS: four labelled demos, brand-page and website click counts remain independent, highest bid earns the crown, demos never affect projected paid rank.');
}finally{rmSync(out,{recursive:true,force:true});}
