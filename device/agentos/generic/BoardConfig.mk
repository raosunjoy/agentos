#
# Copyright (C) 2024 The AgentOS Project
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

# AgentOS Board Configuration

# Architecture (default to x86_64, can be overridden)
TARGET_ARCH ?= x86_64
TARGET_ARCH_VARIANT ?= x86_64
TARGET_CPU_ABI ?= x86_64
TARGET_CPU_VARIANT ?= generic

# For ARM64 builds
ifeq ($(TARGET_ARCH),arm64)
TARGET_ARCH_VARIANT := armv8-a
TARGET_CPU_ABI := arm64-v8a
TARGET_CPU_VARIANT := generic
TARGET_2ND_ARCH := arm
TARGET_2ND_ARCH_VARIANT := armv8-a
TARGET_2ND_CPU_ABI := armeabi-v7a
TARGET_2ND_CPU_VARIANT := generic
endif

# Kernel configuration
TARGET_KERNEL_CONFIG := agentos_defconfig
BOARD_KERNEL_CMDLINE := console=ttyS0,115200n8 androidboot.console=ttyS0 androidboot.hardware=agentos
BOARD_KERNEL_BASE := 0x10000000
BOARD_KERNEL_PAGESIZE := 4096

# Partition sizes (in bytes)
BOARD_FLASH_BLOCK_SIZE := 512
TARGET_USERIMAGES_USE_EXT4 := true
BOARD_SYSTEMIMAGE_PARTITION_SIZE := 4294967296    # 4GB
BOARD_USERDATAIMAGE_PARTITION_SIZE := 2147483648  # 2GB
BOARD_VENDORIMAGE_PARTITION_SIZE := 1073741824    # 1GB
BOARD_PRODUCTIMAGE_PARTITION_SIZE := 536870912    # 512MB

# File system types
TARGET_USERIMAGES_USE_F2FS := true
BOARD_USERDATAIMAGE_FILE_SYSTEM_TYPE := f2fs
BOARD_VENDORIMAGE_FILE_SYSTEM_TYPE := ext4
BOARD_PRODUCTIMAGE_FILE_SYSTEM_TYPE := ext4

# Bootloader
TARGET_NO_BOOTLOADER := true
TARGET_BOOTLOADER_BOARD_NAME := agentos

# Recovery
TARGET_NO_RECOVERY := false
BOARD_USES_RECOVERY_AS_BOOT := false

# Graphics
USE_OPENGL_RENDERER := true
TARGET_USES_HWC2 := true
BOARD_GPU_DRIVERS := swiftshader

# Audio
BOARD_USES_ALSA_AUDIO := true
USE_CUSTOM_AUDIO_POLICY := 1

# Bluetooth
BOARD_HAVE_BLUETOOTH := true
BOARD_BLUETOOTH_BDROID_BUILDCFG_INCLUDE_DIR := device/agentos/generic/bluetooth

# WiFi
BOARD_WPA_SUPPLICANT_DRIVER := NL80211
WPA_SUPPLICANT_VERSION := VER_0_8_X
BOARD_HOSTAPD_DRIVER := NL80211

# Camera
USE_CAMERA_STUB := true

# Sensors
USE_SENSOR_MULTI_HAL := true

# AgentOS specific features
BOARD_AGENTOS_INTELLIGENCE := true
BOARD_AGENTOS_VOICE_PROCESSING := true
BOARD_AGENTOS_PLUGIN_SUPPORT := true
BOARD_AGENTOS_ACCESSIBILITY_ENHANCED := true
BOARD_AGENTOS_PRIVACY_STRICT := true

# Security features
BOARD_USES_SECURE_SERVICES := true
BOARD_SEPOLICY_DIRS += device/agentos/generic/sepolicy

# Vendor security patch level
VENDOR_SECURITY_PATCH := 2024-01-01

# Build system
BUILD_BROKEN_DUP_RULES := true
BUILD_BROKEN_ELF_PREBUILT_PRODUCT_COPY_FILES := true

# Treble
PRODUCT_FULL_TREBLE_OVERRIDE := true
BOARD_VNDK_VERSION := current

# Verified boot
BOARD_AVB_ENABLE := false

# Properties
TARGET_SYSTEM_PROP += device/agentos/generic/system.prop