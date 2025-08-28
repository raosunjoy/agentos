#!/bin/bash

# AgentOS Development Environment Setup Script
# This script sets up the complete development environment for AgentOS

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on supported OS
check_os() {
    log_info "Checking operating system compatibility..."
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        log_success "Linux detected"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        log_success "macOS detected"
    else
        log_error "Unsupported operating system: $OSTYPE"
        log_error "AgentOS development requires Linux or macOS"
        exit 1
    fi
}

# Check system requirements
check_requirements() {
    log_info "Checking system requirements..."
    
    # Check memory
    if [[ "$OS" == "linux" ]]; then
        MEMORY_GB=$(free -g | awk '/^Mem:/{print $2}')
    else
        MEMORY_GB=$(sysctl -n hw.memsize | awk '{print int($1/1024/1024/1024)}')
    fi
    
    if [[ $MEMORY_GB -lt 16 ]]; then
        log_warning "Recommended: 16GB+ RAM (detected: ${MEMORY_GB}GB)"
        log_warning "Build times may be significantly longer"
    else
        log_success "Memory check passed (${MEMORY_GB}GB)"
    fi
    
    # Check disk space
    DISK_SPACE_GB=$(df -BG . | awk 'NR==2 {print int($4)}')
    if [[ $DISK_SPACE_GB -lt 200 ]]; then
        log_error "Insufficient disk space: ${DISK_SPACE_GB}GB available"
        log_error "AgentOS requires at least 200GB free space"
        exit 1
    else
        log_success "Disk space check passed (${DISK_SPACE_GB}GB available)"
    fi
}

# Install system dependencies
install_dependencies() {
    log_info "Installing system dependencies..."
    
    if [[ "$OS" == "linux" ]]; then
        # Update package list
        sudo apt update
        
        # Install required packages
        sudo apt install -y \
            git git-lfs curl wget \
            docker.io docker-compose \
            python3 python3-pip python3-venv \
            nodejs npm \
            openjdk-11-jdk \
            build-essential \
            libssl-dev libffi-dev \
            pkg-config \
            unzip zip \
            adb fastboot
            
        # Add user to docker group
        sudo usermod -aG docker $USER
        
    elif [[ "$OS" == "macos" ]]; then
        # Check if Homebrew is installed
        if ! command -v brew &> /dev/null; then
            log_info "Installing Homebrew..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        fi
        
        # Install required packages
        brew install \
            git git-lfs \
            docker docker-compose \
            python3 \
            node npm \
            openjdk@11 \
            android-platform-tools
            
        # Start Docker Desktop
        open -a Docker
    fi
    
    log_success "System dependencies installed"
}

# Setup Git LFS
setup_git_lfs() {
    log_info "Setting up Git LFS..."
    
    git lfs install
    git lfs track "*.so"
    git lfs track "*.a"
    git lfs track "*.apk"
    git lfs track "*.img"
    git lfs track "*.bin"
    
    log_success "Git LFS configured"
}

# Setup Python environment
setup_python() {
    log_info "Setting up Python environment..."
    
    # Create virtual environment
    python3 -m venv venv
    source venv/bin/activate
    
    # Upgrade pip
    pip install --upgrade pip
    
    # Install Python dependencies
    pip install -r requirements-dev.txt
    
    log_success "Python environment configured"
}

# Setup Node.js environment
setup_nodejs() {
    log_info "Setting up Node.js environment..."
    
    # Install global packages
    npm install -g @angular/cli typescript ts-node
    
    # Install project dependencies
    if [[ -f "package.json" ]]; then
        npm install
    fi
    
    log_success "Node.js environment configured"
}

# Setup Android SDK
setup_android_sdk() {
    log_info "Setting up Android SDK..."
    
    # Create Android SDK directory
    mkdir -p $HOME/Android/Sdk
    
    # Set environment variables
    export ANDROID_HOME=$HOME/Android/Sdk
    export ANDROID_SDK_ROOT=$HOME/Android/Sdk
    export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
    
    # Add to shell profile
    SHELL_PROFILE=""
    if [[ -f "$HOME/.bashrc" ]]; then
        SHELL_PROFILE="$HOME/.bashrc"
    elif [[ -f "$HOME/.zshrc" ]]; then
        SHELL_PROFILE="$HOME/.zshrc"
    fi
    
    if [[ -n "$SHELL_PROFILE" ]]; then
        echo "export ANDROID_HOME=$HOME/Android/Sdk" >> $SHELL_PROFILE
        echo "export ANDROID_SDK_ROOT=$HOME/Android/Sdk" >> $SHELL_PROFILE
        echo "export PATH=\$PATH:\$ANDROID_HOME/tools:\$ANDROID_HOME/platform-tools" >> $SHELL_PROFILE
    fi
    
    log_success "Android SDK environment configured"
}

# Setup Docker environment
setup_docker() {
    log_info "Setting up Docker environment..."
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        log_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    
    # Build development containers
    docker-compose build agentos-dev
    
    # Pull additional images
    docker-compose pull
    
    log_success "Docker environment configured"
}

