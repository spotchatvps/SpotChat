import { Router } from "express";

import userRoutes from "./userRoutes";
import authRoutes from "./authRoutes";
import settingRoutes from "./settingRoutes";
import contactRoutes from "./contactRoutes";
import ticketRoutes from "./ticketRoutes";
import whatsappRoutes from "./whatsappRoutes";
import messageRoutes from "./messageRoutes";
import whatsappSessionRoutes from "./whatsappSessionRoutes";
import queueRoutes from "./queueRoutes";
import companyRoutes from "./companyRoutes";
import ticketNoteRoutes from "./ticketNoteRoutes";
import quickMessageRoutes from "./quickMessageRoutes";
import dashboardRoutes from "./dashboardRoutes";
import queueOptionRoutes from "./queueOptionRoutes";
import scheduleRoutes from "./scheduleRoutes";
import tagRoutes from "./tagRoutes";
import contactListRoutes from "./contactListRoutes";
import contactListItemRoutes from "./contactListItemRoutes";
import chatRoutes from "./chatRoutes";

const routes = Router();

routes.use(userRoutes);
routes.use("/auth", authRoutes);
routes.use(settingRoutes);
routes.use(contactRoutes);
routes.use(ticketRoutes);
routes.use(whatsappRoutes);
routes.use(messageRoutes);
routes.use(messageRoutes);
routes.use(whatsappSessionRoutes);
routes.use(queueRoutes);
routes.use(companyRoutes);
routes.use(ticketNoteRoutes);
routes.use(quickMessageRoutes);
routes.use(dashboardRoutes);
routes.use(queueOptionRoutes);
routes.use(scheduleRoutes);
routes.use(tagRoutes);
routes.use(contactListRoutes);
routes.use(contactListItemRoutes);
routes.use(chatRoutes);

export default routes;
