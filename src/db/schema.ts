// BlogCabin DB 스키마 — docs/02-erd.md 설계를 그대로 옮긴 것
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ===== 값이 정해진 글자 컬럼 =====
// PostgreSQL enum 타입 대신 text + CHECK로 둔다 (2026-10-08). Crowfoot ERD가 enum 타입을 다루지 못해서,
// ERD로 그린 구조를 그대로 DB에 배포하고 앱도 같은 구조를 쓰게 맞췄다. 값 목록은 아래 상수가 기준이다.
const enumText =
  <const T extends readonly [string, ...string[]]>(values: T) =>
  (name: string) =>
    text(name, { enum: values });
// CHECK 식: 컬럼 IN ('a', 'b'). 값은 이 파일의 상수뿐이라 그대로 넣는다 (사용자 입력이 아니다)
const oneOf = (col: AnyPgColumn, values: readonly string[]) =>
  sql`${col} IN (${sql.raw(values.map((v) => `'${v}'`).join(", "))})`;

export const ITEM_TYPES = [
  "character",
  "background",
  "furniture",
  "avatar",
] as const;
export const itemType = enumText(ITEM_TYPES);
// 아바타 꾸미기 부위 (SHOP-06): 상의·하의·모자·신발. 그리는 순서는 몸 → 하의 → 상의 → 신발 → 모자 (src/lib/art/avatar.ts)
export const AVATAR_SLOTS = ["top", "bottom", "hat", "shoes"] as const;
export const avatarSlot = enumText(AVATAR_SLOTS);
export const VISIBILITIES = ["public", "private"] as const;
export const visibility = enumText(VISIBILITIES);
export const USER_ROLES = ["user", "admin"] as const;
export const userRole = enumText(USER_ROLES);
export const LEDGER_REASONS = [
  "signup",
  "attendance",
  "attendance_streak",
  "post",
  "comment",
  "like_received",
  "purchase",
  "farm_care",
  "farm_grown",
  "egg_purchase",
  "potion_purchase",
  // 친구 초대 (GAME-09): invite = 초대한 사람(ref_id = 친구 ID), invited = 초대받은 친구(ref_id = 초대한 사람 ID)
  "invite",
  "invited",
] as const;
export const ledgerReason = enumText(LEDGER_REASONS);
// 동물 농장 (TOWN-09)
export const ANIMAL_STATUSES = ["egg", "growing", "grown"] as const;
export const animalStatus = enumText(ANIMAL_STATUSES);
export const EGG_SOURCES = ["starter", "level", "shop"] as const;
export const eggSource = enumText(EGG_SOURCES);
// water(물 주기)는 2026-10-08에 물약으로 바뀌어 쓰지 않는다. 옛 기록 때문에 값은 남겨 둔다
export const CARE_ACTIONS = ["feed", "water", "pet"] as const;
export const careAction = enumText(CARE_ACTIONS);
export const ANIMAL_GENDERS = ["male", "female"] as const;
export const animalGender = enumText(ANIMAL_GENDERS);
// 펫 꾸미기 (무료): 없음·리본·꽃·스카프. 그림은 src/lib/art/animals.ts
export const PET_ACCESSORIES = ["none", "ribbon", "flower", "scarf"] as const;
export const petAccessory = enumText(PET_ACCESSORIES);
export const FARM_ITEM_KINDS = ["potion"] as const;
export const farmItemKind = enumText(FARM_ITEM_KINDS);
// 알림 종류 (GAME-08). pet_level_up = 내 동물 레벨업 (TOWN-09, ref_id = 동물 ID)
export const NOTIFICATION_KINDS = [
  "level_up",
  "like",
  "comment",
  "reply",
  "pet_level_up",
] as const;
export const notificationKind = enumText(NOTIFICATION_KINDS);

