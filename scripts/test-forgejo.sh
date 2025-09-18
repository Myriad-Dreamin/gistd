#!/bin/bash

# compose bootstrap test-forgejo.yml
# and wait for input and exit

# start the server
docker compose -f scripts/test-forgejo.yml up -d

# wait for input and exit
read  -n 1 -p "Press Enter to exit"

# stop the server
docker compose -f scripts/test-forgejo.yml down
