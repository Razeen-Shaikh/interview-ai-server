import Interview from "../models/Interview.js";

import {
  getTemplateById,
  listTemplateSummaries,
} from "../data/interviewTemplates.js";

import {
  evaluateAnswer,
  generateInterviewQuestions,
} from "../services/ai.service.js";

export const listInterviewTemplates = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      templates: listTemplateSummaries(),
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Failed to list interview templates",
    });
  }
};

export const createInterviewFromTemplate = async (req, res) => {
  try {
    const { templateId } = req.body;

    if (!templateId || typeof templateId !== "string") {
      return res.status(400).json({
        success: false,
        message: "templateId is required",
      });
    }

    const template = getTemplateById(templateId);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Unknown interview template",
      });
    }

    const questions = template.questions;
    const answers = questions.map((question) => ({
      question,
    }));

    const interview = await Interview.create({
      user: req.user.id,
      role: template.role,
      level: template.level,
      techStack: template.techStack,
      questions,
      answers,
    });

    res.status(201).json({
      success: true,
      interview,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Failed to start practice interview",
    });
  }
};

export const createInterview = async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY?.trim() && !process.env.OPENAI_API_KEY?.trim()) {
      return res.status(503).json({
        success: false,
        code: "AI_NOT_CONFIGURED",
        message:
          "Custom AI-generated questions require GEMINI_API_KEY (Google AI Studio) or OPENAI_API_KEY on the server. Practice tests work without either.",
      });
    }

    const { role, level, techStack } = req.body;

    if (
      !role ||
      !level ||
      !Array.isArray(techStack) ||
      techStack.length === 0 ||
      !techStack.every((t) => typeof t === "string" && t.trim().length > 0)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Missing or invalid fields: role, level, and a non-empty techStack array of strings are required",
      });
    }

    const normalizedStack = techStack.map((t) => t.trim());

    const questions = await generateInterviewQuestions({
      role,
      level,
      techStack: normalizedStack,
    });

    const answers = questions.map((question) => ({
      question,
    }));

    const interview = await Interview.create({
      user: req.user.id,
      role,
      level,
      techStack: normalizedStack,
      questions,
      answers,
    });

    res.status(201).json({
      success: true,
      interview,
    });
  } catch (error) {
    console.log(error);

    if (error.code === "OPENAI_INSUFFICIENT_QUOTA") {
      return res.status(503).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    if (error.code === "AI_NOT_CONFIGURED") {
      return res.status(503).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create interview",
    });
  }
};

export const getInterview = async (req, res) => {
  try {
    const { interviewId } = req.params;

    const interview = await Interview.findById(interviewId);

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: "Interview not found",
      });
    }

    if (interview.user.toString() !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this interview",
      });
    }

    res.status(200).json({
      success: true,
      interview,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Failed to load interview",
    });
  }
};

export const submitAnswer = async (req, res) => {
  try {
    const { interviewId } = req.params;

    const { questionIndex, answer } = req.body;

    const qIndex = Number(questionIndex);
    if (!Number.isInteger(qIndex) || qIndex < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid questionIndex",
      });
    }

    const interview = await Interview.findById(interviewId);

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: "Interview not found",
      });
    }

    if (interview.user.toString() !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this interview",
      });
    }

    if (qIndex >= interview.questions.length) {
      return res.status(400).json({
        success: false,
        message: "Question index out of range",
      });
    }

    const question = interview.questions[qIndex];

    const evaluation = await evaluateAnswer({
      question,
      answer: typeof answer === "string" ? answer : "",
      role: interview.role,
      level: interview.level,
      techStack: interview.techStack,
    });

    const scoreNum = Number(evaluation.score);
    const safeScore = Number.isFinite(scoreNum)
      ? Math.min(10, Math.max(0, scoreNum))
      : 0;

    interview.answers[qIndex].answer =
      typeof answer === "string" ? answer : "";
    interview.answers[qIndex].feedback = evaluation.feedback ?? "";
    interview.answers[qIndex].score = safeScore;
    interview.answers[qIndex].strengths = Array.isArray(evaluation.strengths)
      ? evaluation.strengths
      : [];
    interview.answers[qIndex].improvements = Array.isArray(
      evaluation.improvements,
    )
      ? evaluation.improvements
      : [];

    const totalScore = interview.answers.reduce(
      (acc, curr) => acc + (Number(curr.score) || 0),
      0,
    );

    interview.overallScore = totalScore / interview.questions.length;

    await interview.save();

    res.status(200).json({
      success: true,
      evaluation,
      overallScore: interview.overallScore,
    });
  } catch (error) {
    console.log(error);

    if (error.code === "OPENAI_INSUFFICIENT_QUOTA") {
      return res.status(503).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to submit answer",
    });
  }
};
