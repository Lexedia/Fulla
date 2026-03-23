# Fulla Backend Server

A Dart package registry server written in Rust.

## Features

- Package publishing and management
- User authentication and authorization
- Package search with Meilisearch
- Optional package analysis with Pana
- Optional documentation generation with dartdoc
- S3 or filesystem storage backends

## Docker Build Options

The backend Docker image supports build arguments to control which analysis tools are installed:

### Build Arguments

- **`INSTALL_PANA`** (default: `true`) - Install [pana](https://pub.dev/packages/pana) for package analysis
- **`INSTALL_DARTDOC`** (default: `true`) - Install [dartdoc](https://pub.dev/packages/dartdoc) for documentation generation

### Building Different Image Variants

**Full image with all tools (default):**
```bash
docker build -t fulla-backend:full ./server
```

**Minimal image without analysis tools:**
```bash
docker build \
  --build-arg INSTALL_PANA=false \
  --build-arg INSTALL_DARTDOC=false \
  -t fulla-backend:minimal \
  ./server
```

**Image with only pana:**
```bash
docker build \
  --build-arg INSTALL_DARTDOC=false \
  -t fulla-backend:pana-only \
  ./server
```

### Using with Docker Compose

The `docker-compose.yml` supports overriding build arguments via environment variables:

```bash
# Build with default settings (full image)
docker-compose build

# Build minimal image
INSTALL_PANA=false INSTALL_DARTDOC=false docker-compose build fulla-backend

# Build and run
docker-compose up -d
```

## GitHub Container Registry (GHCR)

Pre-built images are automatically published to GHCR via GitHub Actions:

### Available Images

- **Full variant**: `ghcr.io/<username>/fulla-backend:latest`
- **Minimal variant**: `ghcr.io/<username>/fulla-backend:minimal`

### Pulling from GHCR

```bash
# Pull the latest full image
docker pull ghcr.io/<username>/fulla-backend:latest

# Pull the minimal image
docker pull ghcr.io/<username>/fulla-backend:minimal

# Pull a specific version
docker pull ghcr.io/<username>/fulla-backend:v1.0.0
```

### Using GHCR Images in Docker Compose

Update your `docker-compose.yml`:

```yaml
services:
  fulla-backend:
    image: ghcr.io/<username>/fulla-backend:latest
    # ... rest of configuration
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | - | PostgreSQL connection string |
| `MEILI_URL` | - | Meilisearch server URL |
| `MEILI_MASTER_KEY` | - | Meilisearch master key |
| `STORAGE_BACKEND` | `filesystem` | Storage backend: `filesystem` or `s3` |
| `STORAGE_PATH` | `storage` | Path for filesystem storage |
| `S3_BUCKET` | - | S3 bucket name (if using S3) |
| `S3_REGION` | - | S3 region |
| `S3_ENDPOINT` | - | S3 endpoint URL |
| `AWS_ACCESS_KEY_ID` | - | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | - | AWS secret key |
| `ENABLE_REGISTRATION` | `false` | Allow new user registration |
| `MAX_DOC_VERSIONS` | `5` | Maximum documentation versions to retain per package |

## Development

### Prerequisites

- Rust 1.70+
- PostgreSQL
- Meilisearch
- Dart SDK (for running pana/dartdoc locally)

### Building

```bash
cd server
cargo build --release
```

### Running

```bash
# Set required environment variables
export DATABASE_URL="postgres://user:pass@localhost/fulla"
export MEILI_URL="http://localhost:7700"
export MEILI_MASTER_KEY="your-key"

# Run the server
./target/release/fulla-server
```

## How It Works

### Package Analysis

When a package is published:

1. The package is extracted to a temporary directory
2. **`dart pub get`** is run to fetch dependencies (required for proper analysis)
3. If pana is installed, package analysis is performed
4. If dartdoc is installed, documentation is generated
5. Results are indexed in Meilisearch for search
6. Temporary files are cleaned up

If pana or dartdoc are not installed, the server gracefully skips those steps and continues with package indexing.

## CI/CD

The project uses GitHub Actions for automated builds:

- **Triggers**: Pushes to `main`, version tags (`v*`), pull requests
- **Platforms**: linux/amd64, linux/arm64
- **Outputs**: Images pushed to GHCR with multiple tags

See [`.github/workflows/docker-build.yml`](.github/workflows/docker-build.yml) for details.

## License

[Your License Here]
