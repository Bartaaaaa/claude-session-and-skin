# claude-session-and-skin

Mods for [Claude Code](https://claude.com/claude-code).

## session-usage

A usage bar above the prompt, with a little character who gets more and more nervous as your 5-hour session is used up.

```
  ▐▛███▜▌  ♪
 ▝▜█████▛▘  ▰▰▰▰▰▰▰▰▰▰ 45%   │ 7d ▰▰▰▰▰▰▰ 31% │ ↻ 2h10 · +12%/h · sess 1h05
  ▝▝   ▘▘
```

### What it shows

- **5h session**: a green → red gradient bar and the % used.
- **7-day window**: one cell per day, coloured by that day's usage against a 20 % daily budget, then the weekly %.
- **Extras**: time until the 5h reset, usage rate in %/h, and how long this Claude Code session has been running. Each one can be turned off.
- **On hover**: reset time, projected time to reach 100 % (with ⚠ if that comes before the reset), and when the week resets.

### The character

Its mood follows the 5h session:

| Usage | Mood |
| --- | --- |
| 0–20 % | zen |
| 20–60 % | all good |
| 60–80 % | hmm… |
| 80–90 % | heating up |
| 90–95 % | panic |
| 95–100 % | table flip |
| 100 % | K.O. |

It also acts out what Claude is doing (thinking, coding, reading, running a command, searching the web, delegating to an agent), watches an hourglass while background agents run, falls asleep after 25 minutes idle, gets dazed when a tool fails, and celebrates when the 5h session resets. While a character is shown, Claude Code's own "Clauding…" spinner line is hidden.

Characters: `clawd` (default), `smiley`, `whale`, `cat`, `crewmate`, `dino`, `bb8`, or `none` for the bar only.

## Installation

From a terminal:

```sh
claude plugin install session-usage --marketplace Bartaaaaa/claude-session-and-skin
```

Or inside Claude Code:

```
/plugin marketplace add Bartaaaaa/claude-session-and-skin
/plugin install session-usage@bart-claude-mods
```

The terminal command installs it for every project. With `/plugin`, pick the *user* scope to get the same. Then restart Claude Code.

### Requirements

- A recent Claude Code version (tested with 2.1.310).
- Signed in with a Claude Pro or Max subscription: the 5-hour and weekly limits come from it. Without them the bar shows `—`.
- A terminal with true colour.
- For `whale`, `cat`, `crewmate`, `dino` and `bb8`: a font with the Unicode *Symbols for Legacy Computing* block (sextant characters), e.g. Cascadia Code, Iosevka, or a terminal that draws them itself (Kitty, WezTerm, foot, recent GNOME Terminal). If you see boxes instead of the character, use `clawd` or `smiley`, which only need standard block characters.

## Usage

| Command | Effect |
| --- | --- |
| `/usage-skin` | Lists the characters with a preview |
| `/usage-skin <name>` | Switches character (kept across sessions) |
| `/usage-demo` | Plays every mood and animation, 3 s each |

### Options

In `/config`, under session-usage:

| Option | Default | Shows |
| --- | --- | --- |
| `showResetIn` | on | time until the 5h reset, e.g. `↻ 1h52` |
| `showRate` | on | usage rate, e.g. `+18%/h` (after 5 minutes of readings) |
| `showSessionTime` | on | session duration, e.g. `sess 2h05` |

Or from a terminal: `claude plugin configure session-usage`.

### Update / uninstall

```sh
claude plugin update session-usage
claude plugin uninstall session-usage
```

## Troubleshooting

- **Nothing appears**: restart Claude Code after installing, and check that `claude plugin list` shows `session-usage` as enabled.
- **Boxes instead of the character**: your font lacks sextant characters (see Requirements); switch with `/usage-skin clawd`.
- **No `%/h` rate**: it appears after 5 minutes of readings in the current 5h window.

## Development

```sh
git clone https://github.com/Bartaaaaa/claude-session-and-skin
cd claude-session-and-skin
claude plugin validate .
claude plugin test session-usage
claude plugin install session-usage --marketplace .
```

Layout of `session-usage/hooks/`:

| File | Role |
| --- | --- |
| `register.tsx` | Hooks: usage readings, commands, rendering of the bar |
| `look.ts` | Moods, activities, one-line faces, colours, week tracking |
| `tall.ts` | Shared engine of the 3-line characters (scenes, blinking, pixels → sextants) |
| `clawd.ts`, `whale.ts`, `cat.ts`, `crewmate.ts`, `dino.ts`, `bb8.ts` | One file per 3-line character |

To add a character, copy one of the character files, describe its scenes, register it in `TALL` (`register.tsx`) and `SKINS` (`look.ts`), then check every state with `/usage-demo`.

Issues and pull requests are welcome; run `claude plugin test session-usage` before submitting.

## License

MIT. Unofficial mod, not affiliated with Anthropic. Clawd is the Claude Code mascot; the crewmate (Among Us), the dino (Chrome) and BB-8 (Star Wars) belong to their respective owners.
