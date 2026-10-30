const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const NUMBERS = "23456789";
const SYMBOLS = "!@#$%^&*()_-+=?.";
const AMBIGUOUS = /[Il1O0o]/g;

const WORDS = [
  "amber", "atlas", "aurora", "bamboo", "beacon", "berry", "bloom", "breeze",
  "canyon", "cedar", "chai", "cobalt", "comet", "coral", "cosmos", "dahlia",
  "dawn", "dune", "ember", "fable", "fern", "fig", "fjord", "glow",
  "harbor", "hazel", "indigo", "island", "jade", "juniper", "koi", "lagoon",
  "lantern", "lilac", "lotus", "lumen", "maple", "meadow", "mint", "moon",
  "moss", "nectar", "nova", "oasis", "olive", "onyx", "orbit", "pebble",
  "pepper", "petal", "pine", "plum", "quartz", "rain", "river", "rosette",
  "saffron", "sage", "sand", "silk", "sky", "solar", "sparrow", "spruce",
  "stone", "studio", "sunset", "teal", "terra", "thistle", "tide", "tulip",
  "umber", "velvet", "violet", "willow", "zenith", "zephyr",
];

function secureRandomInt(max: number) {
  if (max <= 0) return 0;
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const array = new Uint32Array(1);
    const limit = Math.floor(0xffffffff / max) * max;
    let value = 0;
    do {
      crypto.getRandomValues(array);
      value = array[0];
    } while (value >= limit);
    return value % max;
  }
  return Math.floor(Math.random() * max);
}

export type GeneratorOptions = {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  numbers: boolean;
  symbols: boolean;
  avoidAmbiguous: boolean;
};

export const defaultGeneratorOptions: GeneratorOptions = {
  length: 22,
  lowercase: true,
  uppercase: true,
  numbers: true,
  symbols: true,
  avoidAmbiguous: true,
};

export function generatePassword(options: GeneratorOptions = defaultGeneratorOptions) {
  let pools = "";
  if (options.lowercase) pools += LOWER;
  if (options.uppercase) pools += UPPER;
  if (options.numbers) pools += NUMBERS;
  if (options.symbols) pools += SYMBOLS;
  if (options.avoidAmbiguous) pools = pools.replace(AMBIGUOUS, "");
  if (!pools) pools = LOWER;
  const length = Math.max(8, Math.min(64, options.length));
  let output = "";
  for (let i = 0; i < length; i += 1) output += pools[secureRandomInt(pools.length)];

  // Guarantee every enabled pool is represented.
  const required = [
    options.lowercase ? LOWER : "",
    options.uppercase ? UPPER : "",
    options.numbers ? NUMBERS : "",
    options.symbols ? SYMBOLS : "",
  ].filter(Boolean);
  required.forEach((pool, index) => {
    const clean = options.avoidAmbiguous ? pool.replace(AMBIGUOUS, "") : pool;
    if (clean && index < length) {
      const chars = output.split("");
      chars[index] = clean[secureRandomInt(clean.length)];
      output = chars.join("");
    }
  });
  return output;
}

export function generatePassphrase(wordCount = 5, separator = "-", capitalize = true) {
  const words: string[] = [];
  for (let i = 0; i < wordCount; i += 1) {
    const word = WORDS[secureRandomInt(WORDS.length)];
    words.push(capitalize ? word[0].toUpperCase() + word.slice(1) : word);
  }
  return words.join(separator) + "!" + secureRandomInt(90 + 10);
}

export function passwordStrength(password: string) {
  let points = 0;
  if (password.length >= 12) points += 1;
  if (password.length >= 18) points += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points += 1;
  if (/\d/.test(password)) points += 1;
  if (/[^A-Za-z0-9]/.test(password)) points += 1;
  const score = Math.max(1, Math.min(4, Math.round((points / 5) * 4) || 1));
  return {
    score,
    label: score >= 4 ? "Excellent" : score === 3 ? "Strong" : score === 2 ? "Fair" : "Weak",
    color: score >= 4 ? "var(--success)" : score === 3 ? "var(--success)" : score === 2 ? "var(--warning)" : "var(--danger)",
    entropy: Math.round(password.length * Math.log2(Math.max(new Set(password).size, 2))),
  };
}
