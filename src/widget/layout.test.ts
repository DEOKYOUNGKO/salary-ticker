import { describe, expect, it } from "vitest";
import { amountFontSize, layoutTier, showTodayLabel, WIDGET_MAX, WIDGET_MIN } from "./layout";

const DIGIT_EM = 0.6;
const PUNCT_EM = 0.32;

/** 글자 크기 size에서 금액+원이 차지하는 어림 폭 */
function textWidth(text: string, size: number) {
  const em = [...text].reduce((s, c) => s + (/\d/.test(c) ? DIGIT_EM : PUNCT_EM), 1.0);
  return em * size;
}

describe("layoutTier", () => {
  it("최대 크기는 전체, 최소 크기는 금액만", () => {
    expect(layoutTier(WIDGET_MAX.width, WIDGET_MAX.height)).toBe("full");
    expect(layoutTier(WIDGET_MIN.width, WIDGET_MIN.height)).toBe("small");
  });

  it("중간 크기는 하단 통계를 숨기는 medium", () => {
    expect(layoutTier(300, 199)).toBe("medium");
    expect(layoutTier(260, 150)).toBe("medium");
    expect(layoutTier(220, 120)).toBe("medium");
  });

  it("높이나 너비가 모자라면 small", () => {
    expect(layoutTier(340, 119)).toBe("small");
    expect(layoutTier(219, 230)).toBe("small");
  });

  it("medium에서 라벨은 높이 150 이상일 때만", () => {
    expect(showTodayLabel("full", 230)).toBe(true);
    expect(showTodayLabel("medium", 150)).toBe(true);
    expect(showTodayLabel("medium", 149)).toBe(false);
    expect(showTodayLabel("small", 100)).toBe(false);
  });
});

describe("amountFontSize", () => {
  it("최대 크기에서는 30px", () => {
    expect(amountFontSize("123,456.78", 340, 230)).toBe(30);
  });

  it("창이 작아지면 글자도 작아진다", () => {
    const big = amountFontSize("123,456.78", 340, 230);
    const mid = amountFontSize("123,456.78", 240, 130);
    const small = amountFontSize("123,456.78", 180, 44);
    expect(mid).toBeLessThanOrEqual(big);
    expect(small).toBeLessThan(big);
    expect(small).toBeGreaterThanOrEqual(14);
  });

  it("최소 크기(180x44)에서도 금액 한 줄이 가로·세로로 들어간다", () => {
    for (const text of ["0.00", "123,456.78", "1,234,567.89"]) {
      const size = amountFontSize(text, WIDGET_MIN.width, WIDGET_MIN.height);
      expect(textWidth(text, size)).toBeLessThanOrEqual(WIDGET_MIN.width - 26);
      expect(size * 1.15).toBeLessThanOrEqual(WIDGET_MIN.height - 12);
    }
  });

  it("자릿수가 늘어나면 글자를 줄여서 맞춘다", () => {
    expect(amountFontSize("12,345,678.90", 200, 60)).toBeLessThan(
      amountFontSize("12,345.67", 200, 60),
    );
  });

  it("14px 아래로는 줄이지 않는다", () => {
    expect(amountFontSize("999,999,999,999,999.99", 180, 44)).toBe(14);
  });
});
