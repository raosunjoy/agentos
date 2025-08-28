#!/bin/bash

# AgentOS Build Script
# Builds the complete AgentOS system including AOSP modifications

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

# Configuration
BUILD_TYPE="debug"
CLEAN_BUILD=false
MINIMAL_BUILD=false
PARALLEL_JOBS=$(nproc)
BUILD_DIR="build"
AOSP_DIR="aosp"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --release)
            BUILD_TYPE="release"
            shift
            ;;
        --production)
            BUILD_TYPE="production"
            shift
            ;;
        --clean)
            CLEAN_BUILD=true
            shift
            ;;
        --minimal)
            MINIMAL_BUILD=true
            shift
            ;;
        --jobs)
            PARALLEL_JOBS="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --release      Build release version"
            echo "  --production   Build production version"
            echo "  --clean        Clean build (remove previous build artifacts)"
            echo "  --minimal      Minimal build for CI/testing"
            echo "  --jobs N       Number of parallel jobs (default: $(nproc))"
            echo "  -h, --help     Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Check prerequisites
check_prerequisites() {
    log_info "Checking build prerequisites..."
    
    # Check if running in Docker or native
    if [[ -f /.dockerenv ]]; then
        log_info "Running in Docker environment"
    else
        log_info "Running in native environment"
    fi
    
    # Check required tools
    local required_tools=("python3" "node" "npm" "git")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool not found: $tool"
            exit 1
        fi
    done
    
    # Check Android SDK for AOSP builds
    if [[ ! $MINIMAL_BUILD == true ]]; then
        if [[ -z "$ANDROID_HOME" ]]; then
            log_error "ANDROID_HOME not set. Please set up Android SDK."
            exit 1
        fi
    fi
    
    log_success "Prerequisites check passed"
}

# Clean previous build artifacts
clean_build() {
    if [[ $CLEAN_BUILD == true ]]; then
        log_info "Cleaning previous build artifacts..."
        rm -rf "$BUILD_DIR"
        rm -rf "dist"
        rm -rf "node_modules"
        rm -rf "venv"
        rm -rf ".pytest_cache"
        rm -rf "coverage"
        log_success "Build artifacts cleaned"
    fi
}

# Setup build environment
setup_environment() {
    log_info "Setting up build environment..."
    
    # Create build directories
    mkdir -p "$BUILD_DIR"/{intelligence-layer,plugin-framework,voice-interface,integration-layer}
    
    # Setup Python virtual environment
    if [[ ! -d "venv" ]]; then
        python3 -m venv venv
    fi
    source venv/bin/activate
    
    # Install Python dependencies
    pip install --upgrade pip
    pip install -r requirements-dev.txt
    
    # Install Node.js dependencies
    if [[ ! -d "node_modules" ]]; then
        npm install
    fi
    
    log_success "Build environment ready"
}

# Build Intelligence Layer
build_intelligence_layer() {
    log_info "Building Intelligence Layer..."
    
    cd src/intelligence-layer
    
    # Build NLP components
    log_info "Building NLP engine..."
    python3 -m pytest tests/ --tb=short
    python3 setup.py build
    
    # Build AI models (if not minimal build)
    if [[ ! $MINIMAL_BUILD == true ]]; then
        log_info "Preparing AI models..."
        python3 scripts/prepare_models.py --optimize
    fi
    
    cd ../..
    log_success "Intelligence Layer built successfully"
}

# Build Plugin Framework
build_plugin_framework() {
    log_info "Building Plugin Framework..."
    
    cd src/plugin-framework
    
    # Build SDK
    npm run build
    npm test
    
    # Build plugin registry
    log_info "Building plugin registry..."
    python3 -m pytest tests/ --tb=short
    
    cd ../..
    log_success "Plugin Framework built successfully"
}

# Build Voice Interface
build_voice_interface() {
    log_info "Building Voice Interface..."
    
    cd src/voice-interface
    
    # Build speech recognition components
    log_info "Building speech recognition..."
    python3 -m pytest tests/ --tb=short
    
    # Build accessibility features
    log_info "Building accessibility features..."
    python3 scripts/build_accessibility.py
    
    cd ../..
    log_success "Voice Interface built successfully"
}

