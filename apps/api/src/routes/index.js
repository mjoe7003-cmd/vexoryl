import { Router } from 'express';
import { login, signup } from '../controllers/authController.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { analytics, audienceExport, browse, chat, communityFeed, communityPost, connect, create, createLiveStream, createTaskBid, detail, engage, follow, following, listTaskBids, monitoring, panic, purchaseAccess, transition, unfollow, wallet, walletBalance } from '../controllers/streamController.js';
import { payout } from '../controllers/monetizationController.js';
import { triggerDirectorEvent } from '../controllers/directorController.js';
import { gift } from '../controllers/giftController.js';
import { moderateTextInput } from '../middleware/moderation.js';
import { requirePayoutEligibility } from '../middleware/governance.js';

const router = Router();
router.post('/auth/signup', signup);
router.post('/auth/login', login);
router.get('/streams', browse);
router.get('/users/me/following', requireAuth, following);
router.post('/creators/:creatorId/follow', requireAuth, follow);
router.delete('/creators/:creatorId/follow', requireAuth, unfollow);
router.get('/community', requireAuth, communityFeed);
router.post('/community/posts', requireAuth, communityPost);
router.get('/community/audience/export', requireAuth, audienceExport);
router.get('/streams/:id', detail);
router.post('/streams/:id/access', requireAuth, purchaseAccess);
router.post('/streams', requireAuth, create);
router.post('/streams/live', requireAuth, createLiveStream);
router.post('/streams/:id/:action(start|stop)', requireAuth, transition);
router.post('/streams/:id/panic', requireAuth, panic);
router.post('/streams/:id/connect', connect);
router.post('/streams/:id/chat', moderateTextInput, chat);
router.get('/streams/:id/task-bids', requireAuth, listTaskBids);
router.post('/streams/:id/task-bids', requireAuth, createTaskBid);
router.post('/streams/:id/:type(reactions|polls|moderation)', requireAuth, engage);
router.get('/wallet', requireAuth, walletBalance);
router.post('/wallet/:type(deposit|withdraw|payout)', requireAuth, wallet);
router.post('/monetization/payout', requireAuth, requirePayoutEligibility, payout);
router.post('/monetization/gift', requireAuth, gift);
router.post('/streams/:id/director/triggers', requireAuth, triggerDirectorEvent);
router.get('/analytics/overview', requireAuth, analytics);
router.post('/ai/insights', requireAuth, async (req, res) => {
  const { totalViewers = 0, engagementRate = 0, demographics = [], devices = [], revenue = {} } = req.body || {};
  const mobileShare = Number(devices.find((device) => device.name === 'Mobile')?.viewers || 0);
  const topRegion = [...(demographics || [])].sort((a, b) => Number(b.viewers || 0) - Number(a.viewers || 0))[0];
  const suggestions = [];

  if (Number(engagementRate) < 18) {
    suggestions.push({ title: 'Shorten the opening', detail: 'The first 20 seconds are losing attention. Tighten the introduction and make the hook immediate.' });
  }

  if (mobileShare >= 55) {
    suggestions.push({ title: 'Lean into mobile-first moments', detail: 'Most viewers are on mobile, so shorten prompts and use stronger on-screen calls to action.' });
  }

  if (Number(revenue.gifts || 0) > Number(revenue.subscriptions || 0)) {
    suggestions.push({ title: 'Double down on gift moments', detail: 'Gift activity is outpacing subscriptions. Try a milestone prompt or challenge to convert more viewers.' });
  }

  if (topRegion) {
    suggestions.push({ title: `Tailor the next session to ${topRegion.name}`, detail: `${topRegion.name} is driving the biggest audience share. A region-specific hook could improve retention.` });
  }

  if (suggestions.length === 0) {
    suggestions.push({ title: 'Keep the current momentum', detail: 'The room is healthy. Maintain the format and test one new hook next time.' });
  }

  return res.json({
    source: 'heuristic',
    summary: `Based on ${Number(totalViewers).toLocaleString()} viewers and ${Number(engagementRate)}% engagement, the current room is showing ${Number(engagementRate) < 18 ? 'early retention risk' : 'good momentum'}.`,
    suggestions: suggestions.slice(0, 3),
    warnings: [],
  });
});
router.get('/admin/monitoring', requireAuth, requireAdmin, monitoring);
export default router;
