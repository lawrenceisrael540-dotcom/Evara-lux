import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { Bookmark, Camera, Check, CirclePlay, Clock3, Heart, MessageCircle, MoreHorizontal, Quote, Repeat2, Send, ShoppingBag, Sparkles, Users, Video, X, Zap } from 'lucide-react'
import { api } from '../../../convex/_generated/api'

const demoVideos = [
  'https://videos.pexels.com/video-files/855289/855289-hd_1920_1080_25fps.mp4',
  'https://videos.pexels.com/video-files/853800/853800-hd_1920_1080_25fps.mp4',
]

type FeedItem = { _id: string; authorUsername?: string; body: string; mediaUrl?: string; mediaType?: 'image'|'video'; likeCount: number; commentCount: number; shareCount: number; saveCount: number; viewCount: number }

export function SocialDashboard() {
  const feed = useQuery(api.social.getFeed, {})
  const stories = useQuery(api.social.listStories, {})
  const recordEvent = useMutation(api.social.recordEvent)
  const createFeedItem = useMutation(api.social.createFeedItem)
  const [tab, setTab] = useState<'for-you'|'following'|'circles'|'trending'>('for-you')
  const [composerOpen, setComposerOpen] = useState(false)
  const [body, setBody] = useState('')
  const [hideFrom, setHideFrom] = useState('')
  const [active, setActive] = useState<string | null>(null)
  const [storyOpen, setStoryOpen] = useState(false)
  const [storyIndex, setStoryIndex] = useState(0)
  const [storyGroup, setStoryGroup] = useState(0)
  const [notice, setNotice] = useState('')
  const observed = useRef(new Set<string>())

  const items = useMemo(() => (feed ?? []) as FeedItem[], [feed])
  useEffect(() => {
    const first = items[0]
    if (first && !observed.current.has(first._id)) {
      observed.current.add(first._id)
      void recordEvent({ itemId: first._id as never, event: 'impression' })
    }
  }, [items, recordEvent])

  async function interact(item: FeedItem, event: 'view'|'like'|'comment'|'share'|'save'|'not_interested') {
    setActive(`${event}-${item._id}`)
    await recordEvent({ itemId: item._id as never, event })
    if (event !== 'view') setNotice(event === 'save' ? 'Saved to your edit.' : event === 'share' ? 'Quote-repost composer ready.' : `${event[0].toUpperCase() + event.slice(1)} recorded.`)
    setTimeout(() => setActive(null), 1000)
  }

  async function publish() {
    if (!body.trim()) return
    const excludedUsernames = hideFrom.split(',').map(x => x.trim().replace(/^@/, '')).filter(Boolean)
    const result = await createFeedItem({ body: body.trim(), visibility: 'public', excludedUsernames })
    if (result.ok) {
      setBody('')
      setHideFrom('')
      setComposerOpen(false)
      setNotice('Published to the Evara-lux community.')
    } else setNotice(result.message)
  }

  const story = stories?.[storyGroup]?.stories?.[storyIndex]
  const currentDemo = items[0]?.mediaUrl || demoVideos[storyGroup % demoVideos.length]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-[1440px] px-5 pb-5 pt-8 md:px-10">
          <div className="flex items-end justify-between gap-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-accent">EVARA·LUX / SOCIAL</p>
              <h1 className="mt-2 font-display text-4xl tracking-[-0.04em] md:text-6xl">The Social Edit.</h1>
            </div>
            <button onClick={() => setComposerOpen(true)} className="hidden items-center gap-2 bg-foreground px-5 py-3 text-[10px] uppercase tracking-[0.16em] text-background sm:flex"><Video className="h-4 w-4" /> Create</button>
          </div>
          <div className="mt-7 flex gap-1 overflow-x-auto border-b border-border">
            {([['for-you','For You'],['following','Following'],['circles','Circles'],['trending','Trending Topics']] as const).map(([id,label]) => (
              <button key={id} onClick={() => setTab(id)} className={`shrink-0 border-b-2 px-4 py-3 text-[10px] uppercase tracking-[0.16em] ${tab===id?'border-accent text-foreground':'border-transparent text-muted-foreground'}`}>{label}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 py-5 md:px-10">
        <div className="flex gap-4 overflow-x-auto pb-2">
          <button onClick={() => setComposerOpen(true)} className="flex w-20 shrink-0 flex-col items-center gap-2">
            <span className="grid h-16 w-16 place-items-center rounded-full border border-dashed border-accent text-accent"><Camera className="h-5 w-5" /></span>
            <span className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground">Your story</span>
          </button>
          {(stories ?? []).slice(0,8).map((g:any, i:number) => (
            <button key={String(g.authorId)} onClick={() => {setStoryGroup(i);setStoryIndex(0);setStoryOpen(true)}} className="flex w-20 shrink-0 flex-col items-center gap-2">
              <span className="rounded-full bg-gradient-to-tr from-accent via-foreground to-accent p-[2px]"><span className="block rounded-full border-2 border-background bg-card p-[2px]"><span className="grid h-12 w-12 place-items-center rounded-full bg-muted font-display text-lg">{(g.username ?? 'M')[0].toUpperCase()}</span></span></span>
              <span className="max-w-20 truncate text-[9px] uppercase tracking-[0.1em]">{g.username ?? 'member'}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-[1440px] gap-5 px-5 pb-24 md:grid-cols-[minmax(0,820px)_300px] md:justify-center md:px-10">
        <main className="space-y-5">
          {tab === 'trending' && <div className="border border-border bg-card p-5"><p className="text-[10px] uppercase tracking-[0.2em] text-accent">Live pulse</p><div className="mt-4 grid gap-2 sm:grid-cols-2"><span>#EVARALUX — cultural momentum</span><span>#NewSeason — creator edits</span><span>#TechObjects — product discovery</span><span>#NightRoutine — beauty & lifestyle</span></div></div>}
          {tab === 'circles' && <div className="grid gap-3 sm:grid-cols-3">{['The Style Room','Tech Objects','Beauty Rituals'].map((x,i)=><button key={x} className="border border-border bg-card p-5 text-left hover:border-accent"><Users className="h-5 w-5 text-accent"/><p className="mt-8 font-display text-xl">{x}</p><p className="mt-2 text-xs text-muted-foreground">{120+i*84} members · private</p></button>)}</div>}
          {tab === 'following' && <div className="border border-border bg-card p-5 text-sm text-muted-foreground">Following stream prioritizes creators you connect with. Your live ranked feed remains below while the social graph grows.</div>}

          {(items.length ? items : [{_id:'demo',authorUsername:'evara.editorial',body:'A new season of objects, silhouettes and ideas. Discover the pieces moving through the community.',likeCount:1240,commentCount:86,shareCount:42,saveCount:310,viewCount:8900,mediaUrl:currentDemo,mediaType:'video'}]).slice(0,8).map((item,i) => (
            <article key={item._id} className="overflow-hidden border border-border bg-card">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-muted font-display">{(item.authorUsername ?? 'E')[0].toUpperCase()}</span><div><p className="text-sm">{item.authorUsername ?? 'evara.member'}</p><p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Creator edit · {i+1}h</p></div></div>
                <button aria-label="More"><MoreHorizontal className="h-5 w-5 text-muted-foreground"/></button>
              </div>

              <div className="relative aspect-[4/5] overflow-hidden bg-black">
                {item.mediaUrl || i===0 ? (
                  item.mediaType === 'image' ? <img src={item.mediaUrl!} alt="" className="h-full w-full object-cover"/> :
                  <video src={item.mediaUrl || currentDemo} autoPlay muted loop playsInline onPlay={() => item._id !== 'demo' && void interact(item,'view')} className="h-full w-full object-cover"/>
                ) : <div className="grid h-full place-items-center text-muted-foreground"><CirclePlay className="h-12 w-12"/></div>}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/10"/>
                <div className="absolute left-5 top-5 flex gap-2"><span className="rounded-full bg-black/50 px-3 py-1 text-[9px] uppercase tracking-[0.14em] text-white backdrop-blur">For You</span><span className="rounded-full border border-white/30 bg-black/30 px-3 py-1 text-[9px] uppercase tracking-[0.14em] text-white backdrop-blur">Live pulse</span></div>
                <div className="absolute bottom-5 left-5 max-w-[72%] text-white"><p className="text-sm leading-6">{item.body}</p><button onClick={() => setNotice('Shoppable product tag selected.')} className="mt-4 inline-flex items-center gap-2 border border-white/40 bg-black/35 px-3 py-2 text-[9px] uppercase tracking-[0.14em] backdrop-blur"><ShoppingBag className="h-3.5 w-3.5"/> Shop tagged object · $—</button></div>
                <div className="absolute bottom-5 right-4 flex flex-col items-center gap-5 text-white">
                  {([['like',Heart,item.likeCount],['comment',MessageCircle,item.commentCount],['share',Quote,item.shareCount],['save',Bookmark,item.saveCount]] as const).map(([event,Icon,count])=><button key={event} onClick={()=>item._id!=='demo'&&void interact(item,event)} className="flex flex-col items-center gap-1"><span className={`grid h-11 w-11 place-items-center rounded-full bg-black/35 backdrop-blur transition ${active===event+'-'+item._id?'scale-110 text-accent':''}`}><Icon className="h-5 w-5" strokeWidth={1.4}/></span><span className="text-[9px]">{count>999?(count/1000).toFixed(1)+'k':count}</span></button>)}
                  <button onClick={()=>setNotice('Remix workspace opened.')} className="flex flex-col items-center gap-1"><span className="grid h-11 w-11 place-items-center rounded-full bg-accent text-background"><Repeat2 className="h-5 w-5"/></span><span className="text-[9px]">Remix</span></button>
                </div>
              </div>

              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Zap className="h-3.5 w-3.5 text-accent"/> Trending</span><span>{item.viewCount.toLocaleString()} views</span></div>
                <button onClick={()=>setNotice('Quote-repost composer opened.')} className="flex items-center gap-2 text-[10px] uppercase tracking-[0.13em]"><Repeat2 className="h-4 w-4"/> Quote-repost</button>
              </div>
            </article>
          ))}
        </main>

        <aside className="hidden space-y-3 md:block">
          <div className="sticky top-24 space-y-3">
            <div className="border border-border bg-card p-6">
              <p className="text-[10px] uppercase tracking-[0.2em] text-accent">Trending pulse</p>
              {['#EVARALUX','#NewSeason','#TechObjects','#NightRoutine'].map((x,i)=><div key={x} className="flex items-center justify-between border-b border-border py-4 last:border-0"><div><p className="text-sm">{x}</p><p className="mt-1 text-[10px] text-muted-foreground">{(i+2)*12}K posts</p></div><Clock3 className="h-4 w-4 text-muted-foreground"/></div>)}
            </div>
            <div className="border border-border bg-card p-6"><p className="text-[10px] uppercase tracking-[0.2em] text-accent">Circles</p><p className="mt-3 font-display text-2xl">Find your room.</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Join focused conversations without turning the main feed into a crowded forum.</p><button onClick={()=>setTab('circles')} className="mt-5 text-[10px] uppercase tracking-[0.15em]">Explore circles →</button></div>
          </div>
        </aside>
      </section>

      {notice && <button onClick={()=>setNotice('')} className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 border border-border bg-card px-5 py-3 text-xs shadow-2xl">{notice} <span className="ml-3 text-muted-foreground">×</span></button>}

      {composerOpen && <div className="fixed inset-0 z-[80] grid place-items-center bg-background/80 p-5 backdrop-blur-md"><div className="w-full max-w-xl border border-border bg-card p-7"><div className="flex justify-between"><div><p className="text-[10px] uppercase tracking-[0.2em] text-accent">Create</p><h2 className="mt-2 font-display text-3xl">Publish to the edit.</h2></div><button onClick={()=>setComposerOpen(false)}><X/></button></div><textarea value={body} onChange={e=>setBody(e.target.value)} maxLength={5000} placeholder="What are you discovering?" className="mt-7 min-h-40 w-full resize-none border border-border bg-background p-4 text-sm outline-none focus:border-accent"/>
          <div className="mt-4 border border-border bg-background p-4">
            <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.16em] text-accent">Hide From…</p><p className="mt-1 text-[11px] text-muted-foreground">Block specific @usernames from this post only.</p></div><span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Optional</span></div>
            <input value={hideFrom} onChange={e=>setHideFrom(e.target.value)} placeholder="@account, @another_account" className="mt-3 w-full border border-border bg-card px-3 py-2 text-xs outline-none focus:border-accent"/>
          </div><div className="mt-4 flex justify-between text-xs text-muted-foreground"><span>{body.length}/5000</span><button onClick={()=>void publish()} className="inline-flex items-center gap-2 bg-foreground px-5 py-3 text-[10px] uppercase tracking-[0.15em] text-background"><Send className="h-4 w-4"/> Publish</button></div></div></div>}

      {storyOpen && story && <div className="fixed inset-0 z-[90] grid place-items-center bg-black p-4"><div className="relative h-[88vh] w-full max-w-md overflow-hidden bg-card"><button onClick={()=>setStoryOpen(false)} className="absolute right-4 top-4 z-10 text-white"><X/></button>{story.mediaType==='image'?<img src={story.mediaUrl} alt="" className="h-full w-full object-cover"/>:<video src={story.mediaUrl} autoPlay playsInline controls className="h-full w-full object-cover"/>}<div className="absolute inset-x-5 bottom-5 text-white"><p className="text-sm">{story.caption}</p><p className="mt-2 text-[9px] uppercase tracking-[0.15em] opacity-70">Expires in 24 hours</p></div></div></div>}
    </div>
  )
}