# Build AOSP modifications (if not minimal build)
build_aosp() {
    if [[ $MINIMAL_BUILD == true ]]; then
        log_info "Skipping AOSP build (minimal build mode)"
        return
    fi
    
    log_info "Building AOSP modifications..."
    
    if [[ ! -d "$AOSP_DIR" ]]; then
        log_warning "AOSP source not found. Run ./scripts/init-aosp.sh first"
        return
    fi
    
    cd "$AOSP_DIR"
    
    # Setup build environment
    source build/envsetup.sh
    
    # Choose build target based on build type
    if [[ $BUILD_TYPE == "production" ]]; then
        lunch agentos_x86_64-user
    else
        lunch agentos_x86_64-userdebug
    fi
    
    # Build with ccache if available
    if command -v ccache &> /dev/null; then
        export USE_CCACHE=1
        export CCACHE_DIR=../ccache
        ccache -M 50G
    fi
    
    # Build AgentOS
    log_info "Starting AOSP build (this may take several hours)..."
    make -j"$PARALLEL_JOBS" 2>&1 | tee ../build/aosp-build.log
    
    cd ..
    log_success "AOSP build completed"
}

# Run tests
run_tests() {
    log_info "Running tests..."
    
    # Activate Python environment
    source venv/bin/activate
    
    # Run Python tests
    log_info "Running Python tests..."
    python3 -m pytest tests/ --cov=src/ --cov-report=html --cov-report=xml
    
    # Run JavaScript/TypeScript tests
    log_info "Running JavaScript tests..."
    npm test
    
    # Run accessibility tests
    if [[ ! $MINIMAL_BUILD == true ]]; then
        log_info "Running accessibility tests..."
        python3 -m pytest tests/accessibility/ --tb=short
    fi
    
    log_success "All tests passed"
}

# Package build artifacts
package_artifacts() {
    log_info "Packaging build artifacts..."
    
    # Create distribution directory
    mkdir -p dist
    
    # Copy built components
    cp -r "$BUILD_DIR"/* dist/
    
    # Copy documentation
    if [[ -d "docs/_build" ]]; then
        cp -r docs/_build dist/docs
    fi
    
    # Create version info
    cat > dist/version.json << EOF
{
    "version": "0.1.0",
    "build_type": "$BUILD_TYPE",
    "build_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "git_commit": "$(git rev-parse HEAD)",
    "git_branch": "$(git rev-parse --abbrev-ref HEAD)"
}
EOF
    
    # Create archive for distribution
    if [[ $BUILD_TYPE == "production" ]]; then
        tar -czf "dist/agentos-$(date +%Y%m%d-%H%M%S).tar.gz" -C dist .
    fi
    
    log_success "Build artifacts packaged"
}

# Generate build report
generate_report() {
    log_info "Generating build report..."
    
    local report_file="$BUILD_DIR/build-report.md"
    
    cat > "$report_file" << EOF
# AgentOS Build Report

**Build Date:** $(date)
**Build Type:** $BUILD_TYPE
**Git Commit:** $(git rev-parse HEAD)
**Git Branch:** $(git rev-parse --abbrev-ref HEAD)

## Build Configuration
- Parallel Jobs: $PARALLEL_JOBS
- Clean Build: $CLEAN_BUILD
- Minimal Build: $MINIMAL_BUILD

## Components Built
- [x] Intelligence Layer
- [x] Plugin Framework  
- [x] Voice Interface
$(if [[ ! $MINIMAL_BUILD == true ]]; then echo "- [x] AOSP Modifications"; else echo "- [ ] AOSP Modifications (skipped)"; fi)

## Test Results
$(if [[ -f "coverage.xml" ]]; then echo "- Test Coverage: Available in coverage.xml"; fi)
$(if [[ -f "test-results.xml" ]]; then echo "- Test Results: Available in test-results.xml"; fi)

## Build Artifacts
$(find dist -type f -name "*.tar.gz" -o -name "*.apk" -o -name "*.img" 2>/dev/null | sed 's/^/- /')

## Build Time
**Total Build Time:** $((SECONDS / 60)) minutes $((SECONDS % 60)) seconds
EOF
    
    log_success "Build report generated: $report_file"
}

# Main build function
main() {
    local start_time=$SECONDS
    
    echo "=========================================="
    echo "         AgentOS Build System            "
    echo "=========================================="
    echo "Build Type: $BUILD_TYPE"
    echo "Parallel Jobs: $PARALLEL_JOBS"
    echo "Clean Build: $CLEAN_BUILD"
    echo "Minimal Build: $MINIMAL_BUILD"
    echo "=========================================="
    echo
    
    check_prerequisites
    clean_build
    setup_environment
    build_intelligence_layer
    build_plugin_framework
    build_voice_interface
    build_aosp
    run_tests
    package_artifacts
    generate_report
    
    local build_time=$((SECONDS - start_time))
    
    echo
    log_success "AgentOS build completed successfully!"
    log_info "Total build time: $((build_time / 60)) minutes $((build_time % 60)) seconds"
    echo
    echo "Build artifacts available in: dist/"
    echo "Build report: $BUILD_DIR/build-report.md"
    echo
}

# Run main function
main "$@"