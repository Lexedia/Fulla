FROM rust:1-slim-bookworm AS builder

WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim

# Build arguments for optional tool installation
ARG INSTALL_PANA=true
ARG INSTALL_DARTDOC=true

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libpq-dev \
    curl \
    unzip \
    gnupg \
    apt-transport-https \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Dart SDK
RUN curl -fsSL https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/dart.gpg \
    && echo 'deb [signed-by=/usr/share/keyrings/dart.gpg arch=amd64] https://storage.googleapis.com/download.dartlang.org/linux/debian stable main' | tee /etc/apt/sources.list.d/dart_stable.list \
    && apt-get update \
    && apt-get install -y dart \
    && rm -rf /var/lib/apt/lists/*

# Configure Dart SDK PATH
ENV PATH="/usr/lib/dart/bin:/root/.pub-cache/bin:${PATH}"

# Conditionally install pana
RUN if [ "$INSTALL_PANA" = "true" ]; then \
    echo "Installing pana..." && \
    dart pub global activate pana; \
    else \
    echo "Skipping pana installation"; \
    fi

# Conditionally install dartdoc
RUN if [ "$INSTALL_DARTDOC" = "true" ]; then \
    echo "Installing dartdoc..." && \
    dart pub global activate dartdoc; \
    else \
    echo "Skipping dartdoc installation"; \
    fi

# Verify Dart SDK installation
RUN dart --version

WORKDIR /app
COPY --from=builder /app/target/release/fulla-server /app/fulla-server
COPY --from=builder /app/migrations /app/migrations

CMD ["/app/fulla-server"]
