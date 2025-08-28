#!/bin/bash

# AgentOS AOSP Fork Initialization Script
# This script forks AOSP and sets up the AgentOS branch with custom modifications

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
AOSP_BRANCH="android-14.0.0_r50"  # Latest stable Android 14
AGENTOS_BRANCH="agentos-main"
REPO_URL="https://android.googlesource.com/platform/manifest"
PARALLEL_JOBS=$(nproc)

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --branch)
            AOSP_BRANCH="$2"
            shift 2
            ;;
        --jobs)
            PARALLEL_JOBS="$2"
            shift 2
            ;;
        --clean)
            rm -rf "$AOSP_DIR"
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --branch BRANCH  AOSP branch to fork (default: $AOSP_BRANCH)"
            echo "  --jobs N         Number of parallel jobs (default: $(nproc))"
            echo "  --clean          Clean existing AOSP directory"
            echo "  -h, --help       Show this help message"
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
    log_info "Checking prerequisites for AOSP build..."
    
    # Check disk space (AOSP requires ~200GB)
    local available_space=$(df -BG . | awk 'NR==2 {print int($4)}')
    if [[ $available_space -lt 200 ]]; then
        log_error "Insufficient disk space: ${available_space}GB available"
        log_error "AOSP requires at least 200GB free space"
        exit 1
    fi
    
    # Check memory (recommended 16GB+)
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        local memory_gb=$(free -g | awk '/^Mem:/{print $2}')
    else
        local memory_gb=$(sysctl -n hw.memsize | awk '{print int($1/1024/1024/1024)}')
    fi
    
    if [[ $memory_gb -lt 16 ]]; then
        log_warning "Recommended: 16GB+ RAM (detected: ${memory_gb}GB)"
        log_warning "Build times may be significantly longer"
    fi
    
    # Check required tools
    local required_tools=("git" "curl" "python3" "make" "gcc" "g++")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool not found: $tool"
            exit 1
        fi
    done
    
    # Check repo tool
    if ! command -v repo &> /dev/null; then
        log_info "Installing repo tool..."
        mkdir -p ~/.bin
        curl https://storage.googleapis.com/git-repo-downloads/repo > ~/.bin/repo
        chmod a+x ~/.bin/repo
        export PATH=~/.bin:$PATH
        echo 'export PATH=~/.bin:$PATH' >> ~/.bashrc
    fi
    
    log_success "Prerequisites check passed"
}

# Initialize AOSP repository
init_aosp_repo() {
    log_info "Initializing AOSP repository..."
    
    # Create AOSP directory
    mkdir -p "$AOSP_DIR"
    cd "$AOSP_DIR"
    
    # Initialize repo
    log_info "Initializing repo with branch: $AOSP_BRANCH"
    repo init -u "$REPO_URL" -b "$AOSP_BRANCH" --depth=1
    
    # Configure git
    git config --global user.name "AgentOS Builder"
    git config --global user.email "builder@agentos.org"
    
    log_success "AOSP repository initialized"
}

# Sync AOSP source code
sync_aosp_source() {
    log_info "Syncing AOSP source code (this may take several hours)..."
    
    cd "$AOSP_DIR"
    
    # Sync with parallel jobs
    repo sync -c -j"$PARALLEL_JOBS" --force-sync --no-tags --no-clone-bundle
    
    log_success "AOSP source code synced"
}

# Create AgentOS branch and apply modifications
create_agentos_branch() {
    log_info "Creating AgentOS branch with custom modifications..."
    
    cd "$AOSP_DIR"
    
    # Create AgentOS branch
    repo start "$AGENTOS_BRANCH" --all
    
    # Apply AgentOS modifications
    apply_framework_modifications
    apply_system_modifications
    apply_kernel_modifications
    
    log_success "AgentOS branch created with modifications"
}

