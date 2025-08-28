#!/bin/bash

# AgentOS AOSP Build Script
# Builds only the AOSP components of AgentOS

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
AOSP_DIR="aosp"
BUILD_TYPE="userdebug"
PARALLEL_JOBS=$(nproc)
TARGET="agentos_x86_64"
CLEAN_BUILD=false
CCACHE_SIZE="50G"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --target)
            TARGET="$2"
            shift 2
            ;;
        --user)
            BUILD_TYPE="user"
            shift
            ;;
        --jobs)
            PARALLEL_JOBS="$2"
            shift 2
            ;;
        --clean)
            CLEAN_BUILD=true
            shift
            ;;
        --ccache-size)
            CCACHE_SIZE="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --target TARGET    Build target (default: $TARGET)"
            echo "  --user             Build user variant instead of userdebug"
            echo "  --jobs N           Number of parallel jobs (default: $(nproc))"
            echo "  --clean            Clean build (remove previous build artifacts)"
            echo "  --ccache-size SIZE Ccache size (default: $CCACHE_SIZE)"
            echo "  -h, --help         Show this help message"
            echo
            echo "Available targets:"
            echo "  agentos_x86_64     - x86_64 build for emulator"
            echo "  agentos_arm64      - ARM64 build for devices"
            echo "  agentos_emulator   - Emulator-specific build"
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
    
    # Check AOSP directory
    if [[ ! -d "$AOSP_DIR" ]]; then
        log_error "AOSP directory not found. Run ./scripts/init-aosp.sh first"
        exit 1
    fi
    
    # Check disk space
    local available_space=$(df -BG . | awk 'NR==2 {print int($4)}')
    if [[ $available_space -lt 100 ]]; then
        log_error "Insufficient disk space: ${available_space}GB available"
        log_error "AOSP build requires at least 100GB free space"
        exit 1
    fi
    
    # Check memory
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        local memory_gb=$(free -g | awk '/^Mem:/{print $2}')
    else
        local memory_gb=$(sysctl -n hw.memsize | awk '{print int($1/1024/1024/1024)}')
    fi
    
    if [[ $memory_gb -lt 8 ]]; then
        log_warning "Low memory: ${memory_gb}GB (recommended: 16GB+)"
        log_warning "Build may be slow or fail"
    fi
    
    log_success "Prerequisites check passed"
}

# Setup build environment
setup_build_environment() {
    log_info "Setting up build environment..."
    
    cd "$AOSP_DIR"
    
    # Source build environment
    source build/envsetup.sh
    
    # Select build target
    log_info "Selecting build target: $TARGET-$BUILD_TYPE"
    lunch "$TARGET-$BUILD_TYPE"
    
    # Setup ccache if available
    if command -v ccache &> /dev/null; then
        log_info "Configuring ccache..."
        export USE_CCACHE=1
        export CCACHE_DIR="../ccache"
        ccache -M "$CCACHE_SIZE"
        ccache -s
    else
        log_warning "ccache not found. Build will be slower."
    fi
    
    # Set build optimization flags
    export JACK_SERVER_VM_ARGUMENTS="-Dfile.encoding=UTF-8 -XX:+TieredCompilation -Xmx4g"
    export ANDROID_JACK_VM_ARGS="-Dfile.encoding=UTF-8 -XX:+TieredCompilation -Xmx4g"
    
    log_success "Build environment configured"
}

# Clean build artifacts
clean_build_artifacts() {
    if [[ $CLEAN_BUILD == true ]]; then
        log_info "Cleaning build artifacts..."
        
        cd "$AOSP_DIR"
        
        # Clean output directory
        rm -rf out/
        
        # Clean ccache
        if command -v ccache &> /dev/null; then
            ccache -C
        fi
        
        log_success "Build artifacts cleaned"
    fi
}

# Build AgentOS
build_agentos() {
    log_info "Building AgentOS AOSP components..."
    
    cd "$AOSP_DIR"
    
    local start_time=$SECONDS
    
    # Build with progress monitoring
    log_info "Starting build with $PARALLEL_JOBS parallel jobs..."
    
    # Create build log directory
    mkdir -p ../build/logs
    
    # Build command with logging
    if make -j"$PARALLEL_JOBS" 2>&1 | tee "../build/logs/aosp-build-$(date +%Y%m%d-%H%M%S).log"; then
        local build_time=$((SECONDS - start_time))
        log_success "Build completed in $((build_time / 60)) minutes $((build_time % 60)) seconds"
    else
        log_error "Build failed. Check build log for details."
        return 1
    fi
}

