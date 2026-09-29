import { useState } from "react"
import { useConvexAuth, useMutation, useQuery } from "convex/react"
import { Link } from "@tanstack/react-router"
import { Search, MessageCircle, UserPlus, UserCheck, X, Crown, Trophy, ShieldCheck, Image as ImageIcon, Sparkles, Users } from "lucide-react"
import { api } from "../../convex/_generated/api"

const tierLabel: Record<string,string> = {
  obsidian: "Obsidian",
  sovereign: "Sovereign",
  sovereign_gilded: "Sovereign-Gilded",
  apex_imperial: "Apex-Imperial",
  sovereign_aethel: "Sovereign-Aethel",
}

function InitialAvatar({ name, size="md" }: { name: string; size?: "sm"|"md"|"lg" }) {
  const cls = size === "lg" ? "h-20 w-20 text-xl" : size === "sm" ? "h-9 w-9 text-xs" : "h-14 w-14 text-sm"
  return <div className={`${cls} grid shrink-0 place-items-center rounded-full border border-accent/40 bg-accent/10 font-display text-accent`}>{(name || "E").slice(0,1).toUpperCase()}</div>
}

export function EvaraSocialHub() {
  const { isAuthenticated } = useConvexAuth()
  const [search, setSearch] = useState("")
  const [selectedFriend, setSelectedFriend] = useState<any>(null)
  const [notice, setNotice] = useState("")
  const circle = useQuery(api.social.listMyCircle, isAuthenticated ? {} : "skip") ?? []
  const requests = useQuery(api.social.listFriendRequests, isAuthenticated ? {} : "skip") ?? []
  const membership = useQuery(api.membership.getMyMembership, isAuthenticated ? {} : "skip")
  const leaderboard = useQuery(api.membership.getNexaLeaderboard, isAuthenticated ? {} : "skip") ?? []
  const challenges = useQuery(api.membership.listLiveChallenges, isAuthenticated ? {} : "skip") ?? []
  const searchMembers = useQuery(api.social.searchMembers, isAuthenticated && search.trim().length > 1 ? { search } : "skip") ?? []
  const selectedProfile = useQuery(api.social.getFriendProfile, isAuthenticated && selectedFriend ? { targetUserId: selectedFriend.userId } : "skip")
  const connect = useMutation(api.social.connect)
  const respond = useMutation(api.social.respondToFriendRequest)
  const openThread = useMutation(api.social.openDirectThread)
  const progress = useMutation(api.membership.recordChallengeProgress)

  async function requestFriend(userId: any) {
    const ok = await connect({ targetUserId: userId, kind: "friend" })
    setNotice(ok ? "Friend request sent." : "That connection could not be created.")
    window.setTimeout(() => setNotice(""), 2200)
  }

  async function chatWith(userId: any) {
    const thread = await openThread({ targetUserId: userId })
    if (thread) window.location.href = "/messages"
    else {
      setNotice("Messaging is unavailable for this profile.")
      window.setTimeout(() => setNotice(""), 2200)
    }
  }

  if (!isAuthenticated) {
    return <div className="min-h-[70vh] grid place-items-center px-6 text-center">
      <div><Users className="mx-auto h-8 w-8 text-accent" /><h1 className="mt-5 font-display text-4xl">Your circle awaits.</h1><p className="mt-3 text-sm text-muted-foreground">Sign in to manage friends, private connections and Nexa Points.</p><Link to="/login" className="mt-6 inline-flex border border-accent px-5 py-3 text-[10px] uppercase tracking-[0.16em]">Sign in</Link></div>
    </div>
  }

  return <div className="space-y-6">
    <header className="flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-[10px] uppercase tracking-[0.28em] text-accent">EVARA·LUX / FRIENDS HUB</p>
        <h1 className="mt-3 font-display text-4xl tracking-[-0.04em] md:text-5xl">Your connected circle.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Discover people, manage trusted connections and explore the Nexa Points layer behind meaningful participation.</p>
      </div>
      <div className="flex items-center gap-3 border border-accent/30 bg-accent/5 px-5 py-3">
        <Sparkles className="h-4 w-4 text-accent" />
        <div><p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Nexa Points</p><p className="font-display text-xl">{(membership?.points ?? 0).toLocaleString()}</p></div>
      </div>
    </header>

    {notice && <div className="border border-accent/30 bg-accent/5 px-4 py-3 text-xs text-accent">{notice}</div>}

    <section className="border border-border bg-card p-5 md:p-7">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-[10px] uppercase tracking-[0.2em] text-accent">Connected Circle</p><h2 className="mt-1 font-display text-2xl">Friends & follows</h2></div>
        <span className="text-xs text-muted-foreground">{circle.length} connected</span>
      </div>
      <div className="mt-6 flex gap-5 overflow-x-auto pb-2">
        {circle.length ? circle.map((friend:any) => <button key={String(friend.userId)} onClick={() => setSelectedFriend(friend)} className="group flex w-20 shrink-0 flex-col items-center">
          <div className="rounded-full p-[2px] transition-transform group-hover:scale-105 bg-gradient-to-tr from-accent/80 to-accent/20"><InitialAvatar name={friend.displayName} /></div>
          <span className="mt-2 max-w-20 truncate text-xs group-hover:text-accent">{friend.username}</span>
          <span className="mt-0.5 text-[8px] uppercase tracking-[0.08em] text-muted-foreground">{tierLabel[friend.tier] ?? friend.tier}</span>
        </button>) : <div className="py-8 text-sm text-muted-foreground">Your circle is empty. Search for someone below to begin.</div>}
      </div>
    </section>

    <section className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
      <div className="border border-border bg-card p-5 md:p-7">
        <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.2em] text-accent">People</p><h2 className="mt-1 font-display text-2xl">Find your people</h2></div><Search className="h-4 w-4 text-muted-foreground" /></div>
        <div className="mt-5 flex items-center gap-2 border border-border bg-background px-3 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search username or display name" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </div>
        <div className="mt-4 space-y-2">
          {search.length > 1 && searchMembers.map((person:any) => <div key={String(person.userId)} className="flex items-center gap-3 border border-border p-3">
            <InitialAvatar name={person.displayName} size="sm" /><div className="min-w-0 flex-1"><p className="truncate text-sm">{person.displayName}</p><p className="truncate text-[10px] text-muted-foreground">@{person.username} · {tierLabel[person.tier] ?? person.tier}</p></div>
            <button onClick={() => void requestFriend(person.userId)} className="border border-accent/40 px-3 py-2 text-[9px] uppercase tracking-[0.12em] hover:border-accent"><UserPlus className="mr-1 inline h-3 w-3" />Add</button>
          </div>)}
          {search.length > 1 && !searchMembers.length && <p className="py-5 text-xs text-muted-foreground">No discoverable members matched that search.</p>}
          {search.length <= 1 && <p className="py-5 text-xs leading-5 text-muted-foreground">Search is privacy-aware and respects members who opt out of discovery.</p>}
        </div>
        {requests.length > 0 && (
          <div className="mt-6 border-t border-border pt-5">
            <p className="text-[9px] uppercase tracking-[0.18em] text-accent">Friend requests · {requests.length}</p>
            <div className="mt-3 space-y-2">
              {requests.map((request:any) => (
                <div key={String(request.connectionId)} className="flex items-center gap-3 border border-border p-3">
                  <InitialAvatar name={request.displayName} size="sm" />
                  <div className="flex-1">
                    <p className="text-sm">{request.displayName}</p>
                    <p className="text-[10px] text-muted-foreground">@{request.username}</p>
                  </div>
                  <button onClick={() => void respond({connectionId:request.connectionId,accept:true})} className="border border-accent px-3 py-2 text-[9px] uppercase tracking-[0.1em]">
                    <UserCheck className="mr-1 inline h-3 w-3" />Accept
                  </button>
                  <button onClick={() => void respond({connectionId:request.connectionId,accept:false})} className="border border-border px-3 py-2 text-[9px] uppercase tracking-[0.1em]">
                    Decline
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border border-border bg-card p-5 md:p-7">
        <div className="flex items-center gap-3"><Trophy className="h-4 w-4 text-accent" /><div><p className="text-[10px] uppercase tracking-[0.2em] text-accent">Nexa Points</p><h2 className="mt-1 font-display text-2xl">Recognition board</h2></div></div>
        <div className="mt-5 space-y-2">
          {leaderboard.slice(0,8).map((person:any,index:number) => <button key={String(person.userId)} onClick={() => setSelectedFriend(person)} className="flex w-full items-center gap-3 border border-border p-3 text-left hover:border-accent/40"><span className="w-5 text-center font-mono text-[10px] text-muted-foreground">{index+1}</span><InitialAvatar name={person.displayName} size="sm" /><div className="min-w-0 flex-1"><p className="truncate text-xs">{person.displayName}</p><p className="truncate text-[9px] text-muted-foreground">{tierLabel[person.tier] ?? person.tier}</p></div><span className="font-mono text-xs text-accent">{person.points.toLocaleString()}</span></button>)}
          {!leaderboard.length && <p className="py-6 text-xs text-muted-foreground">The board will populate as members earn Nexa Points.</p>}
        </div>
        <Link to="/membership" className="mt-5 inline-flex text-[9px] uppercase tracking-[0.15em] text-muted-foreground hover:text-accent">View membership system →</Link>
      </div>
    </section>

    <section className="border border-border bg-card p-5 md:p-7">
      <div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[0.2em] text-accent">Nexa grading engine</p><h2 className="mt-1 font-display text-2xl">Weekly challenges</h2></div><Crown className="h-5 w-5 text-accent" /></div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {challenges.slice(0,4).map((challenge:any) => <div key={String(challenge._id)} className="border border-border p-4"><div className="flex justify-between gap-4"><div><p className="text-sm">{challenge.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{challenge.description}</p></div><span className="text-[9px] text-accent">+{challenge.pointsReward}</span></div><div className="mt-4 h-1.5 bg-muted"><div className="h-full bg-accent" style={{width:`${challenge.progress}%`}} /></div><button onClick={() => void progress({challengeId:challenge._id,amount:10})} className="mt-3 border border-border px-3 py-2 text-[9px] uppercase tracking-[0.12em] hover:border-accent">Log contribution +10%</button></div>)}
        {!challenges.length && <p className="text-xs text-muted-foreground">No live challenge is active right now.</p>}
      </div>
    </section>

    {selectedFriend && <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-md" onMouseDown={() => setSelectedFriend(null)}>
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto border border-accent/30 bg-background p-6 md:p-8" onMouseDown={e => e.stopPropagation()}>
        <button onClick={() => setSelectedFriend(null)} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        <div className="flex items-center gap-4 pr-8"><InitialAvatar name={selectedProfile?.displayName ?? selectedFriend.displayName ?? selectedFriend.username} size="lg" /><div><h3 className="font-display text-2xl">{selectedProfile?.displayName ?? selectedFriend.displayName}</h3><p className="mt-1 text-xs text-muted-foreground">@{selectedProfile?.username ?? selectedFriend.username}</p><p className="mt-2 text-[9px] uppercase tracking-[0.16em] text-accent">{tierLabel[selectedProfile?.tier ?? selectedFriend.tier] ?? "Obsidian"} Tier</p></div></div>
        {selectedProfile?.restricted ? <div className="mt-8 border border-border p-5 text-center"><ShieldCheck className="mx-auto h-5 w-5 text-accent" /><p className="mt-3 text-sm">This member keeps their profile private.</p><p className="mt-1 text-xs text-muted-foreground">Connect as a friend to view permitted profile content.</p></div> : <><p className="mt-6 text-sm leading-6 text-muted-foreground">{selectedProfile?.bio || "A member of the Evara-lux circle."}</p><div className="mt-5 flex gap-2"><span className="border border-border px-3 py-2 text-[9px] uppercase tracking-[0.1em]">{(selectedProfile?.points ?? selectedFriend.points ?? 0).toLocaleString()} Nexa Points</span><span className="border border-border px-3 py-2 text-[9px] uppercase tracking-[0.1em]">{selectedProfile?.mutualCount ?? 0} mutual</span></div><div className="mt-6 grid grid-cols-3 gap-2">{(selectedProfile?.posts ?? []).slice(0,6).map((post:any) => <div key={String(post._id)} className="aspect-square border border-border bg-card overflow-hidden">{post.mediaUrl ? <img src={post.mediaUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><ImageIcon className="h-5 w-5 text-muted-foreground" /></div>}</div>)}</div><div className="mt-6 flex gap-2"><button onClick={() => void chatWith(selectedFriend.userId)} className="flex-1 border border-accent bg-accent px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.13em] text-background"><MessageCircle className="mr-1 inline h-3 w-3" />Open Chat</button><button onClick={() => void requestFriend(selectedFriend.userId)} className="flex-1 border border-border px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.13em]"><UserPlus className="mr-1 inline h-3 w-3" />Add Friend</button></div></>}
      </div>
    </div>}
  </div>
}