# Apply Android Framework modifications for AgentOS
apply_framework_modifications() {
    log_info "Applying Android Framework modifications..."
    
    # Create AgentOS system service
    local framework_dir="frameworks/base"
    if [[ -d "$framework_dir" ]]; then
        # Add AgentOS service to framework
        cat >> "$framework_dir/services/java/com/android/server/SystemServer.java" << 'EOF'

        // AgentOS Intelligence Service
        try {
            Slog.i(TAG, "AgentOS Intelligence Service");
            ServiceManager.addService("agentos_intelligence", 
                new com.agentos.intelligence.IntelligenceService(context));
        } catch (Throwable e) {
            reportWtf("starting AgentOS Intelligence Service", e);
        }
EOF
        
        # Create AgentOS API in framework
        mkdir -p "$framework_dir/core/java/com/agentos/intelligence"
        cat > "$framework_dir/core/java/com/agentos/intelligence/IntelligenceManager.java" << 'EOF'
package com.agentos.intelligence;

import android.content.Context;
import android.os.IBinder;
import android.os.RemoteException;
import android.os.ServiceManager;

/**
 * AgentOS Intelligence Manager
 * Provides access to the AgentOS Intelligence Layer
 */
public class IntelligenceManager {
    private static final String SERVICE_NAME = "agentos_intelligence";
    private final Context mContext;
    private IIntelligenceService mService;
    
    public IntelligenceManager(Context context) {
        mContext = context;
        mService = IIntelligenceService.Stub.asInterface(
            ServiceManager.getService(SERVICE_NAME));
    }
    
    /**
     * Process natural language intent
     */
    public IntentResult processIntent(String intent, Context context) throws RemoteException {
        return mService.processIntent(intent, context.getPackageName());
    }
    
    /**
     * Register plugin with intelligence layer
     */
    public boolean registerPlugin(PluginInfo plugin) throws RemoteException {
        return mService.registerPlugin(plugin);
    }
}
EOF
        
        # Add AgentOS permissions
        cat >> "$framework_dir/core/res/AndroidManifest.xml" << 'EOF'
    
    <!-- AgentOS Intelligence Permissions -->
    <permission android:name="com.agentos.permission.INTELLIGENCE_ACCESS"
        android:protectionLevel="signature|privileged"
        android:label="@string/permlab_intelligence_access"
        android:description="@string/permdesc_intelligence_access" />
    
    <permission android:name="com.agentos.permission.PLUGIN_REGISTER"
        android:protectionLevel="normal"
        android:label="@string/permlab_plugin_register"
        android:description="@string/permdesc_plugin_register" />
EOF
    fi
    
    log_success "Framework modifications applied"
}

# Apply system-level modifications
apply_system_modifications() {
    log_info "Applying system-level modifications..."
    
    # Modify system properties for AgentOS
    local system_dir="system/core"
    if [[ -d "$system_dir" ]]; then
        # Add AgentOS system properties
        cat >> "$system_dir/rootdir/init.rc" << 'EOF'

# AgentOS Intelligence Layer
service agentos-intelligence /system/bin/agentos_intelligence
    class main
    user system
    group system audio camera
    capabilities SYS_NICE
EOF
        
        # Create AgentOS init script
        mkdir -p "$system_dir/rootdir/etc/init"
        cat > "$system_dir/rootdir/etc/init/agentos.rc" << 'EOF'
# AgentOS Services

service agentos-nlp /system/bin/agentos_nlp
    class late_start
    user system
    group system audio
    capabilities SYS_NICE

service agentos-orchestrator /system/bin/agentos_orchestrator
    class late_start
    user system
    group system
    capabilities SYS_NICE

service agentos-context /system/bin/agentos_context
    class late_start
    user system
    group system
    capabilities SYS_NICE
EOF
    fi
    
    log_success "System modifications applied"
}

