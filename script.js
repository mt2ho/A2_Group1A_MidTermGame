// ============================================================================
// GAME STATE
// ============================================================================
let currentOrder = null;
let huhClickCount = 0;
let currentAlienNumber = 1;
const CLARIFY_STEPS_PER_HUH = 4;

let currentDay = 1;
let currentCustomerIndex = 0;
let currentCustomerTimes = [];
let levelSession = null;

const dayCustomerCounts = {
  1: 4,
  2: 5,
  3: 6,
  4: 6,
};

let clarifiedTokens = {
  matchaWord: false,
  tempWord: false,
  strawberryWord: false,
};

const posState = {
  temperature: null,
  base: null,
  flavour: null,
  topping: null,
};

// ============================================================================
// ELEMENTS
// ============================================================================
const screens = document.querySelectorAll(".screen");

const startScreen = document.getElementById("startScreen");
const dayIntroScreen = document.getElementById("dayIntroScreen");
const orderScreen = document.getElementById("orderScreen");
const posScreen = document.getElementById("posScreen");
const feedbackScreen = document.getElementById("feedbackScreen");
const dayClosedScreen = document.getElementById("dayClosedScreen");

const startBtn = document.getElementById("startBtn");
const instructionsBtn = document.getElementById("instructionsBtn");
const instructionsModal = document.getElementById("instructionsModal");
const closeInstructionsBtn = document.getElementById("closeInstructionsBtn");

const dayIntroText = document.getElementById("dayIntroText");
const dayClosedText = document.getElementById("dayClosedText");
const startTomorrowBtn = document.getElementById("startTomorrowBtn");

const timeBox = document.getElementById("timeBox");
const timeText = document.getElementById("timeText");
const dayNumber = document.getElementById("dayNumber");
const satisfactionBarFill = document.getElementById("satisfactionBarFill");
const satisfactionBarLabel = document.getElementById("satisfactionBarLabel");
const satisfactionEmoji = document.getElementById("satisfactionEmoji");

const textBubble = document.getElementById("textBubble");
const orderText = document.getElementById("orderText");
const huhBtn = document.getElementById("huhBtn");
const okayBtn = document.getElementById("okayBtn");

const submitBtn = document.getElementById("submitBtn");
const posButtons = document.querySelectorAll(".pos-option-btn");
const posBackgroundImg = document.getElementById("posBackgroundImg");
const toppingSection = document.getElementById("toppingSection");

const feedbackText = document.getElementById("feedbackText");
const nextBtn = document.getElementById("nextBtn");

// ============================================================================
// UTILITIES
// ============================================================================
function showScreen(screenEl) {
  screens.forEach((screen) => screen.classList.remove("active"));
  screenEl.classList.add("active");

  const showTime = screenEl === orderScreen || screenEl === feedbackScreen;
  timeBox.classList.toggle("hidden", !showTime);
}

