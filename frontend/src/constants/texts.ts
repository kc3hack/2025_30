export const STANDARD_TEXTS = [
  "明日の天気はどうなるのかな",
  "このラーメン、とても美味しいですね",
  "今日は早く帰りたいです",
  "電車が遅れて困っています",
  "週末は友達と買い物に行きます",
] as const;

export const getRandomStandardText = () => {
  const randomIndex = Math.floor(Math.random() * STANDARD_TEXTS.length);
  return STANDARD_TEXTS[randomIndex];
};