# Apply kernel modifications for AgentOS
apply_kernel_modifications() {
    log_info "Applying kernel modifications..."
    
    local kernel_dir="kernel/common"
    if [[ -d "$kernel_dir" ]]; then
        # Add AgentOS kernel configuration
        cat >> "$kernel_dir/arch/arm64/configs/agentos_defconfig" << 'EOF'
# AgentOS Kernel Configuration
CONFIG_AGENTOS=y
CONFIG_AGENTOS_INTELLIGENCE=y
CONFIG_AGENTOS_VOICE_PROCESSING=y
CONFIG_AGENTOS_SECURITY=y
EOF
        
        # Create AgentOS kernel module directory
        mkdir -p "$kernel_dir/drivers/agentos"
        cat > "$kernel_dir/drivers/agentos/Kconfig" << 'EOF'
config AGENTOS
    tristate "AgentOS Intelligence Layer Support"
    default y
    help
      Enable AgentOS intelligence layer kernel support.
      This provides low-level interfaces for AI processing,
      voice recognition, and security features.

config AGENTOS_INTELLIGENCE
    tristate "AgentOS Intelligence Processing"
    depends on AGENTOS
    default y
    help
      Enable AgentOS intelligence processing support.

config AGENTOS_VOICE_PROCESSING
    tristate "AgentOS Voice Processing"
    depends on AGENTOS
    default y
    help
      Enable AgentOS voice processing support.

config AGENTOS_SECURITY
    tristate "AgentOS Security Features"
    depends on AGENTOS
    default y
    help
      Enable AgentOS security features.
EOF
        
        cat > "$kernel_dir/drivers/agentos/Makefile" << 'EOF'
obj-$(CONFIG_AGENTOS) += agentos_core.o
obj-$(CONFIG_AGENTOS_INTELLIGENCE) += agentos_intelligence.o
obj-$(CONFIG_AGENTOS_VOICE_PROCESSING) += agentos_voice.o
obj-$(CONFIG_AGENTOS_SECURITY) += agentos_security.o
EOF
    fi
    
    log_success "Kernel modifications applied"
}

# Configure Soong build system for AgentOS
configure_soong_build() {
    log_info "Configuring Soong build system for AgentOS..."
    
    cd "$AOSP_DIR"
    
    # Create AgentOS build configuration
    mkdir -p "device/agentos/generic"
    
    # Device configuration
    cat > "device/agentos/generic/AndroidProducts.mk" << 'EOF'
PRODUCT_MAKEFILES := \
    $(LOCAL_DIR)/agentos_x86_64.mk \
    $(LOCAL_DIR)/agentos_arm64.mk

COMMON_LUNCH_CHOICES := \
    agentos_x86_64-userdebug \
    agentos_x86_64-user \
    agentos_arm64-userdebug \
    agentos_arm64-user
EOF
    
    # x86_64 product configuration
    cat > "device/agentos/generic/agentos_x86_64.mk" << 'EOF'
# AgentOS x86_64 Product Configuration

$(call inherit-product, $(SRC_TARGET_DIR)/product/core_64_bit.mk)
$(call inherit-product, $(SRC_TARGET_DIR)/product/generic_x86_64.mk)

# AgentOS specific packages
PRODUCT_PACKAGES += \
    AgentOSIntelligence \
    AgentOSPluginFramework \
    AgentOSVoiceInterface \
    AgentOSSettings

# AgentOS system properties
PRODUCT_PROPERTY_OVERRIDES += \
    ro.agentos.version=0.1.0 \
    ro.agentos.intelligence.enabled=true \
    ro.agentos.voice.enabled=true \
    ro.agentos.plugins.enabled=true

# Product information
PRODUCT_NAME := agentos_x86_64
PRODUCT_DEVICE := generic_x86_64
PRODUCT_BRAND := AgentOS
PRODUCT_MODEL := AgentOS x86_64
PRODUCT_MANUFACTURER := AgentOS Project
EOF
    
    # ARM64 product configuration
    cat > "device/agentos/generic/agentos_arm64.mk" << 'EOF'
# AgentOS ARM64 Product Configuration

$(call inherit-product, $(SRC_TARGET_DIR)/product/core_64_bit.mk)
$(call inherit-product, $(SRC_TARGET_DIR)/product/generic_arm64.mk)

# AgentOS specific packages
PRODUCT_PACKAGES += \
    AgentOSIntelligence \
    AgentOSPluginFramework \
    AgentOSVoiceInterface \
    AgentOSSettings

# AgentOS system properties
PRODUCT_PROPERTY_OVERRIDES += \
    ro.agentos.version=0.1.0 \
    ro.agentos.intelligence.enabled=true \
    ro.agentos.voice.enabled=true \
    ro.agentos.plugins.enabled=true

# Product information
PRODUCT_NAME := agentos_arm64
PRODUCT_DEVICE := generic_arm64
PRODUCT_BRAND := AgentOS
PRODUCT_MODEL := AgentOS ARM64
PRODUCT_MANUFACTURER := AgentOS Project
EOF
    
    # Board configuration
    cat > "device/agentos/generic/BoardConfig.mk" << 'EOF'
# AgentOS Board Configuration

# Architecture
TARGET_ARCH := x86_64
TARGET_ARCH_VARIANT := x86_64
TARGET_CPU_ABI := x86_64
TARGET_CPU_VARIANT := generic

# Kernel
TARGET_KERNEL_CONFIG := agentos_defconfig
BOARD_KERNEL_CMDLINE := console=ttyS0,115200n8 androidboot.console=ttyS0

# Partitions
BOARD_FLASH_BLOCK_SIZE := 512
TARGET_USERIMAGES_USE_EXT4 := true
BOARD_SYSTEMIMAGE_PARTITION_SIZE := 3221225472  # 3GB
BOARD_USERDATAIMAGE_PARTITION_SIZE := 576716800  # 550MB

# AgentOS specific features
BOARD_AGENTOS_INTELLIGENCE := true
BOARD_AGENTOS_VOICE_PROCESSING := true
BOARD_AGENTOS_PLUGIN_SUPPORT := true
EOF
    
    # Create AgentOS module build files
    create_agentos_modules
    
    log_success "Soong build system configured"
}

