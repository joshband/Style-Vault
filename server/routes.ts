import type { Express } from "express";
import { type Server } from "http";
import { registerDomainRouters } from "./routes/index";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Register all domain-specific routers
  registerDomainRouters(app);

  return httpServer;
}
