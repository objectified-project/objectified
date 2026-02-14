# objectified-db: runs schema-evolution-manager (sem) to apply migrations
FROM ruby:3.2-slim

# Install git (for clone), postgresql-client (for psql used by sem-apply), and ensure UTF-8
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# UTF-8 for sem-apply (see docs/UTF8_DATABASE_SETUP.md)
ENV LANG=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8

# Install schema-evolution-manager from GitHub
ARG SEM_VERSION=0.9.57
RUN git clone --depth 1 --branch "${SEM_VERSION}" \
    https://github.com/mbryzek/schema-evolution-manager.git /tmp/schema-evolution-manager \
    && cd /tmp/schema-evolution-manager \
    && ./install.sh /opt/sem \
    && cd / \
    && rm -rf /tmp/schema-evolution-manager

ENV PATH="/opt/sem/bin:${PATH}"

# Application scripts (sem-apply runs from this directory)
WORKDIR /app
COPY scripts/ /app/scripts/

# Run sem-apply with URL from POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_PORT
ENTRYPOINT ["/bin/sh", "-c", "sem-apply --url \"postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/\""]