# Create AgentOS module build files
create_agentos_modules() {
    log_info "Creating AgentOS module build files..."
    
    # Create AgentOS packages directory
    mkdir -p "packages/apps/AgentOS"
    
    # Intelligence module
    mkdir -p "packages/apps/AgentOS/Intelligence"
    cat > "packages/apps/AgentOS/Intelligence/Android.bp" << 'EOF'
android_app {
    name: "AgentOSIntelligence",
    srcs: ["src/**/*.java"],
    platform_apis: true,
    certificate: "platform",
    privileged: true,
    system_ext_specific: true,
    
    static_libs: [
        "androidx.core_core",
        "androidx.lifecycle_lifecycle-runtime",
    ],
    
    required: [
        "agentos_intelligence_native",
    ],
}

cc_binary {
    name: "agentos_intelligence_native",
    srcs: ["native/**/*.cpp"],
    shared_libs: [
        "liblog",
        "libbinder",
        "libutils",
    ],
    init_rc: ["agentos_intelligence.rc"],
}
EOF
    
    # Plugin Framework module
    mkdir -p "packages/apps/AgentOS/PluginFramework"
    cat > "packages/apps/AgentOS/PluginFramework/Android.bp" << 'EOF'
android_app {
    name: "AgentOSPluginFramework",
    srcs: ["src/**/*.java"],
    platform_apis: true,
    certificate: "platform",
    privileged: true,
    system_ext_specific: true,
    
    static_libs: [
        "androidx.core_core",
        "androidx.lifecycle_lifecycle-runtime",
    ],
}
EOF
    
    # Voice Interface module
    mkdir -p "packages/apps/AgentOS/VoiceInterface"
    cat > "packages/apps/AgentOS/VoiceInterface/Android.bp" << 'EOF'
android_app {
    name: "AgentOSVoiceInterface",
    srcs: ["src/**/*.java"],
    platform_apis: true,
    certificate: "platform",
    privileged: true,
    system_ext_specific: true,
    
    static_libs: [
        "androidx.core_core",
        "androidx.lifecycle_lifecycle-runtime",
    ],
    
    required: [
        "agentos_voice_native",
    ],
}

cc_binary {
    name: "agentos_voice_native",
    srcs: ["native/**/*.cpp"],
    shared_libs: [
        "liblog",
        "libbinder",
        "libutils",
        "libaudioclient",
    ],
    init_rc: ["agentos_voice.rc"],
}
EOF
    
    log_success "AgentOS module build files created"
}

