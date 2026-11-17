import { randomUUID } from "node:crypto"
import type { RequestHandler, Response } from "express"

const requestIdKey = "requestId"

export const requestContext: RequestHandler = (_request, response, next) => {
  const requestId = randomUUID()
  response.locals[requestIdKey] = requestId
  response.setHeader("X-Request-Id", requestId)
  next()
}

export function requestId(response: Response): string {
  const value = response.locals[requestIdKey]
  return typeof value === "string" ? value : "unknown"
}
