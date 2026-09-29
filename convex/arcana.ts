import { v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import { mutation, query } from "./_generated/server"

const rankFor = (level:number): "E"|"D"|"C"|"B"|"A"|"S"|"SS"|"MONARCH" =>
  level >= 120 ? "MONARCH" : level >= 80 ? "SS" : level >= 60 ? "S" : level >= 40 ? "A" : level >= 25 ? "B" : level >= 15 ? "C" : level >= 7 ? "D" : "E"

const tierRank: Record<string,number> = { obsidian:1, sovereign:2, sovereign_gilded:3, apex_imperial:4, sovereign_aethel:5 }
async function membership(ctx:any,userId:any){ return await ctx.db.query("membershipProfiles").withIndex("by_user", (q:any)=>q.eq("userId",userId)).unique() }
function customizationLimit(tier:string){ return (tierRank[tier]??1) >= 3 ? 16 : (tierRank[tier]??1) >= 2 ? 8 : 4 }

const powerupSeed = [
  ["shadow_step","Shadow Step","rare"],["aether_core","Aether Core","epic"],["phantom_guard","Phantom Guard","epic"],["overdrive","Overdrive","mythic"],["sovereign_flux","Sovereign Flux","sovereign"]
] as const

export const getMyArcana = query({
  args:{}, returns:v.any(),
  handler:async(ctx)=>{
    const userId=await getAuthUserId(ctx); if(!userId) return null
    const profile=await ctx.db.query("gameProfiles").withIndex("by_user",q=>q.eq("userId",userId)).unique()
    const tierRow=await membership(ctx,userId); const tier=tierRow?.tier??"obsidian"
    const powerups=await ctx.db.query("gamePowerUps").withIndex("by_user",q=>q.eq("userId",userId)).take(30)
    const today=new Date().toISOString().slice(0,10)
    const daily=await ctx.db.query("gameDailyStates").withIndex("by_user_day",q=>q.eq("userId",userId).eq("dayKey",today)).unique()
    const achievements=await ctx.db.query("gameAchievements").withIndex("by_user",q=>q.eq("userId",userId)).take(30)
    return {profile,tier,customizationLimit:customizationLimit(tier),powerups,daily:daily??{streak:0,energy:5,maxEnergy:5,claimedAt:null},achievements}
  }
})

export const awaken = mutation({
  args:{codename:v.string(),archetype:v.union(v.literal("blade"),v.literal("aether"),v.literal("phantom"),v.literal("oracle"))},
  returns:v.any(),
  handler:async(ctx,args)=>{
    const userId=await getAuthUserId(ctx); if(!userId) return null
    const existing=await ctx.db.query("gameProfiles").withIndex("by_user",q=>q.eq("userId",userId)).unique()
    if(existing) return existing
    const now=Date.now()
    const id=await ctx.db.insert("gameProfiles",{userId,codename:args.codename.trim().slice(0,24)||"Wanderer",archetype:args.archetype,level:1,xp:0,rank:"E",power:100,customization:{hair:"midnight",eyes:"silver",outfit:"origin",aura:"ember"},createdAt:now,updatedAt:now})
    for(const [key,name,rarity] of powerupSeed.slice(0,3)) await ctx.db.insert("gamePowerUps",{userId,key,name,rarity,level:1,equipped:key==="shadow_step",unlockedAt:now})
    await ctx.db.insert("gameDailyStates",{userId,dayKey:new Date(now).toISOString().slice(0,10),streak:0,energy:5,maxEnergy:5,updatedAt:now})
    return await ctx.db.get(id)
  }
})

export const customize = mutation({
  args:{
    codename:v.optional(v.string()), archetype:v.optional(v.union(v.literal("blade"),v.literal("aether"),v.literal("phantom"),v.literal("oracle"))),
    customization:v.any()
  }, returns:v.boolean(),
  handler:async(ctx,args)=>{
    const userId=await getAuthUserId(ctx); if(!userId)return false
    const profile=await ctx.db.query("gameProfiles").withIndex("by_user",q=>q.eq("userId",userId)).unique(); if(!profile)return false
    const tierRow=await membership(ctx,userId); const limit=customizationLimit(tierRow?.tier??"obsidian")
    const incoming=args.customization && typeof args.customization==="object" ? args.customization : {}
    const keys=Object.keys(incoming).slice(0,limit)
    const allowed=new Set(["hair","eyes","skin","face","outfit","coat","weapon","aura","auraIntensity","title","emblem","entrance","victory","finisher","voiceStyle","trail"])
    for(const k of keys) if(!allowed.has(k)) return false
    const merged={...(profile.customization??{}),...Object.fromEntries(keys.map(k=>[k,incoming[k]]))}
    const nextArchetype=args.archetype??profile.archetype
    const codename=(args.codename??profile.codename).trim().slice(0,24)
    await ctx.db.patch(profile._id,{codename:codename||profile.codename,archetype:nextArchetype,customization:merged,power:Math.min(99999,profile.power+Math.min(12,keys.length)),updatedAt:Date.now()})
    return true
  }
})

export const equipPowerUp = mutation({
  args:{key:v.string()}, returns:v.boolean(),
  handler:async(ctx,{key})=>{
    const userId=await getAuthUserId(ctx);if(!userId)return false
    const target=await ctx.db.query("gamePowerUps").withIndex("by_user",q=>q.eq("userId",userId)).filter(q=>q.eq(q.field("key"),key)).unique()
    if(!target)return false
    const all=await ctx.db.query("gamePowerUps").withIndex("by_user_equipped",q=>q.eq("userId",userId).eq("equipped",true)).take(10)
    for(const row of all) if(row._id!==target._id) await ctx.db.patch(row._id,{equipped:false})
    await ctx.db.patch(target._id,{equipped:true})
    return true
  }
})

export const startSession = mutation({
  args:{mode:v.union(v.literal("awakening"),v.literal("rush"),v.literal("boss"),v.literal("duel"))}, returns:v.union(v.id("gameSessions"),v.null()),
  handler:async(ctx,{mode})=>{
    const userId=await getAuthUserId(ctx);if(!userId)return null
    const today=new Date().toISOString().slice(0,10)
    let daily=await ctx.db.query("gameDailyStates").withIndex("by_user_day",q=>q.eq("userId",userId).eq("dayKey",today)).unique()
    if(!daily){const id=await ctx.db.insert("gameDailyStates",{userId,dayKey:today,streak:0,energy:5,maxEnergy:5,updatedAt:Date.now()});daily=await ctx.db.get(id)}
    if(!daily || daily.energy<=0)return null
    await ctx.db.patch(daily._id,{energy:daily.energy-1,updatedAt:Date.now()})
    return await ctx.db.insert("gameSessions",{userId,mode,status:"active",score:0,combo:0,durationMs:0,rewards:{},startedAt:Date.now()})
  }
})

export const completeSession = mutation({
  args:{sessionId:v.id("gameSessions"),score:v.number(),combo:v.number(),durationMs:v.number()}, returns:v.any(),
  handler:async(ctx,args)=>{
    const userId=await getAuthUserId(ctx);if(!userId)return null
    const session=await ctx.db.get(args.sessionId);if(!session||session.userId!==userId||session.status!=="active")return null
    const safeScore=Math.max(0,Math.min(500000,Math.trunc(args.score)))
    const safeCombo=Math.max(0,Math.min(999,Math.trunc(args.combo)))
    const safeDuration=Math.max(500,Math.min(20*60*1000,Math.trunc(args.durationMs)))
    const profile=await ctx.db.query("gameProfiles").withIndex("by_user",q=>q.eq("userId",userId)).unique();if(!profile)return null
    const xpGain=Math.min(5000,Math.floor(safeScore/100)+Math.floor(safeCombo/5))
    const totalXp=profile.xp+xpGain
    const level=Math.max(1,Math.floor(Math.sqrt(totalXp/100))+1)
    const rank=rankFor(level)
    const powerGain=Math.min(500,Math.floor(safeScore/1000)+Math.floor(safeCombo/10))
    await ctx.db.patch(profile._id,{xp:totalXp,level,rank,power:Math.min(99999,profile.power+powerGain),updatedAt:Date.now()})
    const rewards={xp:xpGain,power:powerGain,rank}
    await ctx.db.patch(session._id,{status:"completed",score:safeScore,combo:safeCombo,durationMs:safeDuration,rewards,completedAt:Date.now()})
    if(safeScore>=10000){const existing=await ctx.db.query("gameAchievements").withIndex("by_user_key",q=>q.eq("userId",userId).eq("key","first-breakthrough")).unique();if(!existing)await ctx.db.insert("gameAchievements",{userId,key:"first-breakthrough",title:"First Breakthrough",description:"Cross 10,000 points in the Arcana Arena.",unlockedAt:Date.now()})}
    if(safeCombo>=100){const existing=await ctx.db.query("gameAchievements").withIndex("by_user_key",q=>q.eq("userId",userId).eq("key","hundred-chain")).unique();if(!existing)await ctx.db.insert("gameAchievements",{userId,key:"hundred-chain",title:"Hundred Chain",description:"Reach a 100-hit combo.",unlockedAt:Date.now()})}
    return {ok:true,rewards,profile:{level,xp:totalXp,rank,power:Math.min(99999,profile.power+powerGain)}}
  }
})

export const claimDaily = mutation({
  args:{}, returns:v.any(),
  handler:async(ctx)=>{
    const userId=await getAuthUserId(ctx);if(!userId)return null
    const now=Date.now(),dayKey=new Date(now).toISOString().slice(0,10)
    let daily=await ctx.db.query("gameDailyStates").withIndex("by_user_day",q=>q.eq("userId",userId).eq("dayKey",dayKey)).unique()
    if(!daily){const id=await ctx.db.insert("gameDailyStates",{userId,dayKey,streak:1,energy:5,maxEnergy:5,updatedAt:now});daily=await ctx.db.get(id)}
    if(!daily)return null
    if(daily.claimedAt)return {ok:false,streak:daily.streak,energy:daily.energy}
    const streak=daily.streak+1
    await ctx.db.patch(daily._id,{claimedAt:now,streak,energy:daily.maxEnergy,updatedAt:now})
    const profile=await ctx.db.query("gameProfiles").withIndex("by_user",q=>q.eq("userId",userId)).unique()
    if(profile) await ctx.db.patch(profile._id,{xp:profile.xp+100,updatedAt:now})
    return {ok:true,streak,energy:daily.maxEnergy,xp:100}
  }
})

const seasonKeyFor = () => { const d=new Date(); return String(d.getUTCFullYear())+"-"+String(d.getUTCMonth()+1).padStart(2,"0") }
const divisionFor = (r:number) => r>=2400?"MONARCH":r>=2100?"SSS":r>=1800?"SS":r>=1500?"S":r>=1250?"A":r>=1000?"B":r>=800?"C":r>=600?"D":"E"
const titleFor = (d:string) => d==="MONARCH"?"Thronebreaker":d==="SSS"?"Transcendent":d==="SS"?"Ascendant":d==="S"?"Sovereign Hunter":d==="A"?"Elite":d==="B"?"Vanguard":d==="C"?"Awakened":d==="D"?"Initiate":"Unawakened"
async function ensureSeason(ctx:any){ const key=seasonKeyFor(); const x=await ctx.db.query("gameSeasons").withIndex("by_key",q=>q.eq("key",key)).unique(); if(x)return x; const d=new Date(); const id=await ctx.db.insert("gameSeasons",{key,name:"Ascension "+key,status:"live",startsAt:new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)).getTime(),endsAt:new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)).getTime()}); return await ctx.db.get(id) }
async function ensureRanking(ctx:any,userId:any){ const s=await ensureSeason(ctx); const x=await ctx.db.query("gameRankings").withIndex("by_user_season",q=>q.eq("userId",userId).eq("seasonKey",s!.key)).unique(); if(x)return x; const id=await ctx.db.insert("gameRankings",{userId,seasonKey:s!.key,rating:500,wins:0,losses:0,streak:0,division:"E",title:"Unawakened",updatedAt:Date.now()}); return await ctx.db.get(id) }
async function ensureResources(ctx:any,userId:any){ const x=await ctx.db.query("gameResources").withIndex("by_user",q=>q.eq("userId",userId)).unique(); if(x)return x; const id=await ctx.db.insert("gameResources",{userId,essence:250,shards:5,cores:1,updatedAt:Date.now()}); return await ctx.db.get(id) }

