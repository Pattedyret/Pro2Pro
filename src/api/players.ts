import { Router } from 'express';
import { playerGraph } from '../game/graph';
import { authRequired } from './middleware';

const router = Router();

// GET /players/search?q=...
router.get('/search', authRequired, (req, res) => {
  const query = ((req.query.q as string) ?? '').trim();
  if (query.length < 1) {
    res.json({ players: [] });
    return;
  }

  let results = playerGraph.searchPlayers(query, 15);

  // Fuzzy fallback
  if (results.length === 0) {
    results = playerGraph.fuzzySearchPlayers(query, 10);
  }

  const players = results.map(p => ({
    id: p.id,
    name: p.name,
    nationality: p.nationality,
    imageUrl: p.imageUrl,
    teams: playerGraph.getPlayerTeams(p.id).slice(0, 3),
    fullTeamNames: playerGraph.getPlayerFullTeamNames(p.id, 2),
  }));

  res.json({ players, fuzzy: results.length > 0 && playerGraph.searchPlayers(query, 1).length === 0 });
});

export default router;
