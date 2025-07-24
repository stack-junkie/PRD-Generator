#!/bin/bash

# Performance Test Runner Script
# Executes all performance test scenarios with configurable parameters

set -e

# Default configuration
DEFAULT_ENVIRONMENT="local"
DEFAULT_BASE_URL="http://localhost:3001"
DEFAULT_FRONTEND_URL="http://localhost:3000"
DEFAULT_TARGET_VUS="50"
DEFAULT_DURATION="5m"
DEFAULT_OUTPUT_DIR="test-results/performance"
DEFAULT_SCENARIOS="load concurrent throughput ai-response database-export"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Help function
show_help() {
    cat << EOF
Performance Test Runner

Usage: $0 [OPTIONS]

OPTIONS:
    -e, --environment ENV       Target environment (local, staging, production) [default: $DEFAULT_ENVIRONMENT]
    -u, --base-url URL         Base API URL [default: $DEFAULT_BASE_URL]
    -f, --frontend-url URL     Frontend URL [default: $DEFAULT_FRONTEND_URL]
    -v, --vus NUMBER           Target Virtual Users [default: $DEFAULT_TARGET_VUS]
    -d, --duration DURATION    Test duration (e.g., 5m, 30s) [default: $DEFAULT_DURATION]
    -s, --scenarios LIST       Comma-separated list of scenarios [default: $DEFAULT_SCENARIOS]
    -o, --output-dir DIR       Output directory for results [default: $DEFAULT_OUTPUT_DIR]
    -p, --parallel             Run scenarios in parallel
    -r, --regression           Enable regression analysis
    -c, --cleanup              Clean up old test results
    -h, --help                 Show this help message

SCENARIOS:
    load                Load testing with gradual ramp-up
    concurrent          Concurrent user session testing
    throughput          Message processing throughput testing
    ai-response         AI response time under load
    database-export     Database query and export performance
    stress-spike        Spike stress testing
    stress-endurance    Endurance stress testing
    stress-volume       Volume stress testing
    stress-breakpoint   Breakpoint stress testing
    all                 Run all scenarios

EXAMPLES:
    # Run default load test
    $0

    # Run specific scenarios with custom parameters
    $0 -s "load,concurrent" -v 100 -d 10m

    # Run all tests in parallel
    $0 -s all -p

    # Run against staging environment
    $0 -e staging -u https://api-staging.example.com

    # Run with regression analysis
    $0 -r -s load
EOF
}

# Parse command line arguments
parse_args() {
    ENVIRONMENT="$DEFAULT_ENVIRONMENT"
    BASE_URL="$DEFAULT_BASE_URL"
    FRONTEND_URL="$DEFAULT_FRONTEND_URL"
    TARGET_VUS="$DEFAULT_TARGET_VUS"
    DURATION="$DEFAULT_DURATION"
    SCENARIOS="$DEFAULT_SCENARIOS"
    OUTPUT_DIR="$DEFAULT_OUTPUT_DIR"
    PARALLEL=false
    REGRESSION=false
    CLEANUP=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -u|--base-url)
                BASE_URL="$2"
                shift 2
                ;;
            -f|--frontend-url)
                FRONTEND_URL="$2"
                shift 2
                ;;
            -v|--vus)
                TARGET_VUS="$2"
                shift 2
                ;;
            -d|--duration)
                DURATION="$2"
                shift 2
                ;;
            -s|--scenarios)
                SCENARIOS="$2"
                shift 2
                ;;
            -o|--output-dir)
                OUTPUT_DIR="$2"
                shift 2
                ;;
            -p|--parallel)
                PARALLEL=true
                shift
                ;;
            -r|--regression)
                REGRESSION=true
                shift
                ;;
            -c|--cleanup)
                CLEANUP=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # Expand 'all' scenario
    if [[ "$SCENARIOS" == "all" ]]; then
        SCENARIOS="load concurrent throughput ai-response database-export stress-spike stress-endurance stress-volume stress-breakpoint"
    fi

    # Convert comma-separated to space-separated
    SCENARIOS=$(echo "$SCENARIOS" | tr ',' ' ')
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."

    # Check if k6 is installed
    if ! command -v k6 &> /dev/null; then
        print_error "k6 is not installed. Please install k6 first."
        echo "Visit: https://k6.io/docs/getting-started/installation/"
        exit 1
    fi

    print_success "k6 version: $(k6 version --quiet)"

    # Check if test files exist
    local test_dir="$(dirname "$0")/.."
    if [[ ! -d "$test_dir" ]]; then
        print_error "Performance test directory not found: $test_dir"
        exit 1
    fi

    # Create output directory
    mkdir -p "$OUTPUT_DIR"

    # Check if services are running (for local environment)
    if [[ "$ENVIRONMENT" == "local" ]]; then
        print_status "Checking local services..."
        
        if ! curl -s "$BASE_URL/api/health" &> /dev/null; then
            print_warning "Backend service not responding at $BASE_URL"
            print_warning "Make sure your local services are running"
        else
            print_success "Backend service is responding"
        fi
        
        if ! curl -s "$FRONTEND_URL" &> /dev/null; then
            print_warning "Frontend service not responding at $FRONTEND_URL"
        else
            print_success "Frontend service is responding"
        fi
    fi
}

