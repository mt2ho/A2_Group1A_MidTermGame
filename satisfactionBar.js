/**
 * ALIEN CAFE SATISFACTION BAR SYSTEM
 * ====================================
 * Deterministic, modular penalty system for happiness/satisfaction tracking.
 * No randomness. Fixed discrete penalties.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Huh penalty by level (discrete units)
 */
const HUH_PENALTIES = {
  1: 8,
  2: 20,
  3: 20,
  4: 25,
  5: 25,
};

/**
 * Order component penalties (discrete units)
 */
const ORDER_PENALTIES = {
  matcha: 60, // Missing matcha is catastrophic
  temp: 25, // Wrong temperature
  strawberry: 15, // Wrong strawberry option
};

/**
 * Fixed penalty for any wrong submitted order
 */
const WRONG_ORDER_PENALTY = 10;

/**
 * Minimum final happiness required to pass a day
 */
const LEVEL_PASS_HAPPINESS = 50;

/**
 * Success threshold for an order
 */
const SUCCESS_THRESHOLD = 0.75;

/**
 * Minimum happiness when success rate >= 0.80 (cannot fail if doing well)
 */
const MIN_HAPPINESS_WHEN_PASSING = 1;

/**
 * Minimum happiness for wrecked orders on Level 1 when successRate >= 0.80
 */
const MIN_HAPPINESS_L1_WRECK = 5;

// ============================================================================
// HAPPINESS BAR CLASS
// ============================================================================

class HappinessBar {
  constructor({ level, startValue = 100 }) {
    this.level = level;
    this.happiness = startValue;
    this.maxHappiness = startValue;
  }

  /**
   * Apply huh penalty based on current success rate
   * @param {number} successRate - Current success rate (0..1)
   * @returns {number} New happiness value
   */
  applyHuh(successRate) {
    const penalty = HUH_PENALTIES[this.level] || HUH_PENALTIES[5];

    // Level 2+: Huh can instantly zero if failing
    if (this.level >= 2 && successRate < SUCCESS_THRESHOLD) {
      this.happiness = 0;
      return this.happiness;
    }

    // Otherwise apply normal penalty with clamping
    return this.applyPenalty(penalty, successRate, false);
  }

  /**
   * Apply order breakdown penalties based on which components were wrong
   * @param {object} breakdown - { matcha: 0/1, temp: 0/1, strawberry: 0/1 }
   * @param {number} successRate - Current success rate after this order
   * @returns {number} New happiness value
   */
  applyOrderBreakdown(breakdown, successRate) {
    // Calculate discrete penalty from wrong components
    let totalPenalty = 0;
    let wrongCount = 0;

    if (breakdown.matcha === 0) {
      totalPenalty += ORDER_PENALTIES.matcha;
      wrongCount++;
    }
    if (breakdown.temp === 0) {
      totalPenalty += ORDER_PENALTIES.temp;
      wrongCount++;
    }
    if (breakdown.strawberry === 0) {
      totalPenalty += ORDER_PENALTIES.strawberry;
      wrongCount++;
    }

    // Check if order is wrecked
    const isWrecked = breakdown.matcha === 0 || wrongCount >= 2;

    // Level 2+: Wrecked order can instantly zero if failing
    if (this.level >= 2 && isWrecked && successRate < SUCCESS_THRESHOLD) {
      this.happiness = 0;
      return this.happiness;
    }

    // Apply the modular penalty
    const canInstantZero = false; // Never allow instant zero from penalty application
    this.applyPenalty(totalPenalty, successRate, canInstantZero);

    // Level 1 special rule: wrecked orders have min 5 when passing
    if (this.level === 1 && isWrecked && successRate >= SUCCESS_THRESHOLD) {
      if (this.happiness < MIN_HAPPINESS_L1_WRECK) {
        this.happiness = MIN_HAPPINESS_L1_WRECK;
      }
    }

    return this.happiness;
  }

  /**
   * Apply a raw penalty amount with clamping rules
   * @param {number} amount - Penalty amount to subtract
   * @param {number} successRate - Current success rate
   * @param {boolean} canInstantZero - Whether this penalty can drain to 0 in one shot
   * @returns {number} New happiness value
   */
  applyPenalty(amount, successRate, canInstantZero = false) {
    const before = this.happiness;
    this.happiness -= amount;

    // Level 1 safety: Never allow a single event to hit 0 if failing
    if (this.level === 1 && successRate < SUCCESS_THRESHOLD) {
      if (!canInstantZero && before > 0 && this.happiness <= 0) {
        this.happiness = 1;
      }
    }

    // If passing (successRate >= 0.80), cannot hit 0
    if (successRate >= SUCCESS_THRESHOLD) {
      if (this.happiness < MIN_HAPPINESS_WHEN_PASSING) {
        this.happiness = MIN_HAPPINESS_WHEN_PASSING;
      }
    }

    // Never go below 0 or above max
    this.happiness = Math.max(0, Math.min(this.maxHappiness, this.happiness));

    return this.happiness;
  }

