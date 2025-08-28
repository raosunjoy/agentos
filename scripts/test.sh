#!/bin/bash

# AgentOS Test Runner Script
# Runs comprehensive test suites for AgentOS

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
TEST_TYPE="all"
COVERAGE=true
PARALLEL=true
VERBOSE=false
OUTPUT_DIR="test-results"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        unit|integration|e2e|accessibility|security|performance)
            TEST_TYPE="$1"
            shift
            ;;
        --no-coverage)
            COVERAGE=false
            shift
            ;;
        --sequential)
            PARALLEL=false
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --output-dir)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [TEST_TYPE] [OPTIONS]"
            echo ""
            echo "Test Types:"
            echo "  unit           Run unit tests only"
            echo "  integration    Run integration tests only"
            echo "  e2e           Run end-to-end tests only"
            echo "  accessibility  Run accessibility tests only"
            echo "  security      Run security tests only"
            echo "  performance   Run performance tests only"
            echo "  all           Run all tests (default)"
            echo ""
            echo "Options:"
            echo "  --no-coverage    Disable coverage reporting"
            echo "  --sequential     Run tests sequentially instead of parallel"
            echo "  --verbose        Enable verbose output"
            echo "  --output-dir DIR Specify output directory for test results"
            echo "  -h, --help       Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Setup test environment
setup_test_environment() {
    log_info "Setting up test environment..."
    
    # Create output directory
    mkdir -p "$OUTPUT_DIR"
    
    # Activate Python virtual environment
    if [[ -d "venv" ]]; then
        source venv/bin/activate
    fi
    
    # Install test dependencies if needed
    if [[ ! -f ".test-deps-installed" ]]; then
        pip install -r requirements-dev.txt
        npm install
        touch .test-deps-installed
    fi
    
    log_success "Test environment ready"
}

# Run unit tests
run_unit_tests() {
    log_info "Running unit tests..."
    
    local pytest_args=""
    local npm_args=""
    
    if [[ $COVERAGE == true ]]; then
        pytest_args="--cov=src --cov-report=html:$OUTPUT_DIR/coverage-html --cov-report=xml:$OUTPUT_DIR/coverage.xml"
        npm_args="--coverage"
    fi
    
    if [[ $PARALLEL == true ]]; then
        pytest_args="$pytest_args -n auto"
    fi
    
    if [[ $VERBOSE == true ]]; then
        pytest_args="$pytest_args -v"
        npm_args="$npm_args --verbose"
    fi
    
    # Run Python unit tests
    log_info "Running Python unit tests..."
    python3 -m pytest tests/unit/ $pytest_args \
        --junit-xml="$OUTPUT_DIR/python-unit-tests.xml" \
        --html="$OUTPUT_DIR/python-unit-report.html" \
        --self-contained-html
    
    # Run JavaScript/TypeScript unit tests
    log_info "Running JavaScript unit tests..."
    npm test $npm_args -- --testResultsProcessor="jest-junit" \
        --outputFile="$OUTPUT_DIR/js-unit-tests.xml"
    
    log_success "Unit tests completed"
}

# Run integration tests
run_integration_tests() {
    log_info "Running integration tests..."
    
    # Start test services if needed
    if command -v docker-compose &> /dev/null; then
        log_info "Starting test services..."
        docker-compose -f docker-compose.test.yml up -d
        
        # Wait for services to be ready
        sleep 10
    fi
    
    # Run integration tests
    python3 -m pytest tests/integration/ \
        --junit-xml="$OUTPUT_DIR/integration-tests.xml" \
        --html="$OUTPUT_DIR/integration-report.html" \
        --self-contained-html \
        $(if [[ $VERBOSE == true ]]; then echo "-v"; fi)
    
    # Cleanup test services
    if command -v docker-compose &> /dev/null; then
        docker-compose -f docker-compose.test.yml down
    fi
    
    log_success "Integration tests completed"
}

