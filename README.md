# Unity HTTP Server

A lightweight HTTP server optimized for serving Unity Web builds. Automatically configures proper MIME types and headers required for Web builds.

## Features

- 🎮 Optimized specifically for Unity Web builds
- 📦 Gzip and Brotli compression support
- ☁️ Google Cloud Storage (GCS) proxy support

## Installation

```bash
npm install -g @yaegaki/unity-http-server
```

## Usage

### Basic Usage

```bash
# Global installation - Use anywhere after installing globally
unity-http-server

# Serve from local directory
unity-http-server ./path/to/build

# Serve from Google Cloud Storage
unity-http-server gs://bucket/path

# Run directly with npx (no installation required)
npx @yaegaki/unity-http-server

# Run with npx and specify options
npx @yaegaki/unity-http-server ./path/to/build -p 3000
```

### Command Line Options

```bash
unity-http-server [build-path] [options]
```

#### Arguments

| Argument | Description | Default |
|----------|-------------|---------|
| `build-path` | Path to Unity Web build directory or GCS path (gs://bucket/path) | ./ |

#### Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--port <port>` | `-p` | Port number for the server | 8080 |
| `-a` | - | Host to bind to | localhost |
| `--help` | - | Show help message | - |

#### Examples

```bash
# Start with default build directory (./)
unity-http-server

# Specify custom build directory
unity-http-server ./path/to/build

# Serve from Google Cloud Storage
unity-http-server gs://my-bucket/unity-builds

# GCS with custom port and host
unity-http-server gs://my-bucket/builds -p 3000 -a 0.0.0.0

# Local files with multiple options 
unity-http-server -p 8080 -a 0.0.0.0 ./path/to/build

# Using npx with GCS
npx @yaegaki/unity-http-server gs://my-bucket/builds -p 8080
```

## License

MIT
