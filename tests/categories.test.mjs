import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCategoryNames,categoryLabel,parseImport,emptyProduct,matchesCategory} from '../core.js';
test('カテゴリ名は4つ、空欄・長すぎ・重複・予約名を拒否する',()=>{
 assert.deepEqual(validateCategoryNames([' 冷蔵 ','冷凍','常温','催事']),['冷蔵','冷凍','常温','催事']);
 for(const value of [null,[],['a','b','c'],['','b','c','d'],['a','a','c','d'],['全て','b','c','d'],['未選択','b','c','d'],['あ'.repeat(13),'b','c','d'],[1,'b','c','d']])assert.throws(()=>validateCategoryNames(value));
});
test('名前を変えても旧バックアップと商品分類を維持する',()=>{
 const p={...emptyProduct(),name:'商品',category:'飲料'};
 const names=validateCategoryNames(['冷蔵','冷凍','常温','催事']);
 for(const categoryNames of [undefined,names]){
  const [restored]=parseImport(JSON.stringify({schemaVersion:1,products:[p],categoryNames}));
  assert.equal(restored.category,'飲料');assert.ok(matchesCategory(restored,'飲料'));
  assert.equal(categoryLabel(restored.category,names),'冷凍');
 }
 assert.equal(categoryLabel('',names),'未選択');assert.equal(categoryLabel('全て',names),'全て');
});
