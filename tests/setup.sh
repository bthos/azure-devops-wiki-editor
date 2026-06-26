#!/bin/bash

# ADO Wiki Editor - Robot Framework Test Setup Script
# This script sets up the Robot Framework test environment
# Run from: tests/ directory

set -e

# Change to robot directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/robot"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "=========================================="
echo "ADO Wiki Editor - Robot Framework Setup"
echo "=========================================="
echo ""

# Check Python version
echo -e "${YELLOW}Checking Python version...${NC}"
PYTHON_CMD=""

is_working_python() {
    local candidate="$1"
    local bin="${candidate%% *}"

    if ! command -v "$bin" &> /dev/null; then
        return 1
    fi

    # Some Windows environments expose stubs like python3.12 that exist but fail to execute.
    # Validate by actually running the interpreter and verifying version >= 3.10.
    eval "$candidate -c \"import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)\"" >/dev/null 2>&1
}

for candidate in \
    "python3.12" \
    "python3.11" \
    "python3.10" \
    "python3" \
    "python" \
    "py -3.12" \
    "py -3.11" \
    "py -3.10" \
    "py -3" \
    "py"; do
    if is_working_python "$candidate"; then
        PYTHON_CMD="$candidate"
        break
    fi
done

if [ -z "$PYTHON_CMD" ]; then
    echo -e "${RED}Error: Python 3.10 or higher is required${NC}"
    echo "Please install Python 3.10+ and try again"
    exit 1
fi

PYTHON_VERSION=$(eval "$PYTHON_CMD --version" 2>&1)
echo -e "${GREEN}✓ Found: $PYTHON_VERSION${NC}"
echo ""

# Check Node.js version (required for Playwright)
echo -e "${YELLOW}Checking Node.js version...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Found: Node.js $NODE_VERSION${NC}"
else
    echo -e "${RED}Error: Node.js is required for Playwright${NC}"
    echo "Please install Node.js 18.18.0+ and try again"
    exit 1
fi
echo ""

# Create virtual environment
echo -e "${YELLOW}Creating virtual environment...${NC}"
if [ -d "venv" ]; then
    echo "Virtual environment already exists"
    # Avoid interactive prompts (works better in CI and tool-driven shells).
    # Set RECREATE_VENV=1 to force re-creation.
    if [[ "${RECREATE_VENV:-0}" == "1" ]]; then
        rm -rf venv
        eval "$PYTHON_CMD -m venv venv"
        echo -e "${GREEN}✓ Virtual environment recreated${NC}"
    else
        echo "Keeping existing venv (set RECREATE_VENV=1 to recreate)"
    fi
else
    eval "$PYTHON_CMD -m venv venv"
    echo -e "${GREEN}✓ Virtual environment created${NC}"
fi
echo ""

# Activate virtual environment
echo -e "${YELLOW}Activating virtual environment...${NC}"
if [ -f "venv/Scripts/activate" ]; then
    source venv/Scripts/activate
elif [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
else
    echo -e "${RED}Error: Could not find venv activation script${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Virtual environment activated${NC}"
echo ""

# Upgrade pip
echo -e "${YELLOW}Upgrading pip...${NC}"
pip install --upgrade pip
echo -e "${GREEN}✓ pip upgraded${NC}"
echo ""

# Install requirements
echo -e "${YELLOW}Installing Python packages...${NC}"
pip install -r requirements.txt
echo -e "${GREEN}✓ Python packages installed${NC}"
echo ""

# Initialize Playwright browsers
echo -e "${YELLOW}Initializing Playwright browsers...${NC}"
rfbrowser init chromium
echo -e "${GREEN}✓ Playwright browsers initialized${NC}"
echo ""

# Create .env file in tests/ root
echo -e "${YELLOW}Setting up environment configuration...${NC}"
# Ensure tests/.env exists
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
    echo -e "${GREEN}✓ .env file created from template in tests/${NC}"
    echo ""
    echo -e "${YELLOW}IMPORTANT: Please edit tests/.env file with your configuration${NC}"
else
    echo ".env file already exists in tests/"

    # Warn if LOCAL_TEST_URL is set to something Playwright can't navigate to.
    # Common pitfall: relative paths like ../playground.html (must be file://... or http(s)://...)
    if grep -q '^LOCAL_TEST_URL=' "$SCRIPT_DIR/.env"; then
        LOCAL_TEST_URL_VALUE=$(grep '^LOCAL_TEST_URL=' "$SCRIPT_DIR/.env" | head -n 1 | cut -d '=' -f2-)
        if [[ -n "$LOCAL_TEST_URL_VALUE" ]] && [[ ! "$LOCAL_TEST_URL_VALUE" =~ ^(https?://|file://) ]]; then
            echo -e "${YELLOW}Warning: tests/.env sets LOCAL_TEST_URL to '$LOCAL_TEST_URL_VALUE'.${NC}"
            echo -e "${YELLOW}Playwright requires http(s)://... or file://... URLs. Consider removing LOCAL_TEST_URL to use the default, or set it to e.g. http://localhost:8080/playground.html.${NC}"
        fi
    fi
fi

# Ensure tests/robot/.env exists (run_tests.sh expects this)
if [ ! -f ".env" ]; then
    cp "$SCRIPT_DIR/.env" ".env"
    echo -e "${GREEN}✓ .env file created in tests/robot/ from tests/.env${NC}"
else
    echo ".env file already exists in tests/robot/"
fi
echo ""

# Create necessary directories
echo -e "${YELLOW}Creating project directories...${NC}"
mkdir -p reports logs data screenshots
echo -e "${GREEN}✓ Directories created${NC}"
echo ""

# Summary
echo "=========================================="
echo -e "${GREEN}Setup Complete!${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration:"
echo "   - ADO_ORG_URL (your Azure DevOps URL)"
echo "   - LOCAL_TEST_URL (optional; http(s)://... or file://... URL)"
echo ""
echo "2. Run the tests:"
echo "   robot --outputdir reports test_editor_basic.robot"
echo ""
echo "3. Run with browser visible:"
echo "   BROWSER_HEADLESS=False robot --outputdir reports test_editor_basic.robot"
echo ""
echo "For help, see README.md"
echo ""
