import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { AuthPayload } from '../types';
import AIService from './AIService';
import VoiceProcessingService from './VoiceProcessingService';
import { Conversation, Task, Event, User } from '../models';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
}

class SocketService {
  private io: SocketIOServer | null = null;
  private connectedUsers: Map<string, AuthenticatedSocket> = new Map();

  initialize(server: HTTPServer): void {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:8081'],
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000, // 60 seconds
      pingInterval: 25000, // 25 seconds
      connectTimeout: 45000, // 45 seconds
      allowEIO3: true,
    });

    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
        socket.userId = decoded.userId;
        socket.userEmail = decoded.email;

        next();
      } catch (error) {
        next(new Error('Invalid authentication token'));
      }
    });

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });

    console.log('Socket.IO server initialized');
  }

  private handleConnection(socket: AuthenticatedSocket): void {
    const userId = socket.userId!;
    console.log(`User ${userId} connected via WebSocket`);

    // Store the connected user
    this.connectedUsers.set(userId, socket);

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Handle voice input processing
    socket.on('voice:start', () => {
      this.handleVoiceStart(socket);
    });

    socket.on('voice:data', (audioData: Buffer) => {
      this.handleVoiceData(socket, audioData);
    });

    socket.on('voice:end', () => {
      this.handleVoiceEnd(socket);
    });

    // Handle conversation events
    socket.on('conversation:start', async (data) => {
      await this.handleConversationStart(socket, data);
    });

    socket.on('conversation:message', async (data) => {
      await this.handleConversationMessage(socket, data);
    });

    socket.on('conversation:end', async (data) => {
      await this.handleConversationEnd(socket, data);
    });

    // Handle real-time updates
    socket.on('task:create', async (data) => {
      await this.handleTaskCreate(socket, data);
    });

    socket.on('task:update', async (data) => {
      await this.handleTaskUpdate(socket, data);
    });

    socket.on('event:create', async (data) => {
      await this.handleEventCreate(socket, data);
    });

    socket.on('event:update', async (data) => {
      await this.handleEventUpdate(socket, data);
    });

    // Handle typing indicators
    socket.on('typing:start', () => {
      socket.to(`user:${userId}`).emit('user:typing', { userId, typing: true });
    });

    socket.on('typing:stop', () => {
      socket.to(`user:${userId}`).emit('user:typing', { userId, typing: false });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User ${userId} disconnected`);
      this.connectedUsers.delete(userId);
      socket.to(`user:${userId}`).emit('user:offline', { userId });
    });
  }

  private handleVoiceStart(socket: AuthenticatedSocket): void {
    console.log(`Voice recording started for user ${socket.userId}`);
    socket.emit('voice:listening', { status: 'started' });
  }

  private async handleVoiceData(socket: AuthenticatedSocket, audioData: Buffer): Promise<void> {
    try {
      const userId = socket.userId!;

      // Process voice input
      const result = await VoiceProcessingService.processVoiceInput({
        audioData,
        userId,
      });

      // Send transcription result
      socket.emit('voice:transcription', {
        transcription: result.transcription,
        confidence: result.confidence,
        intent: result.intent,
      });

      // If high confidence transcription, process with AI
      if (result.confidence > 0.7 && result.transcription) {
        await this.processVoiceTranscription(socket, result.transcription);
      }
    } catch (error) {
      console.error('Voice processing error:', error);
      socket.emit('voice:error', { error: 'Failed to process voice input' });
    }
  }

  private handleVoiceEnd(socket: AuthenticatedSocket): void {
    console.log(`Voice recording ended for user ${socket.userId}`);
    socket.emit('voice:stopped', { status: 'ended' });
  }

  private async processVoiceTranscription(socket: AuthenticatedSocket, transcription: string): Promise<void> {
    try {
      const userId = socket.userId!;

      // Get user context
      const [user, pendingTasks, upcomingEvents] = await Promise.all([
        User.findById(userId),
        Task.find({ userId, status: { $ne: 'completed' } }).limit(5),
        Event.find({
          userId,
          startTime: { $gte: new Date(), $lte: new Date(Date.now() + 24 * 60 * 60 * 1000) }
        }).limit(5),
      ]);

      // Generate AI response
      const aiResponse = await AIService.generateResponse(transcription, [], {
        name: user?.name as string | undefined,
        upcomingEvents,
        pendingTasks,
        preferences: user?.preferences,
      });

      // Send AI response back to client
      socket.emit('ai:response', {
        content: aiResponse.content,
        actionItems: aiResponse.actionItems,
        context: aiResponse.context,
      });

    } catch (error) {
      console.error('Voice transcription processing error:', error);
      socket.emit('ai:error', { error: 'Failed to generate response' });
    }
  }

  private async handleConversationStart(socket: AuthenticatedSocket, data: { context?: any }): Promise<void> {
    try {
      const userId = socket.userId!;
      const conversation = await Conversation.create({
        userId,
        messages: [],
        context: data.context || {},
      });

      socket.emit('conversation:created', {
        conversationId: conversation._id,
        context: conversation.context,
      });
    } catch (error) {
      console.error('Conversation start error:', error);
      socket.emit('conversation:error', { error: 'Failed to start conversation' });
    }
  }

  private async handleConversationMessage(socket: AuthenticatedSocket, data: {
    conversationId: string;
    message: string;
    audioUrl?: string;
  }): Promise<void> {
    try {
      const userId = socket.userId!;
      const { conversationId, message, audioUrl } = data;

      // Find conversation
      const conversation = await Conversation.findOne({ _id: conversationId, userId });
      if (!conversation) {
        socket.emit('conversation:error', { error: 'Conversation not found' });
        return;
      }

      // Add user message
      conversation.messages.push({
        role: 'user',
        content: message,
        timestamp: new Date(),
        audioUrl,
      } as any);
      await conversation.save();

      // Get AI response
      const conversationHistory = conversation.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const [user, pendingTasks, upcomingEvents] = await Promise.all([
        User.findById(userId),
        Task.find({ userId, status: { $ne: 'completed' } }).limit(5),
        Event.find({
          userId,
          startTime: { $gte: new Date(), $lte: new Date(Date.now() + 24 * 60 * 60 * 1000) }
        }).limit(5),
      ]);

      const aiResponse = await AIService.generateResponse(message, conversationHistory, {
        name: user?.name as string | undefined,
        upcomingEvents,
        pendingTasks,
        preferences: user?.preferences,
      });

      // Add AI response to conversation
      conversation.messages.push({
        role: 'assistant',
        content: aiResponse.content,
        timestamp: new Date(),
      } as any);
      await conversation.save();

      // Send response to client
      socket.emit('conversation:message', {
        conversationId,
        message: {
          role: 'assistant',
          content: aiResponse.content,
          timestamp: new Date().toISOString(),
        },
        actionItems: aiResponse.actionItems,
      });

      // Auto-create tasks if action items were identified
      if (aiResponse.actionItems && aiResponse.actionItems.length > 0) {
        for (const item of aiResponse.actionItems) {
          await this.createTaskFromActionItem(userId, item);
        }
      }

    } catch (error) {
      console.error('Conversation message error:', error);
      socket.emit('conversation:error', { error: 'Failed to process message' });
    }
  }

  private async handleConversationEnd(socket: AuthenticatedSocket, data: { conversationId: string }): Promise<void> {
    try {
      const userId = socket.userId!;
      const conversation = await Conversation.findOne({ _id: data.conversationId, userId });

      if (conversation) {
        socket.emit('conversation:ended', {
          conversationId: data.conversationId,
          messageCount: conversation.messages.length,
        });
      }
    } catch (error) {
      console.error('Conversation end error:', error);
    }
  }

  private async handleTaskCreate(socket: AuthenticatedSocket, data: any): Promise<void> {
    try {
      const userId = socket.userId!;
      const task = await Task.create({
        ...data,
        userId,
      });

      socket.emit('task:created', task);
      this.broadcastToUser(userId, 'task:updated', { action: 'create', task });
    } catch (error) {
      console.error('Task creation error:', error);
      socket.emit('task:error', { error: 'Failed to create task' });
    }
  }

  private async handleTaskUpdate(socket: AuthenticatedSocket, data: { taskId: string; updates: any }): Promise<void> {
    try {
      const userId = socket.userId!;
      const task = await Task.findOneAndUpdate(
        { _id: data.taskId, userId },
        data.updates,
        { new: true }
      );

      if (task) {
        socket.emit('task:updated', task);
        this.broadcastToUser(userId, 'task:updated', { action: 'update', task });
      } else {
        socket.emit('task:error', { error: 'Task not found' });
      }
    } catch (error) {
      console.error('Task update error:', error);
      socket.emit('task:error', { error: 'Failed to update task' });
    }
  }

  private async handleEventCreate(socket: AuthenticatedSocket, data: any): Promise<void> {
    try {
      const userId = socket.userId!;
      const event = await Event.create({
        ...data,
        userId,
      });

      socket.emit('event:created', event);
      this.broadcastToUser(userId, 'event:updated', { action: 'create', event });
    } catch (error) {
      console.error('Event creation error:', error);
      socket.emit('event:error', { error: 'Failed to create event' });
    }
  }

  private async handleEventUpdate(socket: AuthenticatedSocket, data: { eventId: string; updates: any }): Promise<void> {
    try {
      const userId = socket.userId!;
      const event = await Event.findOneAndUpdate(
        { _id: data.eventId, userId },
        data.updates,
        { new: true }
      );

      if (event) {
        socket.emit('event:updated', event);
        this.broadcastToUser(userId, 'event:updated', { action: 'update', event });
      } else {
        socket.emit('event:error', { error: 'Event not found' });
      }
    } catch (error) {
      console.error('Event update error:', error);
      socket.emit('event:error', { error: 'Failed to update event' });
    }
  }

  private async createTaskFromActionItem(userId: string, actionItem: string): Promise<void> {
    try {
      const task = await Task.create({
        userId,
        title: actionItem,
        priority: 'medium',
        createdBy: 'ai_suggestion',
      });

      this.broadcastToUser(userId, 'task:ai_created', { task });
    } catch (error) {
      console.error('Auto task creation error:', error);
    }
  }

  // Utility methods
  public broadcastToUser(userId: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(`user:${userId}`).emit(event, data);
    }
  }

  public sendNotificationToUser(userId: string, notification: {
    title: string;
    body: string;
    data?: any;
  }): void {
    this.broadcastToUser(userId, 'notification:push', notification);
  }

  public sendDailyBriefing(userId: string, briefing: string): void {
    this.broadcastToUser(userId, 'daily:briefing', { content: briefing });
  }

  public isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  public getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }
}

export default new SocketService();