#!/bin/bash

# AgentOS Emulator Launch Script
# Launches AgentOS in the Android emulator for development and testing

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
AVD_NAME="AgentOS_Emulator"
EMULATOR_PORT="5554"
TARGET="agentos_x86_64"
BUILD_TYPE="userdebug"
MEMORY="4096"
STORAGE="8192"
WIPE_DATA=false
HEADLESS=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --target)
            TARGET="$2"
            shift 2
            ;;
        --port)
            EMULATOR_PORT="$2"
            shift 2
            ;;
        --memory)
            MEMORY="$2"
            shift 2
            ;;
        --storage)
            STORAGE="$2"
            shift 2
            ;;
        --wipe)
            WIPE_DATA=true
            shift
            ;;
        --headless)
            HEADLESS=true
            shift
            ;;
        --user)
            BUILD_TYPE="user"
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --target TARGET    Build target (default: $TARGET)"
            echo "  --port PORT        Emulator port (default: $EMULATOR_PORT)"
            echo "  --memory MB        Memory size in MB (default: $MEMORY)"
            echo "  --storage MB       Storage size in MB (default: $STORAGE)"
            echo "  --wipe             Wipe user data"
            echo "  --headless         Run without GUI"
            echo "  --user             Use user build instead of userdebug"
            echo "  -h, --help         Show this help message"
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
    log_info "Checking emulator prerequisites..."
    
    # Check if AOSP directory exists
    if [[ ! -d "$AOSP_DIR" ]]; then
        log_error "AOSP directory not found. Run ./scripts/init-aosp.sh first"
        exit 1
    fi
    
    # Check if build exists
    local product_dir="$AOSP_DIR/out/target/product/generic_x86_64"
    if [[ ! -f "$product_dir/system.img" ]]; then
        log_error "AgentOS not built. Run ./scripts/build-aosp.sh first"
        exit 1
    fi
    
    # Check emulator binary
    if ! command -v emulator &> /dev/null; then
        log_error "Android emulator not found. Please install Android SDK"
        exit 1
    fi
    
    # Check ADB
    if ! command -v adb &> /dev/null; then
        log_error "ADB not found. Please install Android SDK platform tools"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Setup emulator environment
setup_emulator() {
    log_info "Setting up emulator environment..."
    
    cd "$AOSP_DIR"
    
    # Setup build environment
    source build/envsetup.sh
    lunch "$TARGET-$BUILD_TYPE"
    
    # Set Android SDK path if not set
    if [[ -z "$ANDROID_HOME" ]]; then
        export ANDROID_HOME="$HOME/Android/Sdk"
        export ANDROID_SDK_ROOT="$ANDROID_HOME"
    fi
    
    # Add emulator to PATH
    export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"
    
    log_success "Emulator environment configured"
}

# Create AVD if it doesn't exist
create_avd() {
    log_info "Creating AVD: $AVD_NAME"
    
    # Check if AVD already exists
    if avdmanager list avd | grep -q "$AVD_NAME"; then
        log_info "AVD $AVD_NAME already exists"
        return
    fi
    
    # Create AVD
    echo "no" | avdmanager create avd \
        -n "$AVD_NAME" \
        -k "system-images;android-34;google_apis;x86_64" \
        -d "pixel_4" \
        --force
    
    # Configure AVD
    local avd_config="$HOME/.android/avd/$AVD_NAME.avd/config.ini"
    if [[ -f "$avd_config" ]]; then
        # Update memory and storage settings
        sed -i "s/hw.ramSize=.*/hw.ramSize=$MEMORY/" "$avd_config"
        sed -i "s/disk.dataPartition.size=.*/disk.dataPartition.size=${STORAGE}MB/" "$avd_config"
        
        # Enable hardware acceleration
        echo "hw.gpu.enabled=yes" >> "$avd_config"
        echo "hw.gpu.mode=swiftshader_indirect" >> "$avd_config"
        
        # AgentOS specific settings
        echo "hw.audioInput=yes" >> "$avd_config"
        echo "hw.audioOutput=yes" >> "$avd_config"
        echo "hw.camera.back=webcam0" >> "$avd_config"
        echo "hw.camera.front=webcam0" >> "$avd_config"
    fi
    
    log_success "AVD created: $AVD_NAME"
}

# Launch emulator
launch_emulator() {
    log_info "Launching AgentOS emulator..."
    
    local emulator_args=(
        "-avd" "$AVD_NAME"
        "-system" "out/target/product/generic_x86_64/system.img"
        "-data" "out/target/product/generic_x86_64/userdata.img"
        "-kernel" "prebuilts/qemu-kernel/x86_64/kernel-qemu2"
        "-port" "$EMULATOR_PORT"
        "-memory" "$MEMORY"
        "-partition-size" "$STORAGE"
        "-gpu" "swiftshader_indirect"
        "-no-snapshot"
        "-verbose"
        "-show-kernel"
    )
    
    # Add wipe data if requested
    if [[ $WIPE_DATA == true ]]; then
        emulator_args+=("-wipe-data")
    fi
    
    # Add headless mode if requested
    if [[ $HEADLESS == true ]]; then
        emulator_args+=("-no-window" "-no-audio")
    fi
    
    # Launch emulator in background
    emulator "${emulator_args[@]}" &
    EMULATOR_PID=$!
    
    log_success "AgentOS emulator started (PID: $EMULATOR_PID)"
    log_info "Emulator port: $EMULATOR_PORT"
    log_info "Console port: $((EMULATOR_PORT + 1))"
    
    # Save PID for cleanup
    echo "$EMULATOR_PID" > "/tmp/agentos_emulator.pid"
}