// ===== 인증 (Better Auth가 요구하는 구조) =====
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    // 사이트 자체 아이디 로그인 (소셜 로그인 회원은 NULL)
    username: text("username").unique(),
    displayUsername: text("display_username"),
    role: userRole("role").notNull().default("user"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check("users_role_check", oneOf(t.role, USER_ROLES))],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerId: text("provider_id").notNull(), // naver / kakao / google
    accountId: text("account_id").notNull(), // 소셜 서비스 쪽 사용자 ID
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("accounts_user_id_idx").on(t.userId),
    // 같은 소셜 계정이 두 회원에 연결될 수 없다
    unique("accounts_provider_account_uq").on(t.providerId, t.accountId),
  ],
);

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ===== 아이템 =====
export const items = pgTable(
  "items",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    code: text("code").notNull().unique(),
    type: itemType("type").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    price: integer("price").notNull().default(0),
    requiredLevel: integer("required_level").notNull().default(1),
    isStarter: boolean("is_starter").notNull().default(false), // 가입 시 고를 수 있는 기본 아이템
    assetKey: text("asset_key").notNull(),
    slot: avatarSlot("slot"), // 아바타 꾸미기만: 입는 부위 (SHOP-06)
    createdAt: createdAt(),
  },
  (t) => [
    check("items_price_check", sql`${t.price} >= 0`),
    check("items_required_level_check", sql`${t.requiredLevel} >= 1`),
    // 아바타 꾸미기는 부위가 꼭 있고, 다른 종류는 부위가 없다
    check(
      "items_slot_check",
      sql`(${t.type} = 'avatar') = (${t.slot} IS NOT NULL)`,
    ),
    check("items_type_check", oneOf(t.type, ITEM_TYPES)),
    check("items_slot_value_check", oneOf(t.slot, AVATAR_SLOTS)),
    // avatar_equips가 (아이템, 부위)를 함께 가리킬 수 있게 (부위가 맞는 아이템만 입기)
    unique("items_id_slot_uq").on(t.id, t.slot),
  ],
);

// 회원 ↔ 아이템 (N:M): 보유 목록
export const userItems = pgTable(
  "user_items",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id),
    acquiredAt: timestamp("acquired_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.itemId] })],
);

// 아바타 꾸미기 착용 (SHOP-06): 회원마다 부위별로 0~1개
export const avatarEquips = pgTable(
  "avatar_equips",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slot: avatarSlot("slot").notNull(),
    itemId: integer("item_id").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.slot] }), // 부위마다 하나
    check("avatar_equips_slot_check", oneOf(t.slot, AVATAR_SLOTS)),
    // 보유한 아이템만 입는다 (복합 외래 키, ERD 3.3과 같은 방식)
    foreignKey({
      name: "avatar_equips_owned_fk",
      columns: [t.userId, t.itemId],
      foreignColumns: [userItems.userId, userItems.itemId],
    }).onDelete("cascade"),
    // 아이템의 부위와 입은 부위가 같아야 한다 (모자를 옷 자리에 입을 수 없다)
    foreignKey({
      name: "avatar_equips_item_slot_fk",
      columns: [t.itemId, t.slot],
      foreignColumns: [items.id, items.slot],
    }),
  ],
);

// 미니룸 가구 배치 (SHOP-05): 위치는 미니룸 기준 비율(0~100%), 가구 가운데 기준
export const roomFurniture = pgTable(
  "room_furniture",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: integer("item_id").notNull(),
    x: real("x").notNull(),
    y: real("y").notNull(),
    placedAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.itemId] }), // 같은 가구는 한 미니룸에 하나
    foreignKey({
      name: "room_furniture_owned_fk",
      columns: [t.userId, t.itemId],
      foreignColumns: [userItems.userId, userItems.itemId],
    }).onDelete("cascade"),
    check("room_furniture_x_check", sql`${t.x} BETWEEN 0 AND 100`),
    check("room_furniture_y_check", sql`${t.y} BETWEEN 0 AND 100`),
  ],
);

