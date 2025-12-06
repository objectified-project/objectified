#!/usr/bin/env bash
#
# Builds the Docker image

BUILDPLATFORM="linux/amd64" DOCKER_REGISTRY="registry.objectified.dev" yarn docker:build:push

