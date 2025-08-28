# Contributing to AgentOS

Thank you for your interest in contributing to AgentOS! This document provides guidelines and information for contributors to help make the project successful and welcoming for everyone.

## 🌟 Our Mission

AgentOS aims to revolutionize mobile computing by making it accessible, intelligent, and privacy-focused. We believe technology should serve everyone, regardless of age or technical ability.

## 🤝 Code of Conduct

This project adheres to a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## 🚀 Ways to Contribute

### 🐛 Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- **Clear title** describing the issue
- **Steps to reproduce** the behavior
- **Expected vs actual behavior**
- **Environment details** (device, OS version, AgentOS version)
- **Screenshots or logs** if applicable

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md).

### 💡 Suggesting Features

Feature suggestions are welcome! Please:

- Check existing feature requests first
- Clearly describe the feature and its benefits
- Consider how it aligns with AgentOS's accessibility and privacy goals
- Provide use cases and examples

Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md).

### 💻 Code Contributions

#### Getting Started

1. **Fork the repository** and clone your fork
2. **Set up the development environment** following the [setup guide](docs/development-setup.md)
3. **Create a feature branch** from `main`
4. **Make your changes** following our coding standards
5. **Test thoroughly** including unit and integration tests
6. **Submit a pull request** with a clear description

#### Development Workflow

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/agentos.git
cd agentos

# Set up development environment
./scripts/setup-dev-env.sh

# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and test
./scripts/test.sh

# Commit with conventional commits
git commit -m "feat: add voice recognition for elderly users"

# Push and create PR
git push origin feature/your-feature-name
```

#### Coding Standards

- **Language**: Primarily Kotlin for Android components, Python for AI/ML, C++ for performance-critical parts
- **Style**: Follow [Android Kotlin Style Guide](https://developer.android.com/kotlin/style-guide)
- **Documentation**: All public APIs must be documented
- **Testing**: Minimum 80% code coverage for new features
- **Accessibility**: All UI components must be accessible
- **Privacy**: Follow privacy-by-design principles

#### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

feat(voice): add elderly-optimized speech recognition
fix(security): resolve permission bypass vulnerability
docs(api): update plugin development guide
test(integration): add caregiver access scenarios
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`

### 🔌 Plugin Development

Creating plugins is a great way to contribute! See our [Plugin Development Guide](docs/plugin-development.md) for:

- Plugin architecture and APIs
- Development tools and SDK
- Testing and validation
- Publishing to the plugin marketplace

### 📖 Documentation

Documentation improvements are always welcome:

- **User guides** for new features
- **Developer tutorials** and examples
- **API documentation** improvements
- **Translation** to new languages

### 🧪 Testing and Quality Assurance

Help us maintain quality by:

- **Testing on different devices** and configurations
- **Accessibility testing** with assistive technologies
- **Performance testing** on various hardware
- **Security testing** and vulnerability reporting

## 🏗️ Development Setup

### Prerequisites

- **Operating System**: Linux (Ubuntu 20.04+ recommended) or macOS
- **Memory**: 16GB RAM minimum, 32GB recommended
- **Storage**: 200GB+ free space for AOSP build
- **Tools**: Docker, Git with LFS, Python 3.8+

### Environment Setup

```bash
# Clone repository
git clone https://github.com/raosunjoy/agentos.git
cd agentos

# Install dependencies
sudo apt update
sudo apt install -y docker.io docker-compose git-lfs python3-pip

# Set up development environment
./scripts/setup-dev-env.sh

# Verify setup
./scripts/verify-setup.sh
```

### Building AgentOS

```bash
# Full build (takes 2-4 hours on first run)
./scripts/build.sh

# Incremental build
./scripts/build.sh --incremental

# Build specific components
./scripts/build-component.sh intelligence-layer
./scripts/build-component.sh plugin-framework
```

### Running Tests

