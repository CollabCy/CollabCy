import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const origin=readFileSync(join(process.cwd(),'lib/app-origin.ts'),'utf8');
assert.match(origin,/export function toInAppPath/);
assert.match(origin,/export function authRedirectUrl/);
assert.match(origin,/window\.location\.origin/);
assert.doesNotMatch(origin,/collabcy\.app/);

const auth=readFileSync(join(process.cwd(),'app/ui/auth.tsx'),'utf8');
assert.match(auth,/authRedirectUrl\(\)/);
assert.match(auth,/authRedirectUrl\('\/login'\)/);
assert.match(auth,/continueWithOAuth\('google'\)/);
assert.match(auth,/continueWithOAuth\('x'\)/);
assert.match(auth,/continueWithOAuth\('facebook'\)/);
assert.match(auth,/queryParams:\{auth_type:'reauthenticate'\}/);
assert.match(auth,/queryParams:\{force_login:'true'\}/);
assert.doesNotMatch(auth,/provider:'twitter'/);
assert.doesNotMatch(auth,/redirectTo:window\.location\.origin\}/);

const store=readFileSync(join(process.cwd(),'app/store.tsx'),'utf8');
assert.match(store,/router\.push\(toInAppPath/);
assert.match(store,/const go=\(path:string\)=>\{router\.push\(toInAppPath\(path\)\)/);

const link=readFileSync(join(process.cwd(),'app/ui/app-link.tsx'),'utf8');
assert.match(link,/toInAppPath\(href\)/);

const publicUi=readFileSync(join(process.cwd(),'app/ui/public.tsx'),'utf8');
assert.match(publicUi,/from '\.\/app-link'/);
assert.match(publicUi,/href="\/login"/);
assert.match(publicUi,/href="\/signup"/);

console.log('PASS: local navigation stays origin-relative; auth redirects use the current origin.');
