# DESIGN.md

> OrcBot design direction. Read this first for any UI work, then apply `.agents/antislop.md` as the filter.

**Provenance: agent-authored.** Frederick Abila approved having the agent transcribe this direction. The palette is not invented: it is sampled from the shipping brand asset `assets/banner.png`. Correct any field and the agents will follow the corrected file.

## Identity

OrcBot is an autonomous agent orchestrator: a developer tool that runs in the terminal and coordinates LLMs, browser automation, and messaging channels. Its identity is **a control room, not a landing page**. Calm, dense, legible, and specific to the work the operator is doing.

## Personality

- Precise and honest. Reports state, never sells.
- Quiet by default. Speaks up only when something changed or needs a decision.
- One voice: the product's real name and real values, no slogans.

## Palette

Sampled from `assets/banner.png` (dominant `#081838`, brightest accent `#12b8cf`).

| Role | Value | Use |
|---|---|---|
| Base surface | terminal dark, brand navy `#081838` | Background. Dark is chosen, not a trend: this is a terminal tool (R-21). |
| Neutral text | terminal default foreground / white, gray for secondary | Labels, values, body. |
| Accent | brand cyan `#12b8cf` (ANSI cyan / bright cyan) | The **one** accent. Marks the focal element on a screen and the interactive affordance. |
| State: ok | green | Reserved for a real success or connected state. |
| State: warn | yellow | Reserved for a real pending or degraded state. |
| State: danger | red | Reserved for a real error, destructive action, or disarmed guardrail. |

Rules that follow from this palette (R-29, R-01, R-31):

- Maximum one accent (cyan) plus neutrals plus the three state colors. No decorative second accent.
- The state colors are signals, never decoration: yellow only on something actually pending, red only on something actually dangerous, green only on something actually ok.
- No multicolor gradient text or rainbow separators. A single accent-to-neutral fade on a rule is allowed only to separate one level of hierarchy from another.
- No purple, magenta, or blue-to-cyan gradient treatments. They are off-brand and are the default "AI product" look.

## Typography

The terminal already gives us a monospace face and no choice of family, so the type decisions that remain are weight, case, and spacing:

- Weight and brightness carry hierarchy (bold + bright for a focal label, dim for secondary).
- Sentence case for labels and headings. No uppercase with wide letter-spacing as decoration.
- No emoji in UI text. A glyph stays only when it is a real, relevant icon with a written reason; otherwise the label does the work (R-04).
- Box-drawing characters are structure, not ornament: a rule separates, a frame contains. Do not frame every screen the same way.

## Mood

A focused instrument panel. Restrained chrome, generous vertical spacing between blocks, one clear focal element per screen. Liveliness comes from accurate state and real data, not from color or motion.

## Dials

**Dial: ENERGY 1 / RHYTHM 1 / MOTION 1**

- **ENERGY 1 (calm):** a control surface that is read and operated many times a day. It should not shout.
- **RHYTHM 1 (uniform, deliberate):** screens share one predictable skeleton (banner, header, content, prompt) on purpose, so an operator can move between 40 screens without relearning the layout. Uniformity is the decision here, not the accident.
- **MOTION 1 (static):** no ambient animation. A spinner or progress bar may run only while a real operation is in flight.

## Delivery notes

- Non-interactive output (task logs, streaming agent output) is plain text first: no frames around machine-readable output.
- Interactive menus may use inquirer's own list chrome; do not stack a second frame on top of it.