export const getAscensionOS = query({args:{},returns:v.any(),handler:async(ctx)=>{
 const userId=await getAuthUserId(ctx); if(!userId)return null; const profile=await ctx.db.query("gameProfiles").withIndex("by_user",q=>q.eq("userId",userId)).unique(); if(!profile)return null
 const season=seasonKeyFor(); const ranking=await ctx.db.query("gameRankings").withIndex("by_user_season",q=>q.eq("userId",userId).eq("seasonKey",season)).unique()
 const resources=await ctx.db.query("gameResources").withIndex("by_user",q=>q.eq("userId",userId)).unique(); const mastery=await ctx.db.query("gamePowerUpMastery").withIndex("by_user",q=>q.eq("userId",userId)).take(30)
 const powerups=await ctx.db.query("gamePowerUps").withIndex("by_user",q=>q.eq("userId",userId)).take(30)
 const leaderboard=await ctx.db.query("gameRankings").withIndex("by_season_rating",q=>q.eq("seasonKey",season)).order("desc").take(25)
 const memberships=await ctx.db.query("gildedGuildMembers").withIndex("by_user",q=>q.eq("userId",userId)).take(20); const owned=await ctx.db.query("gildedGuilds").withIndex("by_owner",q=>q.eq("ownerId",userId)).take(10)
 return {season,ranking,resources:resources??{essence:0,shards:0,cores:0},mastery,powerups,leaderboard,memberships,owned}
}})

