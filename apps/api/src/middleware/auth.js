import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'development-secret');
if (!secret) throw new Error('JWT_SECRET must be configured in production');
export function issueToken(user) { return jwt.sign({ sub: user.id, name: user.name, role: user.role }, secret, { expiresIn: '7d' }); }
export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try { req.user = jwt.verify(token, secret); next(); } catch { return res.status(401).json({ error: 'Invalid or expired token' }); }
}
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}
