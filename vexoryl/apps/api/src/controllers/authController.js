import { authenticate, createUser } from '../models/store.js';
import { issueToken } from '../middleware/auth.js';

export async function signup(req, res) { const { name, email, password } = req.body; if (!name || !email || !password || password.length < 8) return res.status(400).json({ error: 'Name, email, and an 8-character password are required' }); try { const user = await createUser({ name, email: email.toLowerCase(), password }); res.status(201).json({ user, token: issueToken(user) }); } catch (error) { res.status(409).json({ error: error.message }); } }
export async function login(req, res) { const { email, password } = req.body; const user = await authenticate(email?.toLowerCase(), password || ''); if (!user) return res.status(401).json({ error: 'Email or password is incorrect' }); res.json({ user, token: issueToken(user) }); }
