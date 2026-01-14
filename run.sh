#!/bin/sh

max_iterations=""

while getopts "n:" opt; do
    case $opt in
        n) max_iterations="$OPTARG" ;;
        *) echo "Usage: $0 [-n NUMBER]" >&2; exit 1 ;;
    esac
done

count=0
while :; do
    cat PROMPT.md | claude
    count=$((count + 1))
    if [ -n "$max_iterations" ] && [ "$count" -ge "$max_iterations" ]; then
        break
    fi
done