# Wait for emulator to boot
wait_for_boot() {
    log_info "Waiting for emulator to boot..."
    
    # Wait for device to be detected
    adb -s "emulator-$EMULATOR_PORT" wait-for-device
    
    # Wait for boot to complete
    local boot_completed=false
    local timeout=300  # 5 minutes
    local elapsed=0
    
    while [[ $boot_completed == false && $elapsed -lt $timeout ]]; do
        local boot_status=$(adb -s "emulator-$EMULATOR_PORT" shell getprop sys.boot_completed 2>/dev/null || echo "0")
        
        if [[ "$boot_status" == "1" ]]; then
            boot_completed=true
        else
            sleep 5
            elapsed=$((elapsed + 5))
            echo -n "."
        fi
    done
    
    echo
    
    if [[ $boot_completed == true ]]; then
        log_success "AgentOS emulator ready!"
    else
        log_error "Emulator boot timeout after $timeout seconds"
        return 1
    fi
}

# Setup AgentOS on emulator
setup_agentos() {
    log_info "Setting up AgentOS on emulator..."
    
    # Install AgentOS apps
    local apk_dir="$AOSP_DIR/out/target/product/generic_x86_64/system/app"
    
    if [[ -d "$apk_dir" ]]; then
        for apk in "$apk_dir"/*.apk; do
            if [[ -f "$apk" ]]; then
                log_info "Installing $(basename "$apk")"
                adb -s "emulator-$EMULATOR_PORT" install -r "$apk"
            fi
        done
    fi
    
    # Configure AgentOS settings
    adb -s "emulator-$EMULATOR_PORT" shell settings put global agentos_intelligence_enabled 1
    adb -s "emulator-$EMULATOR_PORT" shell settings put global agentos_voice_enabled 1
    adb -s "emulator-$EMULATOR_PORT" shell settings put global agentos_plugins_enabled 1
    
    # Start AgentOS services
    adb -s "emulator-$EMULATOR_PORT" shell start agentos-intelligence
    adb -s "emulator-$EMULATOR_PORT" shell start agentos-orchestrator
    adb -s "emulator-$EMULATOR_PORT" shell start agentos-context
    
    log_success "AgentOS setup completed"
}

# Show emulator information
show_info() {
    echo
    echo "=========================================="
    echo "         AgentOS Emulator Info           "
    echo "=========================================="
    echo "Target: $TARGET-$BUILD_TYPE"
    echo "Port: $EMULATOR_PORT"
    echo "Console: telnet localhost $((EMULATOR_PORT + 1))"
    echo "ADB: adb -s emulator-$EMULATOR_PORT"
    echo "Memory: ${MEMORY}MB"
    echo "Storage: ${STORAGE}MB"
    echo "PID: $EMULATOR_PID"
    echo "=========================================="
    echo
    echo "Useful commands:"
    echo "  adb -s emulator-$EMULATOR_PORT shell"
    echo "  adb -s emulator-$EMULATOR_PORT logcat"
    echo "  adb -s emulator-$EMULATOR_PORT install app.apk"
    echo
    echo "To stop emulator:"
    echo "  kill $EMULATOR_PID"
    echo "  or"
    echo "  adb -s emulator-$EMULATOR_PORT emu kill"
    echo
}

# Cleanup function
cleanup() {
    if [[ -f "/tmp/agentos_emulator.pid" ]]; then
        local pid=$(cat "/tmp/agentos_emulator.pid")
        if kill -0 "$pid" 2>/dev/null; then
            log_info "Stopping emulator (PID: $pid)"
            kill "$pid"
        fi
        rm -f "/tmp/agentos_emulator.pid"
    fi
}

# Set up signal handlers
trap cleanup EXIT INT TERM

# Main function
main() {
    echo "=========================================="
    echo "       AgentOS Emulator Launcher         "
    echo "=========================================="
    echo "Target: $TARGET-$BUILD_TYPE"
    echo "Port: $EMULATOR_PORT"
    echo "Memory: ${MEMORY}MB"
    echo "Storage: ${STORAGE}MB"
    echo "Wipe Data: $WIPE_DATA"
    echo "Headless: $HEADLESS"
    echo "=========================================="
    echo
    
    check_prerequisites
    setup_emulator
    create_avd
    launch_emulator
    wait_for_boot
    setup_agentos
    show_info
    
    # Keep script running to maintain emulator
    if [[ $HEADLESS == false ]]; then
        log_info "Emulator is running. Press Ctrl+C to stop."
        wait $EMULATOR_PID
    else
        log_info "Emulator running in headless mode (PID: $EMULATOR_PID)"
    fi
}

# Run main function
main "$@"