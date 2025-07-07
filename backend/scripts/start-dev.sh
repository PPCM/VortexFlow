#!/bin/bash

# VortexFlow Backend Development Startup Script

echo "🌊 Starting VortexFlow Backend Development Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from template...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}✅ .env file created from .env.example${NC}"
        echo -e "${YELLOW}📝 Please edit .env file with your configuration before continuing${NC}"
        exit 1
    else
        echo -e "${RED}❌ .env.example file not found. Please create .env manually${NC}"
        exit 1
    fi
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Dependencies installed successfully${NC}"
fi

# Create upload directories
echo -e "${BLUE}📁 Creating upload directories...${NC}"
mkdir -p uploads/graphs uploads/exports uploads/temp
mkdir -p logs
echo -e "${GREEN}✅ Upload directories created${NC}"

# Check database connection
echo -e "${BLUE}🗄️  Checking database connection...${NC}"
npm run check-db 2>/dev/null
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Database connection check failed. Make sure PostgreSQL is running${NC}"
    echo -e "${YELLOW}   You can run the database setup with: npm run setup-db${NC}"
fi

# Check Redis connection
echo -e "${BLUE}🔴 Checking Redis connection...${NC}"
redis-cli ping >/dev/null 2>&1
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Redis not accessible. Make sure Redis is running${NC}"
    echo -e "${YELLOW}   You can start Redis with: redis-server${NC}"
fi

# Start the development server
echo -e "${GREEN}🚀 Starting VortexFlow Backend in development mode...${NC}"
echo -e "${BLUE}📍 Backend will be available at: http://localhost:5000${NC}"
echo -e "${BLUE}📍 API documentation: http://localhost:5000/api/system/info${NC}"
echo -e "${BLUE}📍 Health check: http://localhost:5000/api/system/health${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}"
echo ""

npm run dev