# Setup emulator environment
setup_emulator() {
    log_info "Setting up emulator environment..."
    
    cd "$AOSP_DIR"
    
    # Create emulator configuration
    mkdir -p "device/agentos/emulator"
    
    cat > "device/agentos/emulator/emulator.mk" << 'EOF'
# AgentOS Emulator Configuration

# Inherit from generic emulator
$(call inherit-product, device/generic/goldfish/x86_64-vendor.mk)
$(call inherit-product, $(SRC_TARGET_DIR)/product/emulator_vendor.mk)
$(call inherit-product, $(SRC_TARGET_DIR)/product/aosp_x86_64.mk)

# AgentOS emulator specific
PRODUCT_NAME := agentos_emulator
PRODUCT_DEVICE := emulator_x86_64
PRODUCT_BRAND := AgentOS
PRODUCT_MODEL := AgentOS Emulator

# Enable emulator features
PRODUCT_PROPERTY_OVERRIDES += \
    ro.kernel.qemu=1 \
    ro.agentos.emulator=true \
    ro.agentos.debug=true

# Emulator packages
PRODUCT_PACKAGES += \
    EmulatorRadioService \
    EmulatorCameraService
EOF
    
    # Create emulator launch script
    cat > "../scripts/run-emulator.sh" << 'EOF'
#!/bin/bash

# AgentOS Emulator Launch Script

set -e

AOSP_DIR="aosp"
AVD_NAME="AgentOS_Emulator"
EMULATOR_PORT="5554"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

# Check if AOSP is built
if [[ ! -f "$AOSP_DIR/out/target/product/generic_x86_64/system.img" ]]; then
    echo "Error: AgentOS not built. Run ./scripts/build.sh first"
    exit 1
fi

cd "$AOSP_DIR"

# Setup environment
source build/envsetup.sh
lunch agentos_x86_64-userdebug

log_info "Starting AgentOS emulator..."

# Launch emulator
emulator -avd "$AVD_NAME" \
    -system out/target/product/generic_x86_64/system.img \
    -data out/target/product/generic_x86_64/userdata.img \
    -kernel prebuilts/qemu-kernel/x86_64/kernel-qemu2 \
    -port "$EMULATOR_PORT" \
    -gpu swiftshader_indirect \
    -no-snapshot \
    -wipe-data \
    -verbose &

EMULATOR_PID=$!

log_success "AgentOS emulator started (PID: $EMULATOR_PID)"
log_info "Connect with: adb connect localhost:$EMULATOR_PORT"

# Wait for emulator to boot
log_info "Waiting for emulator to boot..."
adb wait-for-device

log_success "AgentOS emulator ready!"
echo "Emulator console: telnet localhost $((EMULATOR_PORT + 1))"
EOF
    
    chmod +x "../scripts/run-emulator.sh"
    
    log_success "Emulator environment configured"
}

# Create CI build scripts
create_ci_scripts() {
    log_info "Creating CI build scripts..."
    
    # Update main build script to include AOSP
    cat >> "../scripts/build.sh" << 'EOF'

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
    
    # Choose build target
    if [[ $BUILD_TYPE == "production" ]]; then
        lunch agentos_x86_64-user
    else
        lunch agentos_x86_64-userdebug
    fi
    
    # Build with ccache if available
    if command -v ccache &> /dev/null; then
        export USE_CCACHE=1
        export CCACHE_DIR=../ccache
    fi
    
    # Build AgentOS
    log_info "Starting AOSP build (this may take several hours)..."
    make -j"$PARALLEL_JOBS" 2>&1 | tee ../build/aosp-build.log
    
    cd ..
    log_success "AOSP build completed"
}
EOF
    
    # Create AOSP-specific build script
    cat > "../scripts/build-aosp.sh" << 'EOF'
#!/bin/bash

# AgentOS AOSP Build Script
# Builds only the AOSP components

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

AOSP_DIR="aosp"
BUILD_TYPE="userdebug"
PARALLEL_JOBS=$(nproc)
TARGET="agentos_x86_64"

# Parse arguments
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
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Check AOSP directory
if [[ ! -d "$AOSP_DIR" ]]; then
    log_error "AOSP directory not found. Run ./scripts/init-aosp.sh first"
    exit 1
fi

cd "$AOSP_DIR"

log_info "Building AgentOS AOSP target: $TARGET-$BUILD_TYPE"

# Setup build environment
source build/envsetup.sh

# Select build target
lunch "$TARGET-$BUILD_TYPE"

# Enable ccache if available
if command -v ccache &> /dev/null; then
    export USE_CCACHE=1
    export CCACHE_DIR=../ccache
    ccache -M 50G
fi

# Build
log_info "Starting build with $PARALLEL_JOBS parallel jobs..."
make -j"$PARALLEL_JOBS"

