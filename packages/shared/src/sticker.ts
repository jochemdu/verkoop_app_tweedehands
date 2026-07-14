// Pure sticker-ID helpers. Sticker-ID's zijn 4-cijferige zero-padded strings
// ("0000".."9999"). Geen side effects — makkelijk testbaar en herbruikbaar in
// zowel web (bulk route) als andere consumers.

const MAX_STICKER = 9999;

/** Pad een nummer tot een 4-cijferige sticker-ID, bv. 42 -> "0042". */
export function padSticker(n: number): string {
  return String(n).padStart(4, "0");
}

/**
 * Bouw een reeks opeenvolgende padded sticker-ID's vanaf `start` voor `count`
 * items. Stopt bij 9999 (overschrijdt "9999" nooit).
 *   stickerRange(42, 3)   => ["0042","0043","0044"]
 *   stickerRange(9998, 5) => ["9998","9999"]
 */
export function stickerRange(start: number, count: number): string[] {
  const result: string[] = [];
  if (count < 0) return result;
  let cur = start;
  for (let i = 0; i < count; i++) {
    if (cur > MAX_STICKER) break;
    result.push(padSticker(cur));
    cur++;
  }
  return result;
}
