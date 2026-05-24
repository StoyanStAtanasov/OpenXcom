export const DIFFICULTY_COEFFICIENT = [0, 1, 2, 3, 4];

export function resetDifficultyCoefficients(): void {
  for (let i = 0; i < DIFFICULTY_COEFFICIENT.length; ++i) {
    DIFFICULTY_COEFFICIENT[i] = i;
  }
}

export function setDifficultyCoefficient(index: number, value: number): void {
  const normalized = Math.trunc(index);
  if (normalized >= 0 && normalized < DIFFICULTY_COEFFICIENT.length) {
    DIFFICULTY_COEFFICIENT[normalized] = Math.trunc(value);
  }
}

export function getDifficultyCoefficient(difficulty: number): number {
  const normalized = Math.min(Math.trunc(difficulty), DIFFICULTY_COEFFICIENT.length - 1);
  return DIFFICULTY_COEFFICIENT[Math.max(0, normalized)];
}
