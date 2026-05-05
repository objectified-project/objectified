#!/usr/bin/env bash
#
# Start script for the suite

cd objectified-db ; sem-apply
cd ..
yarn install
yarn dev

