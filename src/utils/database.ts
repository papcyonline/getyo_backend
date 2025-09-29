import mongoose from 'mongoose';

class DatabaseConnection {
  private static instance: DatabaseConnection;
  private isConnected = false;

  private constructor() {}

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      console.log('Already connected to database');
      return;
    }

    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/yo_app';

      // Check if running in mock mode
      if (mongoUri === 'mock') {
        this.isConnected = true;
        console.log('🔧 Running in MOCK DATABASE MODE - no MongoDB required');
        console.log('📝 Note: Data will not persist between server restarts');
        return;
      }

      await mongoose.connect(mongoUri, {
        maxPoolSize: 10, // Maintain up to 10 socket connections
        serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
        socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        family: 4, // Use IPv4, skip trying IPv6
      });

      this.isConnected = true;
      console.log(`Connected to MongoDB: ${mongoUri}`);

      // Handle connection events
      mongoose.connection.on('error', (error) => {
        console.error('MongoDB connection error:', error);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        console.log('Disconnected from MongoDB');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        console.log('Reconnected to MongoDB');
        this.isConnected = true;
      });

      // Graceful shutdown
      process.on('SIGINT', async () => {
        try {
          await this.disconnect();
          process.exit(0);
        } catch (error) {
          console.error('Error during graceful shutdown:', error);
          process.exit(1);
        }
      });

    } catch (error) {
      console.error('MongoDB connection failed:', error);
      this.isConnected = false;
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await mongoose.connection.close();
      this.isConnected = false;
      console.log('Disconnected from MongoDB');
    } catch (error) {
      console.error('Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  public getConnectionStatus(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: {
      connected: boolean;
      readyState: number;
      name?: string;
      host?: string;
      port?: number;
      mode?: string;
    };
  }> {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/yo_app';

    if (mongoUri === 'mock') {
      return {
        status: this.isConnected ? 'healthy' : 'unhealthy',
        details: {
          connected: this.isConnected,
          readyState: this.isConnected ? 1 : 0,
          mode: 'mock',
          name: 'mock_database',
        },
      };
    }

    const connection = mongoose.connection;

    return {
      status: this.isConnected && connection.readyState === 1 ? 'healthy' : 'unhealthy',
      details: {
        connected: this.isConnected,
        readyState: connection.readyState,
        name: connection.name,
        host: connection.host,
        port: connection.port,
        mode: 'mongodb',
      },
    };
  }
}

export default DatabaseConnection.getInstance();