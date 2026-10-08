import type { TermInsight } from "@/utils/term-insight/types"
import { Entity } from "dexie"

export default class TermInsightCache extends Entity {
  key!: string // Sha256Hex(title, textHash, providerIdentity, TERM_INSIGHT_VERSION)
  terms!: TermInsight[]
  createdAt!: Date
}
