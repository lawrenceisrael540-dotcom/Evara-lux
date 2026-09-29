import { useEffect, useMemo, useState } from 'react'
import { useAction, useMutation, useQuery } from 'convex/react'
import { Activity, Bot, BrainCircuit, Check, ChevronRight, Code2, Coins, Cpu, Gauge, Image as ImageIcon, LayoutTemplate, Loader2, Play, Send, Settings2, Sparkles, Terminal, TrendingUp, Video, Workflow, X, Zap } from 'lucide-react'
import { api } from '../../../convex/_generated/api'

const shortcuts = ['Optimize Store SEO','Generate TikTok Video Hook','Analyze Sales Funnel','Auto-Remix Viral Post']
const tools = [
  {title:'AI Video Generator',icon:Video,copy:'Turn a product concept into a short-form creative brief.',accent:'Studio'},
  {title:'Copywriting Studio',icon:LayoutTemplate,copy:'Generate product, social and campaign copy in the EVARA voice.',accent:'Creative'},
  {title:'Pricing Predictor',icon:TrendingUp,copy:'Model pricing scenarios before changing a live catalog price.',accent:'Commerce'},
  {title:'Agent Workflow Builder',icon:Workflow,copy:'Design approval-based workflows across your connected stack.',accent:'Automation'},
]

