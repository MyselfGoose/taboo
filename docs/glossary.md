# Glossary

## Teams

- **Team Alpha** — `team === "A"` in data; labeled “Alpha” in UI.
- **Team Beta** — `team === "B"`; labeled “Beta” in UI.

## Roles (`viewerRole`)

| Value | Meaning |
|-------|---------|
| `clue_giver` | Current turn’s player giving clues |
| `teammate_guesser` | Same team as clue giver; types guesses |
| `opponent_observer` | Other team; watches card and may call Taboo |
| `spectator` | No active seat or post-game observer-style view |

## Game status (`game.status`)

| Status | Meaning |
|--------|---------|
| `waiting_to_start_turn` | Next clue giver must start the timer |
| `turn_in_progress` | Active turn (may still be labeled `in_progress` in older paths; client may normalize) |
| `between_turns` | Short delay before next player in the round |
| `between_rounds` | Longer delay between round cycles |
| `finished` | Match over |

## Review (`game.review`)

| `review.status` | Meaning |
|-----------------|--------|
| `available` | Penalized team may open review or dismiss |
| `in_progress` | Voting active |
| `resolved` | Outcome computed; clue giver may continue |

| `review.outcome` | Meaning |
|------------------|--------|
| `reverted` | Taboo −1 was undone |
| `upheld` | Taboo penalty stands |

## WebSocket message types

- **`subscribe`** — Join realtime channel for a lobby  
- **`subscribed`** — Ack with initial snapshot  
- **`lobby_state`** — Updated snapshot + `reason`  
- **`error`** — Failure; often includes `code`  
- **`pong`** — Ping response  

## HTTP vs WS

- **HTTP** — Create/join/restore/categories/lobby fetch/leaderboard; returns JSON.  
- **WS** — Ongoing lobby sync and all in-game actions after subscribe.

## See also

- [Game logic](game-logic.md)  
- [API reference](api-reference.md)  
