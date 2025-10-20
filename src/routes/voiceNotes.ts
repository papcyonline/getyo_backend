import { Router } from 'express';
import { voiceNoteController, upload } from '../controllers/voiceNoteController';
import { authenticateToken } from '../middleware/auth';
import OpenAI from 'openai';

const router = Router();

// All voice note routes require authentication
router.use(authenticateToken);

// AI Processing endpoint
router.post('/ai-process', async (req, res) => {
  try {
    const { transcript, action, targetLanguage } = req.body;

    if (!transcript) {
      return res.status(400).json({
        success: false,
        error: 'Transcript is required',
      });
    }

    if (!action) {
      return res.status(400).json({
        success: false,
        error: 'Action is required (summary, todo, points, translate)',
      });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    let prompt = '';
    let systemMessage = 'You are a helpful AI assistant that processes transcripts.';

    switch (action) {
      case 'summary':
        systemMessage = 'You are an expert at creating concise meeting summaries.';
        prompt = `Analyze this meeting/recording transcript and create a professional summary.

Transcript:
${transcript}

Create a structured summary with:
1. **Overview**: Brief summary (2-3 sentences)
2. **Key Topics Discussed**: Main topics covered
3. **Important Decisions**: Decisions made (if any)
4. **Action Items**: Things that need to be done (if any)
5. **Next Steps**: What comes next (if mentioned)

Make it clear, professional, and well-organized.`;
        break;

      case 'todo':
        systemMessage = 'You are an expert at extracting actionable tasks from text.';
        prompt = `Analyze this transcript and extract all actionable tasks/to-dos.

Transcript:
${transcript}

Extract tasks in this format:
- [ ] Task description (Priority: High/Medium/Low) - Due: Date if mentioned

Rules:
- Only include clear, actionable items
- Infer priority from urgency/importance keywords
- Include due dates if mentioned
- If no clear tasks, say "No specific tasks identified"
- Make tasks specific and clear`;
        break;

      case 'points':
        systemMessage = 'You are an expert at extracting key insights from text.';
        prompt = `Analyze this transcript and extract the main points.

Transcript:
${transcript}

Extract main points in this format:
• Key point (1-2 sentences explaining why it's important)

Rules:
- Limit to 5-8 most important points
- Make each point clear and concise
- Include context when needed
- Prioritize actionable insights
- Use bullet points for easy reading`;
        break;

      case 'translate':
        if (!targetLanguage) {
          return res.status(400).json({
            success: false,
            error: 'Target language is required for translation',
          });
        }
        systemMessage = 'You are an expert translator.';
        prompt = `Translate the following transcript to ${targetLanguage}. Maintain the original tone and meaning.

Transcript:
${transcript}

Provide ONLY the translation, no explanations.`;
        break;

      default:
        return res.status(400).json({
          success: false,
          error: `Invalid action: ${action}`,
        });
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const result = response.choices[0]?.message?.content;

    if (!result) {
      return res.status(500).json({
        success: false,
        error: 'Failed to process transcript',
      });
    }

    res.json({
      success: true,
      data: {
        action,
        result,
        targetLanguage: targetLanguage || null,
      },
    });

  } catch (error: any) {
    console.error('AI processing error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process transcript',
    });
  }
});

// Voice note CRUD operations
router.get('/', voiceNoteController.getVoiceNotes);
router.get('/search', voiceNoteController.searchVoiceNotes);
router.get('/:id', voiceNoteController.getVoiceNote);
router.post('/', upload.single('audio'), voiceNoteController.createVoiceNote);
router.put('/:id', voiceNoteController.updateVoiceNote);
router.delete('/:id', voiceNoteController.deleteVoiceNote);

export default router;