# Run end-to-end tests
run_e2e_tests() {
    log_info "Running end-to-end tests..."
    
    # Check if Cypress is available
    if ! command -v cypress &> /dev/null; then
        log_warning "Cypress not found, skipping E2E tests"
        return
    fi
    
    # Start application for E2E testing
    log_info "Starting application for E2E testing..."
    npm run start:test &
    APP_PID=$!
    
    # Wait for application to start
    sleep 15
    
    # Run Cypress tests
    if [[ $VERBOSE == true ]]; then
        npx cypress run --reporter junit --reporter-options "mochaFile=$OUTPUT_DIR/e2e-tests.xml"
    else
        npx cypress run --reporter junit --reporter-options "mochaFile=$OUTPUT_DIR/e2e-tests.xml" --quiet
    fi
    
    # Stop application
    kill $APP_PID 2>/dev/null || true
    
    log_success "End-to-end tests completed"
}

# Run accessibility tests
run_accessibility_tests() {
    log_info "Running accessibility tests..."
    
    # Run Python accessibility tests
    python3 -m pytest tests/accessibility/ \
        --junit-xml="$OUTPUT_DIR/accessibility-tests.xml" \
        --html="$OUTPUT_DIR/accessibility-report.html" \
        --self-contained-html \
        $(if [[ $VERBOSE == true ]]; then echo "-v"; fi)
    
    # Run axe-core accessibility tests if available
    if command -v axe &> /dev/null; then
        log_info "Running axe-core accessibility scan..."
        axe http://localhost:3000 --save "$OUTPUT_DIR/axe-results.json" || true
    fi
    
    # Run pa11y accessibility tests if available
    if command -v pa11y &> /dev/null; then
        log_info "Running pa11y accessibility scan..."
        pa11y http://localhost:3000 --reporter json > "$OUTPUT_DIR/pa11y-results.json" || true
    fi
    
    log_success "Accessibility tests completed"
}

# Run security tests
run_security_tests() {
    log_info "Running security tests..."
    
    # Run Bandit security linter for Python
    log_info "Running Bandit security scan..."
    bandit -r src/ -f json -o "$OUTPUT_DIR/bandit-results.json" || true
    
    # Run Safety security checker
    log_info "Running Safety security check..."
    safety check --json --output "$OUTPUT_DIR/safety-results.json" || true
    
    # Run npm audit for Node.js dependencies
    log_info "Running npm security audit..."
    npm audit --json > "$OUTPUT_DIR/npm-audit-results.json" || true
    
    # Run Snyk security scan if available
    if command -v snyk &> /dev/null; then
        log_info "Running Snyk security scan..."
        snyk test --json > "$OUTPUT_DIR/snyk-results.json" || true
    fi
    
    # Run custom security tests
    python3 -m pytest tests/security/ \
        --junit-xml="$OUTPUT_DIR/security-tests.xml" \
        --html="$OUTPUT_DIR/security-report.html" \
        --self-contained-html \
        $(if [[ $VERBOSE == true ]]; then echo "-v"; fi)
    
    log_success "Security tests completed"
}

# Run performance tests
run_performance_tests() {
    log_info "Running performance tests..."
    
    # Run Python performance tests
    python3 -m pytest tests/performance/ \
        --junit-xml="$OUTPUT_DIR/performance-tests.xml" \
        --html="$OUTPUT_DIR/performance-report.html" \
        --self-contained-html \
        $(if [[ $VERBOSE == true ]]; then echo "-v"; fi)
    
    # Run Lighthouse performance audit if available
    if command -v lighthouse &> /dev/null; then
        log_info "Running Lighthouse performance audit..."
        lighthouse http://localhost:3000 \
            --output=json \
            --output-path="$OUTPUT_DIR/lighthouse-results.json" \
            --chrome-flags="--headless" || true
    fi
    
    log_success "Performance tests completed"
}