function getCustomerCountForDay(day) {
  return dayCustomerCounts[day] || dayCustomerCounts[4];
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function formatTime(minutes) {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function updateTimeDisplay(minutes) {
  timeText.textContent = formatTime(minutes);
}

function updateSatisfactionBar() {
  if (!levelSession) return;

  const happiness = levelSession.happinessBar.getValue();

  if (happiness <= 10) {
    satisfactionEmoji.src = "Assets/emojis/very_angry.png";
  } else if (happiness <= 30) {
    satisfactionEmoji.src = "Assets/emojis/annoyed.png";
  } else if (happiness <= 60) {
    satisfactionEmoji.src = "Assets/emojis/neutral.png";
  } else if (happiness <= 85) {
    satisfactionEmoji.src = "Assets/emojis/happy.png";
  } else {
    satisfactionEmoji.src = "Assets/emojis/very_happy.png";
  }
  const renderData =
    window.SatisfactionBarSystem.getHappinessBarRender(happiness);

  satisfactionBarFill.style.width = `${renderData.widthPct}%`;
  satisfactionBarLabel.textContent = renderData.label;

  // Update color based on happiness level
  if (happiness <= 20) {
    satisfactionBarFill.style.background =
      "linear-gradient(90deg, #f44336 0%, #e57373 100%)";
  } else if (happiness <= 50) {
    satisfactionBarFill.style.background =
      "linear-gradient(90deg, #ff9800 0%, #ffb74d 100%)";
  } else {
    satisfactionBarFill.style.background =
      "linear-gradient(90deg, #4caf50 0%, #8bc34a 50%, #cddc39 100%)";
  }
}

function updatePosButtonsForDay(day) {
  posButtons.forEach((button) => {
    const minDay = Number(button.dataset.minDay || "1");
    const shouldShow = day >= minDay;

    button.classList.toggle("hidden", !shouldShow);
    if (!shouldShow) {
      button.classList.remove("selected");
      const category = button.dataset.category;
      if (posState[category] === button.dataset.value) {
        posState[category] = null;
      }
    }
  });

  if (toppingSection) {
    toppingSection.classList.toggle("hidden", day < 3);
  }
}

function generateDaySchedule(customerCount) {
  const start = 9 * 60;
  const end = 16 * 60 + 59;
  const span = end - start;
  const step = span / (customerCount + 1);

  const result = [];
  let prev = start;

  for (let i = 0; i < customerCount; i++) {
    const center = start + step * (i + 1);
    const jitter = Math.floor(step * 0.22);
    const offset = Math.floor(Math.random() * (jitter * 2 + 1)) - jitter;
    let t = Math.round(center + offset);
    t = clamp(t, prev + 15, end - (customerCount - i - 1) * 10);
    result.push(t);
    prev = t;
  }

  return result;
}

// ============================================================================
// ORDER WORD CLARIFICATION
// ============================================================================
function getPartEditDistance(from, to) {
  const minLen = Math.min(from.length, to.length);
  let diff = 0;

  for (let i = 0; i < minLen; i++) {
    if (from[i].toLowerCase() !== to[i].toLowerCase()) {
      diff++;
    }
  }

  diff += Math.abs(from.length - to.length);
  return diff;
}

function applyStepsTowardsCanonical(from, to, steps) {
  if (steps <= 0 || from === to) {
    return { text: from, used: 0 };
  }

  const chars = from.split("");
  let used = 0;
  const minLen = Math.min(chars.length, to.length);

  for (let i = 0; i < minLen && used < steps; i++) {
    if (chars[i].toLowerCase() !== to[i].toLowerCase()) {
      chars[i] = to[i];
      used++;
    }
  }

  while (chars.length > to.length && used < steps) {
    chars.pop();
    used++;
  }

  while (chars.length < to.length && used < steps) {
    chars.push(to[chars.length]);
    used++;
  }

  return { text: chars.join(""), used };
}

function hashStringToSeed(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function applyRandomClarifySteps(order, totalSteps) {
  if (!order || !order.parts || !order.codedIndices || totalSteps <= 0) {
    return order?.parts ? [...order.parts] : [];
  }

  const displayParts = [...order.parts];
  const seedSource = `${order.id || order.text || "order"}:${currentDay}`;
  const seed = hashStringToSeed(seedSource);
  const rng = new window.AlienCafeOrderSystem.SeededRNG(seed);

  for (let step = 0; step < totalSteps; step++) {
    const candidates = [];

    for (const partIndex of order.codedIndices) {
      const tokenKey = order.drinkTokens[partIndex];
      const canonical = order.tokenCanonicalMap[tokenKey];
      const current = displayParts[partIndex];
      const minLen = Math.min(current.length, canonical.length);

      for (let i = 0; i < minLen; i++) {
        if (current[i].toLowerCase() !== canonical[i].toLowerCase()) {
          candidates.push({ type: "replace", partIndex, charIndex: i });
        }
      }

      if (current.length > canonical.length) {
        candidates.push({ type: "remove", partIndex });
      } else if (current.length < canonical.length) {
        candidates.push({ type: "append", partIndex });
      }
    }

    if (candidates.length === 0) break;

    const pick = candidates[Math.floor(rng.random() * candidates.length)];
    const tokenKey = order.drinkTokens[pick.partIndex];
    const canonical = order.tokenCanonicalMap[tokenKey];
    const chars = displayParts[pick.partIndex].split("");

    if (pick.type === "replace") {
      chars[pick.charIndex] = canonical[pick.charIndex];
    } else if (pick.type === "remove") {
      chars.pop();
    } else if (pick.type === "append") {
      chars.push(canonical[chars.length]);
    }

    displayParts[pick.partIndex] = chars.join("");
  }

  return displayParts;
}

function getTotalClarifySteps(order) {
  if (!order || !order.parts || !order.codedIndices) return 0;

  let total = 0;
  for (const partIndex of order.codedIndices) {
    const tokenKey = order.drinkTokens[partIndex];
    const canonical = order.tokenCanonicalMap[tokenKey];
    total += getPartEditDistance(order.parts[partIndex], canonical);
  }

  return total;
}

function buildOrderSentenceWithClarifications() {
  // Build the sentence with clarifications applied
  if (!currentOrder || !currentOrder.parts) {
    return currentOrder?.text || "Loading...";
  }

  const totalSteps = huhClickCount * CLARIFY_STEPS_PER_HUH;
  const displayParts = applyRandomClarifySteps(currentOrder, totalSteps);

  // Rebuild sentence from parts
  let text = "";
  for (let i = 0; i < displayParts.length; i++) {
    const chunk = displayParts[i];
    if (i === 0) {
      text += chunk;
    } else {
      // Add spaces based on space drop probability (we'll just add spaces for clarity)
      text += " " + chunk;
    }
  }

  // Add punctuation
  if (!/[?!]$/.test(text)) text += "?";
  if (text.indexOf(",") === -1) {
    const firstSpace = text.indexOf(" ");
    if (firstSpace > 0) {
      text = text.slice(0, firstSpace) + "," + text.slice(firstSpace);
    }
  }

  return text;
}

function updateOrderDisplay() {
  // With the new phonetic chaos system, the order text is already generated
  // We just need to display it
  if (!currentOrder || !currentOrder.text) {
    console.error(
      "currentOrder or currentOrder.text is undefined",
      currentOrder,
    );
    return;
  }

  const displayText = buildOrderSentenceWithClarifications();
  textBubble.style.animation = "none";
  setTimeout(() => {
    orderText.textContent = displayText;
    textBubble.style.animation = "fadeIn 0.3s ease-in";
  }, 10);
}

// ============================================================================
// FLOW: DAY / CUSTOMERS
// ============================================================================
function startDay(day) {
  currentDay = day;
  currentCustomerIndex = 0;
  currentCustomerTimes = generateDaySchedule(getCustomerCountForDay(day));

  // Initialize satisfaction bar system
  const customersTarget = getCustomerCountForDay(day);
  levelSession = new window.SatisfactionBarSystem.LevelSession({
    level: day,
    customersTarget: customersTarget,
  });
  updateSatisfactionBar();
  updatePosButtonsForDay(currentDay);

  dayNumber.textContent = `Day ${currentDay}`;
  dayIntroText.textContent = `Day ${currentDay}`;
  showScreen(dayIntroScreen);

  setTimeout(() => {
    beginCurrentCustomer();
  }, 1000);
}

function beginCurrentCustomer() {
  // Safety check: ensure currentCustomerTimes is initialized
  if (!currentCustomerTimes || currentCustomerTimes.length === 0) {
    console.error("currentCustomerTimes not properly initialized");
    dayClosedText.textContent = `Day ${currentDay} Closed`;
    showScreen(dayClosedScreen);
    return;
  }

  // Check if we've served all customers
  if (currentCustomerIndex >= currentCustomerTimes.length) {
    dayClosedText.textContent = `Day ${currentDay} Closed`;
    showScreen(dayClosedScreen);
    return;
  }

  updateTimeDisplay(currentCustomerTimes[currentCustomerIndex]);
  startNewOrder();
}

function startNewOrder() {
  huhClickCount = 0;
  clarifiedTokens = {
    matchaWord: false,
    tempWord: false,
    strawberryWord: false,
  };

  posState.temperature = null;
  posState.base = null;
  posState.flavour = null;
  posState.topping = null;

  // Select a random alien (1-3) for this order
  currentAlienNumber = Math.floor(Math.random() * 3) + 1;

  // Update alien display to normal state
  const alien = orderScreen.querySelector(".alien");
  if (alien) {
    alien.style.backgroundImage = `url('Assets/alien${currentAlienNumber}_normal.png')`;
  }

  try {
    const randomSeed = Date.now() + Math.random() * 1000000;
    const rng = new window.AlienCafeOrderSystem.SeededRNG(randomSeed);
    const difficulty = clamp(currentDay, 1, 5);
    currentOrder = window.AlienCafeOrderSystem.generateOrder(difficulty, rng);

    if (!currentOrder) {
      console.error("generateOrder returned undefined");
      return;
    }
  } catch (e) {
    console.error("Error generating order:", e);
    return;
  }

  // Show Huh button if there are coded words to clarify
  const totalClarifySteps = getTotalClarifySteps(currentOrder);
  if (totalClarifySteps > 0) {
    huhBtn.classList.remove("hidden");
  } else {
    huhBtn.classList.add("hidden");
  }

  updateOrderDisplay();
  updateOrderScreenBackground();
  showScreen(orderScreen);
}

function updateOrderScreenBackground() {
  const backgrounds = [
    "InteriorDay.png",
    "InteriorSunset.png",
    "InteriorNight.png",
  ];
  const totalCustomers = getCustomerCountForDay(currentDay);

  // Distribute backgrounds evenly across customers
  let backgroundIndex;
  if (totalCustomers === 3) {
    // Day 1: day (0), sunset (1), night (2)
    backgroundIndex = currentCustomerIndex;
  } else if (totalCustomers === 4) {
    // Day 2: day (0), day (1), sunset (2), night (3)
    if (currentCustomerIndex <= 1) backgroundIndex = 0;
    else if (currentCustomerIndex === 2) backgroundIndex = 1;
    else backgroundIndex = 2;
  } else {
    // Day 3+: distribute evenly
    const segment = totalCustomers / backgrounds.length;
    backgroundIndex = Math.min(
      Math.floor(currentCustomerIndex / segment),
      backgrounds.length - 1,
    );
  }

  const backgroundImage = backgrounds[backgroundIndex];
  orderScreen.style.backgroundImage = `url('Assets/${backgroundImage}')`;
  orderScreen.style.backgroundSize = "cover";
  orderScreen.style.backgroundPosition = "center";
}

// ============================================================================
// ORDER SCREEN EVENTS
// ============================================================================
huhBtn.addEventListener("click", () => {
  const totalClarifySteps = getTotalClarifySteps(currentOrder);
  const maxHuhClicks = Math.ceil(totalClarifySteps / CLARIFY_STEPS_PER_HUH);

  if (huhClickCount >= maxHuhClicks) {
    huhBtn.classList.add("hidden");
    return;
  }

  huhClickCount += 1;
  updateOrderDisplay();

  // Apply huh penalty to satisfaction bar
  if (levelSession) {
    levelSession.onHuh();
    updateSatisfactionBar();

    // Check if level failed
    if (levelSession.status === "failed") {
      showFailureScreen();
      return;
    }
  }

  if (huhClickCount >= maxHuhClicks) {
    huhBtn.classList.add("hidden");
  }
});

okayBtn.addEventListener("click", () => {
  posButtons.forEach((btn) => btn.classList.remove("selected"));

  // Update POS background to match order screen time of day
  const backgrounds = ["POSDay.png", "POSSunset.png", "POSNight.png"];
  const totalCustomers = getCustomerCountForDay(currentDay);

  let backgroundIndex;
  if (totalCustomers === 3) {
    backgroundIndex = currentCustomerIndex;
  } else if (totalCustomers === 4) {
    if (currentCustomerIndex <= 1) backgroundIndex = 0;
    else if (currentCustomerIndex === 2) backgroundIndex = 1;
    else backgroundIndex = 2;
  } else {
    const segment = totalCustomers / backgrounds.length;
    backgroundIndex = Math.min(
      Math.floor(currentCustomerIndex / segment),
      backgrounds.length - 1,
    );
  }

  posBackgroundImg.src = `Assets/${backgrounds[backgroundIndex]}`;
  updatePosButtonsForDay(currentDay);

  showScreen(posScreen);
});

// ============================================================================
// POS EVENTS
// ============================================================================
posButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const category = button.dataset.category;
    const value = button.dataset.value;
    const isAlreadySelected = button.classList.contains("selected");

    posButtons.forEach((btn) => {
      if (btn.dataset.category === category) btn.classList.remove("selected");
    });

    if (isAlreadySelected) {
      posState[category] = null;
    } else {
      button.classList.add("selected");
      posState[category] = value;
    }
  });
});

