// 경험치·코인 내역 (GAME-07): GET /api/v1/wallet?page=
// { wallet: { level, exp, coins … }, ledger: { rows, total, page, pageCount } }
import { Hono } from "hono";
import { listLedger } from "../game/ledger";
import { getWallet } from "../game/points";
import { requireViewer, type GuardEnv } from "../http/guard";
import { parseId } from "../lib/ids";

export const walletRoutes = new Hono<GuardEnv>().get("/", requireViewer("member"), async (c) => {
  const { userId } = c.get("viewer");
  const page = parseId(c.req.query("page")) ?? 1;
  const [wallet, ledger] = await Promise.all([getWallet(userId), listLedger(userId, page)]);
  return c.json({ wallet, ledger });
});
