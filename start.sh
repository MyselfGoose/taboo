#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

RUN_BACKEND=true
RUN_FRONTEND=true
KILL_EXISTING=false
SKIP_INSTALL=false
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

BACKEND_PID=""
FRONTEND_PID=""

log_info() {
  printf '[INFO] %s\n' "$1"
}

log_warn() {
  printf '[WARN] %s\n' "$1" >&2
}

log_error() {
  printf '[ERROR] %s\n' "$1" >&2
}

usage() {
  cat <<'EOF'
Usage: ./start.sh [options]

Options:
  --backend-only     Start backend only
  --frontend-only    Start frontend only
  --kill-existing    Kill processes already listening on required ports
  --skip-install     Skip npm install checks
  --help             Show this help message

Environment variables:
  BACKEND_PORT       Overrides backend port detection
  FRONTEND_PORT      Frontend dev server port (default: 5173)

Notes:
  - Backend port is loaded from BACKEND_PORT, then backend/.env PORT, then defaults to 3000.
  - Script exits if required ports are busy unless --kill-existing is provided.
EOF
}

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log_error "Required command not found: $cmd"
    exit 1
  fi
}

read_port_from_env_file() {
  local env_file="$1"
  if [[ ! -f "$env_file" ]]; then
    return 0
  fi

  local detected
  detected="$(grep -E '^[[:space:]]*PORT=' "$env_file" | tail -n 1 | sed -E 's/^[[:space:]]*PORT=//; s/[[:space:]]+$//' | tr -d '"' || true)"

  if [[ -n "$detected" ]]; then
    printf '%s' "$detected"
  fi
}

read_var_from_env_file() {
  local env_file="$1"
  local var_name="$2"
  if [[ ! -f "$env_file" ]]; then
    return 0
  fi

  local detected
  detected="$(grep -E "^[[:space:]]*${var_name}=" "$env_file" | tail -n 1 | sed -E "s/^[[:space:]]*${var_name}=//; s/[[:space:]]+$//" | tr -d '"' || true)"

  if [[ -n "$detected" ]]; then
    printf '%s' "$detected"
  fi
}

ensure_valid_port() {
  local name="$1"
  local port="$2"
  if [[ ! "$port" =~ ^[0-9]+$ ]] || ((port < 1 || port > 65535)); then
    log_error "$name must be a valid port number (1-65535), got: $port"
    exit 1
  fi
}

find_listening_pids() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true
}

kill_pids_on_port() {
  local port="$1"
  local pids
  pids="$(find_listening_pids "$port")"

  if [[ -z "$pids" ]]; then
    return 0
  fi

  log_warn "Killing existing process(es) on port $port: $pids"
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    kill -TERM "$pid" 2>/dev/null || true
  done <<< "$pids"

  sleep 1

  local still_running
  still_running="$(find_listening_pids "$port")"
  if [[ -n "$still_running" ]]; then
    log_warn "Force-killing stubborn process(es) on port $port: $still_running"
    while IFS= read -r pid; do
      [[ -z "$pid" ]] && continue
      kill -KILL "$pid" 2>/dev/null || true
    done <<< "$still_running"
  fi
}

ensure_port_available() {
  local port="$1"
  local service_name="$2"
  local pids

  pids="$(find_listening_pids "$port")"
  if [[ -z "$pids" ]]; then
    return 0
  fi

  if [[ "$KILL_EXISTING" == true ]]; then
    kill_pids_on_port "$port"
    pids="$(find_listening_pids "$port")"
    if [[ -n "$pids" ]]; then
      log_error "$service_name port $port is still busy after kill attempt: $pids"
      exit 1
    fi
    return 0
  fi

  log_error "$service_name port $port is already in use by PID(s): $pids"
  log_error "Rerun with --kill-existing or choose a different port."
  exit 1
}

ensure_dependencies() {
  local service_dir="$1"
  local service_name="$2"

  if [[ "$SKIP_INSTALL" == true ]]; then
    log_info "Skipping dependency check for $service_name"
    return 0
  fi

  if [[ ! -d "$service_dir/node_modules" ]]; then
    log_info "Installing dependencies for $service_name"
    (cd "$service_dir" && npm install --no-audit --no-fund)
  else
    log_info "$service_name dependencies found"
  fi
}

wait_for_http() {
  local url="$1"
  local label="$2"
  local timeout_seconds="${3:-30}"

  if ! command -v curl >/dev/null 2>&1; then
    log_warn "curl not found; skipping readiness check for $label"
    return 0
  fi

  local curl_opts=(--silent --fail --max-time 2)

  local end_time=$((SECONDS + timeout_seconds))
  while ((SECONDS < end_time)); do
    if curl "${curl_opts[@]}" "$url" >/dev/null 2>&1; then
      log_info "$label is ready at $url"
      return 0
    fi
    sleep 1
  done

  log_error "$label did not become ready within ${timeout_seconds}s ($url)"
  return 1
}

wait_for_http_any() {
  local label="$1"
  local timeout_seconds="$2"
  shift 2
  local urls=("$@")

  if ! command -v curl >/dev/null 2>&1; then
    log_warn "curl not found; skipping readiness check for $label"
    return 0
  fi

  local end_time=$((SECONDS + timeout_seconds))
  while ((SECONDS < end_time)); do
    local url
    for url in "${urls[@]}"; do
      local curl_opts=(--silent --fail --max-time 2)
      if curl "${curl_opts[@]}" "$url" >/dev/null 2>&1; then
        log_info "$label is ready at $url"
        return 0
      fi
    done
    sleep 1
  done

  log_error "$label did not become ready within ${timeout_seconds}s (tried: ${urls[*]})"
  return 1
}