# Generate test report
generate_test_report() {
    log_info "Generating test report..."
    
    local report_file="$OUTPUT_DIR/test-report.md"
    
    cat > "$report_file" << EOF
# AgentOS Test Report

**Test Date:** $(date)
**Test Type:** $TEST_TYPE
**Coverage Enabled:** $COVERAGE
**Parallel Execution:** $PARALLEL

## Test Results Summary

EOF
    
    # Add test results for each type that was run
    if [[ -f "$OUTPUT_DIR/python-unit-tests.xml" ]]; then
        local unit_tests=$(grep -o 'tests="[0-9]*"' "$OUTPUT_DIR/python-unit-tests.xml" | grep -o '[0-9]*' || echo "0")
        local unit_failures=$(grep -o 'failures="[0-9]*"' "$OUTPUT_DIR/python-unit-tests.xml" | grep -o '[0-9]*' || echo "0")
        echo "- **Unit Tests:** $unit_tests tests, $unit_failures failures" >> "$report_file"
    fi
    
    if [[ -f "$OUTPUT_DIR/integration-tests.xml" ]]; then
        local int_tests=$(grep -o 'tests="[0-9]*"' "$OUTPUT_DIR/integration-tests.xml" | grep -o '[0-9]*' || echo "0")
        local int_failures=$(grep -o 'failures="[0-9]*"' "$OUTPUT_DIR/integration-tests.xml" | grep -o '[0-9]*' || echo "0")
        echo "- **Integration Tests:** $int_tests tests, $int_failures failures" >> "$report_file"
    fi
    
    if [[ -f "$OUTPUT_DIR/accessibility-tests.xml" ]]; then
        local a11y_tests=$(grep -o 'tests="[0-9]*"' "$OUTPUT_DIR/accessibility-tests.xml" | grep -o '[0-9]*' || echo "0")
        local a11y_failures=$(grep -o 'failures="[0-9]*"' "$OUTPUT_DIR/accessibility-tests.xml" | grep -o '[0-9]*' || echo "0")
        echo "- **Accessibility Tests:** $a11y_tests tests, $a11y_failures failures" >> "$report_file"
    fi
    
    cat >> "$report_file" << EOF

## Coverage Report
$(if [[ -f "$OUTPUT_DIR/coverage.xml" ]]; then echo "Coverage report available in: $OUTPUT_DIR/coverage-html/index.html"; else echo "Coverage report not generated"; fi)

## Test Artifacts
$(find "$OUTPUT_DIR" -name "*.xml" -o -name "*.html" -o -name "*.json" | sed 's/^/- /')

## Test Duration
**Total Test Time:** $((SECONDS / 60)) minutes $((SECONDS % 60)) seconds
EOF
    
    log_success "Test report generated: $report_file"
}

# Main test function
main() {
    local start_time=$SECONDS
    
    echo "=========================================="
    echo "         AgentOS Test Runner            "
    echo "=========================================="
    echo "Test Type: $TEST_TYPE"
    echo "Coverage: $COVERAGE"
    echo "Parallel: $PARALLEL"
    echo "Output Directory: $OUTPUT_DIR"
    echo "=========================================="
    echo
    
    setup_test_environment
    
    case $TEST_TYPE in
        "unit")
            run_unit_tests
            ;;
        "integration")
            run_integration_tests
            ;;
        "e2e")
            run_e2e_tests
            ;;
        "accessibility")
            run_accessibility_tests
            ;;
        "security")
            run_security_tests
            ;;
        "performance")
            run_performance_tests
            ;;
        "all")
            run_unit_tests
            run_integration_tests
            run_accessibility_tests
            run_security_tests
            # Skip E2E and performance tests in CI unless explicitly requested
            if [[ -z "$CI" ]]; then
                run_e2e_tests
                run_performance_tests
            fi
            ;;
    esac
    
    generate_test_report
    
    local test_time=$((SECONDS - start_time))
    
    echo
    log_success "AgentOS tests completed successfully!"
    log_info "Total test time: $((test_time / 60)) minutes $((test_time % 60)) seconds"
    echo
    echo "Test results available in: $OUTPUT_DIR/"
    echo "Test report: $OUTPUT_DIR/test-report.md"
    echo
}

# Run main function
main "$@"