export const awakenPowerUp = mutation({args:{key:v.string()},returns:v.any(),handler:async(ctx,{key})=>{
 const userId=await getAuthUserId(ctx);if(!userId)return null; const p=await ctx.db.query("gamePowerUps").withIndex("by_user",q=>q.eq("userId",userId)).filter(q=>q.eq(q.field("key"),key)).unique(); if(!p)return null
 const r=await ensureResources(ctx,userId); const m=await ctx.db.query("gamePowerUpMastery").withIndex("by_user_power",q=>q.eq("userId",userId).eq("powerUpKey",key)).unique(); const cost=Math.max(50,p.level*75)
 if(!r||r.essence<cost)return {ok:false,code:"INSUFFICIENT_ESSENCE",cost}; const n=Math.min(99,p.level+1),now=Date.now(); await ctx.db.patch(r._id,{essence:r.essence-cost,cores:r.cores+(n%10===0?1:0),updatedAt:now})
 if(m)await ctx.db.patch(m._id,{masteryXp:m.masteryXp+cost,awakeningLevel:n,awakened:true,lastUsedAt:now,updatedAt:now}); else await ctx.db.insert("gamePowerUpMastery",{userId,powerUpKey:key,masteryXp:cost,awakeningLevel:n,awakened:true,lastUsedAt:now,updatedAt:now})
 await ctx.db.patch(p._id,{level:n}); return {ok:true,level:n,cost}
}})

