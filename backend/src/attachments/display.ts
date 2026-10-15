// 글 사진의 "보여 주기용" 사본 (2026-10-15, 갤럭시 폰에서 사진이 한 줄씩 늦게 뜬다는 제보).
// 휴대폰 사진 원본은 4000px·3~10MB라서 느린 폰·데이터에서는 위에서부터 한 줄씩 그려진다.
// 글 화면에는 원본 대신 긴 쪽을 줄이고 다시 압축한 사본을 보낸다:
// - 불투명한 사진 → 점진적(progressive) JPEG: 받는 동안 흐린 전체 모습이 먼저 뜨고 점점 또렷해진다
//   (화면 캡처 같은 PNG는 글자가 번지지 않게 색을 덜 줄이고 조금 더 높은 화질로)
// - 투명한 부분이 있는 PNG·WEBP → WEBP (투명함을 지킨다)
// - GIF(움직이는 그림)는 그대로 둔다
// 원본은 지우지 않는다. 사본은 올릴 때 만들고, 그 전에 올린 사진은 처음 열 때 한 번 만들어 둔다.
import sharp from "sharp";
import { findView, readAttachment, saveView, type ViewFormat } from "./storage";

// 공용 서버라 사진 변환은 한 번에 하나만, 변환 캐시는 쓰지 않는다 (메모리를 적게)
sharp.concurrency(1);
sharp.cache(false);

/** 글 본문은 화면에서 최대 약 720px 너비라, 2배 화면(휴대폰)까지 또렷한 1600px로 줄인다. 세로로 긴 캡처는 높이를 넉넉히 */
export const DISPLAY_MAX_WIDTH = 1600;
export const DISPLAY_MAX_HEIGHT = 4800;

export type DisplayImage = { bytes: Uint8Array; mime: "image/jpeg" | "image/webp" };

/**
 * 보여 주기용 사본을 만든다. 원본이 GIF이거나, 줄여도 원본보다 작아지지 않으면 null (원본을 그대로 보낸다)
 */
export async function makeDisplayImage(original: Uint8Array): Promise<DisplayImage | null> {
  const meta = await sharp(original).metadata();
  if (meta.format === "gif") return null;
  const image = sharp(original, { failOn: "none" })
    .rotate() // 휴대폰 사진의 회전 정보(EXIF)대로 바로 세운다 (사본에는 회전 정보가 없으므로)
    .resize({ width: DISPLAY_MAX_WIDTH, height: DISPLAY_MAX_HEIGHT, fit: "inside", withoutEnlargement: true });
  const out: DisplayImage = meta.hasAlpha
    ? { bytes: await image.webp({ quality: 85 }).toBuffer(), mime: "image/webp" }
    : {
        bytes: await image
          .jpeg(
            meta.format === "png"
              ? { quality: 85, chromaSubsampling: "4:4:4", progressive: true, mozjpeg: true }
              : { quality: 80, progressive: true, mozjpeg: true },
          )
          .toBuffer(),
        mime: "image/jpeg",
      };
  // 이미 작은 사진은 다시 압축해 봐야 이득이 없다. 원본이 줄일 크기보다 크면(회전 정보 때문에) 사본을 쓴다
  const bigger = (meta.width ?? 0) > DISPLAY_MAX_WIDTH || (meta.height ?? 0) > DISPLAY_MAX_HEIGHT;
  if (!bigger && out.bytes.length >= original.length * 0.9) return null;
  return out;
}

/** 사본을 만들어 저장한다 (올릴 때). 실패해도 글쓰기는 막지 않는다: 처음 열 때 다시 만들어 본다 */
export async function storeDisplayImage(key: string, original: Uint8Array): Promise<ViewFormat | null> {
  try {
    // 읽지 못하는 사진이면 원본을 그대로 보내고, 열 때마다 다시 만들어 보지 않게 "none"을 남긴다
    const view = await makeDisplayImage(original).catch((err) => {
      console.error("사진 사본 만들기 실패", key, err);
      return null;
    });
    const format: ViewFormat = !view ? "none" : view.mime === "image/webp" ? "webp" : "jpg";
    await saveView(key, format, view?.bytes ?? new Uint8Array());
    return format;
  } catch (err) {
    console.error("사진 사본 저장 실패", key, err);
    return null;
  }
}

/** 이미 만든 사본, 없으면 지금 만든다 (이 기능 전에 올린 사진). 만들 수 없으면 null: 원본을 보낸다 */
export async function ensureDisplayImage(key: string): Promise<{ format: ViewFormat; size: number } | null> {
  const found = await findView(key);
  if (found) return found;
  const original = await readAttachment(key);
  if (!original) return null;
  if (!(await storeDisplayImage(key, original))) return null;
  return findView(key);
}