cleanup() {
  local exit_code=$?

  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    log_info "Stopping backend (PID $BACKEND_PID)"
    kill -TERM "$BACKEND_PID" 2>/dev/null || true
  fi

  if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    log_info "Stopping frontend (PID $FRONTEND_PID)"
    kill -TERM "$FRONTEND_PID" 2>/dev/null || true
  fi

  wait 2>/dev/null || true
  exit "$exit_code"
}

start_backend() {
  log_info "Starting backend"
  (
    cd "$BACKEND_DIR"
    npm run dev
  ) > >(sed 's/^/[backend] /') 2> >(sed 's/^/[backend] /' >&2) &
  BACKEND_PID=$!
  log_info "Backend PID: $BACKEND_PID"
}

start_frontend() {
  log_info "Starting frontend"
  (
    cd "$FRONTEND_DIR"
    npm run dev -- --port "$FRONTEND_PORT"
  ) > >(sed 's/^/[frontend] /') 2> >(sed 's/^/[frontend] /' >&2) &
  FRONTEND_PID=$!
  log_info "Frontend PID: $FRONTEND_PID"
}

monitor_processes() {
  while true; do
    if [[ -n "$BACKEND_PID" ]] && ! kill -0 "$BACKEND_PID" 2>/dev/null; then
      wait "$BACKEND_PID" || true
      log_error "Backend process exited unexpectedly"
      return 1
    fi

    if [[ -n "$FRONTEND_PID" ]] && ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
      wait "$FRONTEND_PID" || true
      log_error "Frontend process exited unexpectedly"
      return 1
    fi

    sleep 1
  done
}

main() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --backend-only)
        RUN_FRONTEND=false
        ;;
      --frontend-only)
        RUN_BACKEND=false
        ;;
      --kill-existing)
        KILL_EXISTING=true
        ;;
      --skip-install)
        SKIP_INSTALL=true
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      *)
        log_error "Unknown option: $1"
        usage
        exit 1
        ;;
    esac
    shift
  done

  if [[ "$RUN_BACKEND" == false && "$RUN_FRONTEND" == false ]]; then
    log_error "Both services are disabled. Choose at least one of backend/frontend."
    exit 1
  fi

  require_command node
  require_command npm
  require_command lsof
  require_command sed
  require_command grep

  if [[ ! -d "$BACKEND_DIR" || ! -f "$BACKEND_DIR/package.json" ]]; then
    log_error "Backend directory/package.json missing at: $BACKEND_DIR"
    exit 1
  fi

  if [[ ! -d "$FRONTEND_DIR" || ! -f "$FRONTEND_DIR/package.json" ]]; then
    log_error "Frontend directory/package.json missing at: $FRONTEND_DIR"
    exit 1
  fi

  local node_major
  node_major="$(node -p 'process.versions.node.split(".")[0]')"
  if [[ "$node_major" =~ ^[0-9]+$ ]] && ((node_major < 20)); then
    log_warn "Node.js < 20 detected. New Vite versions usually require Node 20+"
  fi

  local backend_port="${BACKEND_PORT:-}"
  if [[ -z "$backend_port" ]]; then
    backend_port="$(read_port_from_env_file "$BACKEND_DIR/.env" || true)"
  fi
  backend_port="${backend_port:-3000}"

  ensure_valid_port "BACKEND_PORT" "$backend_port"
  ensure_valid_port "FRONTEND_PORT" "$FRONTEND_PORT"

  if [[ "$RUN_BACKEND" == true ]]; then
    ensure_port_available "$backend_port" "Backend"
    ensure_dependencies "$BACKEND_DIR" "backend"
  fi

  if [[ "$RUN_FRONTEND" == true ]]; then
    ensure_port_available "$FRONTEND_PORT" "Frontend"
    ensure_dependencies "$FRONTEND_DIR" "frontend"
  fi

  trap cleanup EXIT INT TERM

  if [[ "$RUN_BACKEND" == true ]]; then
    start_backend
  fi

  if [[ "$RUN_FRONTEND" == true ]]; then
    start_frontend
  fi

  if [[ "$RUN_BACKEND" == true ]]; then
    wait_for_http "http://127.0.0.1:${backend_port}/health" "Backend" 40
  fi

  if [[ "$RUN_FRONTEND" == true ]]; then
    wait_for_http_any "Frontend" 40 \
      "http://localhost:${FRONTEND_PORT}" \
      "http://127.0.0.1:${FRONTEND_PORT}" \
      "http://[::1]:${FRONTEND_PORT}"
  fi

  if [[ "$RUN_BACKEND" == true ]]; then
    log_info "Backend URL: http://127.0.0.1:${backend_port}"
  fi

  if [[ "$RUN_FRONTEND" == true ]]; then
    log_info "Frontend URL: http://localhost:${FRONTEND_PORT}"
  fi

  log_info "Startup checks passed. Press Ctrl+C to stop services."
  monitor_processes
}

main "$@"
