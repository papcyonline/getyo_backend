import express from 'express';
import GmailService from '../services/GmailService';
import { authenticate } from '../middleware/auth';

const router = express.Router();

/**
 * @route   GET /api/gmail/messages
 * @desc    Get user's Gmail messages
 * @access  Private
 */
router.get('/messages', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { maxResults, query, labels } = req.query;

    const options = {
      maxResults: maxResults ? parseInt(maxResults as string) : 20,
      query: query as string | undefined,
      labelIds: labels ? (labels as string).split(',') : undefined,
    };

    const messages = await GmailService.getMessages(userId, options);

    res.json({
      success: true,
      data: {
        messages,
        count: messages.length,
      },
    });
  } catch (error: any) {
    console.error('❌ Get Gmail messages failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch Gmail messages',
    });
  }
});

/**
 * @route   GET /api/gmail/messages/:id
 * @desc    Get a single Gmail message
 * @access  Private
 */
router.get('/messages/:id', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    const message = await GmailService.getMessage(userId, id);

    res.json({
      success: true,
      data: message,
    });
  } catch (error: any) {
    console.error('❌ Get Gmail message failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch Gmail message',
    });
  }
});

/**
 * @route   POST /api/gmail/send
 * @desc    Send an email via Gmail
 * @access  Private
 */
router.post('/send', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { to, subject, body, cc, bcc, isHtml } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: to, subject, body',
      });
    }

    const result = await GmailService.sendEmail(userId, {
      to,
      subject,
      body,
      cc,
      bcc,
      isHtml,
    });

    res.json({
      success: true,
      data: result,
      message: 'Email sent successfully',
    });
  } catch (error: any) {
    console.error('❌ Send email failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send email',
    });
  }
});

/**
 * @route   POST /api/gmail/messages/:id/read
 * @desc    Mark message as read
 * @access  Private
 */
router.post('/messages/:id/read', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    await GmailService.markAsRead(userId, id);

    res.json({
      success: true,
      message: 'Message marked as read',
    });
  } catch (error: any) {
    console.error('❌ Mark as read failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to mark message as read',
    });
  }
});

/**
 * @route   POST /api/gmail/messages/:id/unread
 * @desc    Mark message as unread
 * @access  Private
 */
router.post('/messages/:id/unread', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    await GmailService.markAsUnread(userId, id);

    res.json({
      success: true,
      message: 'Message marked as unread',
    });
  } catch (error: any) {
    console.error('❌ Mark as unread failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to mark message as unread',
    });
  }
});

/**
 * @route   DELETE /api/gmail/messages/:id
 * @desc    Delete a message (move to trash)
 * @access  Private
 */
router.delete('/messages/:id', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    await GmailService.deleteMessage(userId, id);

    res.json({
      success: true,
      message: 'Message moved to trash',
    });
  } catch (error: any) {
    console.error('❌ Delete message failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete message',
    });
  }
});

/**
 * @route   GET /api/gmail/search
 * @desc    Search Gmail messages
 * @access  Private
 */
router.get('/search', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { q, maxResults } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query (q) is required',
      });
    }

    const messages = await GmailService.searchEmails(
      userId,
      q as string,
      maxResults ? parseInt(maxResults as string) : 20
    );

    res.json({
      success: true,
      data: {
        messages,
        count: messages.length,
        query: q,
      },
    });
  } catch (error: any) {
    console.error('❌ Search emails failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to search emails',
    });
  }
});

/**
 * @route   GET /api/gmail/unread-count
 * @desc    Get unread messages count
 * @access  Private
 */
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const count = await GmailService.getUnreadCount(userId);

    res.json({
      success: true,
      data: {
        count,
      },
    });
  } catch (error: any) {
    console.error('❌ Get unread count failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get unread count',
    });
  }
});

export default router;