// ===== 회원 프로필 · 블로그 =====
// profiles 행이 있다 = 온보딩을 마친 회원
export const profiles = pgTable(
  "profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    nickname: text("nickname").notNull().unique(),
    characterItemId: integer("character_item_id").notNull(),
    // 프로필에 전시한 다 키운 동물 카드 (TOWN-09). 내 동물만 (복합 외래 키), 다 키웠는지는 Server Action이 확인
    displayedAnimalId: integer("displayed_animal_id"),
    // 친구 초대 (GAME-09): 온보딩을 마칠 때 만드는 무작위 6자리 (대문자·숫자, 0·O·1·I 없음). 바꾸지 않는다
    inviteCode: text("invite_code").notNull().unique(),
    // 나를 초대한 회원 (온보딩 때 한 번만). 초대한 사람이 탈퇴하면 비운다
    invitedBy: text("invited_by").references(() => users.id, {
      onDelete: "set null",
    }),
    // 초대 보상을 준 시각. NULL에서 한 번만 바뀌므로 친구 1명당 한 번만 지급된다 (GAME-09)
    inviteRewardedAt: timestamp("invite_rewarded_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "profiles_nickname_check",
      sql`char_length(${t.nickname}) BETWEEN 2 AND 12`,
    ),
    check(
      "profiles_invite_code_check",
      sql`${t.inviteCode} ~ '^[A-HJ-NP-Z2-9]{6}$'`,
    ),
    check("profiles_invited_by_check", sql`${t.invitedBy} <> ${t.userId}`), // 자기 자신은 초대할 수 없다
    foreignKey({
      name: "profiles_displayed_animal_owned_fk",
      columns: [t.userId, t.displayedAnimalId],
      foreignColumns: [userAnimals.userId, userAnimals.id],
    }),
    // 보유한 아이템만 장착할 수 있다 (복합 외래 키)
    foreignKey({
      name: "profiles_character_owned_fk",
      columns: [t.userId, t.characterItemId],
      foreignColumns: [userItems.userId, userItems.itemId],
    }),
  ],
);

export const blogs = pgTable(
  "blogs",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    ownerId: text("owner_id")
      .notNull()
      .unique() // 회원당 블로그 1개 (1:1)
      .references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    backgroundItemId: integer("background_item_id").notNull(),
    // 광장 집 지붕 색 (TOWN-07, 무료). NULL = 장착한 배경 색을 따른다. 색 이름은 src/lib/art/town.ts ROOF_COLORS
    roofColor: text("roof_color"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("blogs_slug_check", sql`${t.slug} ~ '^[a-z0-9_]{3,20}$'`),
    check(
      "blogs_roof_color_check",
      sql`${t.roofColor} IN ('red', 'orange', 'yellow', 'green', 'sky', 'blue', 'purple', 'brown')`,
    ),
    check("blogs_title_check", sql`char_length(${t.title}) BETWEEN 1 AND 40`),
    foreignKey({
      name: "blogs_background_owned_fk",
      columns: [t.ownerId, t.backgroundItemId],
      foreignColumns: [userItems.userId, userItems.itemId],
    }),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    blogId: integer("blog_id")
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    unique("categories_blog_name_uq").on(t.blogId, t.name),
    check(
      "categories_name_check",
      sql`char_length(${t.name}) BETWEEN 1 AND 20`,
    ),
  ],
);

// ===== 글 · 교류 =====
export const posts = pgTable(
  "posts",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    blogId: integer("blog_id")
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    contentHtml: text("content_html").notNull(),
    contentText: text("content_text").notNull(), // 태그를 뺀 본문: 요약, 검색, 글자 수 확인용
    visibility: visibility("visibility").notNull().default("public"),
    viewCount: integer("view_count").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("posts_title_check", sql`char_length(${t.title}) BETWEEN 1 AND 100`),
    check("posts_view_count_check", sql`${t.viewCount} >= 0`),
    check("posts_visibility_check", oneOf(t.visibility, VISIBILITIES)),
    index("posts_blog_created_idx").on(t.blogId, t.createdAt.desc()),
    index("posts_visibility_created_idx").on(t.visibility, t.createdAt.desc()),
  ],
);

export const tags = pgTable("tags", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
});

// 글 ↔ 태그 (N:M)
export const postTags = pgTable(
  "post_tags",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.postId, t.tagId] }),
    index("post_tags_tag_idx").on(t.tagId),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    // 작성자가 탈퇴하면 답글이 남은 댓글만 "삭제된 댓글" 자리로 남기고 작성자를 비운다 (AUTH-06)
    authorId: text("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    parentId: integer("parent_id"),
    content: text("content").notNull(),
    createdAt: createdAt(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }), // 답글이 남도록 행은 지우지 않는다
  },
  (t) => [
    foreignKey({
      name: "comments_parent_fk",
      columns: [t.parentId],
      foreignColumns: [t.id],
    }).onDelete("cascade"),
    check(
      "comments_content_check",
      sql`char_length(${t.content}) BETWEEN 1 AND 1000`,
    ),
    check(
      "comments_author_check",
      sql`${t.authorId} IS NOT NULL OR ${t.deletedAt} IS NOT NULL`,
    ), // 작성자 없는 댓글은 삭제된 자리뿐
    index("comments_post_created_idx").on(t.postId, t.createdAt),
  ],
);

