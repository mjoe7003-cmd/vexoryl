import app from './app.js';
import { listExpiredVods, markVodDeleted } from './models/store.js';
import { deleteMuxAsset, getMuxLiveStream } from './services/muxService.js';

const host = process.env.HOST || '0.0.0.0';
const port = process.env.PORT || 4000;
app.listen(port, host, () => console.log(`Vexoryl API listening on http://${host}:${port}`));

async function cleanupExpiredVods() {
	for (const stream of listExpiredVods()) {
		try {
			let assetId = stream.muxAssetId;
			if (!assetId && stream.muxStreamId) assetId = (await getMuxLiveStream(stream.muxStreamId))?.recent_asset_id;
			if (assetId) await deleteMuxAsset(assetId);
			markVodDeleted(stream.id);
			console.log(`[Vexoryl] expired VOD deleted: ${stream.id}`);
		} catch (error) {
			console.error(`[Vexoryl] expired VOD cleanup failed: ${stream.id}`, error);
		}
	}
}

const vodCleanupInterval = setInterval(cleanupExpiredVods, 60 * 60 * 1000);
vodCleanupInterval.unref();
