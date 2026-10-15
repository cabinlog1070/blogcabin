// 첨부 파일 저장소. 지금은 서버 디스크(UPLOAD_DIR, 기본 frontend/storage/uploads)에 둔다.
// 서버(올리기)와 화면(내려받기·탈퇴 때 지우기)이 같은 폴더를 쓴다. 운영은 UPLOAD_DIR=/data/uploads (두 컨테이너가 같은 볼륨)
// 배포 서비스가 정해지면(NF-08) 이 파일만 바꿔서 Vercel Blob 같은 저장소로 옮긴다 (POST-07 열린 질문)
import "server-only";
import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { ATTACHMENT_KEY_RE } from "./rules";

// 기본값은 화면 폴더 기준: frontend/에서 돌든(화면) backend/에서 돌든(서버) 같은 곳을 가리킨다
const ROOT = path.resolve(process.env.UPLOAD_DIR || "../frontend/storage/uploads");

function filePath(key: string) {
  // 키는 서버가 만든 32자 16진수뿐이라 경로를 벗어날 수 없지만, 한 번 더 막는다
  if (!ATTACHMENT_KEY_RE.test(key)) throw new Error("잘못된 파일 키");
  return path.join(ROOT, key);
}

/** 새 파일 저장. 같은 키가 이미 있으면 덮어쓰지 않고 실패한다 */
export async function saveAttachment(key: string, bytes: Uint8Array) {
  await mkdir(ROOT, { recursive: true });
  await writeFile(filePath(key), bytes, { flag: "wx" });
}

/** 파일 내용을 스트림으로. 없으면 null */
export async function openAttachment(key: string): Promise<ReadableStream | null> {
  const p = filePath(key);
  try {
    await stat(p);
  } catch {
    return null;
  }
  return Readable.toWeb(createReadStream(p)) as ReadableStream;
}

/** 원본 파일 내용 전체. 없으면 null (보여 주기용 사본을 만들 때) */
export async function readAttachment(key: string): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await readFile(filePath(key)));
  } catch {
    return null;
  }
}

// 사진의 보여 주기용 사본 (display.ts): 원본 옆에 "키.view.jpg"·"키.view.webp"로 둔다.
// 원본이 더 나아서 사본이 없으면 "키.view.none"을 남겨 다음에 다시 만들어 보지 않는다
export type ViewFormat = "jpg" | "webp" | "none";
const VIEW_FORMATS: ViewFormat[] = ["jpg", "webp", "none"];
const viewPath = (key: string, format: ViewFormat) => `${filePath(key)}.view.${format}`;

/** 저장된 사본. 아직 만들지 않았으면 null */
export async function findView(key: string): Promise<{ format: ViewFormat; size: number } | null> {
  for (const format of VIEW_FORMATS) {
    try {
      return { format, size: (await stat(viewPath(key, format))).size };
    } catch {
      // 다음 형식
    }
  }
  return null;
}

/** 사본 저장. 두 서버 API가 같은 사진을 동시에 만들어도 반쯤 쓴 파일이 보이지 않게 임시 이름에 쓰고 바꾼다 */
export async function saveView(key: string, format: ViewFormat, bytes: Uint8Array) {
  const target = viewPath(key, format);
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, bytes);
  await rename(temp, target);
}

export function openView(key: string, format: ViewFormat): ReadableStream {
  return Readable.toWeb(createReadStream(viewPath(key, format))) as ReadableStream;
}

/** 파일 지우기 (회원 탈퇴 AUTH-06). 사진의 사본도 같이. 이미 없으면 그냥 넘어간다 */
export async function deleteAttachment(key: string) {
  await rm(filePath(key), { force: true });
  for (const format of VIEW_FORMATS) await rm(viewPath(key, format), { force: true });
}
