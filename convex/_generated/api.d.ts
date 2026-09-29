/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ResendOTP from "../ResendOTP.js";
import type * as account from "../account.js";
import type * as activity from "../activity.js";
import type * as aiChat from "../aiChat.js";
import type * as arcana from "../arcana.js";
import type * as auth from "../auth.js";
import type * as authz from "../authz.js";
import type * as brands from "../brands.js";
import type * as cart from "../cart.js";
import type * as cartRecovery from "../cartRecovery.js";
import type * as categories from "../categories.js";
import type * as cj from "../cj.js";
import type * as coins from "../coins.js";
import type * as coinsNative from "../coinsNative.js";
import type * as comments from "../comments.js";
import type * as coupons from "../coupons.js";
import type * as creator from "../creator.js";
import type * as crons from "../crons.js";
import type * as customer from "../customer.js";
import type * as dashboard from "../dashboard.js";
import type * as earlyAccess from "../earlyAccess.js";
import type * as fulfillment from "../fulfillment.js";
import type * as gilded from "../gilded.js";
import type * as http from "../http.js";
import type * as macaly from "../macaly.js";
import type * as media from "../media.js";
import type * as membership from "../membership.js";
import type * as membershipLib from "../membershipLib.js";
import type * as moderation from "../moderation.js";
import type * as notifications from "../notifications.js";
import type * as orders from "../orders.js";
import type * as passkey from "../passkey.js";
import type * as paystack from "../paystack.js";
import type * as phone from "../phone.js";
import type * as posts from "../posts.js";
import type * as privacy from "../privacy.js";
import type * as products from "../products.js";
import type * as recommendations from "../recommendations.js";
import type * as recovery from "../recovery.js";
import type * as reviews from "../reviews.js";
import type * as security from "../security.js";
import type * as sentinel from "../sentinel.js";
import type * as social from "../social.js";
import type * as supabase from "../supabase.js";
import type * as support from "../support.js";
import type * as tiers from "../tiers.js";
import type * as totp from "../totp.js";
import type * as trace from "../trace.js";
import type * as universe from "../universe.js";
import type * as wallet from "../wallet.js";
import type * as walletNative from "../walletNative.js";
import type * as wishlist from "../wishlist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ResendOTP: typeof ResendOTP;
  account: typeof account;
  activity: typeof activity;
  aiChat: typeof aiChat;
  arcana: typeof arcana;
  auth: typeof auth;
  authz: typeof authz;
  brands: typeof brands;
  cart: typeof cart;
  cartRecovery: typeof cartRecovery;
  categories: typeof categories;
  cj: typeof cj;
  coins: typeof coins;
  coinsNative: typeof coinsNative;
  comments: typeof comments;
  coupons: typeof coupons;
  creator: typeof creator;
  crons: typeof crons;
  customer: typeof customer;
  dashboard: typeof dashboard;
  earlyAccess: typeof earlyAccess;
  fulfillment: typeof fulfillment;
  gilded: typeof gilded;
  http: typeof http;
  macaly: typeof macaly;
  media: typeof media;
  membership: typeof membership;
  membershipLib: typeof membershipLib;
  moderation: typeof moderation;
  notifications: typeof notifications;
  orders: typeof orders;
  passkey: typeof passkey;
  paystack: typeof paystack;
  phone: typeof phone;
  posts: typeof posts;
  privacy: typeof privacy;
  products: typeof products;
  recommendations: typeof recommendations;
  recovery: typeof recovery;
  reviews: typeof reviews;
  security: typeof security;
  sentinel: typeof sentinel;
  social: typeof social;
  supabase: typeof supabase;
  support: typeof support;
  tiers: typeof tiers;
  totp: typeof totp;
  trace: typeof trace;
  universe: typeof universe;
  wallet: typeof wallet;
  walletNative: typeof walletNative;
  wishlist: typeof wishlist;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