// 글 ↔ 공감한 회원 (N:M): 한 글에 한 번만
export const postLikes = pgTable(
  "post_likes",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })],
);

// 회원 ↔ 회원 (자기 참조 N:M): 이웃
export const follows = pgTable(
  "follows",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followeeId: text("followee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // 즐겨찾는 이웃 (TOWN-08): 회원당 최대 10명 (Server Action이 lockUser 안에서 센다). 이웃을 취소하면 행이 지워져 함께 풀린다
    isFavorite: boolean("is_favorite").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followeeId] }),
    check("follows_not_self_check", sql`${t.followerId} <> ${t.followeeId}`),
    index("follows_followee_idx").on(t.followeeId),
  ],
);

// ===== 보상 =====
// 기본 키 (user_id, date) → 하루에 한 번만 출석
export const attendances = pgTable(
  "attendances",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    streak: integer("streak").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.date] }),
    check("attendances_streak_check", sql`${t.streak} >= 1`),
  ],
);

// 경험치·코인 원장: 잔액은 저장하지 않고 합계로 계산한다
export const pointLedger = pgTable(
  "point_ledger",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: ledgerReason("reason").notNull(),
    expDelta: integer("exp_delta").notNull().default(0),
    coinDelta: integer("coin_delta").notNull().default(0),
    refId: text("ref_id"), // 관련 글·댓글·아이템 ID
    createdAt: createdAt(),
  },
  (t) => [
    check("point_ledger_exp_check", sql`${t.expDelta} >= 0`),
    check(
      "point_ledger_nonzero_check",
      sql`${t.expDelta} <> 0 OR ${t.coinDelta} <> 0`,
    ),
    check("point_ledger_reason_check", oneOf(t.reason, LEDGER_REASONS)),
    index("point_ledger_user_reason_created_idx").on(
      t.userId,
      t.reason,
      t.createdAt,
    ),
    index("point_ledger_user_created_idx").on(t.userId, t.createdAt.desc()), // 내역 화면 최신순 (GAME-07)
  ],
);

// ===== 알림함 (GAME-08, GAME-06) =====
// 받는 회원(user_id)에게 생긴 일 한 줄. 레벨업은 actor_id·post_id가 없고 level이 있다
export const notifications = pgTable(
  "notifications",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: notificationKind("kind").notNull(),
    actorId: text("actor_id").references(() => users.id, {
      onDelete: "cascade",
    }), // 행동한 회원 (레벨업은 NULL)
    postId: integer("post_id").references(() => posts.id, {
      onDelete: "cascade",
    }),
    level: integer("level"), // level_up·pet_level_up: 오른 레벨
    refId: text("ref_id"), // 댓글 ID, 동물 ID 등 (종류마다 다름)
    createdAt: createdAt(),
    readAt: timestamp("read_at", { withTimezone: true }), // NULL = 안 읽음. 레벨업은 팝업을 봤을 때도 채운다
  },
  (t) => [
    index("notifications_user_read_created_idx").on(
      t.userId,
      t.readAt,
      t.createdAt.desc(),
    ),
    index("notifications_user_created_idx").on(t.userId, t.createdAt.desc()),
    check("notifications_kind_check", oneOf(t.kind, NOTIFICATION_KINDS)),
    check(
      "notifications_level_check",
      sql`(${t.kind} IN ('level_up', 'pet_level_up')) = (${t.level} IS NOT NULL)`,
    ),
    check(
      "notifications_actor_check",
      sql`${t.actorId} IS NULL OR ${t.actorId} <> ${t.userId}`,
    ),
    // 같은 레벨의 레벨업 알림은 한 번만 (동시에 보상이 와도 두 번 생기지 않게)
    uniqueIndex("notifications_level_up_uq")
      .on(t.userId, t.level)
      .where(sql`${t.kind} = 'level_up'`),
    // 같은 동물의 같은 레벨 알림도 한 번만
    uniqueIndex("notifications_pet_level_up_uq")
      .on(t.userId, t.refId, t.level)
      .where(sql`${t.kind} = 'pet_level_up'`),
  ],
);

