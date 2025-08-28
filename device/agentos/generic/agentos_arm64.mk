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

# AgentOS ARM64 Product Configuration

# Inherit from generic ARM64 configuration
$(call inherit-product, $(SRC_TARGET_DIR)/product/core_64_bit.mk)
$(call inherit-product, $(SRC_TARGET_DIR)/product/generic_arm64.mk)
$(call inherit-product, $(SRC_TARGET_DIR)/product/aosp_arm64.mk)

# AgentOS specific packages
PRODUCT_PACKAGES += \
    AgentOSIntelligence \
    AgentOSPluginFramework \
    AgentOSVoiceInterface \
    AgentOSSettings \
    AgentOSLauncher \
    agentos_system_service \
    libagentos_intelligence \
    libagentos_voice \
    libagentos_plugins \
    agentos-framework \
    agentos-plugin-sdk

# AgentOS system properties
PRODUCT_PROPERTY_OVERRIDES += \
    ro.agentos.version=0.1.0 \
    ro.agentos.build.type=arm64 \
    ro.agentos.intelligence.enabled=true \
    ro.agentos.voice.enabled=true \
    ro.agentos.plugins.enabled=true \
    ro.agentos.accessibility.enhanced=true \
    ro.agentos.privacy.mode=strict \
    ro.agentos.debug.enabled=false

# Performance optimizations for ARM64
PRODUCT_PROPERTY_OVERRIDES += \
    ro.config.low_ram=false \
    ro.config.zram=true \
    dalvik.vm.heapsize=512m \
    dalvik.vm.heapstartsize=16m \
    dalvik.vm.heapgrowthlimit=256m \
    dalvik.vm.heaptargetutilization=0.75 \
    ro.hardware.npu.enabled=true

# ARM64 specific optimizations
PRODUCT_PROPERTY_OVERRIDES += \
    ro.agentos.ai.acceleration=npu \
    ro.agentos.voice.dsp=enabled \
    ro.agentos.power.profile=balanced

# AgentOS specific features
PRODUCT_COPY_FILES += \
    device/agentos/generic/configs/agentos.conf:system/etc/agentos.conf \
    device/agentos/generic/configs/intelligence.xml:system/etc/permissions/agentos.intelligence.xml \
    device/agentos/generic/configs/voice.xml:system/etc/permissions/agentos.voice.xml \
    device/agentos/generic/configs/plugins.xml:system/etc/permissions/agentos.plugins.xml

# Audio configuration for voice processing
PRODUCT_COPY_FILES += \
    device/agentos/generic/audio/audio_policy_configuration_arm64.xml:$(TARGET_COPY_OUT_VENDOR)/etc/audio_policy_configuration.xml

# Accessibility features
PRODUCT_PACKAGES += \
    TalkBack \
    AccessibilityMenu \
    SelectToSpeak \
    SoundAmplifier

# Security and privacy
PRODUCT_PACKAGES += \
    PermissionController \
    PrivacyDashboard

# Product information
PRODUCT_NAME := agentos_arm64
PRODUCT_DEVICE := generic_arm64
PRODUCT_BRAND := AgentOS
PRODUCT_MODEL := AgentOS ARM64
PRODUCT_MANUFACTURER := AgentOS Project

# Build fingerprint
PRODUCT_BUILD_PROP_OVERRIDES += \
    PRODUCT_NAME=agentos_arm64 \
    PRIVATE_BUILD_DESC="agentos_arm64-userdebug 14 UP1A.231005.007 eng.$(USER).$(shell date +%Y%m%d.%H%M%S) test-keys"

BUILD_FINGERPRINT := AgentOS/agentos_arm64/generic_arm64:14/UP1A.231005.007/eng.$(USER).$(shell date +%Y%m%d.%H%M%S):userdebug/test-keys