export const rankedStrike = mutation({args:{sessionId:v.id("gameSessions"),score:v.number(),combo:v.number()},returns:v.any(),handler:async(ctx,a)=>{
 const userId=await getAuthUserId(ctx);if(!userId)return null; const s=await ctx.db.get(a.sessionId);if(!s||s.userId!==userId||s.status!=="active")return null
 const score=Math.max(0,Math.min(100000,Math.trunc(a.score))),combo=Math.max(0,Math.min(999,Math.trunc(a.combo))),r=await ensureRanking(ctx,userId)
 const delta=Math.max(8,Math.min(75,Math.floor(score/1000)+Math.floor(combo/20))),win=score>=5000||combo>=60,rating=Math.max(0,r!.rating+(win?delta:-Math.floor(delta/2))),streak=win?r!.streak+1:0,division=divisionFor(rating)
 await ctx.db.patch(r!._id,{rating,wins:r!.wins+(win?1:0),losses:r!.losses+(win?0:1),streak,division,title:titleFor(division),updatedAt:Date.now()}); return {ok:true,rating,division,title:titleFor(division),win,delta}
}})

export const applyToGuild = mutation({args:{guildId:v.id("gildedGuilds")},returns:v.boolean(),handler:async(ctx,{guildId})=>{
 const userId=await getAuthUserId(ctx);if(!userId)return false; const g=await ctx.db.get(guildId);if(!g||g.status!=="active")return false
 const m=await ctx.db.query("gildedGuildMembers").withIndex("by_guild_user",q=>q.eq("guildId",guildId).eq("userId",userId)).unique(); if(m?.status==="active")return true
 const p=await ctx.db.query("gameGuildApplications").withIndex("by_guild_status",q=>q.eq("guildId",guildId).eq("status","pending")).filter(q=>q.eq(q.field("userId"),userId)).unique(); if(p)return true
 await ctx.db.insert("gameGuildApplications",{guildId,userId,status:"pending",createdAt:Date.now(),updatedAt:Date.now()}); return true
}})

