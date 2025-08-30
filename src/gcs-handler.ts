import { Request, Response } from 'express';
import { Storage } from '@google-cloud/storage';

export interface GcsConfig {
  bucketName: string;
  prefix: string;
}

export class GcsHandler {
  private storage: Storage;
  private bucketName: string;
  private prefix: string;

  constructor(config: GcsConfig) {
    this.storage = new Storage();
    this.bucketName = config.bucketName;
    this.prefix = config.prefix;
  }

  /**
   * Parse GCS path and return bucket name and prefix
   */
  static parseGcsPath(gcsPath: string): GcsConfig | null {
    const gcsMatch = gcsPath.match(/^gs:\/\/([^\/]+)\/?(.*)/);
    if (!gcsMatch) {
      return null;
    }
    return {
      bucketName: gcsMatch[1],
      prefix: gcsMatch[2] || ''
    };
  }

  /**
   * Handle GCS file requests
   */
  async handleRequest(req: Request, res: Response): Promise<void> {
    try {
      let filePath = req.url === '/' ? 'index.html' : req.url.substring(1);
      if (this.prefix) {
        filePath = this.prefix + (this.prefix.endsWith('/') ? '' : '/') + filePath;
      }

      const file = this.storage.bucket(this.bucketName).file(filePath);
      const [exists] = await file.exists();
      
      if (!exists) {
        res.status(404).send(`
          <h1>File Not Found</h1>
          <p>File not found in GCS: ${filePath}</p>
        `);
        return;
      }

      // Get file metadata
      const [metadata] = await file.getMetadata();
      
      // Check ETag for conditional requests
      const clientETag = req.headers['if-none-match'];
      if (clientETag && metadata.etag && clientETag === metadata.etag) {
        res.status(304).end();
        return;
      }
      
      // Set headers from GCS metadata
      if (metadata.etag) {
        res.set('ETag', metadata.etag);
      }
      
      if (metadata.contentType) {
        res.set('Content-Type', metadata.contentType);
      }
      
      if (metadata.contentEncoding) {
        res.set('Content-Encoding', metadata.contentEncoding);
      }

      res.set('Cache-Control', 'no-cache');

      const stream = file.createReadStream({ decompress: false });
      stream.pipe(res);
    } catch (error) {
      console.error('GCS Error:', error);
      res.status(500).send('Internal Server Error');
    }
  }
}
