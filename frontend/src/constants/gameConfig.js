export const ROUND_DURATION_OPTIONS = Array.from(
  { length: 10 },
  (_, index) => (index + 1) * 30,
);

export const DEMO_CARDS = [
  {
    guess: "Volcano",
    taboo: ["Lava", "Erupt", "Mountain", "Ash", "Magma"],
  },
  {
    guess: "Astronaut",
    taboo: ["Space", "Rocket", "Moon", "Suit", "NASA"],
  },
  {
    guess: "Piano",
    taboo: ["Music", "Keys", "Instrument", "Play", "Keyboard"],
  },
  {
    guess: "Pirate",
    taboo: ["Ship", "Treasure", "Ocean", "Captain", "Parrot"],
  },
];
