class MatchHistoryRepository {
  constructor({ db }) {
    this.db = db;
  }

  insertMatch({
    id,
    endedAt,
    startedAt,
    durationMs,
    teamAScore,
    teamBScore,
    totalRounds,
    winner,
    categoryMode,
    categoryIds,
    summaryJson,
    playerStats,
  }) {
    const insertMatch = this.db.prepare(`
      INSERT INTO match_results (
        id, ended_at, started_at, duration_ms,
        team_a_score, team_b_score, total_rounds, winner,
        category_mode, category_ids_json, summary_json
      ) VALUES (
        @id, @ended_at, @started_at, @duration_ms,
        @team_a_score, @team_b_score, @total_rounds, @winner,
        @category_mode, @category_ids_json, @summary_json
      )
    `);

    const insertPlayer = this.db.prepare(`
      INSERT INTO match_player_stats (
        match_id, player_name, team,
        correct_guesses, close_guesses, wrong_guesses, skips, taboos_called
      ) VALUES (
        @match_id, @player_name, @team,
        @correct_guesses, @close_guesses, @wrong_guesses, @skips, @taboos_called
      )
    `);

    const transaction = this.db.transaction(() => {
      insertMatch.run({
        id,
        ended_at: endedAt,
        started_at: startedAt,
        duration_ms: durationMs,
        team_a_score: teamAScore,
        team_b_score: teamBScore,
        total_rounds: totalRounds,
        winner,
        category_mode: categoryMode,
        category_ids_json: JSON.stringify(categoryIds || []),
        summary_json: summaryJson,
      });

      for (const row of playerStats) {
        insertPlayer.run({
          match_id: id,
          player_name: row.playerName,
          team: row.team,
          correct_guesses: row.correctGuesses,
          close_guesses: row.closeGuesses,
          wrong_guesses: row.wrongGuesses,
          skips: row.skips,
          taboos_called: row.taboosCalled,
        });
      }
    });

    transaction();
  }

  listRecentMatches({ limit = 10 } = {}) {
    const rows = this.db
      .prepare(
        `
      SELECT id, ended_at, team_a_score, team_b_score, winner, summary_json
      FROM match_results
      ORDER BY ended_at DESC
      LIMIT ?
    `,
      )
      .all(limit);

    return rows.map((row) => ({
      id: row.id,
      endedAt: row.ended_at,
      teamAScore: row.team_a_score,
      teamBScore: row.team_b_score,
      winner: row.winner,
      summary: safeJson(row.summary_json),
    }));
  }

  listLeaderboardHighScores({ limit = 20 } = {}) {
    const rows = this.db
      .prepare(
        `
      SELECT
        id,
        ended_at,
        team_a_score,
        team_b_score,
        winner,
        (team_a_score + team_b_score) AS total_points,
        summary_json
      FROM match_results
      ORDER BY total_points DESC, ended_at DESC
      LIMIT ?
    `,
      )
      .all(limit);

    return rows.map((row) => ({
      id: row.id,
      endedAt: row.ended_at,
      teamAScore: row.team_a_score,
      teamBScore: row.team_b_score,
      winner: row.winner,
      totalPoints: row.total_points,
      summary: safeJson(row.summary_json),
    }));
  }

  listTopPlayersByCorrect({ limit = 15 } = {}) {
    return this.db
      .prepare(
        `
      SELECT player_name, team, SUM(correct_guesses) AS total_correct, COUNT(*) AS games
      FROM match_player_stats
      GROUP BY lower(player_name), team
      ORDER BY total_correct DESC
      LIMIT ?
    `,
      )
      .all(limit);
  }

  deleteOlderThan(cutoffMs) {
    const result = this.db
      .prepare(`DELETE FROM match_results WHERE ended_at < ?`)
      .run(cutoffMs);
    return result.changes;
  }
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

module.exports = {
  MatchHistoryRepository,
};