log_success "AgentOS AOSP build completed successfully!"
EOF
    
    chmod +x "../scripts/build-aosp.sh"
    
    log_success "CI build scripts created"
}

# Commit AgentOS modifications
commit_modifications() {
    log_info "Committing AgentOS modifications..."
    
    cd "$AOSP_DIR"
    
    # Add all modifications
    repo forall -c 'git add -A'
    
    # Commit changes
    repo forall -c 'git commit -m "AgentOS: Initial modifications for Intelligence Layer

- Add AgentOS Intelligence Service to Android Framework
- Create AgentOS API interfaces and permissions
- Add system-level services and init scripts
- Configure kernel modules for AgentOS features
- Set up Soong build system for AgentOS modules
- Create device configurations for x86_64 and ARM64
- Add emulator support for development and testing

This commit establishes the foundation for AgentOS as an
agent-centric mobile operating system built on AOSP."'
    
    cd ..
    
    log_success "AgentOS modifications committed"
}

# Generate documentation
generate_documentation() {
    log_info "Generating AOSP setup documentation..."
    
    cat > "docs/aosp-setup.md" << 'EOF'
# AgentOS AOSP Setup Guide

This guide explains how to set up and build the AgentOS AOSP fork.

## Prerequisites

- Linux development environment (Ubuntu 20.04+ recommended)
- 16GB+ RAM (32GB recommended for faster builds)
- 200GB+ free disk space
- Git and repo tool installed

## Quick Start

```bash
# Initialize AOSP fork
./scripts/init-aosp.sh

# Build AgentOS
./scripts/build-aosp.sh

# Run in emulator
./scripts/run-emulator.sh
```

## Build Targets

AgentOS supports multiple build targets:

- `agentos_x86_64-userdebug` - x86_64 debug build for emulator
- `agentos_x86_64-user` - x86_64 production build
- `agentos_arm64-userdebug` - ARM64 debug build for devices
- `agentos_arm64-user` - ARM64 production build

## Custom Modifications

AgentOS includes the following AOSP modifications:

### Framework Changes
- AgentOS Intelligence Service integration
- New API interfaces for intent processing
- Enhanced permission system for privacy controls
- Plugin framework integration points

### System Changes
- AgentOS system services and daemons
- Custom init scripts for intelligence layer
- Modified system properties and configurations

### Kernel Changes
- AgentOS kernel modules for AI processing
- Voice processing optimizations
- Security enhancements for privacy features

## Development Workflow

1. Make changes to AgentOS components in `src/`
2. Build and test with `./scripts/build.sh`
3. For AOSP changes, modify files in `aosp/`
4. Build AOSP with `./scripts/build-aosp.sh`
5. Test in emulator with `./scripts/run-emulator.sh`

## Troubleshooting

### Build Failures
- Ensure sufficient disk space and memory
- Check that all prerequisites are installed
- Clean build with `./scripts/build-aosp.sh --clean`

### Emulator Issues
- Verify hardware acceleration is available
- Check that system images are built correctly
- Ensure ADB is properly configured

For more help, see the [troubleshooting guide](troubleshooting.md).
EOF
    
    log_success "Documentation generated"
}

# Main function
main() {
    local start_time=$SECONDS
    
    echo "=========================================="
    echo "    AgentOS AOSP Fork Initialization     "
    echo "=========================================="
    echo "AOSP Branch: $AOSP_BRANCH"
    echo "AgentOS Branch: $AGENTOS_BRANCH"
    echo "Parallel Jobs: $PARALLEL_JOBS"
    echo "=========================================="
    echo
    
    check_prerequisites
    init_aosp_repo
    sync_aosp_source
    create_agentos_branch
    configure_soong_build
    setup_emulator
    create_ci_scripts
    commit_modifications
    generate_documentation
    
    local setup_time=$((SECONDS - start_time))
    
    echo
    log_success "AgentOS AOSP fork initialization completed!"
    log_info "Setup time: $((setup_time / 60)) minutes $((setup_time % 60)) seconds"
    echo
    echo "Next steps:"
    echo "1. Build AgentOS: ./scripts/build-aosp.sh"
    echo "2. Run emulator: ./scripts/run-emulator.sh"
    echo "3. Read documentation: docs/aosp-setup.md"
    echo
}

# Run main function
main "$@"