# AgentOS AOSP Setup Guide

This guide explains how to set up, build, and test the AgentOS AOSP fork.

## Overview

AgentOS is built on a forked version of the Android Open Source Project (AOSP) with custom modifications to support the Intelligence Layer, voice-first interface, and plugin framework. This guide covers the complete setup process from initialization to testing.

## Prerequisites

### System Requirements

- **Operating System**: Linux (Ubuntu 20.04+ recommended) or macOS
- **Memory**: 16GB+ RAM (32GB recommended for faster builds)
- **Storage**: 200GB+ free disk space
- **CPU**: Multi-core processor (8+ cores recommended)

### Required Tools

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y git git-lfs curl wget python3 python3-pip \
    openjdk-11-jdk build-essential libssl-dev libffi-dev \
    unzip zip adb fastboot

# macOS (with Homebrew)
brew install git git-lfs python3 openjdk@11 android-platform-tools
```

### Android SDK Setup

1. Download Android SDK or Android Studio
2. Set environment variables:
   ```bash
   export ANDROID_HOME=$HOME/Android/Sdk
   export ANDROID_SDK_ROOT=$ANDROID_HOME
   export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
   ```

## Quick Start

### 1. Initialize AOSP Fork

```bash
# Clone AgentOS repository
git clone https://github.com/raosunjoy/agentos.git
cd agentos

# Initialize AOSP fork and create AgentOS branch
./scripts/init-aosp.sh
```

This script will:
- Download and install the `repo` tool if needed
- Initialize AOSP repository with Android 14
- Sync AOSP source code (this takes several hours)
- Create AgentOS branch with custom modifications
- Configure Soong build system for AgentOS modules

### 2. Build AgentOS

```bash
# Build AgentOS AOSP components
./scripts/build-aosp.sh

# Or build specific target
./scripts/build-aosp.sh --target agentos_arm64 --user
```

Build options:
- `--target`: Build target (agentos_x86_64, agentos_arm64, agentos_emulator)
- `--user`: Build user variant (production)
- `--jobs N`: Number of parallel jobs
- `--clean`: Clean build
- `--ccache-size SIZE`: Ccache size for faster rebuilds

### 3. Test in Emulator

```bash
# Launch AgentOS emulator
./scripts/run-emulator.sh

# Or with custom options
./scripts/run-emulator.sh --memory 8192 --wipe --headless
```

## Build Targets

AgentOS supports multiple build targets optimized for different use cases:

### agentos_x86_64
- **Purpose**: Emulator and x86_64 devices
- **Features**: Full AgentOS feature set
- **Use Case**: Development and testing

### agentos_arm64
- **Purpose**: ARM64 mobile devices
- **Features**: Hardware-optimized AI acceleration
- **Use Case**: Production deployment

### agentos_emulator
- **Purpose**: Emulator-specific optimizations
- **Features**: Debug features enabled
- **Use Case**: Development and CI/CD

## AgentOS Modifications

### Framework Changes

#### Intelligence Service Integration
- New system service: `AgentOSIntelligenceService`
- API interfaces for intent processing
- Enhanced permission system for privacy controls
- Plugin framework integration points

#### Key Files Modified:
```
frameworks/base/services/java/com/android/server/SystemServer.java
frameworks/base/core/java/com/agentos/intelligence/
frameworks/base/core/res/AndroidManifest.xml
```

### System Changes

#### AgentOS System Services
- `agentos-intelligence`: NLP and intent processing
- `agentos-orchestrator`: Workflow coordination
- `agentos-context`: Context management
- `agentos-voice`: Voice processing

#### Configuration Files:
```
system/core/rootdir/init.rc
system/core/rootdir/etc/init/agentos.rc
```

### Kernel Changes

#### AgentOS Kernel Modules
- AI processing optimization
- Voice processing enhancements
- Security features for privacy

#### Configuration:
```
kernel/common/arch/arm64/configs/agentos_defconfig
kernel/common/drivers/agentos/
```

## Development Workflow

### 1. Making Changes

#### For AgentOS Components (src/):
```bash
# Make changes to intelligence layer, plugins, etc.
vim src/intelligence-layer/nlp/intent_processor.py

# Build and test
./scripts/build.sh
./scripts/test.sh
```

#### For AOSP Changes (aosp/):
```bash
# Make changes to AOSP components
vim aosp/frameworks/base/services/java/com/android/server/SystemServer.java

# Build AOSP
./scripts/build-aosp.sh

# Test in emulator
./scripts/run-emulator.sh
```

### 2. Testing Changes

#### Unit Testing:
```bash
# Test specific components
./scripts/test.sh --component intelligence-layer

# Test AOSP modifications
cd aosp && make test-art-host
```

#### Integration Testing:
```bash
# Full system test in emulator
./scripts/run-emulator.sh
adb shell am start -n com.agentos.settings/.MainActivity
```

### 3. Committing Changes

```bash
# For AgentOS components
git add src/
git commit -m "intelligence: improve intent recognition accuracy"

