import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';
import { GcsHandler } from './gcs-handler';

const app = express();

// Configuration interface
interface ServerConfig {
  port: number;
  host: string;
  buildPath: string;
}

// Default configuration
const DEFAULT_CONFIG: ServerConfig = {
  port: 8080,
  host: 'localhost',
  buildPath: './',
};

/**
 * Parse command line arguments and return server configuration
 */
function parseArgs(): ServerConfig {
  const args = process.argv.slice(2);
  const config: ServerConfig = { ...DEFAULT_CONFIG };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '-p':
      case '--port':
        config.port = parseInt(args[++i]) || DEFAULT_CONFIG.port;
        break;
      case '-a':
        config.host = args[++i] || DEFAULT_CONFIG.host;
        break;
      case '--help':
        console.log(`
Unity HTTP Server - A simple HTTP server optimized for serving Unity Web builds

Usage: unity-http-server [options] [build-path]

Arguments:
  build-path              Path to Unity Web build directory (default: ./)

Options:
  -p, --port <port>       Port to listen on (default: 8080)
  -a <host>               Host to bind to (default: localhost)
  --help                  Show this help message

Examples:
  unity-http-server
  unity-http-server ./path/to/build
  unity-http-server ./path/to/build -p 3000
  unity-http-server ./path/to/build -p 3000 -a 0.0.0.0
        `);
        process.exit(0);
        break;
      default:
        // If it's not an option and doesn't start with -, treat it as build path
        if (!args[i].startsWith('-')) {
          config.buildPath = args[i];
        }
        break;
    }
  }
  
  return config;
}

const config = parseArgs();

// Check if build path is a GCS path
const isGcsPath = config.buildPath.startsWith('gs://');
let gcsHandler: GcsHandler | null = null;

if (isGcsPath) {
  const gcsConfig = GcsHandler.parseGcsPath(config.buildPath);
  if (gcsConfig) {
    gcsHandler = new GcsHandler(gcsConfig);
    console.log(`🌐 Using Google Cloud Storage: ${gcsConfig.bucketName}/${gcsConfig.prefix}`);
  } else {
    console.error('Invalid GCS path format. Use: gs://bucket-name/path');
    process.exit(1);
  }
}

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

/**
 * Helper function to determine content type based on compressed file URL
 */
function getContentTypeForCompressedFile(url: string): string {
  if (url.includes('.wasm.')) {
    return 'application/wasm';
  } else if (url.includes('.js.')) {
    return 'application/javascript';
  } else if (url.includes('.data.')) {
    return 'application/octet-stream';
  }
  return 'application/octet-stream';
}

/**
 * Custom middleware to set proper headers for Unity Web files (local files only)
 */
app.use((req: Request, res: Response, next: NextFunction) => {
  // Skip header setting for GCS paths - GCS metadata will handle this
  if (isGcsPath) {
    next();
    return;
  }
  
  const ext = path.extname(req.url).toLowerCase();
  
  // Set proper headers for different file types
  switch (ext) {
    case '.wasm':
      res.set('Content-Type', 'application/wasm');
      break;
    case '.js':
      res.set('Content-Type', 'application/javascript');
      break;
    case '.gz':
      res.set('Content-Encoding', 'gzip');
      res.set('Content-Type', getContentTypeForCompressedFile(req.url));
      break;
    case '.br':
      res.set('Content-Encoding', 'br');
      res.set('Content-Type', getContentTypeForCompressedFile(req.url));
      break;
    case '.data':
      res.set('Content-Type', 'application/octet-stream');
      break;
    case '.unityweb':
      res.set('Content-Type', 'application/octet-stream');
      break;
  }
  
  next();
});

// Check if build directory exists (only for local paths)
if (!isGcsPath && !fs.existsSync(config.buildPath)) {
  console.error(`Error: Build directory '${config.buildPath}' does not exist.`);
  console.log('Please specify a valid Unity Web build directory as the first argument.');
  process.exit(1);
}

// Logging middleware for file access
app.use((req: Request, res: Response, next: NextFunction) => {
  // Listen for the finish event to log the response
  res.on('finish', () => {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] ${req.method} ${req.url} - ${res.statusCode} - ${req.ip}`);
  });
  
  next();
});

// GCS proxy middleware or static file serving
if (isGcsPath && gcsHandler) {
  // GCS proxy middleware
  app.use('/', async (req: Request, res: Response) => {
    await gcsHandler!.handleRequest(req, res);
  });
} else {
  // Serve static files from the build directory
  app.use(express.static(config.buildPath));

  /**
   * Serve index.html for root path
   */
  app.get('/', (req: Request, res: Response) => {
    const indexPath = path.join(config.buildPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(path.resolve(indexPath));
    } else {
      res.status(404).send(`
        <h1>Unity Web Build Not Found</h1>
        <p>No index.html found in build directory: ${config.buildPath}</p>
        <p>Please ensure you have a valid Unity Web build in the specified directory.</p>
      `);
    }
  });
}

/**
 * Start the server
 */
const server = app.listen(config.port, config.host, () => {
  console.log(`🎮 Unity HTTP Server started!`);
  console.log(`📁 Serving files from: ${path.resolve(config.buildPath)}`);
  console.log(`🌐 Server running at: http://${config.host}:${config.port}`);
  console.log(`\n💡 Press Ctrl+C to stop the server`);
});

export default app;
export { ServerConfig };
