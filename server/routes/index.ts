import type { Express } from "express";
import systemRouter from "./system-router";
import pipelineRouter from "./pipeline-router";
import visionRouter from "./vision-router";
import analyticsRouter from "./analytics-router";
import jobsRouter from "./jobs-router";
import stylesRouter from "./styles-router";
import imagesRouter from "./images-router";
import { setupAuth, registerAuthRoutes } from "../replit_integrations/auth";

export async function registerDomainRouters(app: Express): Promise<void> {
  await setupAuth(app);
  registerAuthRoutes(app);
  
  app.use(systemRouter);
  app.use(pipelineRouter);
  app.use(visionRouter);
  app.use(analyticsRouter);
  app.use(jobsRouter);
  app.use(stylesRouter);
  app.use(imagesRouter);
}

export {
  systemRouter,
  pipelineRouter,
  visionRouter,
  analyticsRouter,
  jobsRouter,
  stylesRouter,
  imagesRouter,
};
