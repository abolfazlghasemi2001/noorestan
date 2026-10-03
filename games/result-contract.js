/* نورستان: قرارداد مشترک نتیجهٔ بازی‌ها */
(function(root){
  const alias=[[/^ayahbuilder(?:_|$)/,'ayah-builder'],[/^hadithrush(?:_|$)/,'hadith-rush'],[/^noorpairs(?:_|$)/,'noor-pairs']];
  const canonicalId=v=>{const raw=String(v==null?'':v).trim().toLowerCase();for(const [p,id] of alias)if(p.test(raw))return id;return raw;};
  const normalize=x=>{x=x||{};const gameId=canonicalId(x.gameId||x.game||x.key);if(!gameId)throw Error('gameId is required');return Object.freeze({gameId,score:Math.max(0,Math.round(+x.score||0)),stars:Math.max(0,Math.min(3,Math.round(+x.stars||0))),completion:Math.max(0,Math.min(1,x.completion==null?(x.stars?1:0):+x.completion||0)),mode:['solo','online','local'].includes(x.mode)?x.mode:'solo',metadata:x.metadata&&typeof x.metadata==='object'?{...x.metadata}:{},at:Number.isFinite(+x.at)?+x.at:Date.now()});};
  const legacy=x=>{const r=normalize(x);return {key:r.gameId,game:String(x.game||x.title||r.gameId),score:r.score,stars:r.stars,mode:r.mode,metadata:r.metadata};};
  root.NoorestanGameResult=Object.freeze({normalize,legacy,canonicalId});
})(typeof window==='undefined'?globalThis:window);