// ===== 동물 농장 (TOWN-09) =====
// 동물 종류 카탈로그. 다 자라는 데 필요한 성장치와 다 키웠을 때 보상이 종류마다 다르다
export const animalSpecies = pgTable(
  "animal_species",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    assetKey: text("asset_key").notNull(),
    growExp: integer("grow_exp").notNull(), // 다 자라는 데 필요한 성장치
    rewardExp: integer("reward_exp").notNull(), // 다 키웠을 때 받는 경험치
    rewardCoins: integer("reward_coins").notNull(),
    hatchWeight: integer("hatch_weight").notNull(), // 알에서 나올 확률 비중 (클수록 흔함)
    maxLevel: integer("max_level").notNull().default(5), // 다 자란 레벨. 성장치 grow_exp를 이 레벨까지 나눠 쓴다 (src/lib/farm.ts)
  },
  (t) => [
    check("animal_species_grow_check", sql`${t.growExp} > 0`),
    check(
      "animal_species_reward_check",
      sql`${t.rewardExp} >= 0 AND ${t.rewardCoins} >= 0`,
    ),
    check("animal_species_weight_check", sql`${t.hatchWeight} > 0`),
    check(
      "animal_species_max_level_check",
      sql`${t.maxLevel} >= 2 AND ${t.maxLevel} < ${t.growExp}`,
    ),
  ],
);

// 회원이 가진 알·동물. 알일 때는 종류가 정해지지 않았다가 부화할 때 랜덤으로 정해진다
export const userAnimals = pgTable(
  "user_animals",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    speciesId: integer("species_id").references(() => animalSpecies.id),
    status: animalStatus("status").notNull().default("egg"),
    growth: integer("growth").notNull().default(0),
    source: eggSource("source").notNull(),
    sourceLevel: integer("source_level"), // 레벨 보상 알이면 몇 레벨 보상인지
    // 부화할 때 정해지는 펫 정보: 이름(기본 = 종류 이름, 1~10자), 성별(랜덤). 알이면 둘 다 NULL
    name: text("name"),
    gender: animalGender("gender"),
    accessory: petAccessory("accessory").notNull().default("none"),
    carried: boolean("carried").notNull().default(false), // 데리고 다니는 펫 (회원당 한 마리)
    createdAt: createdAt(),
    hatchedAt: timestamp("hatched_at", { withTimezone: true }), // 만난 날
    grownAt: timestamp("grown_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "user_animals_species_check",
      sql`(${t.status} = 'egg') = (${t.speciesId} IS NULL)`,
    ),
    check(
      "user_animals_pet_check",
      sql`(${t.status} = 'egg') = (${t.name} IS NULL) AND (${t.name} IS NULL) = (${t.gender} IS NULL)`,
    ),
    check(
      "user_animals_name_check",
      sql`char_length(${t.name}) BETWEEN 1 AND 10`,
    ),
    check(
      "user_animals_carried_check",
      sql`NOT ${t.carried} OR ${t.status} <> 'egg'`,
    ),
    // 프로필 전시 카드의 복합 외래 키 대상
    unique("user_animals_user_id_uq").on(t.userId, t.id),
    // 데리고 다니는 펫은 회원당 한 마리
    uniqueIndex("user_animals_carried_uq")
      .on(t.userId)
      .where(sql`${t.carried}`),
    check("user_animals_growth_check", sql`${t.growth} >= 0`),
    check("user_animals_status_check", oneOf(t.status, ANIMAL_STATUSES)),
    check("user_animals_source_check", oneOf(t.source, EGG_SOURCES)),
    check("user_animals_gender_check", oneOf(t.gender, ANIMAL_GENDERS)),
    check("user_animals_accessory_check", oneOf(t.accessory, PET_ACCESSORIES)),
    check(
      "user_animals_level_check",
      sql`(${t.source} = 'level') = (${t.sourceLevel} IS NOT NULL)`,
    ),
    // 첫 알은 한 번, 레벨 보상 알은 레벨마다 한 번만
    uniqueIndex("user_animals_starter_uq")
      .on(t.userId)
      .where(sql`${t.source} = 'starter'`),
    uniqueIndex("user_animals_level_uq")
      .on(t.userId, t.sourceLevel)
      .where(sql`${t.source} = 'level'`),
    index("user_animals_user_status_idx").on(t.userId, t.status),
  ],
);

