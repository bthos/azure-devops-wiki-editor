#!/bin/bash

# ADO Wiki Editor - Robot Framework Test Runner
# This script provides an easy interface to run Robot Framework tests
# Run from: tests/ directory

set -e

# Change to robot directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/robot"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
OUTPUT_DIR="reports"
HEADLESS="True"

# Print usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -t, --test TEST       Run specific test by name"
    echo "  -g, --tag TAG         Run tests with specific tag"
    echo "  -s, --suite SUITE     Run specific test suite"
    echo "  -b, --browser         Run tests with visible browser (not headless)"
    echo "  -o, --output DIR      Output directory for reports (default: reports)"
    echo "  -h, --help            Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Run all tests"
    echo "  $0 --browser                          # Run all tests with visible browser"
    echo "  $0 --tag smoke                        # Run smoke tests only"
    echo "  $0 --suite test_editor_basic.robot    # Run basic editor tests"
    echo "  $0 --test \"Test Editor Loads\"        # Run specific test"
    exit 1
}

# Check if virtual environment is activated
check_venv() {
    if [[ -z "${VIRTUAL_ENV}" ]]; then
        echo -e "${YELLOW}Warning: Virtual environment not activated${NC}"
        echo "Attempting to activate venv..."
        
        if [ -f "venv/bin/activate" ]; then
            source venv/bin/activate
        elif [ -f "venv/Scripts/activate" ]; then
            source venv/Scripts/activate
        else
            echo -e "${RED}Error: venv not found. Please run setup.sh first${NC}"
            exit 1
        fi
        echo -e "${GREEN}Virtual environment activated${NC}"
    fi
}

# Check if .env file exists
check_env() {
    if [ ! -f ".env" ]; then
        echo -e "${YELLOW}Warning: .env file not found${NC}"
        echo "Please create .env file from .env.example and configure your settings"
        read -p "Do you want to copy .env.example to .env now? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            cp .env.example .env
            echo -e "${GREEN}.env file created. Please edit it with your configuration.${NC}"
            exit 0
        fi
    fi
}

# Parse command line arguments
TEST_NAME=""
TAG=""
SUITE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--test)
            TEST_NAME="$2"
            shift 2
            ;;
        -g|--tag)
            TAG="$2"
            shift 2
            ;;
        -s|--suite)
            SUITE="$2"
            shift 2
            ;;
        -b|--browser)
            HEADLESS="False"
            shift
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            usage
            ;;
    esac
done

# Check prerequisites
check_venv
check_env

# Create output directory
mkdir -p "${OUTPUT_DIR}"

# Build robot command
ROBOT_CMD="robot --outputdir ${OUTPUT_DIR}"

# Add headless variable
export BROWSER_HEADLESS="${HEADLESS}"

# Add test filter if specified
if [ -n "$TEST_NAME" ]; then
    ROBOT_CMD="${ROBOT_CMD} --test \"${TEST_NAME}\""
fi

# Add tag filter if specified
if [ -n "$TAG" ]; then
    ROBOT_CMD="${ROBOT_CMD} --include ${TAG}"
fi

# Determine which test files to run
if [ -n "$SUITE" ]; then
    TEST_FILES="${SUITE}"
else
    TEST_FILES="*.robot"
fi

ROBOT_CMD="${ROBOT_CMD} ${TEST_FILES}"

echo -e "${GREEN}Running ADO Wiki Editor Tests...${NC}"
echo "Command: $ROBOT_CMD"
echo ""

# Run the tests
eval $ROBOT_CMD

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ Tests completed successfully${NC}"
    echo "Reports available in: ${OUTPUT_DIR}/"
else
    echo ""
    echo -e "${RED}✗ Some tests failed${NC}"
    echo "Check reports in: ${OUTPUT_DIR}/"
fi
