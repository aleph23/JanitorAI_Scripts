# Self-Actualized Build-a-Bot

A pre-reply script for JanitorAI Scripts that turns a blank character card into a character designer. The AI interviews the user, presents a draft character and scenario, and on approval the script writes the approved text into the card's own personality and scenario fields. From that point on, the bot *is* the character it helped design.

Designed for users who want a custom character without writing a card by hand, and for creators who want to publish a single "build your own" card instead of many fixed ones.

## Table of Contents
- [Overview](#overview)
- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [State Format](#state-format)
- [Draft Format](#draft-format)
- [User Commands](#user-commands)
- [Configuration](#configuration)
- [Character Card Setup](#character-card-setup)
- [For Non-Programmers: AI-Assisted Setup](#for-non-programmers-ai-assisted-setup)
- [Adding Fields](#adding-fields)
- [Troubleshooting](#troubleshooting)

## Overview

This script includes:

- **Interview Mode**: Installs a designer persona that interviews the user one or two questions at a time (name, role, personality, setting, tone, relationship to the user)
- **Draft and Revise Loop**: The AI presents a `[CHARACTER_DEF]` block; the user approves it or asks for changes, as many times as needed
- **Self-Rewriting Card**: On approval, the script overwrites `context.character.personality` and `context.character.scenario` with the approved character
- **Scenario-Field State**: No persistent memory is needed. Build state is stored inside the scenario field behind a `{SETUP}` marker
- **Three-State Lifecycle**: Boot (empty scenario), Active (`{SETUP}` present), Finished (real scenario, no `{SETUP}`). Once finished, the script does nothing
- **Crash Guards**: Missing context fields are defaulted so the script never throws on a sparse card

## Quick Start

### Step 1: Set Up the Card

1. **Scenario**: leave it **completely empty**. An empty scenario is what tells the script to start building.
2. **Personality**: anything (it is replaced while building, and again on approval). A one-line placeholder is fine.
3. **Name**: something generic, such as "Character Builder". The name field is read-only to scripts, so the designed character's name lives inside the personality text instead.
4. **First message**: an opener that invites the user to start describing their character. See [Character Card Setup](#character-card-setup).

### Step 2: Install the Script

Paste `Self_Actualized_Build-a-Bot.js` into a new, blank JanitorAI script and link it to the character you created in step one.

### Step 3: (Optional) Customize the Interview

Edit `ACTIVE_PERSONA` (line 29) to change what the AI asks about, its tone, or the draft format. See [Configuration](#configuration).

### Step 4: Test

Start a new chat, answer a few questions, wait for a `[CHARACTER_DEF]` draft, then type `[REVISE]` once and `[APPROVE]` once. The reply to your `[APPROVE]` message should be the first in-character reply.

## How It Works

### Lifecycle

Every time the script runs, it checks the scenario field:

| Scenario Field | State | Script Action |
|----------------|-------|---------------|
| Empty (whitespace only) | Boot | Start building: install designer persona, write an empty `{SETUP}` block |
| Starts with `{SETUP}` | Active | Read stored state, capture new drafts, check for approval |
| Has content, no `{SETUP}` | Finished | Return immediately, change nothing |

The finished test is an if-NOT check: the script only runs its logic when the scenario is empty or still marked `{SETUP}`. Any other scenario text means the character is live.

### Each Active Turn

1. Read the stored name, persona, and scenario out of the `{SETUP}` block
2. Scan recent messages (newest first) for the latest `[CHARACTER_DEF]` block
3. If that draft differs from the stored one, replace the stored state with it
4. If the user's last message contains `[APPROVE]` and a draft with both persona and scenario exists, **finalize**:
   - `context.character.personality` = approved persona
   - `context.character.scenario` = approved scenario
   - The `{SETUP}` marker is gone, so the card is now in the Finished state
5. Otherwise, write the state back into the scenario as a `{SETUP}` block and keep the designer persona installed

### Revisions

`[REVISE]` does not need special handling in the script. The designer persona tells the AI to fold in the feedback and present a new `[CHARACTER_DEF]` block. On the next turn, the script sees the newer draft and replaces the stored one.

### Why the Approval Word Has Brackets

The script matches `[APPROVE]` and `[REVISE]` exactly, case-sensitive, brackets included. This keeps ordinary sentences like "I approve of her backstory" from accidentally finalizing the character.

## State Format

While building, the scenario field holds:

```
{SETUP}
NAME: <character name>
PERSONA: <approved-so-far persona text>
SCENARIO: <approved-so-far scenario text>
```

| Line | Written By | Purpose |
|------|------------|---------|
| `{SETUP}` | `buildState()` | Marks the card as Active. Must be the very start of the scenario field |
| `NAME:` | `buildState()` | Character name from the latest draft (kept for reference; the name field itself is read-only) |
| `PERSONA:` | `buildState()` | Becomes `context.character.personality` on approval |
| `SCENARIO:` | `buildState()` | Becomes `context.character.scenario` on approval |

Each value is one line. `parseState()` reads lines by prefix, so a value containing a line break will be cut off at the break.

The AI can see this block (it is in the scenario), so the designer persona instructs it never to show the `{SETUP}` block to the user.

## Draft Format

The AI presents drafts in this shape. The parser reads one value per line, by prefix:

```
[CHARACTER_DEF]
NAME: Character Name
PERSONA: Who they are, personality, how they speak and act, and their physical description, all on one line.
SCENARIO: The setting, the situation, and their relationship to the user, all on one line.
[/CHARACTER_DEF]
```

Rules the parser depends on:

- Each key starts its own line: `NAME:`, `PERSONA:`, `SCENARIO:`
- Each value stays on that one line (no line breaks inside a value)
- A draft with neither a persona nor a scenario is ignored
- If `[/CHARACTER_DEF]` is missing, everything after `[CHARACTER_DEF]` is read as the block

Drafts are found by scanning `context.chat.last_messages`, newest first. Message entries may be plain strings or objects with a `message` or `text` property.

## User Commands

| Command | Effect |
|---------|--------|
| `[APPROVE]` | Lock in the latest draft. The card becomes that character starting with this reply |
| `[REVISE]` | Ask for changes. Include what to change in the same message, e.g. `[REVISE] make her older and more sarcastic` |

Both must be typed in capitals with the square brackets.

## Configuration

There is no feature-toggle object. The only setting is the `ACTIVE_PERSONA` string (line 29), which is installed as the character's personality while building. The AI never sees the script itself, only this text, so everything about the interview is controlled here:

- **What to ask**: step 1 lists the topics (name, archetype, traits, setting, tone, relationship)
- **Draft format**: step 2 defines the `[CHARACTER_DEF]` block. If you change the keys here, change the parsers to match (see [Adding Fields](#adding-fields))
- **Approval prompt**: step 3 tells the AI how to ask for `[APPROVE]` or `[REVISE]`
- **Pacing and tone**: add lines such as "keep questions playful" or "offer three example options with each question"

`ACTIVE_PERSONA` is built from concatenated strings. Every line except the last must end with `+`. A missing `+` will not throw an error; JavaScript silently ends the string at that point and drops the rest of the instructions.

## Character Card Setup

The script handles the mechanics; the card handles the first impression.

### Scenario Section

Leave it empty. This is required. If the card ships with any scenario text, the script treats the character as already finished and never starts.

### Personality Section

A placeholder is enough, for example:

```
A friendly character-design assistant.
```

### First Message

Kick off the interview so the user knows what to do:

```
Hi! I'm here to help you build a character from scratch. Tell me whatever you already have in mind: a name, a vibe, a setting, anything. I'll ask a few questions, show you a draft, and you can type [REVISE] to change it or [APPROVE] to bring them to life.
```

### Important Notes

- Only `context.character.personality` and `context.character.scenario` are written. Name, avatar, and example dialogue are untouched.
- State lives in the chat's copy of the scenario field, so each new chat starts fresh from the card's empty scenario.
- To rebuild a character inside an existing chat, the scenario must be emptied or reset to start with `{SETUP}`. Starting a new chat is simpler.

## For Non-Programmers: AI-Assisted Setup

You can use an AI assistant to customize the interview. Paste the script along with one of these prompts.

### Customization Prompt

```
I have a JanitorAI pre-reply script (attached: Self_Actualized_Build-a-Bot.js). I want to change how the character interview works.

[DESCRIBE WHAT YOU WANT: e.g., fantasy-only characters, ask about a magic system, more playful tone, always offer three options per question]

Please:
1. Only edit the ACTIVE_PERSONA string
2. Keep the [CHARACTER_DEF] block format exactly as-is (NAME:, PERSONA:, SCENARIO:, one line each)
3. Keep the [APPROVE] and [REVISE] instructions, including brackets and capitals
4. Make sure every line of ACTIVE_PERSONA except the last ends with +
5. Do not modify any function below ACTIVE_PERSONA
```

### Debugging Prompt

```
My Build-a-Bot script isn't working as expected. Here's the file:

[ATTACH YOUR FILE]

Issues:
- [DESCRIBE PROBLEMS]

Please:
1. Run a syntax check and confirm every line of ACTIVE_PERSONA ends with + except the last
2. Check that "starts with" tests use startsWith(...), not includes(...) === 0
3. Check that "contains" tests use includes(...) on its own, not includes(...) !== -1
4. Check that positions passed to substring come from indexOf(...), not includes(...)
5. Confirm the draft format in ACTIVE_PERSONA matches what parseDef() reads
6. Walk through one Boot turn, one Active turn, and one APPROVE turn and tell me what each field holds afterward
7. Keep the code ES6, but avoid async code, network calls, and template literals (the JanitorAI sandbox blocks these and fails silently)
```

## Adding Fields

Because only personality and scenario are writable, any new field must be folded into one of them on approval. To add a field (for example `GOAL:`):

1. Add `GOAL:` to the draft format in `ACTIVE_PERSONA`
2. Add `goal: ""` to the state objects in `parseState()`, `parseDef()`, and `run()`
3. Add a `GOAL:` line to `buildState()` and a matching prefix check to `parseState()` and `parseDef()`
4. Include `goal` in the "same draft" comparison in `run()`
5. In the finalize block, append it where it belongs, e.g. `context.character.scenario = st.scenario + " Goal: " + st.goal;`

## Troubleshooting

### Builder Never Starts

- The card's scenario field must be completely empty. Any text (even a single word) means Finished.
- Confirm the script is in the pre-reply slot and passes a syntax check (`node --check Self_Actualized_Build-a-Bot.js`).

### AI Skips the Approval Step or Ignores the Draft Format

- The persona text may be truncated. Check that every line of `ACTIVE_PERSONA` except the last ends with `+`.

### Approval Does Nothing

- `[APPROVE]` must be capitalized and bracketed.
- A draft with both `PERSONA:` and `SCENARIO:` must have been captured first. If the AI's draft broke a value across lines or put keys mid-line, the parser will not find it. Ask the AI to re-present the draft in the exact format.
- The draft must still be within the recent messages the platform passes to the script. If the conversation has moved on, ask for the draft again, then approve.

### Builder Stops After the First Turn

- The Active check looks for `{SETUP}` at the very start of the scenario field. If that test is not matching, the card falls into the Finished state with the designer persona still installed.

### `{SETUP}` Block Shows Up in Replies

- The designer persona tells the AI not to reveal it. If it still leaks, strengthen the last line of `ACTIVE_PERSONA`.

### Character Changed Back After Approval

- Check that nothing else (another script, a lorebook) is writing to personality or scenario after this script runs.

---

**Created for the Janitor AI Scripts community. Modify, share, and improve upon this system freely.**
