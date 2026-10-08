import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,"")]}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const W="5116ce6f-0b64-4197-986e-51058f687825";
const all=[];
for (let from=0;;from+=1000){const {data,error}=await sb.from("contacts").select("*").eq("coach_id",W).eq("prospect_source","sales_navigator").range(from,from+999); if(error){console.log(error);break;} all.push(...data); if(data.length<1000)break;}
console.log("n",all.length);
console.log("keys", Object.keys(all[0]).join(","));
const s=all[0]; console.log({full_name:s.full_name,first_name:s.first_name,job_title:s.job_title,business_name:s.business_name,linkedin_url:s.linkedin_url,email:s.email,phone:s.phone,website:s.website,prospect_status:s.prospect_status,tags:s.tags,location:s.location,city:s.city});
const st={}; for(const c of all){st[c.prospect_status]=(st[c.prospect_status]??0)+1;} console.log("status",st);
console.log("li ACw", all.filter(c=>/\/in\/ACw/i.test(c.linkedin_url??"")).length, "li any", all.filter(c=>c.linkedin_url).length, "email", all.filter(c=>c.email).length, "phone", all.filter(c=>c.phone).length);
