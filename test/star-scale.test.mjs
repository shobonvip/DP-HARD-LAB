import test from 'node:test';
import assert from 'node:assert/strict';
import {buildStarScale,hardStar} from '../src/star-scale.mjs';
test('star calibration preserves difficulty order and median anchors',()=>{
 const rows=[5,6,7,8,9,10,11].flatMap(level=>Array.from({length:level<7?2:10},()=>({level,analysis:{requiredCapacity:level*2}})));
 const scale=buildStarScale(rows);
 assert.deepEqual(scale.anchors.map(a=>a.level),[7,8,9,10,11]);
 for(const a of scale.anchors)assert.equal(hardStar(a.capacity,scale).value,a.level);
 assert.equal(hardStar(19,scale).value,9.5);
 assert.equal(hardStar(24,scale).extrapolated,true);
 let previous=-Infinity;for(let c=1;c<32;c+=.1){const v=hardStar(c,scale).value;assert.ok(v>=previous);previous=v;}
});
