import { getAuthUserId } from "@convex-dev/auth/server"
import { internalMutation, mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { internal } from "./_generated/api"
function strings(x:unknown):string[]{return Array.isArray(x)?x.flatMap(v=>typeof v==="string"?v.toLowerCase():[]):[]}
function matches(text:string,terms:string[]){const h=text.toLowerCase();return terms.reduce((n,t)=>n+(h.includes(t)?1:0),0)}
export const forYou=query({args:{limit:v.optional(v.number())},returns:v.array(v.any()),handler:async(ctx,{limit})=>{const u=await getAuthUserId(ctx);if(!u)return[];const taste=await ctx.db.query("tasteProfiles").withIndex("by_user",q=>q.eq("userId",u)).unique();const terms=[...strings(taste?.interests),...strings(taste?.brands),...strings(taste?.categories)];const wish=await ctx.db.query("wishlistItems").withIndex("by_user",q=>q.eq("userId",u)).take(100);const wanted=new Set(wish.map(x=>String(x.productId)));const products=await ctx.db.query("products").withIndex("by_status_featured",q=>q.eq("status","active")).take(100);const rows=products.map(p=>{const text=[p.name,p.shortDescription??"",p.description??"",JSON.stringify(p.attributes??{})].join(" ");const m=matches(text,terms);const rating=Math.min(1,(p.rating??0)/5);const stock=p.stockQuantity>10?1:p.stockQuantity>0?.7:0;const score=Math.min(1,.15+m*.12+rating*.38+stock*.2+(p.featured?.12:0)-(wanted.has(String(p._id))?.4:0));return{...p,score,reason:m?"Matches your evolving taste":p.featured?"Featured by EVARA":rating>=.8?"Highly rated":"Worth exploring"}});rows.sort((a,b)=>b.score-a.score);return rows.slice(0,Math.min(Math.max(limit??12,1),30))}})
export const recordSignal=mutation({args:{productId:v.id("products"),event:v.union(v.literal("view"),v.literal("save"),v.literal("cart"),v.literal("purchase"),v.literal("dismiss"))},returns:v.boolean(),handler:async(ctx,{productId,event})=>{const u=await getAuthUserId(ctx);if(!u)return false;const p=await ctx.db.get(productId);if(!p)return false;const c=await ctx.db.get(p.categoryId);const old=await ctx.db.query("tasteProfiles").withIndex("by_user",q=>q.eq("userId",u)).unique();const cats=new Set(strings(old?.categories));if(c)cats.add(c.name.toLowerCase());const brands=new Set(strings(old?.brands));if(p.brandPartnerId){const b=await ctx.db.get(p.brandPartnerId);if(b)brands.add(b.name.toLowerCase())}const interests=new Set(strings(old?.interests));if(event==="purchase"||event==="save"||event==="cart")interests.add(p.name.toLowerCase());const payload={userId:u,interests:[...interests].slice(-100),creators:old?.creators??[],brands:[...brands].slice(-50),categories:[...cats].slice(-50),updatedAt:Date.now(),version:(old?.version??0)+1};if(old)await ctx.db.patch(old._id,payload);else await ctx.db.insert("tasteProfiles",payload);return true}})
export const refreshMyCache=internalMutation({args:{userId:v.id("users")},returns:v.number(),handler:async(ctx,{userId})=>{const taste=await ctx.db.query("tasteProfiles").withIndex("by_user",q=>q.eq("userId",userId)).unique();const terms=[...strings(taste?.interests),...strings(taste?.brands),...strings(taste?.categories)];const ps=await ctx.db.query("products").withIndex("by_status_featured",q=>q.eq("status","active")).take(100);const ranked=ps.map(p=>({p,score:Math.min(1,.2+matches([p.name,p.shortDescription??"",p.description??""].join(" "),terms)*.15+Math.min(1,(p.rating??0)/5)*.5+(p.featured?.1:0))})).sort((a,b)=>b.score-a.score).slice(0,30);const now=Date.now();for(const r of ranked){const x=await ctx.db.query("recommendationItems").withIndex("by_user_score",q=>q.eq("userId",userId)).filter(q=>q.eq(q.field("productId"),r.p._id)).first();if(x)await ctx.db.patch(x._id,{score:r.score,reason:"Personalized for you",modelVersion:taste?.version??1,expiresAt:now+21600000});else await ctx.db.insert("recommendationItems",{userId,productId:r.p._id,score:r.score,reason:"Personalized for you",modelVersion:taste?.version??1,expiresAt:now+21600000})}return ranked.length}})

export const refreshAll = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const users = await ctx.db.query("userProfiles").take(500)
    let refreshed = 0
    for (const profile of users) {
      await ctx.scheduler.runAfter(0, internal.recommendations.refreshMyCache, { userId: profile.userId })
      refreshed++
    }
    return refreshed
  },
})