# Verify build output
verify_build() {
    log_info "Verifying build output..."
    
    cd "$AOSP_DIR"
    
    local product_dir="out/target/product/generic_x86_64"
    local required_files=(
        "system.img"
        "userdata.img"
        "vendor.img"
        "boot.img"
    )
    
    for file in "${required_files[@]}"; do
        if [[ -f "$product_dir/$file" ]]; then
            local size=$(du -h "$product_dir/$file" | cut -f1)
            log_success "$file ($size)"
        else
            log_error "Missing required file: $file"
            return 1
        fi
    done
    
    # Check AgentOS specific files
    local agentos_files=(
        "system/app/AgentOSSettings/AgentOSSettings.apk"
        "system/app/AgentOSLauncher/AgentOSLauncher.apk"
        "system/bin/agentos_system_service"
        "system/lib64/libagentos_intelligence.so"
    )
    
    for file in "${agentos_files[@]}"; do
        if [[ -f "$product_dir/$file" ]]; then
            log_success "AgentOS: $file"
        else
            log_warning "AgentOS file not found: $file"
        fi
    done
    
    log_success "Build verification completed"
}

# Generate build report
generate_build_report() {
    log_info "Generating build report..."
    
    local report_file="../build/aosp-build-report.md"
    local build_date=$(date)
    local git_commit=$(git -C "$AOSP_DIR" rev-parse HEAD 2>/dev/null || echo "unknown")
    local product_dir="$AOSP_DIR/out/target/product/generic_x86_64"
    
    cat > "$report_file" << EOF
# AgentOS AOSP Build Report

**Build Date:** $build_date
**Target:** $TARGET-$BUILD_TYPE
**Parallel Jobs:** $PARALLEL_JOBS
**Git Commit:** $git_commit

## Build Configuration
- Clean Build: $CLEAN_BUILD
- Ccache Size: $CCACHE_SIZE
- Build Type: $BUILD_TYPE

## Build Artifacts
$(if [[ -d "$product_dir" ]]; then
    echo "### System Images"
    for img in "$product_dir"/*.img; do
        if [[ -f "$img" ]]; then
            local size=$(du -h "$img" | cut -f1)
            echo "- $(basename "$img"): $size"
        fi
    done
    
    echo
    echo "### AgentOS Components"
    find "$product_dir/system" -name "*agentos*" -o -name "AgentOS*" 2>/dev/null | while read -r file; do
        local rel_path=${file#$product_dir/}
        local size=$(du -h "$file" | cut -f1)
        echo "- $rel_path: $size"
    done
fi)

## Build Statistics
$(if command -v ccache &> /dev/null; then
    echo "### Ccache Statistics"
    ccache -s | sed 's/^/- /'
fi)

## Build Time
**Total Build Time:** $((SECONDS / 60)) minutes $((SECONDS % 60)) seconds

## Next Steps
1. Test build: \`./scripts/run-emulator.sh\`
2. Install on device: \`fastboot flashall\`
3. Create OTA package: \`make otapackage\`
EOF
    
    log_success "Build report generated: $report_file"
}

# Package build for distribution
package_build() {
    log_info "Packaging build for distribution..."
    
    cd "$AOSP_DIR"
    
    local package_dir="../dist/aosp-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$package_dir"
    
    # Copy essential images
    local product_dir="out/target/product/generic_x86_64"
    if [[ -d "$product_dir" ]]; then
        cp "$product_dir"/*.img "$package_dir/" 2>/dev/null || true
        
        # Copy AgentOS specific files
        if [[ -d "$product_dir/system/app" ]]; then
            mkdir -p "$package_dir/apps"
            find "$product_dir/system/app" -name "AgentOS*.apk" -exec cp {} "$package_dir/apps/" \; 2>/dev/null || true
        fi
        
        # Copy build info
        cp "../build/aosp-build-report.md" "$package_dir/" 2>/dev/null || true
    fi
    
    # Create archive
    if [[ $BUILD_TYPE == "user" ]]; then
        tar -czf "$package_dir.tar.gz" -C "$(dirname "$package_dir")" "$(basename "$package_dir")"
        log_success "Release package created: $package_dir.tar.gz"
    fi
    
    log_success "Build packaged: $package_dir"
}

# Main function
main() {
    local start_time=$SECONDS
    
    echo "=========================================="
    echo "        AgentOS AOSP Build System        "
    echo "=========================================="
    echo "Target: $TARGET-$BUILD_TYPE"
    echo "Parallel Jobs: $PARALLEL_JOBS"
    echo "Clean Build: $CLEAN_BUILD"
    echo "Ccache Size: $CCACHE_SIZE"
    echo "=========================================="
    echo
    
    check_prerequisites
    setup_build_environment
    clean_build_artifacts
    build_agentos
    verify_build
    generate_build_report
    package_build
    
    local total_time=$((SECONDS - start_time))
    
    echo
    log_success "AgentOS AOSP build completed successfully!"
    log_info "Total time: $((total_time / 60)) minutes $((total_time % 60)) seconds"
    echo
    echo "Build artifacts:"
    echo "  Images: $AOSP_DIR/out/target/product/generic_x86_64/"
    echo "  Report: build/aosp-build-report.md"
    echo "  Package: dist/"
    echo
    echo "Next steps:"
    echo "  1. Test in emulator: ./scripts/run-emulator.sh"
    echo "  2. Flash to device: fastboot flashall"
    echo
}

# Run main function
main "$@"