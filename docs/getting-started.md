# Getting Started with AgentOS

Welcome to AgentOS development! This guide will help you set up your development environment and start contributing to the future of mobile computing.

## 🚀 Quick Start

### Prerequisites

Before you begin, ensure you have:

- **Operating System**: Linux (Ubuntu 20.04+) or macOS
- **Memory**: 16GB RAM minimum (32GB recommended)
- **Storage**: 200GB+ free space
- **Internet**: Stable connection for downloading dependencies

### 1. Clone the Repository

```bash
git clone https://github.com/raosunjoy/agentos.git
cd agentos
```

### 2. Set Up Development Environment

Run our automated setup script:

```bash
./scripts/setup-dev-env.sh
```

This script will:
- Install system dependencies
- Set up Docker environment
- Configure Android SDK
- Create Python virtual environment
- Install development tools
- Set up Git hooks

### 3. Start Development Environment

```bash
# Start all development services
docker-compose up -d

# Enter the development container
docker exec -it agentos-dev bash
```

### 4. Build AgentOS

```bash
# Full build (takes 2-4 hours on first run)
./scripts/build.sh

# Or build specific components
./scripts/build-component.sh intelligence-layer
```

### 5. Run Tests

```bash
# Run all tests
./scripts/test.sh

# Run specific test suites
./scripts/test.sh unit
./scripts/test.sh integration
```

## 🏗️ Project Structure

```
agentos/
├── .kiro/specs/agent-os/          # Project specifications
│   ├── requirements.md            # Detailed requirements
│   ├── design.md                  # System design
│   └── tasks.md                   # Implementation tasks
├── src/                           # Source code
│   ├── intelligence-layer/        # AI and NLP components
│   ├── plugin-framework/          # Plugin system
│   ├── voice-interface/           # Speech processing
│   ├── integration-layer/         # Service integration
│   ├── security/                  # Security and privacy
│   └── aosp-modifications/        # Android modifications
├── tests/                         # Test suites
├── docs/                          # Documentation
├── scripts/                       # Build and utility scripts
├── docker/                        # Docker configurations
└── examples/                      # Example plugins and tutorials
```

## 🎯 Development Workflow

### 1. Choose Your Focus Area

AgentOS has several key areas where you can contribute:

#### 🧠 **Intelligence Layer**
- Natural language processing
- Intent recognition and classification
- Workflow orchestration
- Context management

#### 🗣️ **Voice Interface**
- Speech recognition and synthesis
- Audio processing and filtering
- Accessibility optimizations
- Multi-language support

#### 🔌 **Plugin Framework**
- Plugin architecture and SDK
- Security sandboxing
- Marketplace development
- Developer tools

#### 🔒 **Security & Privacy**
- On-device encryption
- Permission systems
- Privacy compliance
- Security auditing

#### ♿ **Accessibility**
- Screen reader integration
- Voice-first interfaces
- Large text and contrast
- Motor disability support

### 2. Development Process

1. **Pick a task** from [tasks.md](.kiro/specs/agent-os/tasks.md)
2. **Create a branch** for your feature
3. **Implement** following our coding standards
4. **Write tests** for your changes
5. **Submit a pull request** for review

### 3. Coding Standards

- **Languages**: Kotlin (Android), Python (AI/ML), TypeScript (Plugins)
- **Style**: Follow language-specific style guides
- **Testing**: Minimum 80% code coverage
- **Documentation**: Document all public APIs
- **Accessibility**: All UI must be accessible

## 🧪 Testing Your Changes

### Unit Tests

```bash
# Python tests
pytest tests/unit/

# JavaScript/TypeScript tests
npm test

# Android tests
./gradlew test
```

### Integration Tests

```bash
# Full integration test suite
./scripts/test.sh integration

# Specific component integration
./scripts/test.sh integration intelligence-layer
```

### Accessibility Tests

```bash
# Run accessibility compliance tests
./scripts/test.sh accessibility

# Test with screen readers
./scripts/test-accessibility.sh --screen-reader
```

### Performance Tests

```bash
# Run performance benchmarks
./scripts/test.sh performance

# Memory and CPU profiling
./scripts/profile.sh --component intelligence-layer
```

## 🔧 Common Development Tasks

### Building Components

```bash
# Build intelligence layer
./scripts/build-component.sh intelligence-layer

# Build plugin framework
./scripts/build-component.sh plugin-framework

# Build voice interface
./scripts/build-component.sh voice-interface
```

### Running in Emulator

```bash
# Start Android emulator with AgentOS
./scripts/run-emulator.sh

# Install on connected device
./scripts/install-device.sh
```

### Plugin Development

```bash
# Create a new plugin
./scripts/create-plugin.sh my-plugin

# Test plugin integration
./scripts/test-plugin.sh my-plugin

# Publish plugin to marketplace
./scripts/publish-plugin.sh my-plugin
```

## 📚 Learning Resources

### Documentation
- [Architecture Guide](architecture.md) - System design and components
- [API Reference](api-reference.md) - Complete API documentation
- [Plugin Development](plugin-development.md) - Creating plugins
- [Accessibility Guide](accessibility.md) - Building accessible features

### Examples
- [Hello World Plugin](../examples/plugins/hello-world/) - Basic plugin example
- [Voice Command Plugin](../examples/plugins/voice-commands/) - Advanced voice integration
- [Accessibility Plugin](../examples/plugins/accessibility/) - Accessibility features

### Community
- [GitHub Discussions](https://github.com/raosunjoy/agentos/discussions) - Ask questions and share ideas
- [Contributing Guide](../CONTRIBUTING.md) - How to contribute effectively
- [Code of Conduct](../CODE_OF_CONDUCT.md) - Community guidelines

## 🐛 Troubleshooting

### Common Issues

#### Build Failures
```bash
# Clean and rebuild
./scripts/clean.sh
./scripts/build.sh

# Check system requirements
./scripts/verify-setup.sh
```

#### Docker Issues
```bash
# Restart Docker services
docker-compose down
docker-compose up -d

# Rebuild containers
docker-compose build --no-cache
```

#### Permission Errors
```bash
# Fix file permissions
sudo chown -R $USER:$USER .
chmod +x scripts/*.sh
```

#### Android SDK Issues
```bash
# Reinstall Android SDK
./scripts/setup-android-sdk.sh

# Update SDK components
./scripts/update-sdk.sh
```

### Getting Help

1. **Check the logs**: `docker-compose logs agentos-dev`
2. **Search existing issues**: [GitHub Issues](https://github.com/raosunjoy/agentos/issues)
3. **Ask the community**: [GitHub Discussions](https://github.com/raosunjoy/agentos/discussions)
4. **Read the docs**: Browse the [documentation](README.md)

## 🎉 Next Steps

Now that you have AgentOS set up, here are some great ways to get started:

1. **Explore the codebase**: Browse `src/` to understand the architecture
2. **Run the examples**: Try the example plugins in `examples/`
3. **Pick a good first issue**: Look for [good first issue](https://github.com/raosunjoy/agentos/labels/good%20first%20issue) labels
4. **Join the community**: Introduce yourself in [Discussions](https://github.com/raosunjoy/agentos/discussions)
5. **Read the specs**: Review the detailed [requirements](.kiro/specs/agent-os/requirements.md) and [design](.kiro/specs/agent-os/design.md)

Welcome to the AgentOS community! We're excited to have you help build the future of accessible mobile computing. 🚀

---

*Need help? Don't hesitate to ask in our [community discussions](https://github.com/raosunjoy/agentos/discussions)!*