export const governGuildApplication = mutation({args:{applicationId:v.id("gameGuildApplications"),decision:v.union(v.literal("accepted"),v.literal("rejected"))},returns:v.boolean(),handler:async(ctx,a)=>{
 const actor=await getAuthUserId(ctx);if(!actor)return false; const app=await ctx.db.get(a.applicationId);if(!app)return false; const g=await ctx.db.get(app.guildId);if(!g||g.ownerId!==actor)return false
 await ctx.db.patch(app._id,{status:a.decision,updatedAt:Date.now()}); if(a.decision==="accepted"){ const m=await ctx.db.query("gildedGuildMembers").withIndex("by_guild_user",q=>q.eq("guildId",app.guildId).eq("userId",app.userId)).unique(); if(m)await ctx.db.patch(m._id,{status:"active",appointedBy:actor,appointedAt:Date.now()}); else await ctx.db.insert("gildedGuildMembers",{guildId:app.guildId,userId:app.userId,role:"member",status:"active",appointedBy:actor,appointedAt:Date.now()}) } return true
}})



const dungeonSeed=[{key:"whispering_catacombs",name:"The Whispering Catacombs",tier:"obsidian",minAscension:"E",minMembership:"obsidian",energyCost:15,recommendedParty:1,bossKey:"crypt_crawler"},{key:"sunken_spires",name:"The Sunken Spires of DeArmond",tier:"sovereign",minAscension:"C",minMembership:"sovereign",energyCost:25,recommendedParty:2,bossKey:"abyssal_siren"},{key:"obsidian_labyrinth",name:"The Obsidian Labyrinth",tier:"gilded",minAscension:"A",minMembership:"sovereign_gilded",energyCost:35,recommendedParty:3,bossKey:"flame_chimera"},{key:"vaults_aethelgard",name:"The Vaults of Aethelgard",tier:"gilded",minAscension:"SS",minMembership:"sovereign_aethel",energyCost:50,recommendedParty:4,bossKey:"celestial_guardian"},{key:"overlords_throne",name:"The Overlord's Throne Room",tier:"monarch",minAscension:"SS",minMembership:"sovereign_aethel",energyCost:75,recommendedParty:6,bossKey:"malakor_prime"}] as const
const elementSeed=[["flame","Pyromancer","Burn through shields and amplify combo chains."],["frost","Cryomancer","Freeze phases and control encounter tempo."],["void","Void Weaver","Pierce defenses and punish exposed cores."],["storm","Tempest","Stack rapid hits and lightning finishers."]] as const
const skillSeed=[["ember_lance","flame","Ember Lance",1,8,120,"burn"],["inferno_chain","flame","Inferno Chain",2,16,260,"burn"],["frost_bind","frost","Frost Bind",1,9,105,"freeze"],["glacial_break","frost","Glacial Break",2,17,280,"freeze"],["void_rift","void","Void Rift",1,10,140,"pierce"],["abyssal_collapse","void","Abyssal Collapse",2,20,330,"pierce"],["thunderstep","storm","Thunderstep",1,7,115,"shock"],["tempest_crown","storm","Tempest Crown",2,18,300,"shock"]] as const
async function ensureExpeditionSeeds(ctx:any){for(const d of dungeonSeed){if(!(await ctx.db.query("dungeonDefinitions").withIndex("by_key",q=>q.eq("key",d.key)).unique()))await ctx.db.insert("dungeonDefinitions",{...d,active:true})}for(const e of elementSeed){if(!(await ctx.db.query("magicElements").withIndex("by_key",q=>q.eq("key",e[0])).unique()))await ctx.db.insert("magicElements",{key:e[0],name:e[1],description:e[2],colorToken:e[0],active:true})}for(const x of skillSeed){if(!(await ctx.db.query("magicSkills").withIndex("by_key",q=>q.eq("key",x[0])).unique()))await ctx.db.insert("magicSkills",{key:x[0],elementKey:x[1],name:x[2],tier:x[3],manaCost:x[4],baseDamage:x[5],comboTag:x[6],active:true})}}
const membershipRank2=(t:string)=>tierRank[t]??1
const ascRank2=(d:string)=>({E:1,D:2,C:3,B:4,A:5,S:6,SS:7,SSS:8,MONARCH:9} as Record<string,number>)[d]??1
export const getExpeditionHub=query({args:{},returns:v.any(),handler:async(ctx)=>{
 const userId=await getAuthUserId(ctx); if(!userId)return null; await ensureExpeditionSeeds(ctx);
 const tierRow=await membership(ctx,userId);
 const rank=await ctx.db.query("gameRankings").withIndex("by_user_season",q=>q.eq("userId",userId).eq("seasonKey",seasonKeyFor())).unique();
 const dungeons=await ctx.db.query("dungeonDefinitions").filter(q=>q.eq(q.field("active"),true)).collect();
 const elements=await ctx.db.query("magicElements").filter(q=>q.eq(q.field("active"),true)).collect();
 const skills=await ctx.db.query("magicSkills").filter(q=>q.eq(q.field("active"),true)).collect();
 const mastery=await ctx.db.query("magicMastery").withIndex("by_user",q=>q.eq("userId",userId)).collect();
 const parties=await ctx.db.query("dungeonParties").withIndex("by_leader",q=>q.eq("leaderId",userId)).order("desc").take(10);
 const bosses=await ctx.db.query("worldBosses").withIndex("by_status",q=>q.eq("status","live")).take(5);
 return {tier:tierRow?.tier??"obsidian",rank,dungeons,elements,skills,mastery,parties,bosses};
}})
export const createDungeonParty=mutation({args:{dungeonId:v.id("dungeonDefinitions")},returns:v.any(),handler:async(ctx,{dungeonId})=>{const userId=await getAuthUserId(ctx);if(!userId||!(await ctx.db.get(dungeonId)))return null;const p=await ctx.db.insert("dungeonParties",{leaderId:userId,dungeonId,status:"forming",createdAt:Date.now()});await ctx.db.insert("dungeonPartyMembers",{partyId:p,userId,role:"dps",status:"accepted",joinedAt:Date.now()});return p}})
export const joinDungeonParty=mutation({args:{partyId:v.id("dungeonParties"),role:v.union(v.literal("tank"),v.literal("dps"),v.literal("mage"),v.literal("support"))},returns:v.boolean(),handler:async(ctx,a)=>{const userId=await getAuthUserId(ctx);const p=userId?await ctx.db.get(a.partyId):null;if(!userId||!p||p.status!=="forming")return false;const ms=await ctx.db.query("dungeonPartyMembers").withIndex("by_party",q=>q.eq("partyId",a.partyId)).collect();if(ms.length>=4||ms.some(m=>m.userId===userId))return false;await ctx.db.insert("dungeonPartyMembers",{partyId:a.partyId,userId,role:a.role,status:"accepted",joinedAt:Date.now()});return true}})
export const launchDungeon=mutation({
  args:{partyId:v.id("dungeonParties")},returns:v.any(),
  handler:async(ctx,{partyId})=>{
    const userId=await getAuthUserId(ctx);const p=userId?await ctx.db.get(partyId):null
    if(!userId||!p||p.leaderId!==userId||p.status!=="forming")return null
    const d=await ctx.db.get(p.dungeonId);if(!d)return null
    const t=await membership(ctx,userId),r=await ctx.db.query("gameRankings").withIndex("by_user_season",q=>q.eq("userId",userId).eq("seasonKey",seasonKeyFor())).unique()
    if(membershipRank2(t?.tier??"obsidian")<membershipRank2(d.minMembership)||ascRank2(r?.division??"E")<ascRank2(d.minAscension))return{ok:false,code:"TIER_OR_RANK_LOCKED"}
    const ms=await ctx.db.query("dungeonPartyMembers").withIndex("by_party",q=>q.eq("partyId",partyId)).collect();if(ms.length<d.recommendedParty)return{ok:false,code:"PARTY_NOT_READY",required:d.recommendedParty}
    const dayKey=new Date().toISOString().slice(0,10);let daily=await ctx.db.query("gameDailyStates").withIndex("by_user_day",q=>q.eq("userId",userId).eq("dayKey",dayKey)).unique()
    if(!daily){const id=await ctx.db.insert("gameDailyStates",{userId,dayKey,streak:0,energy:5,maxEnergy:5,updatedAt:Date.now()});daily=await ctx.db.get(id)}
    if(!daily||daily.energy<d.energyCost)return{ok:false,code:"INSUFFICIENT_ENERGY",required:d.energyCost,available:daily?.energy??0}
    await ctx.db.patch(daily._id,{energy:daily.energy-d.energyCost,updatedAt:Date.now()})
    const run=await ctx.db.insert("dungeonRuns",{userId,dungeonId:d._id,partyId,status:"active",energySpent:d.energyCost,phase:1,score:0,damage:0,startedAt:Date.now()})
    const lore=await ctx.db.query("universeMonsterProfiles").withIndex("by_key",q=>q.eq("key",d.bossKey)).unique()
    let m=await ctx.db.query("monsterDefinitions").withIndex("by_key",q=>q.eq("key",d.bossKey)).unique()
    if(!m){const id=await ctx.db.insert("monsterDefinitions",{key:d.bossKey,name:lore?.name??"Abyssal Beast",family:lore?.family??"boss",element:lore?.element??"void",maxHp:lore?.hp??d.recommendedParty*18000,shield:lore?.shield??d.recommendedParty*3000,phases:lore?.phases??3,lootTable:{drops:lore?.drops??["monster_shard","essence_core"]},active:true});m=await ctx.db.get(id)}
    const encounterId=await ctx.db.insert("monsterEncounters",{runId:run,monsterId:m!._id,currentHp:m!.maxHp,currentShield:m!.shield,phase:1,status:"spawned",spawnedAt:Date.now()});await ctx.db.insert("monsterAIStates",{encounterId,intelligence:lore?.intelligence??50,awareness:lore?.awareness??50,aggression:lore?.aggression??50,adaptation:0,threatScore:0,repeatedElementCount:0,phasePattern:1,behaviorMode:"observe",lastDecisionAt:Date.now()});await ctx.db.patch(p._id,{status:"active"})
    return{ok:true,runId:run,boss:m!.name,monsterStats:lore?{rank:lore.rank,intelligence:lore.intelligence,awareness:lore.awareness,attack:lore.attack,defense:lore.defense,magic:lore.magic,speed:lore.speed}:null,energyRemaining:daily.energy-d.energyCost}
  }
})

