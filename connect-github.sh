#!/bin/bash
# Point both repos at GitHub and push. Takes the account name as its only argument.
# Nothing secret lives in this file; auth is the SSH key in ~/.ssh/id_ed25519_github.
set -e
ACCOUNT="$1"
if [ -z "$ACCOUNT" ]; then echo "usage: ./connect-github.sh <github-account-name>"; exit 1; fi

echo "== checking the key is accepted =="
ssh -o StrictHostKeyChecking=accept-new -T git@github.com 2>&1 | head -2 || true

for pair in "$HOME/loadbook-app:dino-fitness" "$HOME/loadbook-ds:loadbook-ds"; do
  DIR="${pair%%:*}"; NAME="${pair##*:}"
  [ -d "$DIR/.git" ] || { echo "skip $NAME (not a repo)"; continue; }
  cd "$DIR"
  git remote remove origin 2>/dev/null || true
  git remote add origin "git@github.com:$ACCOUNT/$NAME.git"
  BRANCH=$(git rev-parse --abbrev-ref HEAD)
  echo "== $NAME: pushing $BRANCH to $ACCOUNT/$NAME =="
  git push -u origin "$BRANCH"
done
echo "== done =="
