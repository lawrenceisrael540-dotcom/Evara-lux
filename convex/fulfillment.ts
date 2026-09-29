import { getAuthUserId } from "@convex-dev/auth/server"
import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { internal } from "./_generated/api"

async function isAdmin(ctx: any, userId: any) {
  const p = await ctx.db.query("userProfiles").withIndex("by_user", q => q.eq("userId", userId)).unique()
  return p?.role === "admin"
}
export const listMyShipments = query({
  args: {}, returns: v.array(v.any()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx); if (!userId) return []
    const orders = await ctx.db.query("orders").withIndex("by_user", q => q.eq("userId", userId)).take(50)
    const ids = new Set(orders.map(o => String(o._id)))
    return (await ctx.db.query("fulfillmentShipments").take(100)).filter(s => ids.has(String(s.orderId))).sort((a,b) => (b.shippedAt ?? b._creationTime) - (a.shippedAt ?? a._creationTime))
  },
})
export const getShipment = query({
  args: { shipmentId: v.id("fulfillmentShipments") }, returns: v.union(v.object({ _id:v.id("fulfillmentShipments"), _creationTime:v.number(), orderId:v.id("orders"), provider:v.string(), externalId:v.optional(v.string()), status:v.union(v.literal("pending"),v.literal("processing"),v.literal("shipped"),v.literal("in_transit"),v.literal("delivered"),v.literal("exception"),v.literal("cancelled")), carrier:v.optional(v.string()), trackingNumber:v.optional(v.string()), trackingUrl:v.optional(v.string()), shippedAt:v.optional(v.number()), deliveredAt:v.optional(v.number()), metadata:v.optional(v.any()), events:v.array(v.object({_id:v.id("fulfillmentEvents"),_creationTime:v.number(),shipmentId:v.id("fulfillmentShipments"),status:v.string(),message:v.optional(v.string()),location:v.optional(v.string()),occurredAt:v.number()})) }), v.null()),
  handler: async (ctx, { shipmentId }) => {
    const userId = await getAuthUserId(ctx); if (!userId) return null
    const shipment = await ctx.db.get(shipmentId); if (!shipment) return null
    const order = await ctx.db.get(shipment.orderId); if (!order || order.userId !== userId) return null
    const events = await ctx.db.query("fulfillmentEvents").withIndex("by_shipment_time", q => q.eq("shipmentId", shipmentId)).order("desc").take(50)
    return { ...shipment, events }
  },
})
export const createShipment = mutation({
  args: { orderId: v.id("orders"), provider: v.string(), externalId: v.optional(v.string()), carrier: v.optional(v.string()), trackingNumber: v.optional(v.string()), trackingUrl: v.optional(v.string()) },
  returns: v.union(v.id("fulfillmentShipments"), v.null()),
  handler: async (ctx,args) => {
    const userId = await getAuthUserId(ctx); if (!userId || !(await isAdmin(ctx,userId))) return null
    const order = await ctx.db.get(args.orderId); if (!order) return null
    const id = await ctx.db.insert("fulfillmentShipments",{...args,status:"pending"})
    if (order.status === "paid") {
      await ctx.db.patch(order._id,{fulfillmentStatus:"fulfilled",status:"processing"})
      await ctx.db.insert("orderStatusHistory",{orderId:order._id,fromStatus:"paid",toStatus:"processing",reason:"Fulfillment created"})
    }
    await ctx.scheduler.runAfter(0,internal.notifications.createInternal,{userId:order.userId,kind:"order",title:"Your order is moving",body:"Fulfillment has been created for "+order.orderNumber+".",actionUrl:"/account",priority:"normal"})
    return id
  },
})
export const updateShipment = mutation({
  args: { shipmentId:v.id("fulfillmentShipments"), status:v.union(v.literal("pending"),v.literal("processing"),v.literal("shipped"),v.literal("in_transit"),v.literal("delivered"),v.literal("exception"),v.literal("cancelled")), message:v.optional(v.string()), location:v.optional(v.string()), trackingNumber:v.optional(v.string()), trackingUrl:v.optional(v.string()) },
  returns:v.boolean(),
  handler:async(ctx,args)=>{
    const userId=await getAuthUserId(ctx); if(!userId || !(await isAdmin(ctx,userId))) return false
    const shipment=await ctx.db.get(args.shipmentId); if(!shipment) return false
    const now=Date.now(); const patch:any={status:args.status}
    if(args.trackingNumber!==undefined) patch.trackingNumber=args.trackingNumber
    if(args.trackingUrl!==undefined) patch.trackingUrl=args.trackingUrl
    if(args.status==="shipped"||args.status==="in_transit") patch.shippedAt=shipment.shippedAt??now
    if(args.status==="delivered") patch.deliveredAt=now
    await ctx.db.patch(shipment._id,patch)
    await ctx.db.insert("fulfillmentEvents",{shipmentId:shipment._id,status:args.status,message:args.message,location:args.location,occurredAt:now})
    const order=await ctx.db.get(shipment.orderId)
    if(order){
      const next=args.status==="delivered"?"delivered":(args.status==="shipped"||args.status==="in_transit")?"shipped":order.status
      if(next!==order.status){await ctx.db.patch(order._id,{status:next,fulfillmentStatus:args.status==="delivered"?"delivered":"shipped"});await ctx.db.insert("orderStatusHistory",{orderId:order._id,fromStatus:order.status,toStatus:next,reason:"Fulfillment status updated"})}
      await ctx.scheduler.runAfter(0,internal.notifications.createInternal,{userId:order.userId,kind:"order",title:args.status==="delivered"?"Delivered":"Shipment update",body:args.message??("Order "+order.orderNumber+": "+args.status.replace("_"," ")+"."),actionUrl:"/account",priority:args.status==="exception"?"high":"normal"})
    }
    return true
  },
})