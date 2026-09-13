const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const staged = path.join(__dirname, '../friendship-content.js');
const src = fs.readFileSync(fs.existsSync(staged) ? staged : path.join(__dirname, '../content.js'), 'utf8');
const start = src.indexOf('isFeatureEnabled("accountValue") &&');
assert.ok(start >= 0);
const expression = src.slice(start, src.indexOf('? makeEnhancedProfileHeaderDetail', start));
const privateStart = src.indexOf('const inventoryIsPrivate =');
const privateDeclaration = src.slice(privateStart, src.indexOf(';', privateStart) + 1);
const check = new Function('data', 'isFeatureEnabled', privateDeclaration + 'return ' + expression);
assert.ok(src.includes('const badgeDetail = showBadges && !inventoryIsPrivate ?'));
for (const [inventory, expected] of [
  [{data:{visibility:'limited'}}, false],
  [{code:'PRIVATE'}, false],
  [{data:{visibility:'public'}}, true]
]) assert.equal(check({sections:{inventory}}, () => true), expected);
assert.equal(check({sections:{inventory:{data:{visibility:'public'}}}}, () => false), false);
console.log('Private/public inventory and feature-toggle checks: PASS');