submitBtn.addEventListener("click", () => {
  if (!posState.temperature || !posState.base) return;

  const playerSelection = {
    drinkMatcha: posState.base === "matcha",
    temp: posState.temperature,
    flavour: posState.flavour,
    topping: posState.topping,
    strawberry: posState.flavour === "strawberry",
  };

  const gradeResult = window.AlienCafeOrderSystem.gradeOrder(
    currentOrder,
    playerSelection,
  );

  // Update satisfaction bar with order result
  if (levelSession) {
    levelSession.onOrderSubmitted(currentOrder, playerSelection);
    updateSatisfactionBar();

    // Check level status
    if (levelSession.status === "failed") {
      showFailureScreen();
      return;
    } else if (levelSession.status === "completed") {
      showVictoryScreen();
      return;
    }
  }

  showFeedback(gradeResult);
});

// ============================================================================
// FEEDBACK
// ============================================================================
function getSimpleFeedbackText(gradeResult) {
  const perfectPool = ["*Happy alien noises*"];
  const wrongPool = ["*Disappointed alien noises*", "*Sad alien noises*"];

  if (gradeResult.accuracy === 1) {
    return perfectPool[Math.floor(Math.random() * perfectPool.length)];
  }

  return wrongPool[Math.floor(Math.random() * wrongPool.length)];
}

