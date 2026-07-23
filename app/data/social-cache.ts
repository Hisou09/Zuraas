export type SocialKey="facebook"|"instagram"|"youtube"|"discord"|"telegram";
export type Socials=Record<SocialKey,string>;

const emptySocials:Socials={facebook:"",instagram:"",youtube:"",discord:"",telegram:""};
let socialCache:Socials|null=null;
let socialRequest:Promise<Socials>|null=null;

const normalize=(value:Partial<Socials>|null|undefined):Socials=>({
  facebook:String(value?.facebook||""),
  instagram:String(value?.instagram||""),
  youtube:String(value?.youtube||""),
  discord:String(value?.discord||""),
  telegram:String(value?.telegram||"")
});

export const getSocialCache=()=>{
  if(socialCache)return socialCache;
  if(typeof window==="undefined")return null;
  try{
    const stored=sessionStorage.getItem("zuraas-socials");
    if(stored)socialCache=normalize(JSON.parse(stored) as Partial<Socials>);
  }catch{/* Invalid cached values are ignored. */}
  return socialCache;
};

export const setSocialCache=(value:Partial<Socials>|null|undefined)=>{
  socialCache=normalize(value);
  if(typeof window!=="undefined")sessionStorage.setItem("zuraas-socials",JSON.stringify(socialCache));
  return socialCache;
};

export const requestSocials=()=>{
  const cached=getSocialCache();
  if(cached)return Promise.resolve(cached);
  if(socialRequest)return socialRequest;
  socialRequest=fetch("/api/app/social")
    .then(async response=>{
      if(!response.ok)throw new Error("Social settings request failed");
      const value=await response.json() as {social?:Partial<Socials>};
      return setSocialCache(value.social);
    })
    .catch(()=>setSocialCache(emptySocials))
    .finally(()=>{socialRequest=null});
  return socialRequest;
};
