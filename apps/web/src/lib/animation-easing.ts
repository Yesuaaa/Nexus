// Match the polynomial curves used by the original GSAP tweens.
export const cubicOut = (progress: number) => 1 - (1 - progress) ** 3
export const quarticOut = (progress: number) => 1 - (1 - progress) ** 4
export const quarticInOut = (progress: number) =>
  progress < 0.5 ? 8 * progress ** 4 : 1 - (-2 * progress + 2) ** 4 / 2
