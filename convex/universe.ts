import { v } from "convex/values"
import { query } from "./_generated/server"

const locations = [
  {key:"dearmond",name:"DeArmond",subtitle:"The Sanctuary Capital",description:"A gleaming high-tech luxury metropolis protected by ancient wards, where citizens, merchants and lower-tier adventurers live beneath the watch of the Bastion.",realm:"Sanctuary Realm",dangerRank:"E",tags:["capital","sanctuary","commerce","safe-zone"]},
  {key:"pharmacy_aethel",name:"The Pharmacy",subtitle:"Apothecary of Aethel",description:"An elite alchemy hub where rare materials become healing elixirs, stat tonics and essence phials.",realm:"DeArmond",dangerRank:"C",tags:["alchemy","crafting","healing"]},
  {key:"merchant_plaza",name:"The Grand Merchant Plaza",subtitle:"Heart of Luxury Trade",description:"The commercial heart of Evara-lux: storefronts, Gilded custom-forges and luxury trading posts converge here.",realm:"DeArmond",dangerRank:"C",tags:["commerce","forge","market"]},
  {key:"guild_hall",name:"The Guild Hall",subtitle:"The Bastion of Crowns",description:"The administrative and tactical headquarters for player guilds, with war-room tables, charters and quest boards.",realm:"DeArmond",dangerRank:"B",tags:["guilds","quests","war-room"]},
  {key:"church_first_light",name:"The Church of the First Light",subtitle:"Sanctuary of Sacred Radiance",description:"A majestic cathedral offering daily blessings, safe-haven resting buffs, purification and moral alignment quests.",realm:"DeArmond",dangerRank:"B",tags:["blessing","purification","safe-zone"]},
  {key:"overlords_citadel",name:"The Overlord’s Citadel",subtitle:"Fortress Beyond the Wards",description:"An obsidian fortress on the outer rim, ruled by high-ranking faction bosses and guarded by corrupted champions.",realm:"Outer Rim",dangerRank:"S",tags:["demon","fortress","overlord"]},
  {key:"abyss_rifts",name:"The Interdimensional Rifts",subtitle:"The Abyss",description:"Unstable tears connecting DeArmond to hostile dimensions. High-tier expeditions enter through these portals.",realm:"The Abyss",dangerRank:"SSS",tags:["rift","dimension","raid"]},
]

const factions = [
  {key:"sovereign_syndicate",name:"The Sovereign Syndicate",description:"An elite merchant and political powerhouse whose influence reaches from the Plaza into the highest charters.",alignment:"neutral-power",threatRank:"S",headquartersKey:"merchant_plaza"},
  {key:"obsidian_vanguard",name:"Obsidian Vanguard",description:"Defenders of the inner sector and first response force against incursions.",alignment:"guardian",threatRank:"A",headquartersKey:"dearmond"},
  {key:"gilded_dynasty",name:"Gilded Dynasty",description:"Masters of trade, luxury craftsmanship, custom forging and rare material acquisition.",alignment:"merchant-craft",threatRank:"SS",headquartersKey:"merchant_plaza"},
  {key:"apex_dominion",name:"Apex Dominion",description:"Top-tier tactical combatants and raid conquerors who pursue the most dangerous expeditions.",alignment:"combat",threatRank:"SSS",headquartersKey:"guild_hall"},
  {key:"aethelgard_knights",name:"Aethelgard Knights",description:"Guardians of the Church and sacred dimensional gates.",alignment:"holy-guardian",threatRank:"SSS",headquartersKey:"church_first_light"},
  {key:"demonic_vanguard",name:"The Demonic Vanguard",description:"Fiendish entities invading from the outer rifts and seeking to breach DeArmond.",alignment:"hostile",threatRank:"SSS"},
  {key:"overlord_legions",name:"The Overlord’s Legions",description:"Corrupted monsters and rogue champions commanded by the Overlord, combining heavy physical resistance with dark-magic attacks.",alignment:"hostile",threatRank:"MONARCH",headquartersKey:"overlords_citadel"},
]

