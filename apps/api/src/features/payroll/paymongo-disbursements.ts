export const payMongoDisbursements = {
  enabled: false,
  reason: "PayMongo transfers are disabled in Phase 6.",
  createBatch: { method: "POST", path: "/v2/batch_transfers" },
} as const
