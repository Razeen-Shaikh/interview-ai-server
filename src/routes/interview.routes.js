import express from "express";

import protect from "../middleware/auth.middleware.js";

import {
  createInterview,
  createInterviewFromTemplate,
  getInterview,
  listInterviewTemplates,
  submitAnswer,
} from "../controllers/interview.controller.js";

const router = express.Router();

router.get(
  "/templates",
  protect,
  listInterviewTemplates
);

router.post(
  "/from-template",
  protect,
  createInterviewFromTemplate
);

router.post(
  "/create",
  protect,
  createInterview
);

router.get(
  "/:interviewId",
  protect,
  getInterview
);

router.post(
  "/:interviewId/answer",
  protect,
  submitAnswer
);

export default router;