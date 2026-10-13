"use client";

import { useEffect } from "react";

/** 알림 문구가 잠깐 보이고 사라지는 시간. 화면마다 같은 값을 쓴다 */
export const NOTICE_MS = 3000;

/**
 * 알림 문구(성공·실패 모두)를 NOTICE_MS 뒤에 저절로 지운다. 새 문구가 오면 다시 센다.
 * value가 비어 있으면(null·false·"") 아무것도 하지 않는다.
 */
export function useAutoClear(value: unknown, clear: () => void, ms = NOTICE_MS) {
  useEffect(() => {
    if (!value) return;
    const timer = setTimeout(clear, ms);
    return () => clearTimeout(timer);
    // clear는 setState를 감싼 함수라 바뀌어도 다시 셀 필요가 없다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, ms]);
}