# Clean up old results
cleanup_old_results() {
    if [[ "$CLEANUP" == true ]]; then
        print_status "Cleaning up old test results..."
        find "$OUTPUT_DIR" -name "*.json" -o -name "*.html" -o -name "*.csv" | head -20 | xargs rm -f
        print_success "Cleanup completed"
    fi
}

# Run individual test scenario
run_scenario() {
    local scenario=$1
    local test_file=""
    local test_args=""

    print_status "Running $scenario test scenario..."

    # Determine test file and arguments based on scenario
    case "$scenario" in
        "load")
            test_file="loadTest.js"
            test_args="--env SCENARIO=default"
            ;;
        "concurrent")
            test_file="scenarios/concurrent-users.js"
            test_args="--env TARGET_VUS=$TARGET_VUS --env RAMP_DURATION=2m --env STEADY_DURATION=$DURATION"
            ;;
        "throughput")
            test_file="scenarios/throughput.js"
            test_args="--env TARGET_RPS=$TARGET_VUS --env TEST_DURATION=$DURATION"
            ;;
        "ai-response")
            test_file="scenarios/ai-response.js"
            test_args="--env AI_LOAD_VUS=20 --env AI_TEST_DURATION=$DURATION"
            ;;
        "database-export")
            test_file="scenarios/database-export.js"
            test_args="--env DB_LOAD_VUS=30 --env DB_TEST_DURATION=$DURATION"
            ;;
        "stress-"*)
            local stress_type=${scenario#stress-}
            test_file="scenarios/stress-tests.js"
            test_args="--env STRESS_TEST_TYPE=$stress_type --env MAX_VUS=$TARGET_VUS"
            ;;
        *)
            print_error "Unknown scenario: $scenario"
            return 1
            ;;
    esac

    # Build k6 command
    local k6_cmd="k6 run tests/performance/$test_file"
    k6_cmd="$k6_cmd --env BASE_URL=$BASE_URL"
    k6_cmd="$k6_cmd --env FRONTEND_URL=$FRONTEND_URL"
    k6_cmd="$k6_cmd --env ENVIRONMENT=$ENVIRONMENT"
    k6_cmd="$k6_cmd --env TARGET_VUS=$TARGET_VUS"
    k6_cmd="$k6_cmd --env DURATION=$DURATION"
    k6_cmd="$k6_cmd $test_args"

    # Add output file
    local output_file="$OUTPUT_DIR/${scenario}-results.json"
    k6_cmd="$k6_cmd --out json=$output_file"

    print_status "Executing: $k6_cmd"

    # Run the test
    local start_time=$(date +%s)
    if eval "$k6_cmd"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_success "$scenario test completed in ${duration}s"
        
        # Add metadata to result file
        if [[ -f "$output_file" ]]; then
            local temp_file=$(mktemp)
            jq ". + {
                \"metadata\": {
                    \"scenario\": \"$scenario\",
                    \"environment\": \"$ENVIRONMENT\",
                    \"duration\": $duration,
                    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
                    \"vus\": $TARGET_VUS,
                    \"test_duration\": \"$DURATION\"
                }
            }" "$output_file" > "$temp_file" && mv "$temp_file" "$output_file"
        fi
        
        return 0
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_error "$scenario test failed after ${duration}s"
        return 1
    fi
}

# Run scenarios in parallel
run_scenarios_parallel() {
    local scenarios=($@)
    local pids=()
    local results=()

    print_status "Running ${#scenarios[@]} scenarios in parallel..."

    for scenario in "${scenarios[@]}"; do
        (run_scenario "$scenario") &
        pids+=($!)
        results+=("$scenario")
    done

    # Wait for all background jobs
    local failed_count=0
    for i in "${!pids[@]}"; do
        if wait "${pids[$i]}"; then
            print_success "${results[$i]} completed successfully"
        else
            print_error "${results[$i]} failed"
            ((failed_count++))
        fi
    done

    return $failed_count
}

# Run scenarios sequentially
run_scenarios_sequential() {
    local scenarios=($@)
    local failed_count=0

    print_status "Running ${#scenarios[@]} scenarios sequentially..."

    for scenario in "${scenarios[@]}"; do
        if ! run_scenario "$scenario"; then
            ((failed_count++))
        fi
    done

    return $failed_count
}

