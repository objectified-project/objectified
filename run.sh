#!/usr/bin/env bash
#
# Start script for the suite

cd objectified-db ; objectified-db migrate
cd ..
yarn install
yarn dev