export const strikeMonster=mutation({
  args:{encounterId:v.id("monsterEncounters"),baseDamage:v.number(),element:v.string(),spell:v.boolean()},returns:v.any(),
  handler:async(ctx,a)=>{
    const userId=await getAuthUserId(ctx);const e=userId?await ctx.db.get(a.encounterId):null;if(!userId||!e||e.status!=="spawned")return null
    const run=await ctx.db.get(e.runId);if(!run||run.status!=="active")return null
    if(run.partyId){const member=await ctx.db.query("dungeonPartyMembers").withIndex("by_party",q=>q.eq("partyId",run.partyId!)).filter(q=>q.eq(q.field("userId"),userId)).unique();if(!member||member.status!=="accepted")return{ok:false,code:"NOT_IN_PARTY"}}else if(run.userId!==userId)return{ok:false,code:"NOT_IN_RUN"}
    const m=await ctx.db.get(e.monsterId);if(!m)return null
    const adv=({flame:"frost",frost:"storm",storm:"void",void:"flame"} as Record<string,string>)[a.element]===m.element
    const raw=Math.max(1,Math.min(50000,Math.floor(a.baseDamage)));const damage=Math.floor(raw*(adv?1.5:1)*(a.spell?1.25:1))
    const shield=Math.max(0,e.currentShield-damage),hp=Math.max(0,e.currentHp-Math.max(0,damage-e.currentShield)),phase=hp<=m.maxHp/3?3:hp<=m.maxHp*2/3?2:1,defeated=hp<=0
    await ctx.db.patch(e._id,{currentHp:hp,currentShield:shield,phase,status:defeated?"defeated":"spawned",defeatedAt:defeated?Date.now():undefined})
    await ctx.db.insert("monsterDamage",{encounterId:e._id,userId,damage,criticals:a.spell?1:0,spells:a.spell?1:0,createdAt:Date.now()});const ai=await ctx.db.query("monsterAIStates").withIndex("by_encounter",q=>q.eq("encounterId",e._id)).unique();let decision:any=null;if(ai&&!defeated){const repeat=(ai.lastPlayerElement===a.element?ai.repeatedElementCount+1:1);const adaptation=Math.min(100,ai.adaptation+(repeat>=2?Math.max(3,Math.floor(ai.intelligence/20)):1));const phaseShift=phase>ai.phasePattern;const mode=phaseShift?"enrage":repeat>=3&&ai.intelligence>=70?"counter":ai.awareness>=85?"hunt":ai.aggression>=75?"assault":"observe";const threat=damage*(1+ai.awareness/200)+(a.spell?ai.intelligence:0);decision={mode,target:userId,phase,repeat,adaptation,counterElement:repeat>=2?a.element:null,threat:Math.round(threat)};await ctx.db.patch(ai._id,{adaptation,threatTargetId:userId,threatScore:threat,lastPlayerElement:a.element,repeatedElementCount:repeat,phasePattern:phase,behaviorMode:mode,lastDecisionAt:Date.now()});await ctx.db.insert("combatEvents",{encounterId:e._id,type:"monster_decision",actorId:userId,payload:decision,createdAt:Date.now()})}
    if(defeated){await ctx.db.patch(run._id,{status:"completed",phase:3,damage:run.damage+damage,score:run.score+damage,endedAt:Date.now()});const members=run.partyId?await ctx.db.query("dungeonPartyMembers").withIndex("by_party",q=>q.eq("partyId",run.partyId!)).collect():[];const recipients=members.length?members.filter(x=>x.status==="accepted").map(x=>x.userId):[userId];for(const recipient of recipients){await ctx.db.insert("lootDrops",{runId:run._id,userId:recipient,itemKey:"monster_shard",itemType:"material",quantity:3,rarity:"rare",createdAt:Date.now()});await ctx.db.insert("lootDrops",{runId:run._id,userId:recipient,itemKey:"essence_core",itemType:"material",quantity:1,rarity:"epic",createdAt:Date.now()})}}
    return{damage,advantage:adv,phase,defeated,monsterDecision:decision}
  }
})