# For AOSP changes
cd aosp
repo forall -c 'git add -A && git commit -m "agentos: add intelligence service integration"'
```

## Build Optimization

### Using Ccache

Ccache significantly speeds up rebuilds:

```bash
# Install ccache
sudo apt install ccache  # Ubuntu
brew install ccache      # macOS

# Configure ccache
export USE_CCACHE=1
export CCACHE_DIR=./ccache
ccache -M 50G

# Build with ccache
./scripts/build-aosp.sh --ccache-size 50G
```

### Parallel Builds

Optimize build times based on your hardware:

```bash
# Use all CPU cores
./scripts/build-aosp.sh --jobs $(nproc)

# Conservative (for systems with limited RAM)
./scripts/build-aosp.sh --jobs 4
```

### Incremental Builds

For faster development cycles:

```bash
# Build only changed modules
cd aosp
source build/envsetup.sh
lunch agentos_x86_64-userdebug
mmm packages/apps/AgentOS/Intelligence/
```

## Deployment

### Emulator Deployment

```bash
# Standard emulator
./scripts/run-emulator.sh

# Headless for CI
./scripts/run-emulator.sh --headless --port 5556
```

### Device Deployment

```bash
# Flash to device via fastboot
cd aosp/out/target/product/generic_arm64
fastboot flashall

# Or create flashable package
make otapackage
```

### OTA Updates

```bash
# Create OTA package
cd aosp
make otapackage

# The package will be in:
# out/target/product/generic_*/agentos_*-ota-*.zip
```

## Troubleshooting

### Common Build Issues

#### Insufficient Disk Space
```bash
# Check available space
df -h .

# Clean build artifacts
./scripts/build-aosp.sh --clean
rm -rf aosp/out/
```

#### Memory Issues
```bash
# Reduce parallel jobs
./scripts/build-aosp.sh --jobs 2

# Enable swap
sudo swapon /swapfile
```

#### Dependency Issues
```bash
# Update system packages
sudo apt update && sudo apt upgrade

# Reinstall build dependencies
./scripts/setup-dev-env.sh
```

### Emulator Issues

#### Hardware Acceleration
```bash
# Check KVM support (Linux)
ls -la /dev/kvm

# Enable hardware acceleration
./scripts/run-emulator.sh --gpu swiftshader_indirect
```

#### Boot Issues
```bash
# Wipe data and restart
./scripts/run-emulator.sh --wipe

# Check emulator logs
adb logcat | grep -i agentos
```

### Runtime Issues

#### AgentOS Services Not Starting
```bash
# Check service status
adb shell service list | grep agentos

# Start services manually
adb shell start agentos-intelligence
adb shell start agentos-orchestrator
```

#### Permission Issues
```bash
# Check permissions
adb shell dumpsys package com.agentos.intelligence

# Grant permissions
adb shell pm grant com.agentos.intelligence com.agentos.permission.INTELLIGENCE_ACCESS
```

## Performance Monitoring

### Build Performance
```bash
# Monitor build progress
tail -f build/logs/aosp-build-*.log

# Check ccache statistics
ccache -s
```

### Runtime Performance
```bash
# Monitor system performance
adb shell top | grep agentos

# Check memory usage
adb shell dumpsys meminfo com.agentos.intelligence

# Monitor battery usage
adb shell dumpsys batterystats | grep agentos
```

## Advanced Configuration

### Custom Build Variants

Create custom build configurations:

```bash
# Create custom product makefile
cp device/agentos/generic/agentos_x86_64.mk device/agentos/generic/agentos_custom.mk

# Modify for your needs
vim device/agentos/generic/agentos_custom.mk

# Add to AndroidProducts.mk
echo "agentos_custom.mk" >> device/agentos/generic/AndroidProducts.mk
```

### Kernel Customization

Modify kernel for specific hardware:

```bash
# Create custom kernel config
cp kernel/common/arch/arm64/configs/agentos_defconfig \
   kernel/common/arch/arm64/configs/agentos_device_defconfig

# Enable device-specific features
vim kernel/common/arch/arm64/configs/agentos_device_defconfig

# Update BoardConfig.mk
echo "TARGET_KERNEL_CONFIG := agentos_device_defconfig" >> device/agentos/generic/BoardConfig.mk
```

## Contributing

### Submitting Changes

1. Fork the repository
2. Create feature branch
3. Make changes following coding standards
4. Test thoroughly
5. Submit pull request

### Code Review Process

1. Automated testing via CI/CD
2. Code review by maintainers
3. Integration testing
4. Merge to main branch

## Resources

- [AOSP Documentation](https://source.android.com/)
- [AgentOS Architecture Guide](architecture.md)
- [Plugin Development Guide](plugin-development.md)
- [Troubleshooting Guide](troubleshooting.md)
- [Community Forum](https://github.com/raosunjoy/agentos/discussions)

## Support

For help with AOSP setup:
1. Check this documentation
2. Search existing issues
3. Ask in community discussions
4. File a bug report if needed

---

**Next Steps**: After successful AOSP setup, proceed to [Intelligence Layer Development](intelligence-layer.md) to implement the core AI features.