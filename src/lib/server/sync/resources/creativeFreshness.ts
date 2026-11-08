/** Freshness of saved media is independent from performance or entity delivery. */
export function creativeNeedsRefresh(saved: {updated_at:string|null;image_url:string|null;thumbnail_url:string|null}|undefined, adChangedAt: string|null, now: number) {
  if(!saved || !saved.updated_at || now-Date.parse(saved.updated_at)>=86400000 || !Number.isFinite(Date.parse(saved.updated_at))) return true;
  if(adChangedAt && Date.parse(adChangedAt)>Date.parse(saved.updated_at)) return true;
  const sources=[saved.image_url,saved.thumbnail_url].filter((url):url is string=>Boolean(url));
  if(!sources.length)return true;
  return sources.every(value=>{
    try {
      const url=new URL(value), expiry=url.searchParams.get('oe');
      return expiry ? /^[0-9a-f]+$/i.test(expiry) && parseInt(expiry,16)*1000<now+3600000 : false;
    }catch{return true;}
  });
}
