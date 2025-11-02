#!/bin/bash

# AgentOS Production Deployment Script
# Handles complete production deployment with monitoring, security, and rollback capabilities

set -euo pipefail

# Configuration
PROJECT_NAME="agentos"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-localhost:5000}"
DOCKER_IMAGE="${DOCKER_REGISTRY}/${PROJECT_NAME}"
DOCKER_TAG="${DOCKER_TAG:-latest}"
ENVIRONMENT="${ENVIRONMENT:-production}"
NAMESPACE="${NAMESPACE:-default}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi

    # Check kubectl if using Kubernetes
    if [[ "${DEPLOYMENT_TYPE:-docker}" == "kubernetes" ]]; then
        if ! command -v kubectl &> /dev/null; then
            log_error "kubectl is not installed"
            exit 1
        fi
    fi

    log_success "Prerequisites check passed"
}

# Validate environment
validate_environment() {
    log_info "Validating environment configuration..."

    # Check required environment variables
    required_vars=(
        "DATABASE_URL"
        "REDIS_URL"
        "JWT_SECRET"
    )

    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log_error "Required environment variable $var is not set"
            exit 1
        fi
    done

    # Validate database URL format
    if [[ ! "$DATABASE_URL" =~ ^postgresql:// ]]; then
        log_error "DATABASE_URL must be a valid PostgreSQL connection string"
        exit 1
    fi

    # Validate Redis URL format
    if [[ ! "$REDIS_URL" =~ ^redis:// ]]; then
        log_error "REDIS_URL must be a valid Redis connection string"
        exit 1
    fi

    # Validate JWT secret length
    if [[ ${#JWT_SECRET} -lt 32 ]]; then
        log_error "JWT_SECRET must be at least 32 characters long"
        exit 1
    fi

    log_success "Environment validation passed"
}

# Build Docker image
build_image() {
    log_info "Building Docker image..."

    # Build with production optimizations
    docker build \
        --target production \
        --build-arg NODE_ENV=production \
        --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
        --build-arg VERSION="${DOCKER_TAG}" \
        -t "${DOCKER_IMAGE}:${DOCKER_TAG}" \
        -t "${DOCKER_IMAGE}:latest" \
        .

    log_success "Docker image built successfully"
}

# Push Docker image
push_image() {
    log_info "Pushing Docker image to registry..."

    docker push "${DOCKER_IMAGE}:${DOCKER_TAG}"
    docker push "${DOCKER_IMAGE}:latest"

    log_success "Docker image pushed successfully"
}

# Deploy using Docker Compose
deploy_docker_compose() {
    log_info "Deploying with Docker Compose..."

    # Create environment file
    cat > .env << EOF
NODE_ENV=${ENVIRONMENT}
AGENTOS_ENV=${ENVIRONMENT}
PORT=3000
HOST=0.0.0.0
DATABASE_URL=${DATABASE_URL}
REDIS_URL=${REDIS_URL}
JWT_SECRET=${JWT_SECRET}
LOG_LEVEL=warn
EOF

    # Pull latest images
    docker-compose -f docker-compose.production.yml pull

    # Deploy with zero-downtime
    docker-compose -f docker-compose.production.yml up -d --scale agentos=2

    # Wait for health checks
    log_info "Waiting for services to be healthy..."
    sleep 30

    # Run health checks
    if ! curl -f http://localhost:3000/health > /dev/null 2>&1; then
        log_error "Health check failed"
        rollback_docker_compose
        exit 1
    fi

    # Scale back to normal
    docker-compose -f docker-compose.production.yml up -d --scale agentos=1

    log_success "Docker Compose deployment completed"
}

# Deploy using Kubernetes
deploy_kubernetes() {
    log_info "Deploying to Kubernetes..."

    # Create namespace if it doesn't exist
    kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

    # Create secrets
    kubectl create secret generic agentos-secrets \
        --namespace="${NAMESPACE}" \
        --from-literal=database-url="${DATABASE_URL}" \
        --from-literal=redis-url="${REDIS_URL}" \
        --from-literal=jwt-secret="${JWT_SECRET}" \
        --dry-run=client -o yaml | kubectl apply -f -

    # Deploy using Helm or kubectl
    if command -v helm &> /dev/null && [[ -d "k8s/helm" ]]; then
        # Deploy with Helm
        helm upgrade --install agentos ./k8s/helm \
            --namespace="${NAMESPACE}" \
            --set image.tag="${DOCKER_TAG}" \
            --set image.registry="${DOCKER_REGISTRY}" \
            --wait
    else
        # Deploy with kubectl
        sed "s|{{DOCKER_IMAGE}}|${DOCKER_IMAGE}|g; s|{{DOCKER_TAG}}|${DOCKER_TAG}|g" \
            k8s/deployment.yaml | kubectl apply -f -

        # Wait for rollout
        kubectl rollout status deployment/agentos \
            --namespace="${NAMESPACE}" \
            --timeout=300s
    fi

    log_success "Kubernetes deployment completed"
}

# Run pre-deployment checks
pre_deployment_checks() {
    log_info "Running pre-deployment checks..."

    # Check database connectivity
    log_info "Checking database connectivity..."
    if ! docker run --rm --network host postgres:13-alpine \
        psql "${DATABASE_URL}" -c "SELECT 1;" > /dev/null 2>&1; then
        log_error "Database connectivity check failed"
        exit 1
    fi

    # Check Redis connectivity
    log_info "Checking Redis connectivity..."
    if ! docker run --rm --network host redis:7-alpine \
        redis-cli -u "${REDIS_URL}" ping | grep -q "PONG"; then
        log_error "Redis connectivity check failed"
        exit 1
    fi

    # Run security scan
    log_info "Running security scan..."
    if command -v trivy &> /dev/null; then
        trivy image "${DOCKER_IMAGE}:${DOCKER_TAG}" || true
    fi

    log_success "Pre-deployment checks passed"
}

# Run post-deployment tests
post_deployment_tests() {
    log_info "Running post-deployment tests..."

    # Wait for application to be ready
    local max_attempts=30
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        if curl -f http://localhost:3000/health > /dev/null 2>&1; then
            log_success "Application health check passed"
            break
        fi

        log_info "Waiting for application to be ready (attempt $attempt/$max_attempts)..."
        sleep 10
        ((attempt++))
    done

    if [[ $attempt -gt $max_attempts ]]; then
        log_error "Application failed to become ready"
        rollback
        exit 1
    fi

    # Run API tests
    log_info "Running API tests..."
    if ! curl -f http://localhost:3000/api/v1/status > /dev/null 2>&1; then
        log_error "API status check failed"
        rollback
        exit 1
    fi

    # Run metrics check
    log_info "Checking metrics endpoint..."
    if ! curl -f http://localhost:3000/metrics > /dev/null 2>&1; then
        log_warning "Metrics endpoint not accessible"
    fi

    log_success "Post-deployment tests passed"
}

# Rollback deployment
rollback() {
    log_warning "Initiating rollback..."

    case "${DEPLOYMENT_TYPE:-docker}" in
        "docker")
            rollback_docker_compose
            ;;
        "kubernetes")
            rollback_kubernetes
            ;;
    esac
}

# Rollback Docker Compose deployment
rollback_docker_compose() {
    log_info "Rolling back Docker Compose deployment..."

    # Get previous version
    local previous_tag
    previous_tag=$(docker images "${DOCKER_IMAGE}" --format "table {{.Tag}}" | sed -n '2p')

    if [[ -n "$previous_tag" && "$previous_tag" != "latest" ]]; then
        log_info "Rolling back to previous version: ${previous_tag}"
        docker tag "${DOCKER_IMAGE}:${previous_tag}" "${DOCKER_IMAGE}:rollback"
        docker-compose -f docker-compose.production.yml up -d --no-deps agentos
    else
        log_warning "No previous version found, restarting current version..."
        docker-compose -f docker-compose.production.yml restart agentos
    fi
}

# Rollback Kubernetes deployment
rollback_kubernetes() {
    log_info "Rolling back Kubernetes deployment..."

    kubectl rollout undo deployment/agentos --namespace="${NAMESPACE}"
    kubectl rollout status deployment/agentos --namespace="${NAMESPACE}" --timeout=300s
}

# Send notifications
send_notifications() {
    local status="$1"
    local message="$2"

    log_info "Sending deployment notifications..."

    # Send email notification (if configured)
    if [[ -n "${ALERT_EMAIL:-}" ]]; then
        echo "Subject: AgentOS Deployment ${status}
From: deployment@agentos.com
To: ${ALERT_EMAIL}

${message}

Environment: ${ENVIRONMENT}
Version: ${DOCKER_TAG}
Timestamp: $(date)
" | sendmail "${ALERT_EMAIL}" || true
    fi

    # Send Slack notification (if configured)
    if [[ -n "${ALERT_SLACK_WEBHOOK:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"AgentOS Deployment ${status}: ${message}\"}" \
            "${ALERT_SLACK_WEBHOOK}" || true
    fi
}

# Main deployment function
main() {
    local start_time
    start_time=$(date +%s)

    log_info "Starting AgentOS production deployment..."
    log_info "Environment: ${ENVIRONMENT}"
    log_info "Docker Image: ${DOCKER_IMAGE}:${DOCKER_TAG}"

    # Trap for cleanup on error
    trap 'log_error "Deployment failed"; send_notifications "FAILED" "Deployment failed"; exit 1' ERR

    # Run deployment steps
    check_prerequisites
    validate_environment
    build_image

    if [[ "${SKIP_PUSH:-false}" != "true" ]]; then
        push_image
    fi

    pre_deployment_checks

    case "${DEPLOYMENT_TYPE:-docker}" in
        "docker")
            deploy_docker_compose
            ;;
        "kubernetes")
            deploy_kubernetes
            ;;
        *)
            log_error "Invalid deployment type: ${DEPLOYMENT_TYPE}"
            exit 1
            ;;
    esac

    post_deployment_tests

    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))

    log_success "AgentOS deployment completed successfully in ${duration} seconds"
    send_notifications "SUCCESS" "Deployment completed successfully in ${duration} seconds"
}

# Show usage
usage() {
    cat << EOF
AgentOS Production Deployment Script

Usage: $0 [OPTIONS]

Options:
    -e, --environment ENV     Deployment environment (default: production)
    -t, --tag TAG            Docker image tag (default: latest)
    -d, --deployment TYPE     Deployment type: docker or kubernetes (default: docker)
    -n, --namespace NS        Kubernetes namespace (default: default)
    -r, --registry REG        Docker registry (default: localhost:5000)
    --skip-push              Skip pushing Docker image to registry
    -h, --help               Show this help message

Environment Variables:
    DATABASE_URL             PostgreSQL connection string (required)
    REDIS_URL               Redis connection string (required)
    JWT_SECRET              JWT secret key (required)
    ALERT_EMAIL             Email for deployment notifications
    ALERT_SLACK_WEBHOOK     Slack webhook for notifications

Examples:
    $0 -e staging -t v1.2.3
    $0 --deployment kubernetes --namespace production
    DEPLOYMENT_TYPE=kubernetes DATABASE_URL=... REDIS_URL=... JWT_SECRET=... $0

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -t|--tag)
            DOCKER_TAG="$2"
            shift 2
            ;;
        -d|--deployment)
            DEPLOYMENT_TYPE="$2"
            shift 2
            ;;
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -r|--registry)
            DOCKER_REGISTRY="$2"
            shift 2
            ;;
        --skip-push)
            SKIP_PUSH=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Run main deployment
main
