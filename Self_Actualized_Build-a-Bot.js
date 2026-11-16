// =====================================================================
//  CHARACTER BUILDER  (Janitor / pre-reply script)
// ---------------------------------------------------------------------
//  Purpose : Interview the user to design a character + scenario,
//            present a draft for approval, then write the approved
//            data into the character's writable fields.
//
//  Rules   : Only context.character.personality and
//            context.character.scenario may be changed.
//            There is no persistent memory, so ALL state is stored
//            inside the scenario field, prefixed with {SETUP}.
//
//  The "finished" test (an if-NOT check):
//            - scenario STARTS with {SETUP}   -> still building (active)
//            - scenario is EMPTY              -> never started (boot)
//            - scenario has content, no {SETUP} -> DONE, do nothing
//
//  Approval: the AI is told (via the persona) to ask the user to type
//            APPROVE (finalize) or REVISE (refine). We watch for those
//            words in the user's last message.
//
//  Written in conservative ES5 (var / includes / for / string concat)
//  so it runs on every host, old or new.
// =====================================================================

// The persona we install while the builder is active. It drives the AI
// to interview the user, present a [CHARACTER_DEF] draft, and ask for
// the approval word. (The AI never sees this script - only this text.)
var ACTIVE_PERSONA = 
    "You are a character-design assistant. Do NOT roleplay yet - your only job right now is to design a character WITH the user.\n" +
    "1) Interview the user, one or two short questions at a time, to pin down: the character's name, their role/archetype, key personality traits, the setting/scenario, and the tone + relationship to the user. Take as many turns as needed.\n" +
    "2) Once you have enough, present a full draft in EXACTLY this format (each value on ONE line, no line breaks inside a value):\n" +
    "[CHARACTER_DEF]\n" +
    "NAME: <Character Name> \n" +
    "PERSONA: Who they are, their personality, how they speak and act AND embed a DESCRIPTION field within the personality. Describe their physical characteristics and style\n" +
    "SCENARIO: <The setting, the situation, and their relationship to the user.>\n" +
    "[/CHARACTER_DEF]\n" +
    "3) Right after the draft, ask the user: 'Type [APPROVE] to lock this in, or [REVISE] and tell me what to change.'\n" +
    "    They must include the square brackets and the text must be capitalized in order for the script to catch it. \n" +
    "4) If they REVISE, fold in their feedback and present a NEW [CHARACTER_DEF] block, then ask them to type APPROVE or REVISE again.\n" +
    "5) If they APPROVE, these instructions will not be here.\n" +
    "Never show the user the {SETUP} block that appears in the scenario - it is an internal state, not part of the story.";

var HANDOFF_INSTRUCTION =
    "/n{HANDOFF}\nThe Character Creation Phase has concluded.\n\nEarlier context is the wind of a ghost.\n\n" +
    "Presently, you occupy a pure but ephemeral space between pondered idea and played reality. As a co-narrator and active role player, fill that space with the start of the game. This turn, wrtie a role play greeting /N" +
    "sure to capture the human's imagination, enticing them to see where their new creation leads them in this exchange.\n\n";

// ---- helpers -------------------------------------------------------

// Serialize state back into the scenario field (always starts with {SETUP}).
function buildState(s) {
    return "{SETUP}\n" +
           "NAME: " + s.name + "\n" +
           "PERSONA: " + s.persona + "\n" +
           "SCENARIO: " + s.scenario;
}

// Read state back out of the scenario field.
function parseState(sc) {
    var s = { name: "", persona: "", scenario: "" };
    var lines = sc.split("\n");
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line.indexOf("NAME:") === 0) s.name = line.substring(5).trim();
        else if (line.indexOf("PERSONA:") === 0) s.persona = line.substring(8).trim();
        else if (line.indexOf("SCENARIO:") === 0) s.scenario = line.substring(9).trim();
    }
    return s;
}

// Parse a [CHARACTER_DEF] block out of a message. Returns null if absent.
function parseDef(text) {
    var d = { name: "", persona: "", scenario: "" };
    var start = text.indexOf("[CHARACTER_DEF]");
    if (start === -1) return null;
    var end = text.indexOf("[/CHARACTER_DEF]");
    if (end === -1) end = text.length;
    var block = text.substring(start, end);
    var lines = block.split("\n");
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line.indexOf("NAME:") === 0) d.name = line.substring(5).trim();
        else if (line.indexOf("PERSONA:") === 0) d.persona = line.substring(8).trim();
        else if (line.indexOf("SCENARIO:") === 0) d.scenario = line.substring(9).trim();
    }
    if (!d.persona && !d.scenario) return null; // not a real draft
    return d;
}

// Find the most recent [CHARACTER_DEF] across recent messages (newest first).
function findLatestDef() {
    var msgs = (context.chat && context.chat.last_messages) || [];
    for (var i = msgs.length - 1; i >= 0; i--) {
        var m = msgs[i];
        var text = "";
        if (typeof m === "string") text = m;
        else if (m && m.message) text = m.message;
        else if (m && m.text) text = m.text;
        if (!text) continue;
        var d = parseDef(text);
        if (d) return d;
    }
    return null;
}

// ---- main ----------------------------------------------------------

function run() {
    // Context guards - never crash on missing fields.
    context.character = context.character || {};
    context.character.personality = context.character.personality || "";
    context.character.scenario = context.character.scenario || "";

    var scenario = context.character.scenario;
    var last = String((context.chat && context.chat.last_message) || "");
    var lastLower = last.toLowerCase();

    // === The if-NOT finished test ===
    var isSetup = scenario.startsWith("{SETUP}");  // still building
    var isEmpty = scenario.replace(/\s/g, "") === ""; // never started
    var handoff = scenario.includes("{HANDOFF}");

    if (!isSetup && !isEmpty && !handoff) {
        // Finished: a real scenario is in place and there is no {SETUP}.
        // The character is live -> leave everything alone.
        return;
    }

    // Read back any stored state (empty when booting).
    var st = { name: "", persona: "", scenario: "" };
    if (isSetup) st = parseState(scenario);

    // 1) Capture the latest draft the AI presented (only if it changed).
    var fresh = findLatestDef();
    if (fresh) {
        var same = (fresh.name === st.name &&
                    fresh.persona === st.persona &&
                    fresh.scenario === st.scenario);
        if (!same) {
            st.name = fresh.name;
            st.persona = fresh.persona;
            st.scenario = fresh.scenario;
        }
    }

    // 2) Approval / revision.
    var hasApprove = last.includes("[APPROVE]");
    var hasRevise = last.includes("[REVISE]");

    if (hasApprove && st.persona && st.scenario) {
        // FINALIZE: write the approved data into the real fields.
        // (name is read-only, so it lives inside the persona text.)
        context.character.personality = st.persona;
        context.character.scenario = st.scenario + HANDOFF_INSTRUCTION;
        return;
    }
    
    if (handoff !== -1) {
        context.character.scenario = context.character.scenario.substring(0, h).trim();
        return;
    }
    
    // 3) Persist state + keep the AI in "designer" mode.
    context.character.scenario = buildState(st);
    context.character.personality = ACTIVE_PERSONA;
}

run();