const npcs = [
  {key:"valerius",name:"High Chancellor Valerius",title:"Arbiter of Guild Charters",locationKey:"guild_hall",factionKey:"sovereign_syndicate",description:"Overseer of the Sovereign Tiers and final registrar of elite guild charters.",services:["guild-charters","tier-guidance","territory-law"]},
  {key:"aurelia",name:"Aurelia the Alchemist",title:"Master of Rare Fusion",locationKey:"pharmacy_aethel",description:"Master proprietor of The Pharmacy and authority on rare-material fusion.",services:["alchemy","material-fusion","elixirs","essence-phials"]},
  {key:"kaelen",name:"Kaelen the Blacksmith",title:"Legendary Gilded Weaponsmith",locationKey:"merchant_plaza",factionKey:"gilded_dynasty",description:"A legendary smith specializing in Gilded-tier gear modification and artifact preparation.",services:["gear-modification","reforging","artifact-prep"]},
  {key:"beatrice",name:"Sister Beatrice",title:"Keeper of the First Light",locationKey:"church_first_light",factionKey:"aethelgard_knights",description:"Keeper of the cathedral who grants purification, blessings and sanctuary buffs.",services:["blessing","purification","resting-buff","alignment-quests"]},
  {key:"malakor_exiled",name:"Malakor the Exiled",title:"Whisperer at the Wastes",locationKey:"overlords_citadel",description:"A mysterious informant at the border of DeArmond and the Demon Wastes. His true allegiance is unknown.",services:["rumors","rift-intel","hidden-quests"]},
]

const materials = [
  ["rough_bone_shard","Rough Bone Shard","E/D","bone","Basic remains harvested from novice undead.","slime_wight,crypt_crawler","common","alchemy,forge-reagents"],
  ["gloom_essence","Gloom Essence","E/D","essence","Condensed shadow residue found in Whispering Catacombs.","slime_wight,crypt_crawler","uncommon","tonics,shadow-catalysts"],
  ["polished_steel_core","Polished Steel Core","C/B","core","A dense metallic core from constructs of the Sunken Spires.","ironclad_golem","rare","weapons,armor,forge"],
  ["siren_scale","Siren Scale","C/B","scale","A resonant scale carrying abyssal sonic charge.","abyssal_siren","rare","enchants,warding"],
  ["obsidian_shard","Obsidian Shard","A/S","crystal","A razor-dark shard formed in high-pressure abyssal stone.","shadow_stalker,flame_chimera","epic","weapons,armor,portals"],
  ["dragonic_ash","Dragonic Ash","A/S","ash","Residual ash from flame-bound draconic tissue.","flame_chimera","epic","alchemy,fire-enchants"],
  ["aethel_crystal","Aethel Crystal","SS/SSS","crystal","A radiant dimensional crystal used by Aethelgard artificers.","void_sovereign,celestial_guardian","legendary","artifacts,rift-keys"],
  ["star_metal_core","Star-Metal Core","SS/SSS","core","Compressed celestial metal with extreme resonance.","void_sovereign,celestial_guardian","legendary","relics,armor"],
  ["monarchs_tear","Monarch's Tear","MONARCH","relic","A crystallized remnant of sovereign will.","malakor_prime,infinite_void_beast","mythic","monarch-artifacts,ascension"],
  ["primordial_essence","Primordial Essence","MONARCH","essence","Pre-dimensional essence capable of rewriting artifact limits.","malakor_prime,infinite_void_beast","mythic","transcendence,primordial-crafting"],
].map(([key,name,rank,category,description,source,rarity,uses])=>({key,name,rank,category,description,sourceMonsterKeys:source.split(","),rarity,uses:uses.split(","),active:true}))

