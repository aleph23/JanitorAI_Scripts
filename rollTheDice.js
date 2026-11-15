// ===================================================================== 
// rollTheDice - STANDALONE DICE ROLLER (Janitor / pre-reply script) 
// --------------------------------------------------------------------- 
// Welcome to rollTheDice. We at a13phScripts aschew the Janitor's suggested best-practice
// because who the hell wants a hundred old dice rolls tacked onto the end of their character's
// scenario? If you answered, "No One!" then you, dear user, are correct. We at a13phScripts
// thumb our noses at 'best', settling only for Better-than-best practice, breaking things
// on the way.
//
// -- !!Seriously. Test this shit before you go live!! --
//
// roleTheDice generates fresh die rolls every user prompt and embeds them into a specific 
// and highly unlikely tag-fenced area in the scenario, tossing that stale shit into the abyss.
// We do this every turn, whether we need to or not. This keeps the LLM from having to guess
// a die roll. LLMs just pick what it finds most interesting or most likely from the list provided.
// This makes it an actual random number. NOTE: This will likely require you to adjust the 
// boundaries on your list of possible outcomes, since previously the LLM could pick the one in 
// one hundred event, just because its activations made if feel like it. You can also event
// distribute: [7, 17, 27, 37, 47, 57, 67, 77, 87, 97] = 'Character sprouts wings and flies'
// instead of 1-10 = 'Character sprouts wings and flies'. 
//
// It statistically matches multiple die rolls. This means that 3d3 will result in a value of 6 
// significantly more often than a simple `Math.floor(Math.random() * 7) + 3`, which even-weights
// values between 3 and 9. If you want even weights, only roll once (1d7) then add 2 to that output.
// 
// Designed to co-exist peacefully, if commentarily condescendingly, with other 
// scenario-manipulating AND scenario-bloating scripts.
// 
// We promise to only play within our own playground, defined by {[FR3SH_RAND0M]} to 
// {[/FR3SH_RAND0M]} boundaries. However, in order to incinerate everything within our 
// playground every turn, we will evacuate your scenario for safety reasons. Once clean,
// we return your precious scenario and gently tuck it back into its cozy little home 
// (with our continuously morphing parasitic leech hanging from its bottom (Shut up. You
// know you love it. That leech keeps your scenario tidy) ¯\_(ツ)_/¯ ).
// =====================================================================

// Because some best practices actually are
context.character = context.character || {};
context.character.scenario = context.character.scenario || "";

// The walls of our playground look like
const DICE_OPEN = "{[FR3SH_RAND0M]}";
const DICE_CLOSE = "{[/FR3SH_RAND0M]}";

/**
 * Rolls a die with 'f' faces (1 to f) 'x' number of times. In theory you could roll a
 * one-sided die five million times.
 *
 * Don't. It's always five million.
 *
 * @param {number} x - Number of times to roll.
 * @param {number} f - Number of faces on your die.
 * @returns {number} The sum of the rolled dice.
 */
const rollDice = (x, f) => {
    let rollValue = 0;
    for (let i = 0; i < x; i++) {
        rollValue += Math.floor(Math.random() * f) + 1;
    }
    return rollValue;
};

/**
 * outWithTheOld - Strips the specific dice block from the scenario text.
 * Will not touch anything outside of DICE_OPEN and DICE_CLOSE.
 * @param {string} scenario - The current scenario string/
 * @returns {string} The cleaned scenario string.
 */
const outWithTheOld = (scenario) => {
    // The likelihood of you accidentally including a fence-tag was too high to calculate
    // while drinking, so we check for it anyway.
    const startIdx = scenario.lastIndexOf(DICE_OPEN);1
    const endIdx = startIdx === -1 ? -1 : scenario.indexOf(DICE_CLOSE, startIdx);

    // Only strip if both tags exist and are in the correct order
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        const before = scenario.substring(0, startIdx);
        const after = scenario.substring(endIdx + DICE_CLOSE.length);
        
        // Clean up potential double newlines left behind by removal
        //return (before + after).replace(/\n{3,}/g, "\n\n"); 
        // ^^ Is Global: collapses triple newlines ANYWHERE in the scenario, not just at the seam. Instead we,
        return before.replace(/\n+$/, "") + after;
        // to just remove what we added.
    }
    return scenario;
};

/**
 * Writes the new dice block into the scenario.
 * Replaces existing block if present, otherwise appends cleanly.
 * @param {string} scenario - The cleaned scenario string.
 * @param {string} content - The inner text to place between tags.
 * @returns {string} The updated scenario string.
 */
const inWithTheNew = (scenario, content) => {
    const block = `${DICE_OPEN}\n${content}\n${DICE_CLOSE}`;
    
    const startIdx = scenario.indexOf(DICE_OPEN);
    const endIdx = scenario.indexOf(DICE_CLOSE);

    // If for some reason a partial block exists, replace it
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        return scenario.substring(0, startIdx) + block + scenario.substring(endIdx + DICE_CLOSE.length);
    }

    // Otherwise, append to the end of the scenario cleanly
    const trimmedScenario = scenario.replace(/\s+$/, "");
    return trimmedScenario ? `${trimmedScenario}\n\n${block}` : block;
};

// ---- Main Engine ----

const run = () => {
    try {
        // 1. Generate our randomness. Add as many as you like. First number is times rolled.
        // Second number is the number of sides the die has.
        // const flipACoin = rollDice(1, 2) // For a binary coin flip
        const bimChange = rollDice(3, 3);   // Geometrically Difficult Die: 3d3 (Statistically Center-Weighted Range: 3 - 9)
        const probability = rollDice(1, 100); // Percentage Die: 1d100 (Range: 1 - 100)

        // 2. Give meaning and purpose to otherwise random events. Go on, you're a natural.
        const diceContent = `We make two calls to Math.random every turn. These are unique values and apply to this turn only. The Percentage (d100) Role Value: ${probability} If bim changes (3d3) this turn, change it by plus or minus: ${bimChange}`;

        // 3. Strip the old random. NOTE: The Character scenario does NOT need to be pre-populated.
        let yourScenario = outWithTheOld(context.character.scenario);

        // 4. Burn down (=) then rebuild the house. It looks very much like the old house.
        context.character.scenario = inWithTheNew(yourScenario, diceContent);

        // 5a. Breathe. It worked.
        console.log(`[dice-roller] Injected fresh rolls -> d100: ${probability}, 3d3: ${bimChange}`);

    } catch (error) {
        // 5b. Oh shit. 
        console.error("[dice-roller] EXECUTION FAILED! If you are an end-user seeing this message in your browser's devtools, please tell the creator that 'rollTheDice' failed with this error message: ", error.message);
    }
};

// This is the point in the script where you are meant to cross your fingers.
// Guaranteed by a13phScripts. See clawedSoulBack for details.
run();
