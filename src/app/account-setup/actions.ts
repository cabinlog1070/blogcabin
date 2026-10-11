"use server";

import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { loginAttempts } from "@/db/schema";
import { auth, LOGIN_LOCKED_CODE, LOGIN_LOCKED_MESSAGE } from "@/lib/auth";
import { authErrorCode, newLoginSchema, USERNAME_RULE_MESSAGE } from "@/lib/login-rules";
import { MergeRefused, mergeSocialOnlyUser } from "@/server/account-merge";
import { needsAccountSetup, requireSignedIn } from "@/server/dal";
import { grantSocialLinkReward, grantSocialLinkRewardsFor } from "@/server/points";

export type SetupState = { error?: string; values?: { username: string } };

/** 이 화면은 아이디·비밀번호가 없는 회원만 쓴다. 이미 있으면 광장으로 */
async function setupViewer() {
  const viewer = await requireSignedIn();
  if (!(await needsAccountSetup())) redirect("/town");
  return viewer;
}

/**
 * [새로 시작해요] 소셜로 처음 들어온 회원이 아이디·비밀번호를 정한다 (회원가입과 같은 규칙).
 * 아이디를 먼저 저장하고(겹치거나 남겨 둔 아이디면 여기서 멈춘다) 비밀번호를 넣는다
 */
export async function createLogin(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const viewer = await setupViewer();
  const raw = {
    username: String(formData.get("username") ?? ""),
    password: String(formData.get("password") ?? ""),
    passwordConfirm: String(formData.get("passwordConfirm") ?? ""),
  };
  const parsed = newLoginSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: { username: raw.username } };
  const { username, password } = parsed.data;
  const values = { username: raw.username };
  const h = await headers();

  try {
    // username 플러그인이 형식·중복을, databaseHooks.user.update.before(assertUsernameAllowed)가 남겨 둔 아이디를 막는다
    await auth.api.updateUser({ body: { username, displayUsername: username }, headers: h });
  } catch (err) {
    const code = err instanceof APIError ? authErrorCode(err) : undefined;
    if (code === "USERNAME_IS_ALREADY_TAKEN") return { error: "이미 있는 아이디예요", values };
    if (code === "INVALID_USERNAME" || code === "USERNAME_TOO_SHORT" || code === "USERNAME_TOO_LONG") return { error: USERNAME_RULE_MESSAGE, values };
    throw err;
  }
  await auth.api.setPassword({ body: { newPassword: password }, headers: h });
  // 회원가입처럼, 이 아이디로 쌓여 있던 로그인 실패 횟수는 지운다
  await db.delete(loginAttempts).where(eq(loginAttempts.loginKey, username));

  // 이미 주민 등록을 마친 소셜 회원(이 화면이 생기기 전 가입)은 여기서 그 소셜 몫 🪙 100. 주민 등록 전이면 등록을 마칠 때 받는다
  await grantSocialLinkRewardsFor(viewer.userId);

  revalidatePath("/", "layout");
  redirect(viewer.profile ? "/town" : "/onboarding");
}

/**
 * [이미 아이디가 있어요] 기존 아이디·비밀번호로 확인하고, 방금 들어온 소셜 계정을 그 회원으로 옮긴다.
 * 확인은 auth.api.signInUsername으로 한다 → 로그인과 같은 시도 제한(5번 실패하면 5분, src/lib/auth.ts loginHooks)이 걸리고,
 * 성공하면 nextCookies가 브라우저 로그인을 기존 회원으로 바꾼다
 */
export async function linkExisting(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const viewer = await setupViewer();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const values = { username };
  if (!username || !password) return { error: "아이디와 비밀번호를 적어 주세요", values };
  if (viewer.profile) {
    // 이미 주민 등록을 마친 회원은 집·글이 있어서 다른 아이디와 합치지 않는다
    return { error: "이미 주민 등록을 마쳐서 다른 아이디와 합칠 수 없어요. [새로 시작해요]에서 아이디를 만들어 주세요", values };
  }

  let existingId: string;
  try {
    const result = await auth.api.signInUsername({ body: { username, password }, headers: await headers() });
    if (!result) return { error: "아이디 또는 비밀번호가 맞지 않아요", values };
    existingId = result.user.id;
  } catch (err) {
    if (err instanceof APIError && authErrorCode(err) === LOGIN_LOCKED_CODE) return { error: LOGIN_LOCKED_MESSAGE, values };
    if (err instanceof APIError) return { error: "아이디 또는 비밀번호가 맞지 않아요", values };
    throw err;
  }

  // 지금 회원 그대로면 옮길 것이 없다
  if (existingId === viewer.userId) {
    revalidatePath("/", "layout");
    redirect("/town");
  }

  let merged: Awaited<ReturnType<typeof mergeSocialOnlyUser>>;
  try {
    merged = await mergeSocialOnlyUser(viewer.userId, existingId);
  } catch (err) {
    if (err instanceof MergeRefused) {
      // 확인 사이에 주민 등록·아이디가 생긴 경우. 브라우저는 이미 기존 회원으로 로그인됐다
      revalidatePath("/", "layout");
      redirect("/account-setup/done?refused=1");
    }
    throw err;
  }
  const rewarded: string[] = [];
  for (const a of merged.moved) if (await grantSocialLinkReward(existingId, a.providerId, a.accountId)) rewarded.push(a.providerId);

  revalidatePath("/", "layout");
  const q = new URLSearchParams();
  if (merged.moved.length) q.set("moved", merged.moved.map((a) => a.providerId).join(","));
  if (merged.skipped.length) q.set("skipped", merged.skipped.join(","));
  if (rewarded.length) q.set("rewarded", rewarded.join(","));
  redirect(`/account-setup/done?${q}`);
}