const monsters = [
  {key:"slime_wight",name:"Slime-Wight",rank:"E",family:"undead-slime",factionKey:"overlord_legions",element:"gloom",intelligence:18,awareness:22,aggression:30,attack:35,defense:20,magic:15,speed:24,vitality:40,hp:900,shield:100,phases:1,abilities:["Grave Sludge","Wight Bite"],behavior:["wanders","clusters","retreats at low vitality"],drops:["rough_bone_shard","gloom_essence"],dungeonKey:"whispering_catacombs",description:"A low-rank undead mass animated by gloom residue."},
  {key:"crypt_crawler",name:"Crypt Crawler",rank:"D",family:"crypt-beast",factionKey:"overlord_legions",element:"gloom",intelligence:28,awareness:38,aggression:45,attack:55,defense:42,magic:22,speed:50,vitality:65,hp:1800,shield:180,phases:2,abilities:["Burrow","Bone Ambush","Carrion Rush"],behavior:["burrows","flanks","targets isolated players"],drops:["rough_bone_shard","gloom_essence"],dungeonKey:"whispering_catacombs",description:"A predatory crypt beast whose instincts sharpen in darkness."},
  {key:"ironclad_golem",name:"Ironclad Golem",rank:"C",family:"construct",factionKey:"overlord_legions",element:"steel",intelligence:45,awareness:50,aggression:52,attack:110,defense:140,magic:30,speed:28,vitality:150,hp:6200,shield:1200,phases:2,abilities:["Fortify","Titan Slam","Steel Bastion"],behavior:["guards","raises shield at phase change","focuses highest-damage target"],drops:["polished_steel_core"],dungeonKey:"sunken_spires",description:"A siege construct built to protect submerged dimensional machinery."},
  {key:"abyssal_siren",name:"Abyssal Siren",rank:"B",family:"abyssal-humanoid",factionKey:"demonic_vanguard",element:"tide",intelligence:68,awareness:72,aggression:58,attack:125,defense:75,magic:155,speed:90,vitality:130,hp:7600,shield:800,phases:3,abilities:["Sonic Veil","Drowning Hymn","Mirror Call"],behavior:["debuffs","misdirects","punishes grouped parties"],drops:["siren_scale"],dungeonKey:"sunken_spires",description:"A calculating abyssal caster that weaponizes resonance."},
  {key:"shadow_stalker",name:"Shadow Stalker",rank:"A",family:"void-hunter",factionKey:"overlord_legions",element:"void",intelligence:78,awareness:88,aggression:76,attack:220,defense:120,magic:180,speed:145,vitality:190,hp:15000,shield:2200,phases:3,abilities:["Phase Step","Void Mark","Execution Fang"],behavior:["stalks","counterattacks","hunts wounded targets"],drops:["obsidian_shard"],dungeonKey:"obsidian_labyrinth",description:"A sentient hunter that studies player patterns before committing to an attack."},
  {key:"flame_chimera",name:"Flame-Bound Chimera",rank:"S",family:"chimera",factionKey:"demonic_vanguard",element:"flame",intelligence:84,awareness:86,aggression:94,attack:320,defense:210,magic:260,speed:110,vitality:280,hp:28000,shield:4500,phases:4,abilities:["Inferno Roar","Drake Rush","Tri-Head Rupture"],behavior:["switches targets","ignites arenas","enrages when wounded"],drops:["obsidian_shard","dragonic_ash"],dungeonKey:"obsidian_labyrinth",description:"A multi-headed war beast bound to living flame."},
  {key:"void_sovereign",name:"Void Sovereign",rank:"SS",family:"void-lord",factionKey:"demonic_vanguard",element:"void",intelligence:94,awareness:96,aggression:82,attack:520,defense:390,magic:620,speed:170,vitality:520,hp:80000,shield:14000,phases:5,abilities:["Null Crown","Reality Fracture","Abyssal Edict","Void Collapse"],behavior:["adapts to repeated skills","separates party","punishes predictable rotations"],drops:["aethel_crystal","star_metal_core"],dungeonKey:"vaults_aethelgard",description:"A high-order intelligence capable of recognizing player rotations and changing tactics."},
  {key:"celestial_guardian",name:"Celestial Guardian",rank:"SSS",family:"celestial-construct",factionKey:"aethelgard_knights",element:"radiance",intelligence:98,awareness:99,aggression:60,attack:680,defense:620,magic:760,speed:190,vitality:700,hp:120000,shield:24000,phases:6,abilities:["Judgment Ray","Aegis of Stars","Heavenfall","Sanctum Reset"],behavior:["reads threat","protects objectives","changes pattern after player adaptation"],drops:["aethel_crystal","star_metal_core"],dungeonKey:"vaults_aethelgard",description:"An ancient guardian whose battle logic approaches sentience."},
  {key:"malakor_prime",name:"Malakor Prime",rank:"MONARCH",family:"demon-overlord",factionKey:"overlord_legions",element:"abyss",intelligence:100,awareness:100,aggression:100,attack:1500,defense:1300,magic:1800,speed:260,vitality:2000,hp:1000000,shield:250000,phases:8,abilities:["Overlord's Decree","Abyssal Dominion","Demon Crown","World Rend"],behavior:["commands adds","rewrites encounter rules","counter-builds against party","executes failed mechanics"],drops:["monarchs_tear","primordial_essence"],dungeonKey:"overlords_throne",description:"The apex manifestation of Malakor's demonic sovereignty."},
  {key:"infinite_void_beast",name:"The Infinite Void Beast",rank:"MONARCH",family:"primordial-void",factionKey:"overlord_legions",element:"void",intelligence:100,awareness:100,aggression:98,attack:1900,defense:1600,magic:2200,speed:300,vitality:2500,hp:1500000,shield:400000,phases:10,abilities:["Infinity Maw","Dimension Devour","Zero Horizon","Endless Phase"],behavior:["adapts globally","copies player elemental patterns","alters phase objectives","targets guild formations"],drops:["monarchs_tear","primordial_essence"],dungeonKey:"overlords_throne",description:"A primordial entity whose combat intelligence evolves with every failed assault."},
]