```bash
# Run all tests
./scripts/test.sh

# Run specific test suites
./scripts/test.sh --unit
./scripts/test.sh --integration
./scripts/test.sh --accessibility

# Run tests for specific components
./scripts/test.sh intelligence-layer
```

## 📋 Pull Request Process

### Before Submitting

- [ ] Code follows project style guidelines
- [ ] All tests pass locally
- [ ] Documentation is updated if needed
- [ ] Accessibility requirements are met
- [ ] Privacy implications are considered
- [ ] Performance impact is evaluated

### PR Requirements

1. **Clear description** of changes and motivation
2. **Link to related issues** using keywords (fixes #123)
3. **Test coverage** for new functionality
4. **Documentation updates** for user-facing changes
5. **Accessibility compliance** for UI changes
6. **Privacy impact assessment** for data handling changes

### Review Process

1. **Automated checks** must pass (CI/CD, tests, linting)
2. **Code review** by at least one maintainer
3. **Accessibility review** for UI changes
4. **Security review** for sensitive changes
5. **Final approval** and merge by maintainer

## 🏷️ Issue Labels

We use labels to organize and prioritize work:

### Type Labels
- `bug` - Something isn't working
- `enhancement` - New feature or improvement
- `documentation` - Documentation improvements
- `question` - Further information is requested

### Priority Labels
- `priority/critical` - Critical issues requiring immediate attention
- `priority/high` - Important issues for next release
- `priority/medium` - Standard priority
- `priority/low` - Nice to have improvements

### Component Labels
- `component/intelligence-layer` - AI and NLP components
- `component/voice-interface` - Speech recognition and synthesis
- `component/plugin-framework` - Plugin system
- `component/security` - Security and privacy features
- `component/accessibility` - Accessibility features

### Special Labels
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention is needed
- `accessibility` - Accessibility-related
- `privacy` - Privacy-related
- `breaking change` - Introduces breaking changes

## 🎯 Contribution Areas

### High Priority Areas

1. **Accessibility Features**
   - Screen reader optimization
   - Voice interface improvements
   - Large text and high contrast support

2. **Privacy and Security**
   - On-device AI optimization
   - Permission system enhancements
   - Security auditing and testing

3. **Plugin Ecosystem**
   - Core service integrations
   - Developer tools and SDK
   - Plugin marketplace features

4. **Performance Optimization**
   - Battery life improvements
   - Memory usage optimization
   - Response time enhancements

### Beginner-Friendly Areas

- Documentation improvements
- Unit test additions
- UI/UX enhancements
- Translation and localization
- Example plugin development

## 🏆 Recognition

Contributors are recognized in several ways:

- **Contributors file** listing all contributors
- **Release notes** highlighting significant contributions
- **Community spotlight** in discussions and social media
- **Maintainer status** for consistent, high-quality contributors

## 📞 Getting Help

### Community Support

- **GitHub Discussions**: General questions and community chat
- **Issues**: Bug reports and feature requests
- **Wiki**: Community-maintained documentation
- **Code Reviews**: Learning through the review process

### Maintainer Contact

For sensitive issues (security, code of conduct violations):
- Email: maintainers@agentos.org
- Security issues: security@agentos.org

## 📚 Resources

### Documentation
- [Architecture Guide](docs/architecture.md)
- [API Reference](docs/api-reference.md)
- [Plugin Development](docs/plugin-development.md)
- [Testing Guide](docs/testing.md)

### External Resources
- [Android Open Source Project](https://source.android.com/)
- [Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Privacy by Design](https://www.ipc.on.ca/wp-content/uploads/resources/7foundationalprinciples.pdf)

## 🙏 Thank You

Every contribution, no matter how small, helps make AgentOS better for everyone. Thank you for being part of our mission to create more accessible and intelligent mobile computing!

---

*Questions about contributing? Start a [discussion](https://github.com/raosunjoy/agentos/discussions) or check our [FAQ](docs/faq.md).*