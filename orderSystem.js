/**
 * ALIEN CAFE ORDER GENERATION & GRADING SYSTEM
 * =============================================
 * A modular system for generating distorted matcha orders and grading player accuracy.
 * Framework-agnostic ES6 code suitable for vanilla JS, p5.js, or other environments.
 */

// ============================================================================
// SEEDED RNG UTILITY
// ============================================================================
/**
 * Mulberry32: A simple, fast seeded pseudorandom number generator.
 * Pass a seed to get reproducible random sequences.
 */
class SeededRNG {
  constructor(seed = Date.now()) {
    this.seed = seed;
  }

  /**
   * Returns a float [0, 1) using the current seed state
   */
  random() {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns a random integer [min, max] inclusive
   */
  randomInt(min, max) {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /**
   * Picks a random element from an array
   */
  pick(arr) {
    return arr[Math.floor(this.random() * arr.length)];
  }

  /**
   * Shuffles array in place and returns it
   */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

// ============================================================================
// PHONETIC TOKEN VARIANTS
// ============================================================================
const TOKEN_VARIANTS = {
  hi: ["Hi", "Hai", "Hye", "Hae", "Hy", "H'aye"],
  couldi: ["could I", "koodai", "k'dai", "kudeye", "kudai", "k'udai"],
  pleaseget: ["plee geh", "pliz ge", "preez geth", "pleh g't", "pleaz ged"],
  aniced: ["n ais", "an aish", "ah ized", "ahn ighst", "n ishd"],
  ahot: ["ah hock", "uh hah", "a hodd", "uh huhh", "at huff"],
  matcha: ["masha", "macca", "matchee", "matsa", "makta"],
  latte: ["lattie", "laddy", "latta", "ladee", "lakte"],
  strawberry: ["stawbery", "strobbery", "strawbily", "strobry", "shrawbery"],
  blueberry: ["bloobee", "broobee", "blury", "bwuhbri", "brubuh"],
  vanilla: ["baniluh", "vneeluh", "vaynah", "manuh", "v'nill"],
  coldfoam: ["cole fohm", "cog fow", "ko fo", "coldom", "coh flum"],
  coconutcream: [
    "coco creem",
    "cogno cre",
    "coao'm crin",
    "konu crim",
    "ko'nut crem",
  ],
  with: ["wif", "wid", "whit", "wiz", "widuh"],
};

// ============================================================================
// PHONETIC CHAOS LEVELS
// ============================================================================
const PHONETIC_LEVELS = {
  1: {
    spaceDrop: 0.05,
    apostrophe: 0.1,
    vowelSwap: 0.05,
    clip: 0.0,
    capChaos: 0.0,
  },
  2: {
    spaceDrop: 0.1,
    apostrophe: 0.2,
    vowelSwap: 0.1,
    clip: 0.05,
    capChaos: 0.05,
  },
  3: {
    spaceDrop: 0.2,
    apostrophe: 0.35,
    vowelSwap: 0.18,
    clip: 0.1,
    capChaos: 0.1,
  },
  4: {
    spaceDrop: 0.35,
    apostrophe: 0.5,
    vowelSwap: 0.25,
    clip: 0.18,
    capChaos: 0.2,
  },
  5: {
    spaceDrop: 0.55,
    apostrophe: 0.65,
    vowelSwap: 0.35,
    clip: 0.25,
    capChaos: 0.3,
  },
};

const VOWEL_SWAPS = [
  ["i", "y"],
  ["y", "i"],
  ["oo", "u"],
  ["u", "oo"],
  ["ai", "ae"],
  ["ae", "ai"],
  ["e", "eh"],
  ["a", "uh"],
  ["uh", "a"],
];

// ============================================================================
// PHONETIC CHAOS FUNCTIONS
// ============================================================================
function replaceAt(str, from, to) {
  const lower = str.toLowerCase();
  const i = lower.indexOf(from);
  if (i === -1) return str;
  return str.slice(0, i) + to + str.slice(i + from.length);
}

function applyVowelSwap(rng, s, p) {
  if (rng.random() >= p) return s;
  const [from, to] = rng.pick(VOWEL_SWAPS);
  const idx = s.toLowerCase().indexOf(from);
  if (idx === -1) return s;
  return s.slice(0, idx) + replaceAt(s.slice(idx), from, to);
}

function applyClip(rng, s, p) {
  if (rng.random() >= p) return s;
  if (s.length <= 4) return s;
  return s.slice(0, s.length - 1);
}

function applyApostrophe(rng, s, p) {
  if (rng.random() >= p) return s;
  if (s.includes("'") || s.includes("'")) return s;
  const mid = Math.max(1, Math.floor(s.length / 2));
  return s.slice(0, mid) + "'" + s.slice(mid);
}

function capChaos(rng, s, p) {
  if (rng.random() >= p) return s;
  let out = "";
  for (const ch of s) {
    if (/[a-z]/i.test(ch) && rng.random() < 0.15) {
      out += rng.random() < 0.5 ? ch.toUpperCase() : ch.toLowerCase();
    } else out += ch;
  }
  return out;
}

function pickToken(rng, token, knobs) {
  if (!TOKEN_VARIANTS[token]) {
    console.error(`Token "${token}" not found in TOKEN_VARIANTS`);
    return token;
  }

  let v = rng.pick(TOKEN_VARIANTS[token]);
  v = applyVowelSwap(rng, v, knobs.vowelSwap);
  v = applyClip(rng, v, knobs.clip);
  v = applyApostrophe(rng, v, knobs.apostrophe);
  v = capChaos(rng, v, knobs.capChaos);
  return v;
}

// ============================================================================
// DICTIONARIES (LEGACY - KEPT FOR COMPATIBILITY)
// ============================================================================
const HEARSAY_DICT = {
  matcha: TOKEN_VARIANTS.matcha,
  strawberry: TOKEN_VARIANTS.strawberry,
  blueberry: TOKEN_VARIANTS.blueberry,
  vanilla: TOKEN_VARIANTS.vanilla,
  hot: TOKEN_VARIANTS.ahot,
  iced: TOKEN_VARIANTS.aniced,
};

function getDayProfile(day) {
  if (day <= 1) {
    return {
      flavours: [null, "strawberry"],
      toppings: [null],
    };
  }

  if (day === 2) {
    return {
      flavours: [null, "strawberry", "blueberry", "vanilla"],
      toppings: [null],
    };
  }

  return {
    flavours: [null, "strawberry", "blueberry", "vanilla"],
    toppings: [null, "coldfoam", "coconutcream"],
  };
}

// ============================================================================
// ORDER GENERATION
// ============================================================================
/**
 * Generate a randomized matcha order.
 *
 * @param {number} difficulty - Difficulty level 1-5
 * @param {SeededRNG} rng - Optional seeded RNG. If not provided, uses Math.random()
 * @returns {object} Order object with canonical, tokens, and text
 *
 * Example:
 *   const order = generateOrder(3, new SeededRNG(42));
 *   console.log(order.text);      // "May I please have a Hahd Strawbari Machu?"
 *   console.log(order.canonical); // { drink: "matcha", temp: "hot", strawberry: true }
 */
function generateOrder(difficulty, rng = null) {
  if (!rng) {
    rng = new SeededRNG(Date.now());
  }

  const id = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const knobs = PHONETIC_LEVELS[difficulty] || PHONETIC_LEVELS[3];
  const day = Math.max(1, Math.min(3, difficulty));
  const dayProfile = getDayProfile(day);

  // ---- Step 1: Decide canonical order
  const canonical = {
    drink: "matcha",
    base: "latte",
    temp: rng.pick(["hot", "iced"]),
    flavour: rng.pick(dayProfile.flavours),
    topping: rng.pick(dayProfile.toppings),
  };
  canonical.strawberry = canonical.flavour === "strawberry";

  // ---- Step 2: Build token list based on canonical order
  const tempToken = canonical.temp === "iced" ? "aniced" : "ahot";
  const drinkTokens = ["couldi", "pleaseget", tempToken];
  if (canonical.flavour) {
    drinkTokens.push(canonical.flavour);
  }
  drinkTokens.push("matcha");
  drinkTokens.push("latte");
  if (canonical.topping) {
    drinkTokens.push("with", canonical.topping);
  }

  // ---- Step 3: Map tokens to canonical words for clarification
  const tokenCanonicalMap = {
    couldi: "could I",
    pleaseget: "please get",
    aniced: "an iced",
    ahot: "a hot",
    strawberry: "strawberry",
    blueberry: "blueberry",
    vanilla: "vanilla",
    matcha: "matcha",
    latte: "latte",
    with: "with",
    coldfoam: "cold foam",
    coconutcream: "coconut cream",
  };

  // ---- Step 4: Apply phonetic chaos to each token
  const parts = drinkTokens.map((t) => pickToken(rng, t, knobs));

  // Track which parts are coded (different from canonical)
  const codedIndices = [];
  for (let i = 0; i < parts.length; i++) {
    const canonical = tokenCanonicalMap[drinkTokens[i]];
    if (parts[i].toLowerCase() !== canonical.toLowerCase()) {
      codedIndices.push(i);
    }
  }

  // ---- Step 5: Build sentence with space drops
  let text = "";
  for (let i = 0; i < parts.length; i++) {
    const chunk = parts[i];
    if (i === 0) {
      text += chunk;
    } else {
      const glue = rng.random() < knobs.spaceDrop ? "" : " ";
      text += glue + chunk;
    }
  }

  // ---- Step 6: Add punctuation and comma
  if (!/[?!]$/.test(text)) text += "?";
  if (rng.random() < 0.85) text = text.replace(/^([^ ]+)/, "$1,");

  // ---- Step 7: Build tokens object for grading (clean versions)
  const tokens = {
    matchaWord: "matcha",
    baseWord: "latte",
    tempWord: canonical.temp,
    flavourWord: canonical.flavour,
    strawberryWord: canonical.flavour === "strawberry" ? "strawberry" : null,
    toppingWord: canonical.topping,
  };

  return {
    id,
    difficulty,
    canonical,
    tokens,
    text,
    parts,
    drinkTokens,
    tokenCanonicalMap,
    codedIndices,
  };
}

// ============================================================================
// GRADING & HAPPINESS
// ============================================================================
/**
 * Grade a player's selection against the canonical order.
 *
 * @param {object} order - Order object (from generateOrder)
 * @param {object} playerSelection - { drinkMatcha: boolean, temp: string|null, strawberry: boolean|null }
 * @returns {object} Grading result with accuracy, breakdown, happiness, and response
 *
 * Example:
 *   const result = gradeOrder(order, { drinkMatcha: true, temp: "hot", strawberry: true });
 *   console.log(result.happiness);      // 95
 *   console.log(result.responseText);   // "Zorp! Exactly what I needed!"
 */
function gradeOrder(order, playerSelection) {
  const breakdown = {
    matcha: 0,
    temp: 0,
    strawberry: 0,
  };

  // ---- Matcha (required)
  if (playerSelection.drinkMatcha) {
    breakdown.matcha = 1;
  } else {
    // Missing matcha is a critical error
    const responses = [
      "Um... where's the matcha?",
      "This isn't what I ordered... no matcha?",
      "I specifically asked for MATCHA!",
      "Zorp! This is all wrong!",
    ];
    return {
      correct: false,
      accuracy: 0,
      breakdown,
      happiness: 0,
      responseText: responses[Math.floor(Math.random() * responses.length)],
    };
  }

  // ---- Temperature
  if (playerSelection.temp === order.canonical.temp) {
    breakdown.temp = 1;
  }

  const requestedFlavour =
    order.canonical.flavour ??
    (order.canonical.strawberry ? "strawberry" : null);
  const selectedFlavour =
    playerSelection.flavour ??
    (playerSelection.strawberry === true ? "strawberry" : null);
  const requestedTopping = order.canonical.topping ?? null;
  const selectedTopping = playerSelection.topping ?? null;

  // ---- Modifiers
  if (
    selectedFlavour === requestedFlavour &&
    selectedTopping === requestedTopping
  ) {
    breakdown.strawberry = 1;
  }

  // ---- Accuracy (0 to 1)
  const accuracy =
    (breakdown.matcha + breakdown.temp + breakdown.strawberry) / 3;

  // ---- Happiness (0 to 100)
  // Higher difficulty makes mistakes more costly
  const difficultyPenalty = (order.difficulty - 1) * 5;
  let happiness = Math.round(Math.pow(accuracy, 1.2) * 100 - difficultyPenalty);
  happiness = Math.max(0, Math.min(100, happiness));

  // ---- Determine response text
  let responseText;
  if (accuracy === 1) {
    responseText = getResponseText(100, "perfect");
  } else if (happiness >= 90) {
    responseText = getResponseText(happiness, "excellent");
  } else if (happiness >= 70) {
    responseText = getResponseText(happiness, "good");
  } else if (happiness >= 40) {
    responseText = getResponseText(happiness, "okay");
  } else {
    responseText = getResponseText(happiness, "poor");
  }

  return {
    correct: accuracy === 1,
    accuracy: Math.round(accuracy * 100) / 100,
    breakdown,
    happiness,
    responseText,
  };
}

/**
 * Get alien response based on happiness level and category
 */
function getResponseText(happiness, category) {
  const responses = {
    perfect: [
      "Gleeorious! You got it exactly right!",
      "Zorp! That's PERFECT!",
      "YES! Exactly what I ordered!",
      "Wheeeee! *happy alien noises*",
    ],
    excellent: [
      "Very nice! Close enough for me!",
      "Bwort! Pretty much what I wanted!",
      "That's great, thank you!",
      "*alien smile* Almost exactly right!",
    ],
    good: [
      "Hmm, close... I guess it's okay.",
      "Could be a bit better, but thanks!",
      "It's... alright. Not perfect though.",
      "Plink! Not bad, not bad.",
    ],
    okay: [
      "Um... this isn't quite what I asked for.",
      "*confused alien sounds* I... guess?",
      "Zang? That's not really right...",
      "Uh, I don't think that's right...",
    ],
    poor: [
      "Zorp! That's completely wrong!",
      "WRONG! This isn't what I wanted at all!",
      "*sad alien noises*",
      "This is... not even close.",
    ],
  };

  const pool = responses[category] || responses.okay;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ============================================================================
// HELPER: GET CORRECT SELECTION
// ============================================================================
/**
 * Return the ideal player selection for a given order.
 * Useful for validation or showing the "correct answer".
 *
 * @param {object} order - Order object
 * @returns {object} { drinkMatcha: boolean, temp: string, strawberry: boolean }
 */
function getCorrectSelection(order) {
  const flavour =
    order.canonical.flavour ??
    (order.canonical.strawberry ? "strawberry" : null);

  return {
    drinkMatcha: true,
    temp: order.canonical.temp,
    flavour,
    topping: order.canonical.topping ?? null,
    strawberry: flavour === "strawberry",
  };
}

// ============================================================================
// EXAMPLE USAGE & TEST CASES
// ============================================================================
/**
 * Example: Generate 5 orders per difficulty and show grading results.
 * Logs order text, canonical data, and grades for both correct and incorrect selections.
 */
function runExamples() {
  console.log("=".repeat(80));
  console.log("ALIEN CAFE ORDER SYSTEM - EXAMPLE USAGE");
  console.log("=".repeat(80));

  // Use a fixed seed for reproducible results
  const baseSeed = 12345;

  for (let difficulty = 1; difficulty <= 5; difficulty++) {
    console.log(
      `\n${"=".repeat(80)}\nDIFFICULTY ${difficulty}\n${"=".repeat(80)}`,
    );

    for (let i = 0; i < 2; i++) {
      const rng = new SeededRNG(baseSeed + difficulty * 100 + i);
      const order = generateOrder(difficulty, rng);

      console.log(`\n--- Order ${i + 1} ---`);
      console.log(`Order ID: ${order.id}`);
      console.log(`Text: "${order.text}"`);
      console.log(
        `Canonical: temp=${order.canonical.temp}, strawberry=${order.canonical.strawberry}`,
      );

      // Correct selection
      const correctSelection = getCorrectSelection(order);
      const correctGrade = gradeOrder(order, correctSelection);
      console.log(`\n  CORRECT SELECTION:`, correctSelection);
      console.log(
        `  → Accuracy: ${correctGrade.accuracy * 100}%, Happiness: ${correctGrade.happiness}`,
      );
      console.log(`  → Response: "${correctGrade.responseText}"`);

      // Incorrect selection (mix it up)
      const incorrectSelection = {
        drinkMatcha: true,
        temp: order.canonical.temp === "hot" ? "iced" : "hot",
        strawberry: !order.canonical.strawberry,
      };
      const incorrectGrade = gradeOrder(order, incorrectSelection);
      console.log(`\n  INCORRECT SELECTION:`, incorrectSelection);
      console.log(
        `  → Accuracy: ${incorrectGrade.accuracy * 100}%, Happiness: ${incorrectGrade.happiness}`,
      );
      console.log(`  → Response: "${incorrectGrade.responseText}"`);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("END OF EXAMPLES");
  console.log("=".repeat(80));
}

// Uncomment to run examples:
// runExamples();

// ============================================================================
// EXPORT (for use in other modules or frameworks)
// ============================================================================
// For Node.js / module systems:
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SeededRNG,
    generateOrder,
    gradeOrder,
    getCorrectSelection,
    HEARSAY_DICT,
  };
}

// For browser globals:
if (typeof window !== "undefined") {
  window.AlienCafeOrderSystem = {
    SeededRNG,
    generateOrder,
    gradeOrder,
    getCorrectSelection,
    HEARSAY_DICT,
    PHONETIC_LEVELS,
    TOKEN_VARIANTS,
  };
}