# Create development directories
create_directories() {
    log_info "Creating development directories..."
    
    mkdir -p {
        build,
        dist,
        logs,
        test-reports,
        docs/generated,
        src/intelligence-layer/{nlp,orchestrator,context,predictive,trust},
        src/plugin-framework/{registry,sdk,security,marketplace},
        src/voice-interface/{speech-recognition,speech-synthesis,audio-processing,accessibility},
        src/integration-layer/{api-gateway,data-layer,service-discovery},
        src/security/{encryption,permissions,audit,compliance},
        src/ui/{voice-ui,visual-ui,accessibility-ui},
        src/aosp-modifications/{framework,runtime,hal,kernel},
        tests/{unit,integration,e2e,performance},
        tools/{build,deploy,monitor},
        examples/{plugins,integrations,tutorials}
    }
    
    log_success "Development directories created"
}

# Setup pre-commit hooks
setup_hooks() {
    log_info "Setting up Git hooks..."
    
    # Install pre-commit
    pip install pre-commit
    
    # Create pre-commit config
    cat > .pre-commit-config.yaml << EOF
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.4.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
      - id: check-merge-conflict
  
  - repo: https://github.com/psf/black
    rev: 23.3.0
    hooks:
      - id: black
        language_version: python3
  
  - repo: https://github.com/pycqa/flake8
    rev: 6.0.0
    hooks:
      - id: flake8
  
  - repo: https://github.com/pre-commit/mirrors-eslint
    rev: v8.44.0
    hooks:
      - id: eslint
        files: \.(js|ts)$
EOF
    
    # Install hooks
    pre-commit install
    
    log_success "Git hooks configured"
}

# Generate initial configuration files
generate_configs() {
    log_info "Generating configuration files..."
    
    # Create build configuration
    cat > build.gradle << 'EOF'
// AgentOS Build Configuration
buildscript {
    ext.kotlin_version = '1.8.0'
    ext.android_gradle_version = '8.0.0'
    
    repositories {
        google()
        mavenCentral()
    }
    
    dependencies {
        classpath "com.android.tools.build:gradle:$android_gradle_version"
        classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlin_version"
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

task clean(type: Delete) {
    delete rootProject.buildDir
}
EOF
    
    # Create Python requirements
    cat > requirements-dev.txt << 'EOF'
# Core dependencies
numpy>=1.21.0
scipy>=1.7.0
scikit-learn>=1.0.0
torch>=1.12.0
transformers>=4.20.0
librosa>=0.9.0
soundfile>=0.10.0

# Development tools
pytest>=7.0.0
pytest-cov>=4.0.0
black>=22.0.0
flake8>=5.0.0
mypy>=0.991
pre-commit>=2.20.0

# Documentation
mkdocs>=1.4.0
mkdocs-material>=8.5.0
mkdocs-mermaid2-plugin>=0.6.0

# Security
bandit>=1.7.0
safety>=2.3.0

# Performance
memory-profiler>=0.60.0
line-profiler>=4.0.0
EOF
    
    # Create package.json for plugin development
    cat > package.json << 'EOF'
{
  "name": "agentos",
  "version": "0.1.0",
  "description": "AgentOS - The Future of Mobile Computing",
  "main": "index.js",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "lint": "eslint src/**/*.ts",
    "dev": "ts-node-dev src/index.ts"
  },
  "keywords": ["agentos", "mobile", "ai", "accessibility"],
  "author": "AgentOS Contributors",
  "license": "Apache-2.0",
  "devDependencies": {
    "@types/node": "^18.0.0",
    "@typescript-eslint/eslint-plugin": "^5.0.0",
    "@typescript-eslint/parser": "^5.0.0",
    "eslint": "^8.0.0",
    "jest": "^29.0.0",
    "ts-node-dev": "^2.0.0",
    "typescript": "^4.8.0"
  }
}
EOF
    
    log_success "Configuration files generated"
}

# Verify installation
verify_installation() {
    log_info "Verifying installation..."
    
    # Check Docker
    if docker --version &> /dev/null; then
        log_success "Docker: $(docker --version)"
    else
        log_error "Docker installation failed"
        return 1
    fi
    
    # Check Python
    if python3 --version &> /dev/null; then
        log_success "Python: $(python3 --version)"
    else
        log_error "Python installation failed"
        return 1
    fi
    
    # Check Node.js
    if node --version &> /dev/null; then
        log_success "Node.js: $(node --version)"
    else
        log_error "Node.js installation failed"
        return 1
    fi
    
    # Check Git LFS
    if git lfs version &> /dev/null; then
        log_success "Git LFS: $(git lfs version)"
    else
        log_error "Git LFS installation failed"
        return 1
    fi
    
    log_success "All components verified successfully"
}

# Main setup function
main() {
    echo "=========================================="
    echo "  AgentOS Development Environment Setup  "
    echo "=========================================="
    echo
    
    check_os
    check_requirements
    install_dependencies
    setup_git_lfs
    setup_python
    setup_nodejs
    setup_android_sdk
    setup_docker
    create_directories
    setup_hooks
    generate_configs
    verify_installation
    
    echo
    log_success "AgentOS development environment setup complete!"
    echo
    echo "Next steps:"
    echo "1. Restart your terminal or run: source ~/.bashrc (or ~/.zshrc)"
    echo "2. Run: docker-compose up -d agentos-dev"
    echo "3. Run: ./scripts/build.sh to build AgentOS"
    echo "4. Check out the documentation: ./docs/getting-started.md"
    echo
    echo "Happy coding! 🚀"
}

# Run main function
main "$@"