  /**
   * Get current happiness value
   */
  getValue() {
    return this.happiness;
  }

  /**
   * Check if happiness is empty (0)
   */
  isEmpty() {
    return this.happiness === 0;
  }
}

// ============================================================================
// LEVEL SESSION CLASS
// ============================================================================

class LevelSession {
  constructor({ level, customersTarget }) {
    this.level = level;
    this.customersTarget = customersTarget;
    this.totalOrders = 0;
    this.successfulOrders = 0;
    this.status = "active"; // 'active', 'completed', 'failed'
    this.happinessBar = new HappinessBar({ level });
  }

  /**
   * Get current success rate
   */
  get successRate() {
    if (this.totalOrders === 0) return 1.0; // Start optimistic
    return this.successfulOrders / this.totalOrders;
  }

  /**
   * Handle a "huh" button click
   */
  onHuh() {
    if (this.status !== "active") return;

    // Apply huh penalty with CURRENT success rate (before any change)
    const currentSuccessRate = this.successRate;
    this.happinessBar.applyHuh(currentSuccessRate);

    // Check if happiness depleted
    if (this.happinessBar.isEmpty()) {
      this.status = "failed";
    }
  }

  /**
   * Handle an order submission
   * @param {object} order - Generated order object
   * @param {object} playerSelection - Player's input
   */
  onOrderSubmitted(order, playerSelection) {
    if (this.status !== "active") return;

    // Grade the order using the order system
    const gradeResult = window.AlienCafeOrderSystem.gradeOrder(
      order,
      playerSelection,
    );
    const { accuracy } = gradeResult;

    // Update totals
    this.totalOrders++;
    if (accuracy === 1) {
      this.successfulOrders++;
    }

    // Compute NEW success rate after this order
    const newSuccessRate = this.successRate;

    if (accuracy < 1) {
      this.happinessBar.applyPenalty(
        WRONG_ORDER_PENALTY,
        newSuccessRate,
        false,
      );
    }

    // Check if happiness depleted
    if (this.happinessBar.isEmpty()) {
      this.status = "failed";
      return;
    }

    // Check if level is complete
    if (this.totalOrders >= this.customersTarget) {
      if (this.happinessBar.getValue() >= LEVEL_PASS_HAPPINESS) {
        this.status = "completed";
      } else {
        this.status = "failed";
      }
    }
  }

  /**
   * Get current session stats
   */
  getStats() {
    return {
      level: this.level,
      totalOrders: this.totalOrders,
      successfulOrders: this.successfulOrders,
      customersTarget: this.customersTarget,
      successRate: this.successRate,
      happiness: this.happinessBar.getValue(),
      status: this.status,
    };
  }
}

// ============================================================================
// RENDERING HELPER
// ============================================================================

/**
 * Get happiness bar rendering info
 * @param {number} value - Happiness value 0-100
 * @returns {object} { widthPct, label }
 */
function getHappinessBarRender(value) {
  const widthPct = Math.max(0, Math.min(100, value));
  const label = `${Math.round(value)}%`;

  return {
    widthPct,
    label,
  };
}

// ============================================================================
// EXAMPLE USAGE & TESTS
// ============================================================================

/**
 * Example: Test Level 1 behavior
 * - Huh should apply -8
 * - Correct order should apply 0
 * - Temp wrong should apply -25
 * - Matcha wrong (wrecked) should apply -60 but clamp to min 5 if passing
 */
function testLevel1() {
  console.log("\n" + "=".repeat(80));
  console.log("LEVEL 1 TEST");
  console.log("=".repeat(80));

  const session = new LevelSession({ level: 1, customersTarget: 5 });

  console.log("\nInitial state:", session.getStats());

  // Test 1: Huh (-8)
  console.log("\n--- Action: Huh ---");
  session.onHuh();
  console.log("After huh:", session.getStats());

  // Test 2: Perfect order (no penalty)
  console.log("\n--- Action: Perfect order ---");
  const perfectBreakdown = { matcha: 1, temp: 1, strawberry: 1 };
  session.totalOrders++;
  session.successfulOrders++;
  session.happinessBar.applyOrderBreakdown(
    perfectBreakdown,
    session.successRate,
  );
  console.log("After perfect order:", session.getStats());

  // Test 3: Temp wrong (-25)
  console.log("\n--- Action: Temp wrong ---");
  const tempWrongBreakdown = { matcha: 1, temp: 0, strawberry: 1 };
  session.totalOrders++;
  session.happinessBar.applyOrderBreakdown(
    tempWrongBreakdown,
    session.successRate,
  );
  console.log("After temp wrong (not successful):", session.getStats());

  // Test 4: Matcha wrong - wrecked (-60, but clamped)
  console.log("\n--- Action: Matcha wrong (wrecked) ---");
  const matchaWrongBreakdown = { matcha: 0, temp: 1, strawberry: 1 };
  session.totalOrders++;
  session.happinessBar.applyOrderBreakdown(
    matchaWrongBreakdown,
    session.successRate,
  );
  console.log("After matcha wrong (wrecked):", session.getStats());
  console.log(
    "Note: Should be clamped to min 5 on L1 if passing (successRate >= 0.80)",
  );

  // Test 5: Two more perfect orders to reach target
  console.log("\n--- Action: Complete with 2 perfect orders ---");
  session.totalOrders++;
  session.successfulOrders++;
  session.happinessBar.applyOrderBreakdown(
    { matcha: 1, temp: 1, strawberry: 1 },
    session.successRate,
  );

  session.totalOrders++;
  session.successfulOrders++;
  session.happinessBar.applyOrderBreakdown(
    { matcha: 1, temp: 1, strawberry: 1 },
    session.successRate,
  );

  // Check completion
  if (session.totalOrders >= session.customersTarget) {
    if (
      session.successRate >= SUCCESS_THRESHOLD &&
      !session.happinessBar.isEmpty()
    ) {
      session.status = "completed";
    } else {
      session.status = "failed";
    }
  }

  console.log("Final state:", session.getStats());
  console.log(
    `Success rate: ${(session.successRate * 100).toFixed(1)}% (need >= 80%)`,
  );
}