export function AIDashboard(){
  const createThread=useMutation(api.aiChat.createThread)
  const sendMessage=useAction(api.aiChat.sendMessage)
  const threads=useQuery(api.aiChat.listThreads,{})
  const [threadId,setThreadId]=useState<any>(null)
  const [input,setInput]=useState('')
  const [messages,setMessages]=useState<{role:'user'|'assistant',content:string}[]>([])
  const [running,setRunning]=useState(false)
  const [approval,setApproval]=useState(true)
  const [activeTool,setActiveTool]=useState<string|null>(null)
  const [notice,setNotice]=useState('')

  const latestThread=useMemo(()=>threads?.[0],[threads])
  useEffect(()=>{ if(!threadId && latestThread) setThreadId(latestThread._id) },[latestThread,threadId])
  const stored=useQuery(api.aiChat.listMessages,threadId?{threadId}:{threadId:undefined as never})
  useEffect(()=>{if(stored) setMessages(stored.filter((m:any)=>m.role==='user'||m.role==='assistant').map((m:any)=>({role:m.role,content:m.content})))} , [stored])

  async function ensureThread(){
    if(threadId) return threadId
    const id=await createThread({mode:'general',title:'EVARA Intelligence'})
    setThreadId(id)
    return id
  }
  async function ask(text=input){
    const prompt=text.trim();if(!prompt||running)return
    setInput('');setRunning(true);setActiveTool('EVARA Intelligence')
    setMessages(m=>[...m,{role:'user',content:prompt}])
    try{
      const id=await ensureThread()
      const result=await sendMessage({threadId:id,message:prompt})
      setMessages(m=>[...m,{role:'assistant',content:result.ok?(result.answer??'No answer returned.'):result.message??'The intelligence service could not complete that request.'}])
    }catch(e){setMessages(m=>[...m,{role:'assistant',content:e instanceof Error?e.message:'The intelligence service is unavailable.'}])}
    finally{setRunning(false);setActiveTool(null)}
  }

  return <section className="min-h-screen bg-background text-foreground">
    <div className="mx-auto max-w-[1440px] px-5 py-10 md:px-10">
      <div className="flex flex-col justify-between gap-6 border-b border-border pb-8 md:flex-row md:items-end">
        <div><p className="text-[10px] uppercase tracking-[0.24em] text-accent">EVARA·LUX / INTELLIGENCE</p><h1 className="mt-2 font-display text-4xl tracking-[-0.04em] md:text-6xl">The Intelligence Floor.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">A command center for creative generation, commerce analysis and approval-based automation.</p></div>
        <div className="flex items-center gap-2 border border-border px-4 py-3 text-[10px] uppercase tracking-[0.14em]"><span className="h-2 w-2 rounded-full bg-accent"/>{running?'Agent running':'Systems ready'}</div>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_360px]">
        <div className="border border-border bg-card p-5 md:p-7">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center border border-accent text-accent"><BrainCircuit className="h-5 w-5"/></span><div><p className="text-sm">Evara-lux Intelligence</p><p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Multi-modal command interface</p></div></div>
          <div className="mt-6 min-h-[280px] space-y-4 border-y border-border py-5">
            {messages.length===0?<div className="grid min-h-[240px] place-items-center text-center"><div><Sparkles className="mx-auto h-8 w-8 text-accent"/><p className="mt-4 font-display text-2xl">What should EVARA work on?</p><p className="mt-2 max-w-md text-sm text-muted-foreground">Ask about your store, social content, creative direction, customer experience or an automation workflow.</p></div></div>:messages.slice(-8).map((m,i)=><div key={i} className={m.role==='user'?'ml-auto max-w-[82%] bg-foreground p-4 text-sm text-background':'max-w-[88%] border border-border bg-background p-4 text-sm leading-6'}>{m.content}</div>)}
            {running&&<div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-accent"/> Reasoning through the request…</div>}
          </div>
          <div className="mt-5 flex gap-2 overflow-x-auto pb-2">{shortcuts.map(x=><button key={x} onClick={()=>void ask(x)} className="shrink-0 border border-border px-3 py-2 text-[9px] uppercase tracking-[0.12em] hover:border-accent">{x}</button>)}</div>
          <form onSubmit={e=>{e.preventDefault();void ask(input)}} className="mt-3 flex gap-2"><input value={input} onChange={e=>setInput(e.target.value)} placeholder="Command Evara-lux Intelligence…" className="min-w-0 flex-1 border border-border bg-background px-4 py-4 text-sm outline-none focus:border-accent"/><button disabled={running} className="grid w-14 place-items-center bg-foreground text-background disabled:opacity-50"><SendIcon/></button></form>
        </div>

        <aside className="space-y-5">
          <div className="border border-border bg-card p-6"><div className="flex items-center justify-between"><p className="text-[10px] uppercase tracking-[0.2em] text-accent">Compute monitor</p><Gauge className="h-4 w-4 text-muted-foreground"/></div><p className="mt-5 font-display text-4xl">—</p><p className="mt-1 text-xs text-muted-foreground">Usage telemetry will appear when provider metering is exposed.</p><div className="mt-5 h-1.5 bg-muted"><div className="h-full w-[34%] bg-accent"/></div><div className="mt-2 flex justify-between text-[9px] uppercase tracking-[0.12em] text-muted-foreground"><span>Session</span><span>Meter pending</span></div></div>
          <div className="border border-border bg-card p-6"><p className="text-[10px] uppercase tracking-[0.2em] text-accent">Autonomy guardrail</p><div className="mt-5 flex items-center justify-between"><div><p className="text-sm">Creator approval</p><p className="mt-1 text-xs text-muted-foreground">Required before external actions.</p></div><button onClick={()=>setApproval(!approval)} className={`relative h-6 w-11 rounded-full ${approval?'bg-accent':'bg-muted'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-background transition ${approval?'left-6':'left-1'}`}/></button></div></div>
          <div className="border border-border bg-card p-6"><p className="text-[10px] uppercase tracking-[0.2em] text-accent">Agent status</p><div className="mt-4 space-y-3">{['Intelligence Core','Commerce Analyst','Creative Studio','Automation Guard'].map((x,i)=><div key={x} className="flex items-center justify-between border-b border-border pb-3 last:border-0"><span className="flex items-center gap-2 text-xs"><span className={`h-1.5 w-1.5 rounded-full ${activeTool===x?'bg-accent':'bg-muted-foreground'}`}/>{x}</span><span className="text-[9px] uppercase text-muted-foreground">{activeTool===x?'running':'ready'}</span></div>)}</div></div>
        </aside>
      </div>

      <div className="mt-8"><div className="mb-4 flex items-end justify-between"><div><p className="text-[10px] uppercase tracking-[0.2em] text-accent">Generative studio</p><h2 className="mt-2 font-display text-3xl">Build from one brief.</h2></div><Settings2 className="h-5 w-5 text-muted-foreground"/></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{tools.map(({title,icon:Icon,copy,accent})=><button key={title} onClick={()=>{setNotice(`${title} workspace queued for the next connected agent action.`);setInput(`Open the ${title} workflow`)}} className="group min-h-56 border border-border bg-card p-6 text-left hover:border-accent"><div className="flex justify-between"><span className="grid h-10 w-10 place-items-center border border-border group-hover:border-accent"><Icon className="h-5 w-5 text-accent"/></span><span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">{accent}</span></div><h3 className="mt-12 font-display text-2xl">{title}</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">{copy}</p><span className="mt-5 inline-flex items-center gap-2 text-[9px] uppercase tracking-[0.14em]">Open module <ChevronRight className="h-3 w-3"/></span></button>)}</div></div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <div className="border border-border bg-black p-6 text-white"><div className="flex items-center justify-between border-b border-white/15 pb-4"><p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em]"><Terminal className="h-4 w-4 text-accent"/> Agent execution terminal</p><span className="text-[9px] uppercase text-white/50">Live session</span></div><div className="min-h-48 space-y-3 py-5 font-mono text-xs text-white/70"><p><span className="text-accent">09:08:15</span> intelligence.core initialized</p><p><span className="text-accent">09:08:16</span> commerce context synchronized</p><p><span className="text-accent">09:08:17</span> social signals available</p>{activeTool?<p><span className="text-accent">NOW</span> agent task: {activeTool.toLowerCase()}</p>:<p><span className="text-white/40">IDLE</span> awaiting creator command</p>}</div></div>
        <div className="border border-border bg-card p-6"><div className="flex items-center justify-between"><p className="text-[10px] uppercase tracking-[0.2em] text-accent">Workflow queue</p><Activity className="h-4 w-4"/></div><div className="mt-5 space-y-3">{['SEO optimization','Creator hook generation','Funnel analysis','Social remix'].map((x,i)=><div key={x} className="flex items-center justify-between border border-border p-4"><span className="text-xs">{x}</span><span className="text-[9px] uppercase text-muted-foreground">{i===0?'ready':approval?'approval':'queued'}</span></div>)}</div></div>
      </div>
    </div>
    {notice&&<button onClick={()=>setNotice('')} className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 border border-border bg-card px-5 py-3 text-xs shadow-2xl">{notice} ×</button>}
  </section>
}

function SendIcon(){return <SendIconInner/>}
function SendIconInner(){return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>}
