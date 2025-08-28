#!/bin/bash

# AgentOS Setup Verification Script
# Verifies that the development environment is properly configured

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Verification results
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Check function
check() {
    local name="$1"
    local command="$2"
    local required="${3:-true}"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    log_info "Checking $name..."
    
    if eval "$command" &>/dev/null; then
        log_success "$name: OK"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        if [[ "$required" == "true" ]]; then
            log_error "$name: FAILED"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            return 1
        else
            log_warning "$name: NOT FOUND (optional)"
            WARNING_CHECKS=$((WARNING_CHECKS + 1))
            return 0
        fi
    fi
}

# Check with version
check_version() {
    local name="$1"
    local command="$2"
    local min_version="$3"
    local required="${4:-true}"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    log_info "Checking $name..."
    
    if command -v "${command%% *}" &>/dev/null; then
        local version_output
        version_output=$(eval "$command" 2>&1 || echo "unknown")
        log_success "$name: $version_output"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        if [[ "$required" == "true" ]]; then
            log_error "$name: NOT FOUND"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            return 1
        else
            log_warning "$name: NOT FOUND (optional)"
            WARNING_CHECKS=$((WARNING_CHECKS + 1))
            return 0
        fi
    fi
}

# Check file exists
check_file() {
    local name="$1"
    local file="$2"
    local required="${3:-true}"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    log_info "Checking $name..."
    
    if [[ -f "$file" ]]; then
        log_success "$name: Found at $file"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        if [[ "$required" == "true" ]]; then
            log_error "$name: NOT FOUND at $file"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            return 1
        else
            log_warning "$name: NOT FOUND at $file (optional)"
            WARNING_CHECKS=$((WARNING_CHECKS + 1))
            return 0
        fi
    fi
}

# Check directory exists
check_directory() {
    local name="$1"
    local dir="$2"
    local required="${3:-true}"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    log_info "Checking $name..."
    
    if [[ -d "$dir" ]]; then
        log_success "$name: Found at $dir"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        if [[ "$required" == "true" ]]; then
            log_error "$name: NOT FOUND at $dir"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            return 1
        else
            log_warning "$name: NOT FOUND at $dir (optional)"
            WARNING_CHECKS=$((WARNING_CHECKS + 1))
            return 0
        fi
    fi
}

# Main verification function
main() {
    echo "=========================================="
    echo "    AgentOS Setup Verification           "
    echo "=========================================="
    echo
    
    # System tools
    log_info "Verifying system tools..."
    check_version "Git" "git --version" "2.0" true
    check_version "Python 3" "python3 --version" "3.8" true
    check_version "Node.js" "node --version" "16.0" true
    check_version "npm" "npm --version" "8.0" true
    check_version "Docker" "docker --version" "20.0" true
    check_version "Docker Compose" "docker-compose --version" "2.0" true
    
    echo
    
    # Development tools
    log_info "Verifying development tools..."
    check "Git LFS" "git lfs version" true
    check "Java" "java -version" false
    check "Android SDK" "test -n \"\$ANDROID_HOME\"" false
    check "ccache" "ccache --version" false
    
    echo
    
    # Project files
    log_info "Verifying project configuration files..."
    check_file "Package.json" "package.json" true
    check_file "Requirements.txt" "requirements-dev.txt" true
    check_file "TypeScript config" "tsconfig.json" true
    check_file "Jest config" "jest.config.js" true
    check_file "Pre-commit config" ".pre-commit-config.yaml" true
    check_file "Docker Compose" "docker-compose.yml" true
    check_file "MkDocs config" "mkdocs.yml" true
    
    echo
    
    # Project directories
    log_info "Verifying project structure..."
    check_directory "Source directory" "src" true
    check_directory "Intelligence Layer" "src/intelligence-layer" true
    check_directory "Plugin Framework" "src/plugin-framework" true
    check_directory "Voice Interface" "src/voice-interface" true
    check_directory "Tests directory" "tests" true
    check_directory "Scripts directory" "scripts" true
    check_directory "Documentation" "docs" true
    check_directory "Docker files" "docker" true
    
    echo
    
    # Docker containers
    log_info "Verifying Docker setup..."
    if command -v docker &>/dev/null && docker info &>/dev/null; then
        check "Docker daemon" "docker info" true
        check "AgentOS dev image" "docker images | grep -q agentos-dev" false
        check "AOSP builder image" "docker images | grep -q aosp-builder" false
    else
        log_warning "Docker not running, skipping container checks"
    fi
    
    echo
    
    # Python environment
    log_info "Verifying Python environment..."
    if [[ -d "venv" ]]; then
        check_directory "Python virtual environment" "venv" true
        if source venv/bin/activate 2>/dev/null; then
            check "Virtual environment activation" "echo 'activated'" true
            check "pytest" "pytest --version" true
            check "black" "black --version" true
            check "flake8" "flake8 --version" true
            deactivate 2>/dev/null || true
        fi
    else
        log_warning "Python virtual environment not found"
        WARNING_CHECKS=$((WARNING_CHECKS + 1))
    fi
    
    echo
    
    # Node.js environment
    log_info "Verifying Node.js environment..."
    if [[ -d "node_modules" ]]; then
        check_directory "Node modules" "node_modules" true
        check "TypeScript" "npx tsc --version" true
        check "ESLint" "npx eslint --version" true
        check "Jest" "npx jest --version" true
    else
        log_warning "Node modules not installed"
        WARNING_CHECKS=$((WARNING_CHECKS + 1))
    fi
    
    echo
    
    # Git configuration
    log_info "Verifying Git configuration..."
    check "Git user name" "git config user.name" true
    check "Git user email" "git config user.email" true
    check "Git LFS tracking" "git lfs track" false
    check "Pre-commit hooks" "test -f .git/hooks/pre-commit" false
    
    echo
    
    # Build verification
    log_info "Verifying build capability..."
    check "Build script executable" "test -x scripts/build.sh" true
    check "Test script executable" "test -x scripts/test.sh" true
    check "Setup script executable" "test -x scripts/setup-dev-env.sh" true
    
    echo
    
    # Security checks
    log_info "Verifying security tools..."
    check "Bandit" "bandit --version" false
    check "Safety" "safety --version" false
    check "npm audit" "npm audit --help" false
    
    echo
    
    # Accessibility tools
    log_info "Verifying accessibility tools..."
    check "axe-core" "npx axe --version" false
    check "pa11y" "npx pa11y --version" false
    
    echo
    
    # Generate report
    echo "=========================================="
    echo "         Verification Summary            "
    echo "=========================================="
    echo "Total checks: $TOTAL_CHECKS"
    echo -e "Passed: ${GREEN}$PASSED_CHECKS${NC}"
    echo -e "Failed: ${RED}$FAILED_CHECKS${NC}"
    echo -e "Warnings: ${YELLOW}$WARNING_CHECKS${NC}"
    echo
    
    if [[ $FAILED_CHECKS -eq 0 ]]; then
        log_success "All critical checks passed! ✅"
        echo
        echo "Your AgentOS development environment is ready!"
        echo
        echo "Next steps:"
        echo "1. Run: docker-compose up -d agentos-dev"
        echo "2. Run: ./scripts/build.sh"
        echo "3. Run: ./scripts/test.sh"
        echo "4. Start developing! 🚀"
        echo
        exit 0
    else
        log_error "Some critical checks failed! ❌"
        echo
        echo "Please fix the failed checks before proceeding."
        echo "Refer to the setup guide: docs/getting-started.md"
        echo
        exit 1
    fi
}

# Run main function
main "$@"