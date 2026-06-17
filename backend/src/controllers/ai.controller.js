const Groq = require("groq-sdk");
const prisma = require("../lib/prisma");

const DEFAULT_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

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

exports.generateInterviewSummary = async (req, res) => {
  try {
    const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : "";
    const roomCode = typeof req.body?.roomCode === "string" ? req.body.roomCode.trim() : "";

    if (!notes) {
      return res.status(400).json({ message: "Interview notes are required." });
    }

    if (!roomCode) {
      return res.status(400).json({ message: "roomCode is required." });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({ message: "GROQ_API_KEY is not configured." });
    }

    const room = await prisma.room.findFirst({
      where: {
        roomCode,
        interviewerId: req.user.userId,
      },
      include: {
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
      },
    });

    if (!room) {
      return res.status(404).json({ message: "Room not found." });
    }

    const interviewee = room.participants.find((participant) => participant.user.role === "INTERVIEWEE");
    const candidateName = interviewee?.user?.name || "Not specified";

    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const completion = await groq.chat.completions.create({
      model: DEFAULT_MODEL,
      temperature: 0.3,
      max_completion_tokens: 600,
      messages: [
        { role: "system", content: "You are a senior technical interviewer." },
        { role: "user", content: buildPrompt({ candidateName, notes }) },
      ],
    });

    const summary = completion.choices?.[0]?.message?.content?.trim();
    if (!summary) {
      return res.status(502).json({ message: "The AI service returned an empty summary." });
    }

    return res.json({ summary, candidateName });
  } catch (err) {
    console.error("AI summary generation failed:", err);
    return res.status(500).json({ message: "Failed to generate AI summary." });
  }
};
