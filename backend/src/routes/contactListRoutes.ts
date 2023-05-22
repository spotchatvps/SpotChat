import express from "express";
import isAuth from "../middleware/isAuth";
import * as ContactListController from "../controllers/ContactListController";

import uploadConfig from "../config/upload";
import multer from "multer";
const upload = multer(uploadConfig);

const routes = express.Router();

routes.get("/contact-lists/list", isAuth, ContactListController.findList);

routes.get("/contact-lists", isAuth, ContactListController.index);

routes.get("/contact-lists/:id", isAuth, ContactListController.show);

routes.post("/contact-lists", isAuth, ContactListController.store);

routes.post(
  "/contact-lists/:id/upload",
  isAuth,
  upload.array("file"),
  ContactListController.upload
);

routes.put("/contact-lists/:id", isAuth, ContactListController.update);

routes.delete("/contact-lists/:id", isAuth, ContactListController.remove);

export default routes;