const dungeons = [
  {key:"whispering_catacombs",name:"The Whispering Catacombs",rankBand:"E / D",locationKey:"dearmond",bossKeys:["slime_wight","crypt_crawler"],materialKeys:["rough_bone_shard","gloom_essence"],description:"The first descent beneath DeArmond. The walls whisper old names to unprepared hunters.",partyRange:"1–4"},
  {key:"sunken_spires",name:"The Sunken Spires of DeArmond",rankBand:"C / B",locationKey:"dearmond",bossKeys:["ironclad_golem","abyssal_siren"],materialKeys:["polished_steel_core","siren_scale"],description:"Flooded towers below the capital containing forgotten dimensional machinery.",partyRange:"2–4"},
  {key:"obsidian_labyrinth",name:"The Obsidian Labyrinth",rankBand:"A / S",locationKey:"abyss_rifts",bossKeys:["shadow_stalker","flame_chimera"],materialKeys:["obsidian_shard","dragonic_ash"],description:"A shifting labyrinth where darkness remembers every route taken.",partyRange:"3–5"},
  {key:"vaults_aethelgard",name:"The Vaults of Aethelgard",rankBand:"SS / SSS",locationKey:"abyss_rifts",bossKeys:["void_sovereign","celestial_guardian"],materialKeys:["aethel_crystal","star_metal_core"],description:"Sacred dimensional vaults where celestial defenses and void sovereigns collide.",partyRange:"4–6"},
  {key:"overlords_throne",name:"The Overlord's Throne Room",rankBand:"MONARCH",locationKey:"overlords_citadel",bossKeys:["malakor_prime","infinite_void_beast"],materialKeys:["monarchs_tear","primordial_essence"],description:"A god-tier encounter zone beyond ordinary adventurer law.",partyRange:"6–12"},
]

async function ensure(ctx:any){
  for(const x of locations) if(!(await ctx.db.query("universeLocations").withIndex("by_key",q=>q.eq("key",x.key)).unique())) await ctx.db.insert("universeLocations",{...x})
  for(const x of factions) if(!(await ctx.db.query("universeFactions").withIndex("by_key",q=>q.eq("key",x.key)).unique())) await ctx.db.insert("universeFactions",{...x,active:true})
  for(const x of npcs) if(!(await ctx.db.query("universeNpcs").withIndex("by_key",q=>q.eq("key",x.key)).unique())) await ctx.db.insert("universeNpcs",{...x,active:true})
  for(const x of materials) if(!(await ctx.db.query("universeMaterials").withIndex("by_key",q=>q.eq("key",x.key)).unique())) await ctx.db.insert("universeMaterials",{...x})
  for(const x of monsters) if(!(await ctx.db.query("universeMonsterProfiles").withIndex("by_key",q=>q.eq("key",x.key)).unique())) await ctx.db.insert("universeMonsterProfiles",{...x,active:true})
  for(const x of dungeons) if(!(await ctx.db.query("universeDungeons").withIndex("by_key",q=>q.eq("key",x.key)).unique())) await ctx.db.insert("universeDungeons",{...x,active:true})
}

export const getUniverseCodex = query({
  args:{},
  returns:v.any(),
  handler:async(ctx)=>{
    await ensure(ctx)
    const [locations,factions,npcs,materials,monsters,dungeons]=await Promise.all([
      ctx.db.query("universeLocations").take(50),
      ctx.db.query("universeFactions").take(50),
      ctx.db.query("universeNpcs").take(50),
      ctx.db.query("universeMaterials").take(100),
      ctx.db.query("universeMonsterProfiles").take(100),
      ctx.db.query("universeDungeons").take(50),
    ])
    return {locations,factions,npcs,materials,monsters,dungeons}
  }
})

export const getMonsterIntel = query({
  args:{monsterKey:v.string()},
  returns:v.any(),
  handler:async(ctx,{monsterKey})=>{
    await ensure(ctx)
    const monster=await ctx.db.query("universeMonsterProfiles").withIndex("by_key",q=>q.eq("key",monsterKey)).unique()
    if(!monster) return null
    const dungeon=await ctx.db.query("universeDungeons").withIndex("by_key",q=>q.eq("key",monster.dungeonKey)).unique()
    const drops:any[]=[]
    for(const key of monster.drops){ const m=await ctx.db.query("universeMaterials").withIndex("by_key",q=>q.eq("key",key)).unique(); if(m)drops.push(m) }
    return {monster,dungeon,drops}
  }
})
