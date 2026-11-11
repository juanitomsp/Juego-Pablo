/** Posiciones de los palos (centro) en una carta de 100×150, como en la baraja española tradicional. */
const L = 32,
  R = 68,
  C = 50;

export const PIPS: Record<number, [number, number][]> = {
  1: [[C, 78]],
  2: [
    [C, 44],
    [C, 112],
  ],
  3: [
    [C, 38],
    [C, 78],
    [C, 118],
  ],
  4: [
    [L, 46],
    [R, 46],
    [L, 110],
    [R, 110],
  ],
  5: [
    [L, 44],
    [R, 44],
    [C, 78],
    [L, 112],
    [R, 112],
  ],
  6: [
    [L, 40],
    [R, 40],
    [L, 78],
    [R, 78],
    [L, 116],
    [R, 116],
  ],
  7: [
    [L, 36],
    [R, 36],
    [C, 57],
    [L, 78],
    [R, 78],
    [L, 120],
    [R, 120],
  ],
};

export const pipSize = (rank: number) => (rank === 1 ? 60 : rank <= 3 ? 32 : 27);
