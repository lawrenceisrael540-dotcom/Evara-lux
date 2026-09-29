import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"
import { authTables } from "@convex-dev/auth/server"

export default defineSchema({
  ...authTables,

  // Extends the auth-provided users table with app-level profile/role fields.
  // Convex's own `_id` on this table is the account's unique, permanent
  // identity. `username` is the changeable, human-readable handle shown
  // anywhere the account needs to be recognizable (comments, posts, later
  // social features) — auto-assigned on first profile creation, editable
  // via authz.setUsername, always unique via usernameLower.
  userProfiles: defineTable({
    userId: v.id("users"),
    role: v.union(v.literal("customer"), v.literal("admin")),
    publicId: v.optional(v.string()),
    level: v.optional(v.number()),
    tier: v.optional(v.string()),
    verificationStatus: v.optional(v.union(v.literal("pending"), v.literal("verified"), v.literal("restricted"))),
    emailVerified: v.optional(v.boolean()),
    twoFactorEnabled: v.optional(v.boolean()),
    displayName: v.optional(v.string()),
    username: v.optional(v.string()),
    usernameLower: v.optional(v.string()),
    phone: v.optional(v.string()),
    country: v.optional(v.string()),
    // Account-only demographics (never returned by any public query — see
    // getPublicProfileByUsername/searchProfiles, which stay handle+name
    // only). Buckets, not a raw birthdate/age, by design: enough for
    // personalization without storing anything more sensitive than needed.
    ageRange: v.optional(
      v.union(
        v.literal("13-17"),
        v.literal("18-24"),
        v.literal("25-34"),
        v.literal("35-44"),
        v.literal("45-54"),
        v.literal("55-64"),
        v.literal("65+"),
      ),
    ),
    gender: v.optional(
      v.union(
        v.literal("woman"),
        v.literal("man"),
        v.literal("nonbinary"),
        v.literal("prefer_not_to_say"),
      ),
    ),
  })
    .index("by_user", ["userId"])
    .index("by_username_lower", ["usernameLower"])
    .index("by_public_id", ["publicId"]),

  brandPartners: defineTable({
    name: v.string(),
    slug: v.string(),
    website: v.optional(v.string()),
    category: v.string(),
    status: v.union(v.literal("prospect"), v.literal("invited"), v.literal("applied"), v.literal("verified"), v.literal("active"), v.literal("suspended")),
    integrationMode: v.union(v.literal("affiliate"), v.literal("catalog"), v.literal("wholesale"), v.literal("reseller"), v.literal("partner_api"), v.literal("manual")),
    country: v.optional(v.string()),
    notes: v.optional(v.string()),
    operationsEmail: v.optional(v.string()),
  }).index("by_slug", ["slug"]).index("by_status", ["status"]),

  brandAuthorizations: defineTable({
    brandId: v.id("brandPartners"),
    status: v.union(v.literal("requested"), v.literal("approved"), v.literal("expired"), v.literal("revoked")),
    permissions: v.any(),
    territory: v.optional(v.string()),
    startsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
    packagingMode: v.union(v.literal("brand_original"), v.literal("evara_outer"), v.literal("co_branded")),
    evidenceUrl: v.optional(v.string()),
  }).index("by_brand_status", ["brandId", "status"]),

  categories: defineTable({
    slug: v.string(),
    name: v.string(),
    parentId: v.optional(v.id("categories")),
    description: v.optional(v.string()),
    themeConfig: v.optional(v.any()),
    status: v.union(v.literal("active"), v.literal("hidden"), v.literal("archived")),
    sortOrder: v.number(),
    // Expanded: lets each category present differently (the "dynamic category
    // experience") and links to CJ's own category taxonomy for filtered import.
    cjCategoryId: v.optional(v.string()),
    heroImage: v.optional(v.string()),
    layoutVariant: v.optional(
      v.union(
        v.literal("editorial"),  // fashion — collection storytelling
        v.literal("routine"),    // beauty — routines/ingredients
        v.literal("specs"),      // electronics — comparison/specs
        v.literal("context"),    // home — room/lifestyle presentation
        v.literal("pairing"),    // accessories — styling/complementary
        v.literal("standard"),
      ),
    ),
    merchandising: v.optional(v.any()), // promo blocks/content modules, free-form
    featuredProductIds: v.optional(v.array(v.id("products"))),
  })
    .index("by_slug", ["slug"])
    .index("by_status_sort", ["status", "sortOrder"])
    .index("by_cj_category", ["cjCategoryId"]),

  products: defineTable({
    slug: v.string(),
    categoryId: v.id("categories"),
    name: v.string(),
    shortDescription: v.optional(v.string()),
    description: v.optional(v.string()),
    source: v.union(v.literal("manual"), v.literal("cj")),
    cjProductId: v.optional(v.string()),
    sku: v.optional(v.string()),
    images: v.array(v.string()),
    priceMinor: v.number(),
    compareAtPriceMinor: v.optional(v.number()),
    costMinor: v.optional(v.number()), // admin-only; never returned by public queries
    currency: v.string(),
    stockQuantity: v.number(),
    inventoryStatus: v.union(
      v.literal("in_stock"),
      v.literal("low_stock"),
      v.literal("out_of_stock"),
      v.literal("discontinued"),
    ),
    attributes: v.optional(v.any()),
    specifications: v.optional(v.any()),
    rating: v.optional(v.number()),
    reviewCount: v.number(),
    featured: v.boolean(),
    status: v.union(v.literal("draft"), v.literal("active"), v.literal("archived")),
    // CJ sync bookkeeping — lets a scheduled sync know what changed upstream
    // without re-importing everything every time.
    cjLastSyncedAt: v.optional(v.number()),
    cjSourceCategoryId: v.optional(v.string()),
    // The markup applied on import/resync: priceMinor = cjSupplierPriceMinor *
    // (1 + cjMarkupPercent/100). Kept per-product (not global) so a resync
    // can refresh CJ's supplier price while preserving the margin decision
    // that was actually made for that item. Unset for non-CJ products.
    cjMarkupPercent: v.optional(v.number()),
    cjSupplierPriceMinor: v.optional(v.number()),
    brandPartnerId: v.optional(v.id("brandPartners")),
    brandAuthorizationId: v.optional(v.id("brandAuthorizations")),
    packagingMode: v.optional(v.union(v.literal("brand_original"), v.literal("evara_outer"), v.literal("co_branded"))),
  })
    .index("by_slug", ["slug"])
    .index("by_category_status", ["categoryId", "status"])
    .index("by_status_featured", ["status", "featured"])
    .index("by_cj_product", ["cjProductId"])
    // Powers the navbar's product search (see products.search). Filtering on
    // status inside the index means a search for "active" products never
    // touches draft/archived rows in the first place.
    .searchIndex("search_name", { searchField: "name", filterFields: ["status"] }),

  productVariants: defineTable({
    productId: v.id("products"),
    cjVariantId: v.optional(v.string()),
    sku: v.optional(v.string()),
    optionName: v.string(),
    optionValue: v.string(),
    priceMinor: v.optional(v.number()),
    stockQuantity: v.number(),
  }).index("by_product", ["productId"]),

  // --- CJ Dropshipping integration ------------------------------------------
  // A single cached token row (CJ's own auth model has no concept of "one per
  // user" — one CJ account, one store-wide credential). accessToken lives
  // here, never in an env var, because it rotates; the CJ *account* email +
  // apiKey used to mint it stay in Convex env vars (CJ_EMAIL / CJ_API_KEY),
  // never written to the database. lastAuthAttemptAt exists solely to
  // self-enforce CJ's "1 call per 5 minutes" limit on getAccessToken.
  cjTokens: defineTable({
    accessToken: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()),
    refreshToken: v.optional(v.string()),
    refreshTokenExpiresAt: v.optional(v.number()),
    lastAuthAttemptAt: v.optional(v.number()),
  }),

  cjImportLog: defineTable({
    adminUserId: v.id("users"),
    cjProductId: v.string(),
    productId: v.optional(v.id("products")),
    action: v.union(v.literal("import"), v.literal("resync"), v.literal("failed")),
    message: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_cj_product", ["cjProductId"]).index("by_created", ["createdAt"]),

  carts: defineTable({
    userId: v.id("users"),
    status: v.union(v.literal("active"), v.literal("converted"), v.literal("abandoned")),
    currency: v.string(),
  }).index("by_user_status", ["userId", "status"]).index("by_status", ["status"]),

  cartItems: defineTable({
    cartId: v.id("carts"),
    productId: v.id("products"),
    variantId: v.optional(v.id("productVariants")),
    quantity: v.number(),
    unitPriceMinor: v.number(), // snapshot, revalidated at checkout
  }).index("by_cart", ["cartId"]),

  wishlistItems: defineTable({
    userId: v.id("users"),
    productId: v.id("products"),
  })
    .index("by_user", ["userId"])
    .index("by_user_product", ["userId", "productId"]),

  orders: defineTable({
    orderNumber: v.string(),
    userId: v.id("users"),
    status: v.union(
      v.literal("pending_payment"),
      v.literal("paid"),
      v.literal("processing"),
      v.literal("shipped"),
      v.literal("delivered"),
      v.literal("cancelled"),
      v.literal("refunded"),
      v.literal("payment_failed"),
    ),
    currency: v.string(),
    subtotalMinor: v.number(),
    discountMinor: v.number(),
    shippingMinor: v.number(),
    taxMinor: v.number(),
    totalMinor: v.number(),
    shippingAddress: v.any(),
    billingAddress: v.optional(v.any()),
    cjOrderId: v.optional(v.string()),
    fulfillmentStatus: v.union(
      v.literal("unfulfilled"),
      v.literal("fulfilled"),
      v.literal("partially_fulfilled"),
      v.literal("shipped"),
      v.literal("delivered"),
    ),
    trackingNumber: v.optional(v.string()),
    trackingCarrier: v.optional(v.string()),
    idempotencyKey: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_order_number", ["orderNumber"])
    .index("by_status", ["status"]),

  orderItems: defineTable({
    orderId: v.id("orders"),
    productId: v.id("products"),
    variantId: v.optional(v.id("productVariants")),
    productNameSnapshot: v.string(),
    skuSnapshot: v.optional(v.string()),
    unitPriceMinor: v.number(),
    quantity: v.number(),
    lineTotalMinor: v.number(),
  }).index("by_order", ["orderId"]),

  orderStatusHistory: defineTable({
    orderId: v.id("orders"),
    fromStatus: v.optional(v.string()),
    toStatus: v.string(),
    reason: v.optional(v.string()),
  }).index("by_order", ["orderId"]),

  // Every customer-visible thing that happens on their account — the "track
  // everything going on" activity log. Written by server-side code only
  // (queries/mutations insert directly; nothing lets a client fabricate an
  // entry for another user or forge one for themselves).
  accountActivity: defineTable({
    userId: v.id("users"),
    kind: v.union(
      v.literal("order_placed"),
      v.literal("order_status_changed"),
      v.literal("wishlist_added"),
      v.literal("wishlist_removed"),
      v.literal("profile_updated"),
      v.literal("sign_in"),
    ),
    summary: v.string(),
    relatedOrderId: v.optional(v.id("orders")),
    relatedProductId: v.optional(v.id("products")),
  }).index("by_user", ["userId"]),

  // --- Phase 2: posts/comments (SCAFFOLDED) ---------------------------------
  // Minimal social layer. A post always belongs to a userProfiles-backed
  // identity (the same @handle used everywhere else), never posted
  // anonymously. Moderation (reports, hiding, admin takedown) is not built
  // yet — status exists now so it can be added without a schema migration.
  posts: defineTable({
    userId: v.id("users"),
    body: v.string(),
    imageUrl: v.optional(v.string()),
    status: v.union(v.literal("visible"), v.literal("hidden")),
    commentCount: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  comments: defineTable({
    postId: v.id("posts"),
    userId: v.id("users"),
    body: v.string(),
    status: v.union(v.literal("visible"), v.literal("hidden")),
  })
    .index("by_post", ["postId"])
    .index("by_user", ["userId"]),

  wallets: defineTable({
    userId: v.id("users"),
    balanceMinor: v.int64(),
    currency: v.string(),
    status: v.union(v.literal("active"), v.literal("locked")),
  }).index("by_user", ["userId"]),

  loyaltyAccounts: defineTable({
    userId: v.id("users"),
    pointsBalance: v.number(),
    lifetimePoints: v.number(),
    tier: v.string(),
  }).index("by_user", ["userId"]),

  coinAccounts: defineTable({
    userId: v.id("users"),
    balance: v.number(),
    lifetimeCoins: v.number(),
  }).index("by_user", ["userId"]),

  userSecurity: defineTable({
    userId: v.id("users"),
    twoFactorEnabled: v.boolean(),
    twoFactorPending: v.optional(v.string()),
    twoFactorSecret: v.optional(v.string()),
    twoFactorVerifiedAt: v.optional(v.number()),
    lastTwoFactorAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  phoneVerifications: defineTable({
    userId: v.id("users"),
    phone: v.string(),
    purpose: v.union(v.literal("verification"), v.literal("two_factor"), v.literal("notification")),
    codeHash: v.string(),
    expiresAt: v.number(),
    attempts: v.number(),
    lastSentAt: v.number(),
    verifiedAt: v.optional(v.number()),
  }).index("by_user_purpose", ["userId", "purpose"]).index("by_user_phone", ["userId", "phone"]),

  verificationEvents: defineTable({
    userId: v.id("users"),
    kind: v.union(v.literal("email"), v.literal("phone"), v.literal("identity")),
    status: v.union(v.literal("pending"), v.literal("verified"), v.literal("failed")),
    method: v.string(),
    verifiedAt: v.optional(v.number()),
  }).index("by_user_kind", ["userId", "kind"]),

  traceEvents: defineTable({
    traceId: v.string(),
    userId: v.optional(v.id("users")),
    kind: v.string(),
    status: v.union(v.literal("started"), v.literal("completed"), v.literal("failed")),
    metadata: v.optional(v.any()),
  }).index("by_trace", ["traceId"]).index("by_user", ["userId"]),

  aiRuns: defineTable({
    traceId: v.string(),
    userId: v.optional(v.id("users")),
    agent: v.string(),
    task: v.string(),
    status: v.union(v.literal("queued"), v.literal("running"), v.literal("completed"), v.literal("failed")),
    inputSummary: v.optional(v.string()),
    outputSummary: v.optional(v.string()),
    model: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  }).index("by_trace", ["traceId"]).index("by_status", ["status"]),

  trends: defineTable({
    source: v.string(),
    topic: v.string(),
    score: v.number(),
    velocity: v.number(),
    region: v.optional(v.string()),
    status: v.union(v.literal("detected"), v.literal("qualified"), v.literal("archived")),
  }).index("by_status_score", ["status", "score"]),

  productOpportunities: defineTable({
    trendId: v.optional(v.id("trends")),
    productId: v.optional(v.id("products")),
    score: v.number(),
    marginScore: v.number(),
    demandScore: v.number(),
    contentScore: v.number(),
    riskScore: v.number(),
    status: v.union(v.literal("candidate"), v.literal("approved"), v.literal("rejected"), v.literal("launched")),
  }).index("by_status_score", ["status", "score"]),

  campaigns: defineTable({
    name: v.string(),
    status: v.union(v.literal("draft"), v.literal("active"), v.literal("paused"), v.literal("completed")),
    traceId: v.optional(v.string()),
    objective: v.string(),
    budgetMinor: v.optional(v.int64()),
  }).index("by_status", ["status"]),

  contentItems: defineTable({
    campaignId: v.optional(v.id("campaigns")),
    type: v.union(v.literal("script"), v.literal("image"), v.literal("video"), v.literal("copy")),
    status: v.union(v.literal("draft"), v.literal("ready"), v.literal("published"), v.literal("archived")),
    title: v.string(),
    body: v.optional(v.string()),
    platform: v.optional(v.string()),
  }).index("by_campaign", ["campaignId"]).index("by_status", ["status"]),

  socialPosts: defineTable({
    contentId: v.optional(v.id("contentItems")),
    platform: v.string(),
    status: v.union(v.literal("draft"), v.literal("scheduled"), v.literal("published"), v.literal("failed")),
    publishedAt: v.optional(v.number()),
    impressions: v.number(),
    clicks: v.number(),
    conversions: v.number(),
  }).index("by_platform_status", ["platform", "status"]),

  payments: defineTable({
    userId: v.id("users"),
    orderId: v.optional(v.id("orders")),
    kind: v.union(v.literal("order"), v.literal("nexa"), v.literal("wallet_topup")),
    provider: v.literal("paystack"),
    reference: v.string(),
    amountMinor: v.number(),
    currency: v.string(),
    status: v.union(v.literal("initialized"), v.literal("pending"), v.literal("success"), v.literal("failed"), v.literal("refunded")),
    metadata: v.optional(v.any()),
    authorizationUrl: v.optional(v.string()),
    paidAt: v.optional(v.number()),
  }).index("by_reference", ["reference"]).index("by_user", ["userId"]).index("by_order", ["orderId"]),

  walletLedger: defineTable({
    userId: v.id("users"),
    kind: v.union(v.literal("credit"), v.literal("debit")),
    amountMinor: v.number(),
    currency: v.string(),
    reason: v.string(),
    reference: v.optional(v.string()),
    balanceAfterMinor: v.number(),
  }).index("by_user", ["userId"]),

  bankRecipients: defineTable({
    userId: v.id("users"),
    provider: v.literal("paystack"),
    recipientCode: v.string(),
    bankCode: v.string(),
    bankName: v.string(),
    accountName: v.string(),
    maskedAccountNumber: v.string(),
    currency: v.string(),
    status: v.union(v.literal("active"), v.literal("disabled")),
  }).index("by_user", ["userId"]).index("by_recipient", ["recipientCode"]),

  transfers: defineTable({
    userId: v.id("users"),
    recipientId: v.id("bankRecipients"),
    provider: v.literal("paystack"),
    reference: v.string(),
    amountMinor: v.number(),
    currency: v.string(),
    status: v.union(v.literal("queued"), v.literal("pending"), v.literal("success"), v.literal("failed"), v.literal("reversed")),
    reason: v.string(),
  }).index("by_reference", ["reference"]).index("by_user", ["userId"]),

  privacySettings: defineTable({
    userId: v.id("users"),
    profileMode: v.union(v.literal("public"), v.literal("contact_only"), v.literal("private")),
    showFollowers: v.boolean(),
    showFollowing: v.boolean(),
    showLikes: v.boolean(),
    showComments: v.boolean(),
    showReshares: v.boolean(),
    showViews: v.boolean(),
    privateMetrics: v.boolean(),
    hideNegativeComments: v.boolean(),
    ghostShieldMode: v.optional(v.union(v.literal("standard"), v.literal("strict"), v.literal("custom"))),
    ghostShieldRules: v.optional(v.any()),
  }).index("by_user", ["userId"]),

  sovereignPrivilegeAudit: defineTable({
    userId: v.id("users"),
    tier: v.string(),
    action: v.string(),
    feature: v.string(),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  }).index("by_user_created", ["userId", "createdAt"]).index("by_feature_created", ["feature", "createdAt"]),

  sovereignProfiles: defineTable({
    userId: v.id("users"),
    customBioStyle: v.optional(v.union(v.literal("classic"), v.literal("editorial"), v.literal("steel"), v.literal("minimal"))),
    pinnedMediaUrls: v.array(v.string()),
    linkInBioLabel: v.optional(v.string()),
    linkInBioUrl: v.optional(v.string()),
    statusTag: v.optional(v.string()),
    discoveryBoostEnabled: v.boolean(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  sovereignMediaUsage: defineTable({
    userId: v.id("users"),
    kind: v.union(v.literal("video"), v.literal("image"), v.literal("story")),
    bytes: v.number(),
    durationSeconds: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_user_created", ["userId", "createdAt"]),

  gildedCustomizations: defineTable({
    userId: v.id("users"),
    productId: v.id("products"),
    selections: v.any(),
    notes: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("submitted"), v.literal("confirmed"), v.literal("fulfilled")),
    brandEmail: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    leadTimeEstimate: v.optional(v.string()),
    blueprint: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user_created", ["userId","createdAt"]).index("by_product_status", ["productId","status"]),

  gildedDispatches: defineTable({
    customizationId: v.id("gildedCustomizations"),
    recipientType: v.union(v.literal("brand"), v.literal("customer")),
    recipientEmail: v.string(),
    status: v.union(v.literal("queued"), v.literal("sent"), v.literal("failed")),
    subject: v.string(),
    createdAt: v.number(),
    sentAt: v.optional(v.number()),
    error: v.optional(v.string()),
  }).index("by_customization", ["customizationId"]),

  gildedAuditRuns: defineTable({
    userId: v.id("users"),
    targetType: v.union(v.literal("homepage"), v.literal("profile")),
    targetId: v.optional(v.string()),
    configuration: v.any(),
    findings: v.array(v.any()),
    createdAt: v.number(),
  }).index("by_user_created", ["userId","createdAt"]),

  vipCareQueue: defineTable({
    userId: v.id("users"),
    actionType: v.string(),
    referenceId: v.optional(v.string()),
    priority: v.number(),
    status: v.union(v.literal("queued"), v.literal("assigned"), v.literal("resolved")),
    createdAt: v.number(),
  }).index("by_status_priority", ["status","priority"]).index("by_user_created", ["userId","createdAt"]),

  gildedGuilds: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    slug: v.string(),
    territory: v.string(),
    description: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("suspended")),
    createdAt: v.number(),
  }).index("by_owner", ["ownerId"]).index("by_territory", ["territory"]).index("by_slug", ["slug"]),

  gildedGuildMembers: defineTable({
    guildId: v.id("gildedGuilds"),
    userId: v.id("users"),
    role: v.union(v.literal("member"), v.literal("warden"), v.literal("steward")),
    status: v.union(v.literal("active"), v.literal("suspended")),
    appointedBy: v.id("users"),
    appointedAt: v.number(),
  }).index("by_guild_user", ["guildId","userId"]).index("by_guild_role", ["guildId","role"]).index("by_user", ["userId"]),

  gildedTerritoryPolicies: defineTable({
    guildId: v.id("gildedGuilds"),
    territory: v.string(),
    policy: v.any(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  }).index("by_guild", ["guildId"]),

  privacyTrustedAccounts: defineTable({
    userId: v.id("users"),
    trustedUserId: v.id("users"),
    createdAt: v.number(),
  }).index("by_user", ["userId"]).index("by_user_trusted", ["userId", "trustedUserId"]),

  postExclusions: defineTable({
    postId: v.id("feedItems"),
    ownerId: v.id("users"),
    excludedUserId: v.optional(v.id("users")),
    excludedConnectionKind: v.optional(v.union(v.literal("follow"), v.literal("friend"), v.literal("blocked"))),
    excludedListName: v.optional(v.string()),
  }).index("by_post", ["postId"]).index("by_owner", ["ownerId"]),

  membershipProfiles: defineTable({
    userId: v.id("users"),
    tier: v.union(v.literal("obsidian"), v.literal("sovereign"), v.literal("sovereign_gilded"), v.literal("apex_imperial"), v.literal("sovereign_aethel")),
    points: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]).index("by_tier", ["tier"]),

  membershipInvitations: defineTable({
    userId: v.id("users"),
    tier: v.union(v.literal("apex_imperial"), v.literal("sovereign_aethel")),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("revoked")),
    invitedBy: v.id("users"),
    createdAt: v.number(),
  }).index("by_user", ["userId"]).index("by_status_tier", ["status", "tier"]),

  // Apex-Imperial's dual-sponsor nomination workflow. A nomination is NOT an
  // invitation — it becomes one (a membershipInvitations row) only once it
  // has two distinct, existing Apex-Imperial sponsors and someone with
  // authority approves it. See membership.ts for the state machine.
  apexNominations: defineTable({
    nomineeUserId: v.id("users"),
    firstSponsorId: v.id("users"),
    secondSponsorId: v.optional(v.id("users")),
    status: v.union(v.literal("pending_second_sponsor"), v.literal("pending_review"), v.literal("approved"), v.literal("rejected"), v.literal("withdrawn")),
    note: v.optional(v.string()),
    createdAt: v.number(),
    decidedAt: v.optional(v.number()),
    decidedBy: v.optional(v.id("users")),
  })
    .index("by_nominee", ["nomineeUserId"])
    .index("by_status", ["status"])
    .index("by_first_sponsor", ["firstSponsorId"]),

  engagementChallenges: defineTable({
    title: v.string(),
    description: v.string(),
    category: v.union(v.literal("family"), v.literal("creative"), v.literal("community"), v.literal("wellbeing")),
    startsAt: v.number(),
    endsAt: v.number(),
    pointsReward: v.number(),
    cosmeticReward: v.optional(v.string()),
    status: v.union(v.literal("scheduled"), v.literal("live"), v.literal("ended")),
  }).index("by_status_end", ["status", "endsAt"]),

  challengeProgress: defineTable({
    challengeId: v.id("engagementChallenges"),
    userId: v.id("users"),
    progress: v.number(),
    placement: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  }).index("by_challenge_user", ["challengeId", "userId"]).index("by_user", ["userId"]),

  nexaPointTransactions: defineTable({
    userId: v.id("users"),
    amount: v.number(),
    reason: v.string(),
    source: v.union(v.literal("challenge"), v.literal("social"), v.literal("purchase"), v.literal("badge"), v.literal("admin"), v.literal("adjustment")),
    referenceId: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user_created", ["userId", "createdAt"]).index("by_source", ["source"]),

  engagementBadges: defineTable({
    userId: v.id("users"),
    key: v.string(),
    label: v.string(),
    awardedAt: v.number(),
  }).index("by_user", ["userId"]).index("by_user_key", ["userId", "key"]),

  familyPlayRooms: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    game: v.union(v.literal("trivia"), v.literal("puzzle"), v.literal("creative")),
    access: v.union(v.literal("invite_only"), v.literal("circle")),
    status: v.union(v.literal("open"), v.literal("closed")),
    createdAt: v.number(),
  }).index("by_owner", ["ownerId"]).index("by_status", ["status"]),

  socialProfiles: defineTable({
    userId: v.id("users"),
    bio: v.optional(v.string()),
    city: v.optional(v.string()),
    region: v.optional(v.string()),
    country: v.optional(v.string()),
    locationMode: v.union(v.literal("private"), v.literal("city"), v.literal("region")),
    discoveryEnabled: v.boolean(),
    discoverableTo: v.union(v.literal("friends"), v.literal("everyone"), v.literal("nobody")),
  }).index("by_user", ["userId"]).index("by_region", ["region", "discoveryEnabled"]),

  socialConnections: defineTable({
    userId: v.id("users"),
    targetUserId: v.id("users"),
    kind: v.union(v.literal("follow"), v.literal("friend"), v.literal("blocked")),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("active")),
  }).index("by_user_target", ["userId", "targetUserId"]).index("by_target_kind", ["targetUserId", "kind"]),

  feedItems: defineTable({
    authorId: v.id("users"),
    authorUsername: v.optional(v.string()),
    body: v.string(),
    mediaUrl: v.optional(v.string()),
    mediaType: v.optional(v.union(v.literal("image"), v.literal("video"))),
    visibility: v.union(v.literal("public"), v.literal("friends"), v.literal("private")),
    regionBucket: v.optional(v.string()),
    status: v.union(v.literal("published"), v.literal("hidden"), v.literal("deleted")),
    likeCount: v.number(),
    commentCount: v.number(),
    shareCount: v.number(),
    saveCount: v.number(),
    viewCount: v.number(),
    qualityScore: v.number(),
    velocityScore: v.number(),
    diversityKey: v.optional(v.string()),
  }).index("by_status_created", ["status"]).index("by_author", ["authorId"]).index("by_region_status", ["regionBucket", "status"]),

  feedEvents: defineTable({
    viewerId: v.optional(v.id("users")),
    itemId: v.id("feedItems"),
    event: v.union(v.literal("impression"), v.literal("view"), v.literal("like"), v.literal("comment"), v.literal("share"), v.literal("save"), v.literal("not_interested"), v.literal("follow")),
    dwellMs: v.optional(v.number()),
    sessionId: v.optional(v.string()),
    regionBucket: v.optional(v.string()),
  }).index("by_item", ["itemId"]).index("by_viewer", ["viewerId"]),

  tasteProfiles: defineTable({
    userId: v.id("users"),
    interests: v.any(),
    creators: v.any(),
    brands: v.any(),
    categories: v.any(),
    updatedAt: v.number(),
    version: v.number(),
  }).index("by_user", ["userId"]),

  algorithmConfigs: defineTable({
    name: v.string(),
    version: v.number(),
    weights: v.any(),
    explorationRate: v.number(),
    updatedAt: v.number(),
    active: v.boolean(),
  }).index("by_name_active", ["name", "active"]),

  aiThreads: defineTable({
    userId: v.id("users"),
    title: v.string(),
    mode: v.union(v.literal("shopping"), v.literal("social"), v.literal("finance"), v.literal("general"), v.literal("admin")),
    updatedAt: v.number(),
  }).index("by_user_updated", ["userId", "updatedAt"]),

  directThreads: defineTable({
    memberA: v.id("users"),
    memberB: v.id("users"),
    lastMessageAt: v.number(),
    status: v.union(v.literal("active"), v.literal("blocked")),
  }).index("by_member_a", ["memberA"]).index("by_member_b", ["memberB"]),

  directMessages: defineTable({
    threadId: v.id("directThreads"),
    senderId: v.id("users"),
    body: v.string(),
    createdAt: v.number(),
    status: v.union(v.literal("sent"), v.literal("hidden"), v.literal("deleted")),
  }).index("by_thread_created", ["threadId", "createdAt"]),

  messageRequests: defineTable({
    threadId: v.id("directThreads"),
    senderId: v.id("users"),
    receiverId: v.id("users"),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("ignored"), v.literal("blocked"), v.literal("reported")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_receiver_status", ["receiverId", "status"]).index("by_thread", ["threadId"]),

  messagePreferences: defineTable({
    userId: v.id("users"),
    allowMessagesFrom: v.union(v.literal("friends"), v.literal("contacts"), v.literal("everyone")),
    allowMedia: v.boolean(),
  }).index("by_user", ["userId"]),

  typingIndicators: defineTable({
    threadId: v.id("directThreads"),
    userId: v.id("users"),
    expiresAt: v.number(),
  }).index("by_thread", ["threadId"]).index("by_thread_user", ["threadId", "userId"]),

  aiMessages: defineTable({
    threadId: v.id("aiThreads"),
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    model: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_thread_created", ["threadId", "createdAt"]),

  revenueEvents: defineTable({
    traceId: v.string(),
    orderId: v.optional(v.id("orders")),
    amountMinor: v.int64(),
    currency: v.string(),
    source: v.string(),
  }).index("by_trace", ["traceId"]),

  accountRecovery: defineTable({
    userId: v.id("users"),
    email: v.string(),
    challengeHash: v.string(),
    questions: v.array(v.object({ id:v.string(), prompt:v.string(), answerHash:v.string() })),
    attempts: v.number(),
    expiresAt: v.number(),
    verifiedAt: v.optional(v.number()),
  }).index("by_user", ["userId"]).index("by_email", ["email"]).index("by_challenge", ["challengeHash"]),

  passkeyCredentials: defineTable({
    userId: v.id("users"),
    credentialId: v.string(),
    publicKey: v.string(),
    counter: v.number(),
    transports: v.optional(v.array(v.string())),
    deviceType: v.optional(v.string()),
    backedUp: v.optional(v.boolean()),
    name: v.string(),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
  }).index("by_user", ["userId"]).index("by_credential", ["credentialId"]),

  passkeyChallenges: defineTable({
    userId: v.id("users"),
    challenge: v.string(),
    type: v.union(v.literal("registration"), v.literal("authentication")),
    expiresAt: v.number(),
  }).index("by_user_type", ["userId", "type"]),

  notifications: defineTable({
    userId: v.id("users"),
    kind: v.union(
      v.literal("order"), v.literal("payment"), v.literal("social"), v.literal("security"),
      v.literal("promotion"), v.literal("system"), v.literal("creator"), v.literal("support")
    ),
    title: v.string(),
    body: v.string(),
    actionUrl: v.optional(v.string()),
    readAt: v.optional(v.number()),
    priority: v.union(v.literal("low"), v.literal("normal"), v.literal("high")),
    createdAt: v.number(),
  }).index("by_user_created", ["userId", "createdAt"]).index("by_user_unread", ["userId", "readAt"]),

  notificationPreferences: defineTable({
    userId: v.id("users"),
    orders: v.boolean(),
    payments: v.boolean(),
    social: v.boolean(),
    promotions: v.boolean(),
    creator: v.boolean(),
    support: v.boolean(),
    security: v.boolean(),
    email: v.boolean(),
    push: v.boolean(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  inventoryReservations: defineTable({
    orderId: v.id("orders"),
    productId: v.id("products"),
    variantId: v.optional(v.id("productVariants")),
    quantity: v.number(),
    status: v.union(v.literal("held"), v.literal("released"), v.literal("committed")),
    expiresAt: v.number(),
  }).index("by_order", ["orderId"]).index("by_expiry_status", ["expiresAt", "status"]),

  fulfillmentShipments: defineTable({
    orderId: v.id("orders"),
    provider: v.string(),
    externalId: v.optional(v.string()),
    status: v.union(
      v.literal("pending"), v.literal("processing"), v.literal("shipped"),
      v.literal("in_transit"), v.literal("delivered"), v.literal("exception"), v.literal("cancelled")
    ),
    carrier: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
    trackingUrl: v.optional(v.string()),
    shippedAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
  }).index("by_order", ["orderId"]).index("by_tracking", ["trackingNumber"]).index("by_status", ["status"]),

  fulfillmentEvents: defineTable({
    shipmentId: v.id("fulfillmentShipments"),
    status: v.string(),
    message: v.optional(v.string()),
    location: v.optional(v.string()),
    occurredAt: v.number(),
  }).index("by_shipment_time", ["shipmentId", "occurredAt"]),

  returns: defineTable({
    orderId: v.id("orders"),
    userId: v.id("users"),
    status: v.union(v.literal("requested"), v.literal("approved"), v.literal("received"), v.literal("refunded"), v.literal("rejected")),
    reason: v.string(),
    notes: v.optional(v.string()),
    requestedAt: v.number(),
    resolvedAt: v.optional(v.number()),
  }).index("by_user", ["userId"]).index("by_order", ["orderId"]).index("by_status", ["status"]),

  refunds: defineTable({
    orderId: v.id("orders"),
    userId: v.id("users"),
    paymentId: v.optional(v.id("payments")),
    amountMinor: v.number(),
    currency: v.string(),
    reason: v.string(),
    status: v.union(v.literal("requested"), v.literal("processing"), v.literal("completed"), v.literal("failed")),
    providerReference: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  }).index("by_order", ["orderId"]).index("by_user", ["userId"]).index("by_status", ["status"]),

  reviews: defineTable({
    productId: v.id("products"),
    userId: v.id("users"),
    orderId: v.optional(v.id("orders")),
    rating: v.number(),
    title: v.optional(v.string()),
    body: v.string(),
    verifiedPurchase: v.boolean(),
    status: v.union(v.literal("pending"), v.literal("published"), v.literal("hidden")),
  }).index("by_product_status", ["productId", "status"]).index("by_user", ["userId"]).index("by_order", ["orderId"]),

  creatorProfiles: defineTable({
    userId: v.id("users"),
    displayName: v.string(),
    bio: v.optional(v.string()),
    niche: v.optional(v.string()),
    status: v.union(v.literal("applicant"), v.literal("approved"), v.literal("suspended")),
    commissionBps: v.number(),
    totalClicks: v.number(),
    totalConversions: v.number(),
    totalRevenueMinor: v.number(),
  }).index("by_user", ["userId"]).index("by_status", ["status"]),

  creatorCollections: defineTable({
    creatorId: v.id("creatorProfiles"),
    title: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("published"), v.literal("archived")),
    coverImage: v.optional(v.string()),
  }).index("by_creator", ["creatorId"]).index("by_slug", ["slug"]),

  creatorCollectionItems: defineTable({
    collectionId: v.id("creatorCollections"),
    productId: v.id("products"),
    sortOrder: v.number(),
  }).index("by_collection", ["collectionId"]).index("by_product", ["productId"]),

  creatorEvents: defineTable({
    creatorId: v.id("creatorProfiles"),
    collectionId: v.optional(v.id("creatorCollections")),
    productId: v.optional(v.id("products")),
    kind: v.union(v.literal("view"), v.literal("click"), v.literal("add_to_cart"), v.literal("purchase")),
    orderId: v.optional(v.id("orders")),
    valueMinor: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_creator_time", ["creatorId", "createdAt"]).index("by_product", ["productId"]),

  reports: defineTable({
    reporterId: v.id("users"),
    targetType: v.union(v.literal("feed_item"), v.literal("comment"), v.literal("profile"), v.literal("message"), v.literal("product"), v.literal("creator")),
    targetId: v.string(),
    reason: v.union(v.literal("spam"), v.literal("scam"), v.literal("harassment"), v.literal("hate"), v.literal("sexual"), v.literal("copyright"), v.literal("impersonation"), v.literal("other")),
    details: v.optional(v.string()),
    status: v.union(v.literal("open"), v.literal("reviewing"), v.literal("resolved"), v.literal("dismissed")),
    resolution: v.optional(v.string()),
  }).index("by_status", ["status"]).index("by_reporter", ["reporterId"]).index("by_target", ["targetType", "targetId"]),

  moderationActions: defineTable({
    adminId: v.id("users"),
    reportId: v.optional(v.id("reports")),
    targetType: v.string(),
    targetId: v.string(),
    action: v.union(v.literal("warn"), v.literal("hide"), v.literal("restore"), v.literal("suspend"), v.literal("delete")),
    reason: v.string(),
  }).index("by_target", ["targetType", "targetId"]).index("by_report", ["reportId"]),

  supportTickets: defineTable({
    userId: v.id("users"),
    subject: v.string(),
    category: v.union(v.literal("order"), v.literal("payment"), v.literal("account"), v.literal("product"), v.literal("social"), v.literal("other")),
    status: v.union(v.literal("open"), v.literal("pending"), v.literal("resolved"), v.literal("closed")),
    priority: v.union(v.literal("low"), v.literal("normal"), v.literal("high"), v.literal("urgent")),
    orderId: v.optional(v.id("orders")),
    lastMessageAt: v.number(),
  }).index("by_user", ["userId"]).index("by_status_priority", ["status", "priority"]),

  supportMessages: defineTable({
    ticketId: v.id("supportTickets"),
    senderId: v.id("users"),
    role: v.union(v.literal("customer"), v.literal("agent"), v.literal("ai")),
    body: v.string(),
    createdAt: v.number(),
  }).index("by_ticket_time", ["ticketId", "createdAt"]),

  mediaAssets: defineTable({
    ownerId: v.id("users"),
    storageId: v.id("_storage"),
    kind: v.union(v.literal("image"), v.literal("video"), v.literal("document"), v.literal("audio")),
    status: v.union(v.literal("uploaded"), v.literal("processing"), v.literal("ready"), v.literal("blocked"), v.literal("deleted")),
    mimeType: v.optional(v.string()),
    sizeBytes: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    purpose: v.optional(v.string()),
  }).index("by_owner", ["ownerId"]).index("by_status", ["status"]),

  recommendationItems: defineTable({
    userId: v.id("users"),
    productId: v.id("products"),
    score: v.number(),
    reason: v.string(),
    modelVersion: v.number(),
    expiresAt: v.number(),
  }).index("by_user_score", ["userId", "score"]).index("by_expiry", ["expiresAt"]),

  searchEvents: defineTable({
    userId: v.optional(v.id("users")),
    query: v.string(),
    resultCount: v.number(),
    selectedProductId: v.optional(v.id("products")),
    createdAt: v.number(),
  }).index("by_user_time", ["userId", "createdAt"]),

  riskEvents: defineTable({
    userId: v.optional(v.id("users")),
    kind: v.union(v.literal("login"), v.literal("payment"), v.literal("withdrawal"), v.literal("message"), v.literal("content")),
    score: v.number(),
    reason: v.string(),
    status: v.union(v.literal("open"), v.literal("reviewed"), v.literal("dismissed")),
    createdAt: v.number(),
  }).index("by_user_time", ["userId", "createdAt"]).index("by_status_score", ["status", "score"]),

  earlyAccessDrops: defineTable({
    brandId: v.id("brandPartners"),
    productId: v.id("products"),
    title: v.string(),
    startsAt: v.number(),
    endsAt: v.optional(v.number()),
    accessTier: v.string(),
    quantityLimit: v.optional(v.number()),
    status: v.union(v.literal("scheduled"), v.literal("live"), v.literal("ended"), v.literal("cancelled")),
  }).index("by_status_start", ["status", "startsAt"]).index("by_product", ["productId"]),

  dropClaims: defineTable({
    dropId: v.id("earlyAccessDrops"),
    userId: v.id("users"),
    quantity: v.number(),
    claimedAt: v.number(),
  }).index("by_drop_user", ["dropId", "userId"]).index("by_drop", ["dropId"]),

  stories: defineTable({
    authorId: v.id("users"),
    mediaUrl: v.string(),
    mediaType: v.union(v.literal("image"), v.literal("video")),
    caption: v.optional(v.string()),
    visibility: v.union(v.literal("public"), v.literal("friends")),
    expiresAt: v.number(),
    status: v.union(v.literal("published"), v.literal("hidden"), v.literal("deleted")),
  }).index("by_author", ["authorId"]).index("by_status_expiry", ["status", "expiresAt"]),

  storyViews: defineTable({
    storyId: v.id("stories"),
    viewerId: v.id("users"),
    viewedAt: v.number(),
  }).index("by_story_viewer", ["storyId", "viewerId"]).index("by_story", ["storyId"]),


  // --- EVARA-LUX ARCANA ARENA -------------------------------------------------
  gameProfiles: defineTable({
    userId: v.id("users"),
    codename: v.string(),
    archetype: v.union(v.literal("blade"), v.literal("aether"), v.literal("phantom"), v.literal("oracle")),
    level: v.number(),
    xp: v.number(),
    rank: v.union(v.literal("E"), v.literal("D"), v.literal("C"), v.literal("B"), v.literal("A"), v.literal("S"), v.literal("SS"), v.literal("MONARCH")),
    power: v.number(),
    customization: v.any(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]).index("by_rank_power", ["rank", "power"]),

  gamePowerUps: defineTable({
    userId: v.id("users"),
    key: v.string(),
    name: v.string(),
    rarity: v.union(v.literal("common"), v.literal("rare"), v.literal("epic"), v.literal("mythic"), v.literal("sovereign")),
    level: v.number(),
    equipped: v.boolean(),
    unlockedAt: v.number(),
  }).index("by_user", ["userId"]).index("by_user_equipped", ["userId", "equipped"]),

  gameSessions: defineTable({
    userId: v.id("users"),
    mode: v.union(v.literal("awakening"), v.literal("rush"), v.literal("boss"), v.literal("duel")),
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("abandoned")),
    score: v.number(),
    combo: v.number(),
    durationMs: v.number(),
    rewards: v.any(),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  }).index("by_user_started", ["userId", "startedAt"]).index("by_status", ["status"]),

  gameAchievements: defineTable({
    userId: v.id("users"),
    key: v.string(),
    title: v.string(),
    description: v.string(),
    unlockedAt: v.number(),
  }).index("by_user", ["userId"]).index("by_user_key", ["userId", "key"]),

  gameDailyStates: defineTable({
    userId: v.id("users"),
    dayKey: v.string(),
    streak: v.number(),
    claimedAt: v.optional(v.number()),
    energy: v.number(),
    maxEnergy: v.number(),
    updatedAt: v.number(),
  }).index("by_user_day", ["userId", "dayKey"]),


  gameSeasons: defineTable({
    key: v.string(), name: v.string(),
    status: v.union(v.literal("upcoming"), v.literal("live"), v.literal("ended")),
    startsAt: v.number(), endsAt: v.number(),
  }).index("by_key", ["key"]).index("by_status", ["status"]),
  gameRankings: defineTable({
    userId: v.id("users"), seasonKey: v.string(), rating: v.number(), wins: v.number(), losses: v.number(), streak: v.number(), division: v.string(), title: v.string(), updatedAt: v.number(),
  }).index("by_user_season", ["userId", "seasonKey"]).index("by_season_rating", ["seasonKey", "rating"]),
  gamePowerUpMastery: defineTable({
    userId: v.id("users"), powerUpKey: v.string(), masteryXp: v.number(), awakeningLevel: v.number(), awakened: v.boolean(), lastUsedAt: v.optional(v.number()), updatedAt: v.number(),
  }).index("by_user", ["userId"]).index("by_user_power", ["userId", "powerUpKey"]),
  gameResources: defineTable({
    userId: v.id("users"), essence: v.number(), shards: v.number(), cores: v.number(), updatedAt: v.number(),
  }).index("by_user", ["userId"]),
  gameGuildStats: defineTable({
    guildId: v.id("gildedGuilds"), seasonKey: v.string(), guildPower: v.number(), rating: v.number(), wins: v.number(), losses: v.number(), territoryScore: v.number(), level: v.number(), updatedAt: v.number(),
  }).index("by_guild_season", ["guildId", "seasonKey"]).index("by_season_rating", ["seasonKey", "rating"]),
  gameGuildApplications: defineTable({
    guildId: v.id("gildedGuilds"), userId: v.id("users"), status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("rejected"), v.literal("withdrawn")), createdAt: v.number(), updatedAt: v.number(),
  }).index("by_guild_status", ["guildId", "status"]).index("by_user_status", ["userId", "status"]),
  gameGuildEvents: defineTable({
    guildId: v.id("gildedGuilds"), actorId: v.id("users"), type: v.union(v.literal("joined"), v.literal("left"), v.literal("appointed"), v.literal("mission"), v.literal("territory"), v.literal("war"), v.literal("upgrade")), targetUserId: v.optional(v.id("users")), payload: v.any(), createdAt: v.number(),
  }).index("by_guild_created", ["guildId", "createdAt"]),
  gameGuildMissions: defineTable({
    guildId: v.id("gildedGuilds"), title: v.string(), description: v.string(), goal: v.number(), progress: v.number(), rewardPower: v.number(), status: v.union(v.literal("active"), v.literal("completed"), v.literal("expired")), createdAt: v.number(), endsAt: v.number(),
  }).index("by_guild_status", ["guildId", "status"]),
  gameGuildWars: defineTable({
    attackerGuildId: v.id("gildedGuilds"), defenderGuildId: v.id("gildedGuilds"), seasonKey: v.string(), status: v.union(v.literal("queued"), v.literal("live"), v.literal("resolved"), v.literal("cancelled")), attackerScore: v.number(), defenderScore: v.number(), startedAt: v.number(), endsAt: v.number(), winnerGuildId: v.optional(v.id("gildedGuilds")),
  }).index("by_guild_status", ["attackerGuildId", "status"]).index("by_season_status", ["seasonKey", "status"]),

  dungeonDefinitions: defineTable({ key:v.string(), name:v.string(), tier:v.string(), minAscension:v.string(), minMembership:v.string(), energyCost:v.number(), recommendedParty:v.number(), bossKey:v.string(), active:v.boolean() }).index("by_key",["key"]).index("by_tier",["tier"]),
  dungeonRuns: defineTable({ userId:v.id("users"), dungeonId:v.id("dungeonDefinitions"), partyId:v.optional(v.id("dungeonParties")), status:v.union(v.literal("forming"),v.literal("active"),v.literal("completed"),v.literal("failed")), energySpent:v.number(), phase:v.number(), score:v.number(), damage:v.number(), startedAt:v.number(), endedAt:v.optional(v.number()) }).index("by_user",["userId"]).index("by_status",["status"]),
  dungeonParties: defineTable({ leaderId:v.id("users"), dungeonId:v.id("dungeonDefinitions"), status:v.union(v.literal("forming"),v.literal("ready"),v.literal("active"),v.literal("completed"),v.literal("cancelled")), createdAt:v.number() }).index("by_leader",["leaderId"]).index("by_dungeon_status",["dungeonId","status"]),
  dungeonPartyMembers: defineTable({ partyId:v.id("dungeonParties"), userId:v.id("users"), role:v.union(v.literal("tank"),v.literal("dps"),v.literal("mage"),v.literal("support")), status:v.union(v.literal("invited"),v.literal("accepted"),v.literal("declined")), joinedAt:v.number() }).index("by_party",["partyId"]).index("by_user",["userId"]),
  monsterDefinitions: defineTable({ key:v.string(), name:v.string(), family:v.string(), element:v.string(), maxHp:v.number(), shield:v.number(), phases:v.number(), lootTable:v.any(), active:v.boolean() }).index("by_key",["key"]).index("by_element",["element"]),
  monsterEncounters: defineTable({ runId:v.id("dungeonRuns"), monsterId:v.id("monsterDefinitions"), currentHp:v.number(), currentShield:v.number(), phase:v.number(), status:v.union(v.literal("spawned"),v.literal("defeated")), spawnedAt:v.number(), defeatedAt:v.optional(v.number()) }).index("by_run",["runId"]),
  monsterDamage: defineTable({ encounterId:v.id("monsterEncounters"), userId:v.id("users"), damage:v.number(), criticals:v.number(), spells:v.number(), createdAt:v.number() }).index("by_encounter",["encounterId"]).index("by_user",["userId"]),
  monsterAIStates: defineTable({ encounterId:v.id("monsterEncounters"), intelligence:v.number(), awareness:v.number(), aggression:v.number(), adaptation:v.number(), threatTargetId:v.optional(v.id("users")), threatScore:v.number(), lastPlayerElement:v.optional(v.string()), repeatedElementCount:v.number(), phasePattern:v.number(), behaviorMode:v.string(), lastDecisionAt:v.number() }).index("by_encounter",["encounterId"]),
  combatEvents: defineTable({ encounterId:v.id("monsterEncounters"), type:v.string(), actorId:v.optional(v.id("users")), payload:v.any(), createdAt:v.number() }).index("by_encounter",["encounterId"]),
  lootDrops: defineTable({ runId:v.id("dungeonRuns"), userId:v.id("users"), itemKey:v.string(), itemType:v.string(), quantity:v.number(), rarity:v.string(), createdAt:v.number() }).index("by_run",["runId"]).index("by_user",["userId"]),
  worldBosses: defineTable({ key:v.string(), name:v.string(), element:v.string(), maxHp:v.number(), currentHp:v.number(), phase:v.number(), status:v.union(v.literal("scheduled"),v.literal("live"),v.literal("defeated")), startsAt:v.number(), endsAt:v.number() }).index("by_status",["status"]),
  worldBossDamage: defineTable({ bossId:v.id("worldBosses"), userId:v.id("users"), guildId:v.optional(v.id("gildedGuilds")), damage:v.number(), createdAt:v.number() }).index("by_boss",["bossId"]).index("by_user",["userId"]),
  magicElements: defineTable({ key:v.string(), name:v.string(), description:v.string(), colorToken:v.string(), active:v.boolean() }).index("by_key",["key"]),
  magicSkills: defineTable({ key:v.string(), elementKey:v.string(), name:v.string(), tier:v.number(), manaCost:v.number(), baseDamage:v.number(), comboTag:v.string(), active:v.boolean() }).index("by_element",["elementKey"]).index("by_key",["key"]),
  magicMastery: defineTable({ userId:v.id("users"), skillKey:v.string(), xp:v.number(), level:v.number(), unlocked:v.boolean(), equippedSlot:v.optional(v.number()), updatedAt:v.number() }).index("by_user",["userId"]).index("by_skill",["userId","skillKey"]),
  magicLoadouts: defineTable({ userId:v.id("users"), name:v.string(), slots:v.any(), active:v.boolean(), updatedAt:v.number() }).index("by_user",["userId"]),
  magicalArtifacts: defineTable({ userId:v.id("users"), key:v.string(), name:v.string(), rarity:v.string(), sourceCustomizationId:v.optional(v.id("gildedCustomizations")), stats:v.any(), enchantments:v.any(), createdAt:v.number() }).index("by_user",["userId"]),


  universeLocations: defineTable({
    key:v.string(), name:v.string(), subtitle:v.string(), description:v.string(), realm:v.string(), dangerRank:v.string(), tags:v.array(v.string()), active:v.boolean()
  }).index("by_key",["key"]).index("by_realm",["realm"]),

  universeNpcs: defineTable({
    key:v.string(), name:v.string(), title:v.string(), locationKey:v.string(), factionKey:v.optional(v.string()), description:v.string(), services:v.array(v.string()), active:v.boolean()
  }).index("by_key",["key"]).index("by_location",["locationKey"]),

  universeFactions: defineTable({
    key:v.string(), name:v.string(), description:v.string(), alignment:v.string(), threatRank:v.string(), headquartersKey:v.optional(v.string()), active:v.boolean()
  }).index("by_key",["key"]),

  universeMaterials: defineTable({
    key:v.string(), name:v.string(), rank:v.string(), category:v.string(), description:v.string(), sourceMonsterKeys:v.array(v.string()), rarity:v.string(), uses:v.array(v.string()), active:v.boolean()
  }).index("by_key",["key"]).index("by_rank",["rank"]),

  universeMonsterProfiles: defineTable({
    key:v.string(), name:v.string(), rank:v.string(), family:v.string(), factionKey:v.optional(v.string()), element:v.string(),
    intelligence:v.number(), awareness:v.number(), aggression:v.number(), attack:v.number(), defense:v.number(), magic:v.number(), speed:v.number(), vitality:v.number(),
    hp:v.number(), shield:v.number(), phases:v.number(), abilities:v.array(v.string()), behavior:v.array(v.string()), drops:v.array(v.string()), dungeonKey:v.string(), description:v.string(), active:v.boolean()
  }).index("by_key",["key"]).index("by_rank",["rank"]).index("by_dungeon",["dungeonKey"]),

  // Generic auditable coin-grant log for the native coin ledger (welcome
  // bonus, referral rewards, wallet-funded purchases). coinAccounts.balance/
  // lifetimeCoins is the aggregate; this table is the per-event audit trail
  // and idempotency guard (reference must be unique per grant/purchase).
  coinGrants: defineTable({
    userId: v.id('users'),
    amount: v.number(),
    reason: v.union(v.literal('welcome_bonus'), v.literal('referral_referee'), v.literal('referral_referrer'), v.literal('tier_bonus'), v.literal('wallet_purchase'), v.literal('admin_adjustment')),
    reference: v.string(),
    orderId: v.optional(v.id('orders')),
    createdAt: v.number(),
  }).index('by_user', ['userId']).index('by_reference', ['reference']).index('by_user_created', ['userId', 'createdAt']),

  universeDungeons: defineTable({
    key:v.string(), name:v.string(), rankBand:v.string(), locationKey:v.string(), bossKeys:v.array(v.string()), materialKeys:v.array(v.string()), description:v.string(), partyRange:v.string(), active:v.boolean()
  }).index("by_key",["key"]).index("by_rank",["rankBand"]),

  // --- Legal / compliance --------------------------------------------------
  // Auditable record of every consent a user has given (age confirmation,
  // ToS, Privacy Policy, cookie choices). One row per acceptance event —
  // never overwritten — so "when did this person accept which version" is
  // always answerable, which is what most consent-audit requirements ask for.
  legalConsents: defineTable({
    userId: v.id("users"),
    kind: v.union(
      v.literal("age_confirmation"),
      v.literal("terms_of_service"),
      v.literal("privacy_policy"),
      v.literal("cookie_consent"),
    ),
    version: v.string(), // e.g. "2026-09-25" — the doc version shown at accept time
    acceptedAt: v.number(),
  }).index("by_user", ["userId"]).index("by_user_kind", ["userId", "kind"]),

  // A member's request to have their account/personal data deleted (GDPR
  // "right to erasure" / CCPA "right to delete"). Recorded here, not
  // auto-executed — deletion has to reconcile against order/tax retention
  // obligations first, so this is a queue an admin (or a future automated
  // job) works through, with the request itself as the auditable proof it
  // was made and when.
  dataDeletionRequests: defineTable({
    userId: v.id("users"),
    email: v.string(),
    reason: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("in_review"), v.literal("completed"), v.literal("rejected")),
    requestedAt: v.number(),
    resolvedAt: v.optional(v.number()),
    resolutionNote: v.optional(v.string()),
  }).index("by_user", ["userId"]).index("by_status", ["status"]),

})
