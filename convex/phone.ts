import { getAuthUserId } from "@convex-dev/auth/server"
import { action, internalMutation, mutation, query } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"

type Purpose = "verification" | "two_factor" | "notification"
const purpose=v.union(v.literal("verification"),v.literal("two_factor"),v.literal("notification"))

function normalizePhone(phone:string){return phone.trim().replace(/[\s()-]/g,"")}
function validPhone(phone:string){return /^\+[1-9]\d{7,14}$/.test(phone)}
function generateCode(){const a=new Uint32Array(6);crypto.getRandomValues(a);return Array.from(a,n=>String(n%10)).join("")}
async function hashCode(code:string){const bytes=new TextEncoder().encode(code);const digest=await crypto.subtle.digest("SHA-256",bytes);return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("")}

export const getMyPhone=query({args:{},returns:v.union(v.object({phone:v.union(v.string(),v.null()),verified:v.boolean()}),v.null()),handler:async(ctx)=>{const u=await getAuthUserId(ctx);if(!u)return null;const p=await ctx.db.query("userProfiles").withIndex("by_user",q=>q.eq("userId",u)).unique();return{phone:p?.phone??null,verified:!!p?.phone&&p?.verificationStatus==="verified"}}})

export const requestCode=mutation({args:{phone:v.string(),purpose},returns:v.object({ok:v.boolean(),message:v.string()}),handler:async(ctx,{phone,purpose})=>{const u=await getAuthUserId(ctx);if(!u)return{ok:false,message:"Sign in required."};const normalized=normalizePhone(phone);if(!validPhone(normalized))return{ok:false,message:"Use international format, for example +2348012345678."};const now=Date.now();const current=await ctx.db.query("phoneVerifications").withIndex("by_user_purpose",q=>q.eq("userId",u).eq("purpose",purpose)).unique();if(current&&now-current.lastSentAt<60_000)return{ok:false,message:"Please wait before requesting another code."};const code=generateCode();const codeHash=await hashCode(code);if(current)await ctx.db.patch(current._id,{phone:normalized,codeHash,expiresAt:now+10*60_000,attempts:0,lastSentAt:now,verifiedAt:undefined});else await ctx.db.insert("phoneVerifications",{userId:u,phone:normalized,purpose,codeHash,expiresAt:now+10*60_000,attempts:0,lastSentAt:now});await ctx.scheduler.runAfter(0,internal.phone.sendCode,{phone:normalized,code,purpose});return{ok:true,message:"Verification code sent."}}})

export const sendCode=action({args:{phone:v.string(),code:v.string(),purpose},returns:v.boolean(),handler:async(ctx,{phone,code,purpose})=>{const endpoint=process.env.SMS_OTP_ENDPOINT;if(!endpoint)return false;const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone,token:code,purpose,appName:process.env.APP_NAME??"EVARA-LUX",secretKey:process.env.SMS_SECRET_KEY})});return response.ok}})

export const verifyCode=mutation({args:{code:v.string(),purpose},returns:v.object({ok:v.boolean(),message:v.string()}),handler:async(ctx,{code,purpose})=>{const u=await getAuthUserId(ctx);if(!u)return{ok:false,message:"Sign in required."};const row=await ctx.db.query("phoneVerifications").withIndex("by_user_purpose",q=>q.eq("userId",u).eq("purpose",purpose)).unique();if(!row)return{ok:false,message:"Request a code first."};if(row.verifiedAt)return{ok:true,message:"Phone already verified."};if(row.expiresAt<Date.now())return{ok:false,message:"That code has expired."};if(row.attempts>=5)return{ok:false,message:"Too many attempts. Request a new code."};const ok=(await hashCode(code.trim()))===row.codeHash;if(!ok){await ctx.db.patch(row._id,{attempts:row.attempts+1});return{ok:false,message:"Incorrect code."}}await ctx.db.patch(row._id,{verifiedAt:Date.now()});const p=await ctx.db.query("userProfiles").withIndex("by_user",q=>q.eq("userId",u)).unique();if(p){await ctx.db.patch(p._id,{phone:row.phone,verificationStatus:"verified"})}return{ok:true,message:"Phone verified."}}})
