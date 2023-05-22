import { Router } from "express";
import isAuth from "../middleware/isAuth";
import tokenAuth from "../middleware/tokenAuth";

import * as MessageController from "../controllers/MessageController";

import uploadConfig from "../config/upload";
import multer from "multer";
const upload = multer(uploadConfig);

const messageRoutes = Router();

messageRoutes.get("/messages/:ticketId", isAuth, MessageController.index);

messageRoutes.post(
  "/messages/:ticketId",
  isAuth,
  upload.array("medias"),
  MessageController.store
);

messageRoutes.delete("/messages/:messageId", isAuth, MessageController.remove);

messageRoutes.post(
  "/api/messages/send",
  tokenAuth,
  upload.array("medias"),
  MessageController.send
);

export default messageRoutes;
