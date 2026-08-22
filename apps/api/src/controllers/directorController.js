import { broadcastDirectorTrigger } from '../services/directorService.js';
import { getStream } from '../models/store.js';

export async function triggerDirectorEvent(req, res) {
  const stream = getStream(req.params.id);
  if (!stream) return res.status(404).json({ error: 'Stream not found' });
  if (stream.creator !== req.user.name) return res.status(403).json({ error: 'Only the stream creator can trigger Director Mode events' });
  const event = String(req.body.event || '').trim();
  if (!event || !/^[a-z0-9._-]{1,64}$/i.test(event)) return res.status(400).json({ error: 'A valid event is required' });
  try {
    const delivery = await broadcastDirectorTrigger(stream.id, { event, parameters: req.body.parameters || {}, triggeredBy: req.user.sub, createdAt: new Date().toISOString() });
    return res.status(202).json({ streamId: stream.id, event, delivery });
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
}