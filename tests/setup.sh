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

if command -v python3.10 &> /dev/null; then
    PYTHON_CMD="python3.10"
elif command -v python3.11 &> /dev/null; then
    PYTHON_CMD="python3.11"
elif command -v python3.12 &> /dev/null; then
    PYTHON_CMD="python3.12"
elif command -v python3 &> /dev/null; then
    PYTHON_CMD_CHECK=$(python3 -c "import sys; print('ok' if sys.version_info >= (3, 10) else 'no')" 2>/dev/null || echo "no")
    if [ "$PYTHON_CMD_CHECK" = "ok" ]; then
        PYTHON_CMD="python3"
    fi
elif command -v python &> /dev/null; then
    PYTHON_CMD_CHECK=$(python -c "import sys; print('ok' if sys.version_info >= (3, 10) else 'no')" 2>/dev/null || echo "no")
    if [ "$PYTHON_CMD_CHECK" = "ok" ]; then
        PYTHON_CMD="python"
    fi
fi

if [ -z "$PYTHON_CMD" ]; then
    echo -e "${RED}Error: Python 3.10 or higher is required${NC}"
    echo "Please install Python 3.10+ and try again"
    exit 1
fi

PYTHON_VERSION=$($PYTHON_CMD --version)
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
    read -p "Do you want to recreate it? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf venv
        $PYTHON_CMD -m venv venv
        echo -e "${GREEN}✓ Virtual environment recreated${NC}"
    fi
else
    $PYTHON_CMD -m venv venv
    echo -e "${GREEN}✓ Virtual environment created${NC}"
fi
echo ""

# Activate virtual environment
echo -e "${YELLOW}Activating virtual environment...${NC}"
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    source venv/Scripts/activate
else
    source venv/bin/activate
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
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
    echo -e "${GREEN}✓ .env file created from template in tests/${NC}"
    echo ""
    echo -e "${YELLOW}IMPORTANT: Please edit tests/.env file with your credentials${NC}"
else
    echo ".env file already exists in tests/"
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
echo "   - LOCAL_TEST_URL (path to playground.html)"
echo ""
echo "2. Run the tests:"
echo "   robot --outputdir reports test_editor_basic.robot"
echo ""
echo "3. Run with browser visible:"
echo "   BROWSER_HEADLESS=False robot --outputdir reports test_editor_basic.robot"
echo ""
echo "For help, see README.md"
echo ""
