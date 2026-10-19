import { handler } from '../leaderboard-api/server.js';

export default function apiHandler(req, res) {
  return handler(req, res);
}