/**
 * Example: Test Level 2 behavior
 * - Huh with successRate < 0.80 should instantly zero
 * - Wrecked order with successRate < 0.80 should instantly zero
 * - With successRate >= 0.80, penalties apply but cannot hit 0
 */
function testLevel2() {
  console.log("\n" + "=".repeat(80));
  console.log("LEVEL 2 TEST - Instant Zero on Failure");
  console.log("=".repeat(80));

  const session = new LevelSession({ level: 2, customersTarget: 4 });

  console.log("\nInitial state:", session.getStats());

  // Test 1: One perfect order
  console.log("\n--- Action: Perfect order ---");
  session.totalOrders++;
  session.successfulOrders++;
  session.happinessBar.applyOrderBreakdown(
    { matcha: 1, temp: 1, strawberry: 1 },
    session.successRate,
  );
  console.log("After perfect order:", session.getStats());

  // Test 2: Fail one order (successRate will drop to 0.50)
  console.log("\n--- Action: Completely wrong order ---");
  session.totalOrders++;
  // successRate = 1/2 = 0.50 < 0.80
  session.happinessBar.applyOrderBreakdown(
    { matcha: 0, temp: 0, strawberry: 0 },
    session.successRate,
  );
  console.log("After failed order (successRate < 0.80):", session.getStats());
  console.log(
    "Note: On L2+, wrecked order with successRate < 0.80 should instantly zero",
  );
}

/**
 * Example: Test Level 2 with good success rate
 * Show that penalties apply but cannot hit 0 when successRate >= 0.80
 */
function testLevel2Passing() {
  console.log("\n" + "=".repeat(80));
  console.log("LEVEL 2 TEST - Passing with Good Success Rate");
  console.log("=".repeat(80));

  const session = new LevelSession({ level: 2, customersTarget: 5 });

  console.log("\nInitial state:", session.getStats());

  // Get 4 perfect orders (successRate will be 100%)
  for (let i = 0; i < 4; i++) {
    session.totalOrders++;
    session.successfulOrders++;
    session.happinessBar.applyOrderBreakdown(
      { matcha: 1, temp: 1, strawberry: 1 },
      session.successRate,
    );
  }

  console.log("\nAfter 4 perfect orders:", session.getStats());

  // Now use multiple huhs - should apply -20 each but never hit 0
  console.log("\n--- Spam Huh 6 times (should drain but not hit 0) ---");
  for (let i = 0; i < 6; i++) {
    session.onHuh();
    console.log(`After huh ${i + 1}:`, session.getStats());
  }

  console.log(
    "\nNote: With successRate >= 0.80, happiness clamped to minimum 1",
  );
}

/**
 * Run all examples
 */
function runSatisfactionBarExamples() {
  console.log("=".repeat(80));
  console.log("SATISFACTION BAR SYSTEM - EXAMPLES");
  console.log("=".repeat(80));

  testLevel1();
  testLevel2();
  testLevel2Passing();

  console.log("\n" + "=".repeat(80));
  console.log("END OF EXAMPLES");
  console.log("=".repeat(80));
}

// Uncomment to run examples:
// runSatisfactionBarExamples();

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    HappinessBar,
    LevelSession,
    getHappinessBarRender,
    HUH_PENALTIES,
    ORDER_PENALTIES,
    SUCCESS_THRESHOLD,
    runSatisfactionBarExamples,
  };
}

if (typeof window !== "undefined") {
  window.SatisfactionBarSystem = {
    HappinessBar,
    LevelSession,
    getHappinessBarRender,
    HUH_PENALTIES,
    ORDER_PENALTIES,
    SUCCESS_THRESHOLD,
    runSatisfactionBarExamples,
  };
}
