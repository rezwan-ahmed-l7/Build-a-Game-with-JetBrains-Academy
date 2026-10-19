import { handler } from '../server.js';

export default function apiHandler(req, res) {
  return handler(req, res);
}