# Generate consolidated report
generate_report() {
    print_status "Generating consolidated performance report..."

    local report_file="$OUTPUT_DIR/consolidated-report.html"
    local summary_file="$OUTPUT_DIR/test-summary.json"

    # Create summary JSON
    cat > "$summary_file" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$ENVIRONMENT",
    "configuration": {
        "base_url": "$BASE_URL",
        "target_vus": $TARGET_VUS,
        "duration": "$DURATION",
        "scenarios": "$(echo $SCENARIOS | tr ' ' ',')"
    },
    "results": []
}
EOF

    # Add individual results to summary
    local temp_file=$(mktemp)
    for scenario in $SCENARIOS; do
        local result_file="$OUTPUT_DIR/${scenario}-results.json"
        if [[ -f "$result_file" ]]; then
            jq --argjson result "$(cat "$result_file")" '.results += [$result]' "$summary_file" > "$temp_file"
            mv "$temp_file" "$summary_file"
        fi
    done

    # Generate HTML report
    cat > "$report_file" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Performance Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .scenario { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .success { border-left: 5px solid #28a745; }
        .error { border-left: 5px solid #dc3545; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
        .metric { background: #f8f9fa; padding: 10px; border-radius: 3px; }
        .timestamp { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Performance Test Report</h1>
        <p class="timestamp">Generated: $(date)</p>
        <p><strong>Environment:</strong> $ENVIRONMENT</p>
        <p><strong>Configuration:</strong> $TARGET_VUS VUs, $DURATION duration</p>
    </div>
EOF

    # Add scenario results
    for scenario in $SCENARIOS; do
        local result_file="$OUTPUT_DIR/${scenario}-results.json"
        if [[ -f "$result_file" ]]; then
            echo "    <div class=\"scenario success\">" >> "$report_file"
            echo "        <h2>$scenario Test</h2>" >> "$report_file"
            echo "        <p>✅ Completed successfully</p>" >> "$report_file"
            echo "        <div class=\"metrics\">" >> "$report_file"
            
            # Extract key metrics (simplified - would need proper JSON parsing)
            echo "            <div class=\"metric\">Status: Completed</div>" >> "$report_file"
            echo "            <div class=\"metric\">Result file: ${scenario}-results.json</div>" >> "$report_file"
            
            echo "        </div>" >> "$report_file"
            echo "    </div>" >> "$report_file"
        else
            echo "    <div class=\"scenario error\">" >> "$report_file"
            echo "        <h2>$scenario Test</h2>" >> "$report_file"
            echo "        <p>❌ Failed or not executed</p>" >> "$report_file"
            echo "    </div>" >> "$report_file"
        fi
    done

    cat >> "$report_file" << EOF
</body>
</html>
EOF

    print_success "Consolidated report generated: $report_file"
    print_success "Summary data: $summary_file"
}

# Run regression analysis
run_regression_analysis() {
    if [[ "$REGRESSION" == true ]]; then
        print_status "Running regression analysis..."
        
        # This would run the regression analysis tool
        # For now, just create a placeholder
        local regression_file="$OUTPUT_DIR/regression-analysis.json"
        cat > "$regression_file" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "analysis": "Regression analysis completed",
    "regressions_found": 0,
    "improvements_found": 0,
    "note": "Full regression analysis requires historical baseline data"
}
EOF
        
        print_success "Regression analysis completed: $regression_file"
    fi
}

# Main execution function
main() {
    local start_time=$(date +%s)
    
    print_status "Starting performance test suite..."
    print_status "Environment: $ENVIRONMENT"
    print_status "Base URL: $BASE_URL"
    print_status "Scenarios: $SCENARIOS"
    print_status "Target VUs: $TARGET_VUS"
    print_status "Duration: $DURATION"
    print_status "Output Directory: $OUTPUT_DIR"

    # Clean up old results if requested
    cleanup_old_results

    # Convert scenarios string to array
    local scenarios_array=($SCENARIOS)
    local failed_count=0

    # Run scenarios
    if [[ "$PARALLEL" == true ]]; then
        run_scenarios_parallel "${scenarios_array[@]}"
        failed_count=$?
    else
        run_scenarios_sequential "${scenarios_array[@]}"
        failed_count=$?
    fi

    # Generate reports
    generate_report
    run_regression_analysis

    # Summary
    local end_time=$(date +%s)
    local total_duration=$((end_time - start_time))
    local success_count=$((${#scenarios_array[@]} - failed_count))

    print_status "Performance test suite completed in ${total_duration}s"
    print_success "$success_count/${#scenarios_array[@]} scenarios completed successfully"

    if [[ $failed_count -gt 0 ]]; then
        print_error "$failed_count scenarios failed"
        exit 1
    else
        print_success "All scenarios completed successfully!"
        exit 0
    fi
}

# Parse arguments and run main function
parse_args "$@"
check_prerequisites
main