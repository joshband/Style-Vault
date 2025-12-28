import type { Express } from "express";
import { type Server } from "http";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { registerAdminRoutes } from "./admin-routes";
import { pipelineBridge } from "./pipeline-bridge";
import { registerDomainRouters } from "./routes/index";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);
  
  registerObjectStorageRoutes(app);
  
  registerAdminRoutes(app);

  pipelineBridge.startServer().then((started) => {
    if (started) {
      console.log("[Routes] Pipeline server started successfully");
    } else {
      console.log("[Routes] Pipeline server not available, using fallback mode");
    }
  }).catch((err) => {
    console.warn("[Routes] Failed to start pipeline server:", err);
  });

  registerDomainRouters(app);

  return httpServer;
}
