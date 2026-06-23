const Groq = require("groq-sdk");
const prisma = require("../lib/prisma");

const DEFAULT_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

function getGroqClient() {
  if (!process.env.GROQ_API_KEY) {
    const error = new Error("GROQ_API_KEY is not configured.");
    error.statusCode = 503;
    throw error;
  }

  return new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });
}

async function createAiCompletion({
  system,
  prompt,
  temperature = 0.3,
  maxCompletionTokens = 700,
}) {
  const groq = getGroqClient();

  const completion = await groq.chat.completions.create({
    model: DEFAULT_MODEL,
    temperature,
    max_completion_tokens: maxCompletionTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
  });

  const content = completion.choices?.[0]?.message?.content?.trim();
  if (!content) {
    const error = new Error("The AI service returned an empty response.");
    error.statusCode = 502;
    throw error;
  }

  return content;
}

function sendAiError(res, error, fallbackMessage) {
  const statusCode = error.statusCode || 500;
  console.error(fallbackMessage, error);

  return res.status(statusCode).json({
    message: error.statusCode ? error.message : fallbackMessage,
  });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function findOwnedRoom(roomCode, interviewerId, include = {}) {
  return prisma.room.findFirst({
    where: {
      roomCode,
      interviewerId,
    },
    include,
  });
}

async function findParticipantRoom(roomCode, userId) {
  return prisma.room.findFirst({
    where: {
      roomCode,
      participants: {
        some: {
          userId,
        },
      },
    },
    select: {
      id: true,
    },
  });
}

function buildPrompt({ candidateName, notes }) {
  return `You are a senior technical interviewer.

Evaluate the candidate against the role and level implied by the interview notes.
If the notes mention a target role, seniority, or expectations, use that to judge whether the candidate should be hired for that role.
If the target role or level is unclear, explicitly say that in the response and make the recommendation conditional.

Include:
1. Candidate Name
2. Target Role / Level
3. Overall Performance
4. Technical Strengths
5. Areas for Improvement
6. Hiring Decision (Hire / No Hire / Lean Hire / Lean No Hire)
7. Final Recommendation

Formatting requirements:
- Use concise section headings
- Use bullet points for strengths and improvement areas
- Mention whether the candidate meets the expected level for the role
- Be direct and recruiter-friendly

Candidate Name:
${candidateName}

Interview Notes:
${notes}`;
}

function buildQuestionPrompt({ topic, difficulty, language }) {
  return `Create a coding interview question for a live interview platform.

Topic: ${topic}
Difficulty: ${difficulty}
Language: ${language}

Requirements:
- Make the problem solvable in 20-40 minutes.
- Keep the description crisp and interviewer-friendly.
- Include realistic constraints.
- Include one sample input and one sample output.
- Provide starter code in ${language}.
- Include exactly 3 hidden-style test cases with input and expected output.
- Do not include the solution or explanation.

Return the response in this exact structure:
Title:
Description:
Constraints:
Sample Input:
Sample Output:
Starter Code:
Test Cases:
1.
Input:
Expected Output:
2.
Input:
Expected Output:
3.
Input:
Expected Output:`;
}

function buildReviewPrompt({ question, code, language }) {
  return `You are a senior software engineer reviewing a candidate's interview submission.

Question:
${question}

Language: ${language}

Candidate Code:
${code}

Respond with concise interview feedback using these sections:
1. Correctness Analysis
2. Time Complexity
3. Space Complexity
4. Strengths
5. Improvements
6. Suggested Next Step

Rules:
- Do not rewrite the full solution.
- Do not provide a complete corrected code listing.
- Focus on actionable feedback and likely edge cases.`;
}

function buildHintPrompt({ question, code }) {
  return `You are a coding interview mentor.

Question:
${question}

Current Candidate Code:
${code}

Give exactly one concise hint.

Rules:
- Do NOT provide the solution.
- Do NOT provide full code.
- Do NOT reveal the final algorithm outright.
- Keep it to 2-4 sentences max.`;
}

exports.generateInterviewSummary = async (req, res) => {
  try {
    const notes = normalizeText(req.body?.notes);
    const roomCode = normalizeText(req.body?.roomCode);

    if (!notes) {
      return res.status(400).json({ message: "Interview notes are required." });
    }

    if (!roomCode) {
      return res.status(400).json({ message: "roomCode is required." });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({ message: "GROQ_API_KEY is not configured." });
    }

    const room = await findOwnedRoom(roomCode, req.user.userId, {
      participants: {
        orderBy: { joinedAt: "asc" },
        include: {
          user: {
            select: {
              name: true,
              role: true,
            },
          },
        },
      },
    });

    if (!room) {
      return res.status(404).json({ message: "Room not found." });
    }

    const interviewee = room.participants.find((participant) => participant.user.role === "INTERVIEWEE");
    const candidateName = interviewee?.user?.name || "Not specified";

    const summary = await createAiCompletion({
      system: "You are a senior technical interviewer.",
      prompt: buildPrompt({ candidateName, notes }),
      temperature: 0.3,
      maxCompletionTokens: 600,
    });

    await prisma.room.update({
      where: { id: room.id },
      data: {
        aiSummary: summary,
      },
    });

    return res.json({ summary, candidateName });
  } catch (error) {
    return sendAiError(res, error, "Failed to generate AI summary.");
  }
};
exports.generateQuestion = async (req, res) => {
  try {
    const topic = normalizeText(req.body?.topic);
    const difficulty = normalizeText(req.body?.difficulty) || "Easy";
    const language = normalizeText(req.body?.language) || "python";

    if (!topic) {
      return res.status(400).json({ message: "topic is required." });
    }

    const question = await createAiCompletion({
      system: "You create original coding interview prompts for live technical interviews.",
      prompt: buildQuestionPrompt({ topic, difficulty, language }),
      temperature: 0.7,
      maxCompletionTokens: 900,
    });

    return res.json({ question });
  } catch (error) {
    return sendAiError(res, error, "Failed to generate question.");
  }
};
exports.reviewCode = async (req, res) => {
  try {
    const question = normalizeText(req.body?.question);
    const code = typeof req.body?.code === "string" ? req.body.code : "";
    const language = normalizeText(req.body?.language) || "python";
    const roomCode = normalizeText(req.body?.roomCode);

    if (!question) {
      return res.status(400).json({ message: "question is required." });
    }

    if (!code.trim()) {
      return res.status(400).json({ message: "code is required." });
    }

    const review = await createAiCompletion({
      system: "You review interview code with concise, constructive feedback.",
      prompt: buildReviewPrompt({ question, code, language }),
      temperature: 0.2,
      maxCompletionTokens: 800,
    });

    if (roomCode) {
      const room = await findOwnedRoom(roomCode, req.user.userId);
      if (!room) {
        return res.status(404).json({ message: "Room not found." });
      }

      await prisma.room.update({
        where: { id: room.id },
        data: {
          latestAiReview: review,
        },
      });
    }

    return res.json({ review });
  } catch (error) {
    return sendAiError(res, error, "Failed to review code.");
  }
};
exports.generateHint = async (req, res) => {
  try {
    const question = normalizeText(req.body?.question);
    const code = typeof req.body?.code === "string" ? req.body.code : "";
    const roomCode = normalizeText(req.body?.roomCode);

    if (!question) {
      return res.status(400).json({ message: "question is required." });
    }

    if (!code.trim()) {
      return res.status(400).json({ message: "code is required." });
    }

    const hint = await createAiCompletion({
      system: "You help interview candidates with small, non-spoiler hints.",
      prompt: buildHintPrompt({ question, code }),
      temperature: 0.4,
      maxCompletionTokens: 180,
    });

    let hintCount;

    if (roomCode && req.user?.role === "INTERVIEWEE") {
      const room = await findParticipantRoom(roomCode, req.user.userId);

      if (room) {
        const updatedRoom = await prisma.room.update({
          where: { id: room.id },
          data: {
            latestHint: hint,
            hintCount: {
              increment: 1,
            },
          },
          select: {
            hintCount: true,
          },
        });

        hintCount = updatedRoom.hintCount;
      }
    }

    return res.json({ hint, hintCount });
  } catch (error) {
    return sendAiError(res, error, "Failed to generate hint.");
  }
};