function showFeedback(gradeResult) {
  feedbackText.textContent = getSimpleFeedbackText(gradeResult);

  const alien = feedbackScreen.querySelector(".alien");

  // Determine emotion based on accuracy
  let emotion = "happy"; // default
  if (gradeResult.accuracy === 0) {
    emotion = "angry";
  }

  const imagePath = `url('Assets/alien${currentAlienNumber}_${emotion}.png')`;
  alien.style.backgroundImage = imagePath;

  // Match the order screen background
  feedbackScreen.style.backgroundImage = orderScreen.style.backgroundImage;
  feedbackScreen.style.backgroundSize = "cover";
  feedbackScreen.style.backgroundPosition = "center";

  showScreen(feedbackScreen);
}

function showVictoryScreen() {
  const stats = levelSession.getStats();
  const successPct = (stats.successRate * 100).toFixed(0);
  dayClosedText.textContent = `Day ${currentDay} Complete! Success: ${successPct}%`;
  showScreen(dayClosedScreen);
}

function showFailureScreen() {
  const stats = levelSession.getStats();
  const successPct = (stats.successRate * 100).toFixed(0);

  const failureMessages = [
    "Nice try. But the aliens were not a fan of your service. Try today again.",
    "Oops! The aliens are not happy. Better luck next time. Try today again.",
    "Yikes! The aliens gave up on you. Try today again.",
    "Not quite right. The aliens need a better barista. Try today again.",
  ];

  const randomMessage =
    failureMessages[Math.floor(Math.random() * failureMessages.length)];
  dayClosedText.textContent = randomMessage;
  startTomorrowBtn.textContent = "Retry Day";
  showScreen(dayClosedScreen);
}

nextBtn.addEventListener("click", () => {
  currentCustomerIndex += 1;
  beginCurrentCustomer();
});

// ============================================================================
// START / DAY CONTROL EVENTS
// ============================================================================
startBtn.addEventListener("click", () => {
  const bgMusic = document.getElementById("bgMusic");
  if (bgMusic) {
    bgMusic.volume = 0.4;
    bgMusic.play().catch(() => {});
  }
  startDay(currentDay);
});

instructionsBtn.addEventListener("click", () => {
  instructionsModal.classList.remove("hidden");
});

closeInstructionsBtn.addEventListener("click", () => {
  instructionsModal.classList.add("hidden");
});

startTomorrowBtn.addEventListener("click", () => {
  const shouldRetry = startTomorrowBtn.textContent === "Retry Day";
  startTomorrowBtn.textContent = "Start Tomorrow";

  if (shouldRetry) {
    startDay(currentDay);
  } else {
    startDay(currentDay + 1);
  }
});

// ============================================================================
// INITIAL SCREEN
// ============================================================================
showScreen(startScreen);