// 돌보기 기록: 동물 한 마리에 같은 돌보기는 하루 한 번
export const animalCares = pgTable(
  "animal_cares",
  {
    animalId: integer("animal_id")
      .notNull()
      .references(() => userAnimals.id, { onDelete: "cascade" }),
    action: careAction("action").notNull(),
    date: date("date").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.animalId, t.action, t.date] }),
    check("animal_cares_action_check", oneOf(t.action, CARE_ACTIONS)),
  ],
);

// 농장 가방: 회원이 가진 농장 아이템 개수 (지금은 물약만). 살 때 +1, 쓸 때 −1
export const farmItems = pgTable(
  "farm_items",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: farmItemKind("kind").notNull(),
    quantity: integer("quantity").notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.kind] }),
    check("farm_items_quantity_check", sql`${t.quantity} >= 0`),
    check("farm_items_kind_check", oneOf(t.kind, FARM_ITEM_KINDS)),
  ],
);

// 글 첨부(사진·파일) 정보. 파일 내용은 DB가 아니라 저장소(src/server/storage.ts)에 둔다 (POST-07, POST-09)
export const attachments = pgTable(
  "attachments",
  {
    key: text("key").primaryKey(), // 서버가 만든 무작위 32자. 저장 이름이자 주소(/files/키)
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // image | file
    name: text("name").notNull(), // 올린 사람이 붙인 원래 파일 이름 (내려받을 때 이 이름으로)
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check("attachments_kind_check", sql`${t.kind} IN ('image', 'file')`),
    check("attachments_key_check", sql`${t.key} ~ '^[a-f0-9]{32}$'`),
    check(
      "attachments_name_check",
      sql`char_length(${t.name}) BETWEEN 1 AND 255`,
    ),
    check("attachments_size_check", sql`${t.size} > 0`),
    index("attachments_user_created_idx").on(t.userId, t.createdAt),
  ],
);

// ===== 방문자 수 · 조회수 (BLOG-06, POST-06) =====
// 같은 사람 = 온보딩을 마친 회원은 `u:회원ID`, 방문자(로그인 안 함·온보딩 전)는 브라우저 식별 쿠키 `b:UUID`.
// 기본 키가 (대상, 한국 날짜, 사람)이라 같은 사람은 하루 한 번만 남는다. IP는 저장하지 않는다
const viewerKeyCheck = (col: unknown) =>
  sql`${col} ~ '^(u:[A-Za-z0-9_-]{1,64}|b:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|w:[0-9a-f]{32})$'`;

export const blogVisits = pgTable(
  "blog_visits",
  {
    blogId: integer("blog_id")
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    visitorKey: text("visitor_key").notNull(), // 탈퇴한 회원의 키는 w:무작위로 바꿔 숫자만 남긴다
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.blogId, t.date, t.visitorKey] }),
    check("blog_visits_visitor_key_check", viewerKeyCheck(t.visitorKey)),
  ],
);

export const postViews = pgTable(
  "post_views",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    viewerKey: text("viewer_key").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.postId, t.date, t.viewerKey] }),
    check("post_views_viewer_key_check", viewerKeyCheck(t.viewerKey)),
  ],
);

// ===== 로그인 시도 제한 (NF-10) =====
// 같은 아이디로 5번 연속 실패하면 5분 동안 막는다. 없는 아이디도 똑같이 센다 (그래서 users를 가리키지 않는다)
export const loginAttempts = pgTable(
  "login_attempts",
  {
    loginKey: text("login_key").primaryKey(), // 소문자로 바꾼 아이디 (이메일 로그인이면 이메일)
    failures: integer("failures").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    updatedAt: updatedAt(),
  },
  (t) => [check("login_attempts_failures_check", sql`${t.failures} >= 0`)],
);