export const unlockMagic=mutation({args:{skillKey:v.string()},returns:v.boolean(),handler:async(ctx,{skillKey})=>{const userId=await getAuthUserId(ctx);const skill=userId?await ctx.db.query("magicSkills").withIndex("by_key",q=>q.eq("key",skillKey)).unique():null;if(!userId||!skill)return false;const m=await ctx.db.query("magicMastery").withIndex("by_skill",q=>q.eq("userId",userId).eq("skillKey",skillKey)).unique();if(m){await ctx.db.patch(m._id,{unlocked:true});return true}await ctx.db.insert("magicMastery",{userId,skillKey,xp:0,level:1,unlocked:true,updatedAt:Date.now()});return true}})
export const equipMagic=mutation({args:{skillKey:v.string(),slot:v.number()},returns:v.boolean(),handler:async(ctx,a)=>{const userId=await getAuthUserId(ctx);if(!userId||a.slot<1||a.slot>4)return false;const m=await ctx.db.query("magicMastery").withIndex("by_skill",q=>q.eq("userId",userId).eq("skillKey",a.skillKey)).unique();if(!m||!m.unlocked)return false;for(const x of await ctx.db.query("magicMastery").withIndex("by_user",q=>q.eq("userId",userId)).collect())if(x.equippedSlot===a.slot)await ctx.db.patch(x._id,{equippedSlot:undefined});await ctx.db.patch(m._id,{equippedSlot:a.slot,updatedAt:Date.now()});return true}})
export const castMagic=mutation({args:{skillKey:v.string(),combo:v.number()},returns:v.any(),handler:async(ctx,a)=>{const userId=await getAuthUserId(ctx);const m=userId?await ctx.db.query("magicMastery").withIndex("by_skill",q=>q.eq("userId",userId).eq("skillKey",a.skillKey)).unique():null;const skill=await ctx.db.query("magicSkills").withIndex("by_key",q=>q.eq("key",a.skillKey)).unique();if(!userId||!m||!m.unlocked||!skill)return null;const mult=1+Math.min(3,Math.max(0,a.combo)*0.08),damage=Math.floor(skill.baseDamage*(1+m.level*0.12)*mult),xp=m.xp+damage;await ctx.db.patch(m._id,{xp,level:Math.min(99,1+Math.floor(xp/1000)),updatedAt:Date.now()});return{damage,element:skill.elementKey,comboMultiplier:mult}}})
export const getMonsterCombatIntel=query({
  args:{encounterId:v.id("monsterEncounters")},returns:v.any(),
  handler:async(ctx,{encounterId})=>{
    const e=await ctx.db.get(encounterId);if(!e)return null
    const m=await ctx.db.get(e.monsterId);const ai=await ctx.db.query("monsterAIStates").withIndex("by_encounter",q=>q.eq("encounterId",encounterId)).unique()
    const events=await ctx.db.query("combatEvents").withIndex("by_encounter",q=>q.eq("encounterId",encounterId)).order("desc").take(8)
    return {monster:m,ai,events}
  }
})
