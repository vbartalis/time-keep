#!/usr/bin/env bash
# Claude Code status line - mirrors the devcontainers bash PS1 theme
# Includes: context usage, 5-hour session limit, 7-day weekly limit, reset countdowns.

input=$(cat)

# ---------------------------------------------------------------------------
# PS1-style prompt fields
# ---------------------------------------------------------------------------

# Extract fields from JSON
cwd=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // empty')
git_branch=$(echo "$input" | jq -r '.workspace.git_worktree // empty')

# If no git_worktree field, try to get branch from worktree data
worktree_branch=$(echo "$input" | jq -r '.worktree.branch // empty')
[ -n "$worktree_branch" ] && git_branch="$worktree_branch"

# Fallback: detect git branch from the cwd directly (skip optional locks)
if [ -z "$git_branch" ] && [ -n "$cwd" ]; then
    git_branch=$(git --no-optional-locks -C "$cwd" symbolic-ref --short HEAD 2>/dev/null \
        || git --no-optional-locks -C "$cwd" rev-parse --short HEAD 2>/dev/null)
fi

# User (green)
user_part=$(printf '\033[0;32m%s\033[0m' "$(whoami)")

# Arrow (plain, no exit-code colouring available)
arrow=$(printf '\033[0m➜')

# Directory (bold blue) — shorten home prefix
if [ -n "$cwd" ]; then
    home="$HOME"
    short_cwd="${cwd/#$home/~}"
else
    short_cwd="~"
fi
dir_part=$(printf '\033[1;34m%s\033[0m' "$short_cwd")

# Git branch (cyan parens, red branch name)
branch_part=""
if [ -n "$git_branch" ]; then
    branch_part=$(printf '\033[0;36m(\033[1;31m%s\033[0;36m)\033[0m' "$git_branch")
fi

# ---------------------------------------------------------------------------
# Helper: format seconds into a human-readable countdown (e.g. "1h23m")
# ---------------------------------------------------------------------------
format_countdown() {
    local secs="$1"
    if [ -z "$secs" ] || [ "$secs" -le 0 ] 2>/dev/null; then
        echo "now"
        return
    fi
    local h=$(( secs / 3600 ))
    local m=$(( (secs % 3600) / 60 ))
    if [ "$h" -gt 0 ]; then
        printf '%dh%02dm' "$h" "$m"
    else
        printf '%dm' "$m"
    fi
}

# ---------------------------------------------------------------------------
# Context window usage
# ---------------------------------------------------------------------------
ctx_used=$(echo "$input" | jq -r '.context_window.used_percentage // empty')
ctx_part=""
if [ -n "$ctx_used" ]; then
    ctx_int=$(printf '%.0f' "$ctx_used")
    # Color: green <50%, yellow <80%, red >=80%
    if [ "$ctx_int" -ge 80 ]; then
        ctx_color='\033[0;31m'   # red
    elif [ "$ctx_int" -ge 50 ]; then
        ctx_color='\033[0;33m'   # yellow
    else
        ctx_color='\033[0;32m'   # green
    fi
    ctx_part=$(printf "${ctx_color}ctx:%d%%\033[0m" "$ctx_int")
fi

# ---------------------------------------------------------------------------
# 5-hour session rate limit
# ---------------------------------------------------------------------------
five_pct=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
five_reset=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')
five_part=""
if [ -n "$five_pct" ]; then
    five_int=$(printf '%.0f' "$five_pct")
    if [ "$five_int" -ge 80 ]; then
        five_color='\033[0;31m'
    elif [ "$five_int" -ge 50 ]; then
        five_color='\033[0;33m'
    else
        five_color='\033[0;32m'
    fi
    five_str=$(printf "${five_color}5h:%d%%\033[0m" "$five_int")
    # Append reset countdown if available
    if [ -n "$five_reset" ] && [ "$five_reset" != "null" ]; then
        now=$(date +%s)
        remaining_secs=$(( five_reset - now ))
        countdown=$(format_countdown "$remaining_secs")
        five_str="${five_str}$(printf '\033[2;37m(%s)\033[0m' "$countdown")"
    fi
    five_part="$five_str"
fi

# ---------------------------------------------------------------------------
# 7-day weekly rate limit
# ---------------------------------------------------------------------------
week_pct=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')
week_reset=$(echo "$input" | jq -r '.rate_limits.seven_day.resets_at // empty')
week_part=""
if [ -n "$week_pct" ]; then
    week_int=$(printf '%.0f' "$week_pct")
    if [ "$week_int" -ge 80 ]; then
        week_color='\033[0;31m'
    elif [ "$week_int" -ge 50 ]; then
        week_color='\033[0;33m'
    else
        week_color='\033[0;32m'
    fi
    week_str=$(printf "${week_color}7d:%d%%\033[0m" "$week_int")
    if [ -n "$week_reset" ] && [ "$week_reset" != "null" ]; then
        now=$(date +%s)
        remaining_secs=$(( week_reset - now ))
        countdown=$(format_countdown "$remaining_secs")
        week_str="${week_str}$(printf '\033[2;37m(%s)\033[0m' "$countdown")"
    fi
    week_part="$week_str"
fi

# ---------------------------------------------------------------------------
# Assemble stats block (only include parts that have data)
# ---------------------------------------------------------------------------
stats=""
for part in "$ctx_part" "$five_part" "$week_part"; do
    [ -z "$part" ] && continue
    if [ -z "$stats" ]; then
        stats="$part"
    else
        stats="${stats}$(printf '\033[2;37m|\033[0m')${part}"
    fi
done

stats_block=""
if [ -n "$stats" ]; then
    stats_block=$(printf ' \033[2;37m[\033[0m%s\033[2;37m]\033[0m' "$stats")
fi

# ---------------------------------------------------------------------------
# Final output — single line
# ---------------------------------------------------------------------------
printf '%s %s %s' "$user_part" "$arrow" "$dir_part"
[ -n "$branch_part" ] && printf ' %s' "$branch_part"
[ -n "$stats_block" ] && printf '%s' "$stats_block"
printf '\n'
