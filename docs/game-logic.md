# Game logic

This document describes behavior as implemented in **`LobbyService`** and related code. In-app copy for players may differ slightly in wording; trust the server for exact rules.

## Lobby and teams

- Each lobby has a short **code**, a **host**, and a list of **players**.
- Each player has a **team**: `A` (Alpha) or `B` (Beta).
- The game **does not start** until:
  - At least **two** players are present,
  - **Both teams** have at least one player,
  - **Every** player has toggled **Ready**.

## Settings

- **Round count** — how many “round cycles” the match runs (see turns below).
- **Round duration** — length of each **active clue turn** in seconds (validated in 30-second steps).
- **Categories** — either one category or all categories from the dataset; the deck is built from selected category IDs.

## Turn order

Turns **interleave** teams (A, B, A, B, …) with a deterministic rotation so different players start each round. If team sizes differ, the schedule still walks the built order until the round’s turn list is done.

Implementation detail: see `buildTurnOrder` in [`lobbyService.js`](../backend/src/services/lobbyService.js).

## Game phases (status)

| Status | Typical UI |
|--------|------------|
| `waiting_to_start_turn` | “Start turn” for the active clue giver |
| `turn_in_progress` | Timer running; guesses / skip / taboo |
| `between_turns` | Short pause before the next clue giver |
| `between_rounds` | Longer pause; scores; next round |
| `finished` | Game over / recap |

Legacy note: some code normalizes an older `in_progress` label to `turn_in_progress` in the client.

## Roles (per viewer)

The server assigns a **`viewerRole`** for each snapshot:

| Role | Who | Card visibility |
|------|-----|-----------------|
| `clue_giver` | Active turn’s player | Sees word + taboo list |
| `teammate_guesser` | Same team, not clue giver | Does **not** see card; can guess |
| `opponent_observer` | Other team | Sees card (to police taboo) |
| `spectator` | No seat / finished | Limited view |

**Permissions** in the snapshot (`canStartTurn`, `canSubmitGuess`, …) are derived from role + phase + review state.

## Scoring

| Event | Points |
|-------|--------|
| Correct guess | **+1** to the **active** team |
| Skip card | **0** |
| Turn timeout | **0** for the turn |
| Taboo called | **−1** to the **active** team (clue giver’s team) |

## Guesses

- Only **teammates** (not the clue giver) may submit guesses during an active turn.
- The server normalizes text and applies **exact**, **plural**, and **bounded fuzzy** matching (see [`guessMatch.js`](../backend/src/utils/guessMatch.js)).
- A **close** guess (almost right) records a **`close_guess`** history entry and **does not** award a point—players get feedback without changing score.

## Deck behavior

- The game maintains a **draw pile** and a **discard pile**.
- When moving to the next card, the current card goes to **discard**, then a card is drawn from the draw pile.
- When the draw pile is **empty** but discard has cards, **discard is shuffled** into the new draw pile (no immediate repeat of the whole pool until exhaustion).

## Taboo and review

1. **Opponents** may call **Taboo** once per card (while a turn is active and no blocking review).
2. The active team’s score is penalized; a **review** object may become **`available`**.
3. The **penalized team** may **request review** or **dismiss** it.
4. If review starts, the turn timer is **paused**; **only players on the penalized team** vote **fair** or **not_fair**.
5. After **all** eligible penalized-team players vote:
   - If **not_fair** votes **strictly outnumber** **fair** votes, the **−1 is reverted**.
   - If tied or more **fair**, the penalty **stands**.

Then the clue giver may **continue** the turn with the remaining time.

## History

Actions append to **`game.history`** (trimmed server-side). The feed powers the in-game activity list and post-game recap stats.

## See also

- [Realtime system](realtime-system.md) — how actions reach the server  
- [API reference](api-reference.md) — `game_action` names  
- [Glossary](glossary.md) — status and role names  
