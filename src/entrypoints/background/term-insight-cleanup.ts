import { browser } from "#imports"
import { db } from "@/utils/db/dexie/db"
import { logger } from "@/utils/logger"

export const TERM_INSIGHT_CACHE_CLEANUP_ALARM = "term-insight-cache-cleanup"
// Longer than the other caches: terms of a page rarely change, and each entry
// costs one model call to rebuild.
export const TERM_INSIGHT_CACHE_MAX_AGE_MINUTES = 30 * 24 * 60
const CHECK_INTERVAL_MINUTES = 24 * 60

export async function cleanupOldTermInsightCache() {
  try {
    const cutoffDate = new Date(Date.now() - TERM_INSIGHT_CACHE_MAX_AGE_MINUTES * 60 * 1000)
    const deletedCount = await db.termInsightCache.where("createdAt").below(cutoffDate).delete()

    if (deletedCount > 0) {
      logger.info(`Term insight cache cleanup: Deleted ${deletedCount} old entries`)
    }
  } catch (error) {
    logger.error("Failed to cleanup old term insight cache:", error)
  }
}

/** Register synchronously so the alarm can wake the background during initialization. */
export async function setUpTermInsightCleanup() {
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === TERM_INSIGHT_CACHE_CLEANUP_ALARM) {
      await cleanupOldTermInsightCache()
    }
  })

  if (!(await browser.alarms.get(TERM_INSIGHT_CACHE_CLEANUP_ALARM))) {
    void browser.alarms.create(TERM_INSIGHT_CACHE_CLEANUP_ALARM, {
      delayInMinutes: 1,
      periodInMinutes: CHECK_INTERVAL_MINUTES,
    })
  }
}
