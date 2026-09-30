import { getAuthUserId } from "@convex-dev/auth/server"
import { action, internalMutation, internalQuery, query } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"
import { generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server"

const opts=v.object({rpId:v.string(),origin:v.string()})

function allowedOrigin(origin:string){
  try{
    const u=new URL(origin)
    if(u.protocol==="http:"&&u.hostname!=="localhost") return false
    if(u.hostname==="localhost") return true
    const configured=(process.env.APP_ALLOWED_ORIGINS??"").split(",").map(x=>x.trim().replace(/\/$/,"")).filter(Boolean)
    return configured.includes(u.origin)
  }catch{return false}
}

export const getMine=query({args:{},returns:v.array(v.object({id:v.id("passkeyCredentials"),name:v.string(),createdAt:v.number(),lastUsedAt:v.optional(v.number()),deviceType:v.optional(v.string()),backedUp:v.optional(v.boolean())})),handler:async(ctx)=>{const u=await getAuthUserId(ctx);if(!u)return[];return ctx.db.query("passkeyCredentials").withIndex("by_user",q=>q.eq("userId",u)).order("desc").take(20).then(rows=>rows.map(x=>({id:x._id,name:x.name,createdAt:x.createdAt,lastUsedAt:x.lastUsedAt,deviceType:x.deviceType,backedUp:x.backedUp})))}})

export const saveCredential=internalMutation({args:{userId:v.id("users"),credentialId:v.string(),publicKey:v.string(),counter:v.number(),transports:v.optional(v.array(v.string())),deviceType:v.optional(v.string()),backedUp:v.optional(v.boolean()),name:v.string()},returns:v.id("passkeyCredentials"),handler:async(ctx,a)=>ctx.db.insert("passkeyCredentials",{...a,createdAt:Date.now()})})

export const beginRegistration=action({args:opts,returns:v.object({ok:v.boolean(),options:v.optional(v.any()),message:v.string()}),handler:async(ctx,{rpId,origin})=>{const u=await ctx.auth.getUserIdentity();if(!u)return{ok:false,message:"Sign in required."};if(!allowedOrigin(origin))return{ok:false,message:"This origin is not allowed."};const userId=await ctx.runQuery(internal.passkey.lookupUser,{subject:u.subject});if(!userId)return{ok:false,message:"Account not found."};const existing=await ctx.runQuery(internal.passkey.listCredentials,{userId});const options=await generateRegistrationOptions({rpName:"EVARA-LUX",rpID:rpId,userID:String(userId),userName:u.email??u.subject,userDisplayName:u.name??"EVARA Member",attestationType:"none",excludeCredentials:existing.map(x=>({id:x.credentialId,transports:x.transports as any})),authenticatorSelection:{residentKey:"required",userVerification:"preferred"}});await ctx.runMutation(internal.passkey.saveChallenge,{userId,challenge:options.challenge});return{ok:true,options,message:"Passkey registration ready."}}})

export const finishRegistration=action({args:{credential:v.any(),rpId:v.string(),origin:v.string(),name:v.string()},returns:v.object({ok:v.boolean(),message:v.string()}),handler:async(ctx,{credential,rpId,origin,name})=>{if(!allowedOrigin(origin))return{ok:false,message:"This origin is not allowed."};const u=await ctx.auth.getUserIdentity();if(!u)return{ok:false,message:"Sign in required."};const userId=await ctx.runQuery(internal.passkey.lookupUser,{subject:u.subject});if(!userId)return{ok:false,message:"Account not found."};const challenge=await ctx.runQuery(internal.passkey.getChallenge,{userId});if(!challenge||challenge.expiresAt<Date.now())return{ok:false,message:"Passkey registration expired. Start again."};const result=await verifyRegistrationResponse({response:credential,expectedChallenge:challenge.challenge,expectedOrigin:origin,expectedRPID:rpId,requireUserVerification:false});if(!result.verified||!result.registrationInfo)return{ok:false,message:"Passkey verification failed."};const info=result.registrationInfo;await ctx.runMutation(internal.passkey.saveCredential,{userId,credentialId:info.credentialID,publicKey:Buffer.from(info.credentialPublicKey).toString("base64url"),counter:info.counter,transports:credential.response?.transports,deviceType:info.credentialDeviceType,backedUp:info.credentialBackedUp,name:name.trim().slice(0,80)||"EVARA Passkey"});await ctx.runMutation(internal.passkey.clearChallenge,{userId});return{ok:true,message:"Passkey added successfully."}}})

export const lookupUser=internalQuery({args:{subject:v.string()},returns:v.union(v.id("users"),v.null()),handler:async(ctx,{subject})=>{const row:any=await ctx.db.get(subject as any);return row?(row._id as any):null}})
export const listCredentials=internalQuery({args:{userId:v.id("users")},returns:v.array(v.any()),handler:async(ctx,{userId})=>ctx.db.query("passkeyCredentials").withIndex("by_user",q=>q.eq("userId",userId)).take(50)})
export const saveChallenge=internalMutation({args:{userId:v.id("users"),challenge:v.string()},returns:v.null(),handler:async(ctx,a)=>{const old=await ctx.db.query("passkeyChallenges").withIndex("by_user_type",q=>q.eq("userId",a.userId).eq("type","registration")).unique();if(old)await ctx.db.delete(old._id);await ctx.db.insert("passkeyChallenges",{userId:a.userId,challenge:a.challenge,type:"registration",expiresAt:Date.now()+5*60_000});return null}})
export const getChallenge=internalQuery({args:{userId:v.id("users")},returns:v.any(),handler:async(ctx,{userId})=>ctx.db.query("passkeyChallenges").withIndex("by_user_type",q=>q.eq("userId",userId).eq("type","registration")).unique()})
export const clearChallenge=internalMutation({args:{userId:v.id("users")},returns:v.null(),handler:async(ctx,{userId})=>{const x=await ctx.db.query("passkeyChallenges").withIndex("by_user_type",q=>q.eq("userId",userId).eq("type","registration")).unique();if(x)await ctx.db.delete(x._id);return null}})
