# Fulla

A Dart package registry server written in Rust (and Solid/typescript for the frontend).

![Fulla](.github/assets/frontpage.png)

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

# Build minimal image (useful for headless server)
INSTALL_PANA=false INSTALL_DARTDOC=false docker-compose build fulla-backend

# Build and run
docker-compose up -d
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
