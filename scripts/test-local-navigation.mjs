import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const origin=readFileSync(join(process.cwd(),'lib/app-origin.ts'),'utf8');
assert.match(origin,/export function toInAppPath/);
assert.match(origin,/window\.location\.origin/);
assert.doesNotMatch(origin,/collabcy\.app/);

const store=readFileSync(join(process.cwd(),'app/store.tsx'),'utf8');
assert.match(store,/router\.push\(toInAppPath/);
assert.match(store,/const go=\(path:string\)=>\{router\.push\(toInAppPath\(path\)\)/);

const link=readFileSync(join(process.cwd(),'app/ui/app-link.tsx'),'utf8');
assert.match(link,/toInAppPath\(href\)/);

const publicUi=readFileSync(join(process.cwd(),'app/ui/public.tsx'),'utf8');
assert.match(publicUi,/from '\.\/app-link'/);
const publicHeader=publicUi.slice(publicUi.indexOf('export function PublicHeader'),publicUi.indexOf('export function PublicFooter'));
const publicFooter=publicUi.slice(publicUi.indexOf('export function PublicFooter'));
assert.doesNotMatch(publicHeader,/href="\/login"/);
assert.doesNotMatch(publicHeader,/href="\/signup"/);
assert.doesNotMatch(publicFooter,/href="\/login"/);
assert.doesNotMatch(publicFooter,/href="\/signup"/);

console.log('PASS: local navigation stays origin-relative; Attention Marketplace has no login/signup routes.');
