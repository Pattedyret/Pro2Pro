import { getDb } from '../db';

export interface DailyPuzzle {
  id: number;
  puzzle_number: number;
  date: string;
  start_player_id: number;
  end_player_id: number;
  optimal_path_length: number;
  num_valid_paths: number;
  difficulty: string;
}

export function getTodayPuzzle(): DailyPuzzle | null {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  return db.prepare('SELECT * FROM daily_puzzles WHERE date = ?').get(today) as DailyPuzzle | null;
}

export function savePuzzle(puzzle: Omit<DailyPuzzle, 'id'>): DailyPuzzle {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO daily_puzzles (puzzle_number, date, start_player_id, end_player_id, optimal_path_length, num_valid_paths, difficulty)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    puzzle.puzzle_number,
    puzzle.date,
    puzzle.start_player_id,
    puzzle.end_player_id,
    puzzle.optimal_path_length,
    puzzle.num_valid_paths,
    puzzle.difficulty
  );

  return { id: Number(result.lastInsertRowid), ...puzzle };
}

export function getPuzzleById(id: number): DailyPuzzle | null {
  const db = getDb();
  return db.prepare('SELECT * FROM daily_puzzles WHERE id = ?').get(id) as DailyPuzzle | null;
}

export function getPuzzleByNumber(num: number): DailyPuzzle | null {
  const db = getDb();
  return db.prepare('SELECT * FROM daily_puzzles WHERE puzzle_number = ?').get(num) as DailyPuzzle | null;
}
