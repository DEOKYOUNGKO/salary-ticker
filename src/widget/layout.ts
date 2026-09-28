/** 위젯 창 크기에 따른 표시 단계와 금액 글자 크기 (순수 함수). */

/** src-tauri의 widget_options.rs, tauri.conf.json 위젯 최소/최대 크기와 같은 값 (논리 px) */
export const WIDGET_MAX = { width: 340, height: 230 } as const;
export const WIDGET_MIN = { width: 180, height: 44 } as const;

/**
 * full: 전체 표시
 * medium: 하단 누적·초당·시급 숨김
 * small: 오늘 번 돈 금액만 (버튼 없음, 카드 전체로 드래그 이동)
 */
export type LayoutTier = "full" | "medium" | "small";

const FULL_MIN = { width: 300, height: 200 };
const MEDIUM_MIN = { width: 220, height: 120 };
/** medium에서 "오늘 번 돈" 라벨까지 보여 줄 최소 높이 */
const MEDIUM_LABEL_MIN_HEIGHT = 150;

export function layoutTier(width: number, height: number): LayoutTier {
  if (width >= FULL_MIN.width && height >= FULL_MIN.height) return "full";
  if (width >= MEDIUM_MIN.width && height >= MEDIUM_MIN.height) return "medium";
  return "small";
}

export function showTodayLabel(tier: LayoutTier, height: number): boolean {
  return tier === "full" || (tier === "medium" && height >= MEDIUM_LABEL_MIN_HEIGHT);
}

const FONT_MIN = 14;
const FONT_MAX = 30;
/** 숫자 폭(em) 어림값: 굵은 고정폭 숫자, 쉼표·마침표 */
const DIGIT_EM = 0.6;
const PUNCT_EM = 0.32;
/** "원"(0.55em 크기) + 간격 */
const UNIT_EM = 1.0;
/** 카드 좌우 안쪽 여백 + 테두리 */
const PADDING_X: Record<LayoutTier, number> = { full: 34, medium: 34, small: 26 };
/** medium에서 금액 외 요소(헤더, 진행 바, 남은 시간, 여백)가 차지하는 높이 */
const MEDIUM_OTHER_HEIGHT = 92;
const LABEL_HEIGHT = 16;
const SMALL_PADDING_Y = 12;
const LINE_HEIGHT = 1.15;

/** 금액 문자열(예: "123,456.78")이 창에 한 줄로 들어가는 글자 크기(px) */
export function amountFontSize(text: string, width: number, height: number): number {
  const tier = layoutTier(width, height);
  const em = [...text].reduce((sum, c) => sum + (/\d/.test(c) ? DIGIT_EM : PUNCT_EM), UNIT_EM);
  const byWidth = (width - PADDING_X[tier]) / em;

  let byHeight: number;
  if (tier === "full") byHeight = FONT_MAX;
  else if (tier === "medium") {
    const label = showTodayLabel(tier, height) ? LABEL_HEIGHT : 0;
    byHeight = (height - MEDIUM_OTHER_HEIGHT - label) / LINE_HEIGHT;
  } else byHeight = (height - SMALL_PADDING_Y) / LINE_HEIGHT;

  return Math.max(FONT_MIN, Math.min(FONT_MAX, Math.floor(Math.min(byWidth, byHeight))));
}
