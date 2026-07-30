#!/bin/sh
# Runs once, on first initialisation of the Postgres volume.
# The WhatsApp gateway stores its sessions in a SEPARATE database on the same
# server: one instance to tune and back up, no schema collisions with the app.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE evolution OWNER $POSTGRES_USER;
EOSQL

echo "[init] database 'evolution' created"
