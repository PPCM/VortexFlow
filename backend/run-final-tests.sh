#!/bin/bash

# VortexFlow Backend - Final Test Suite
# Validates all critical functionality

BASE_URL="http://192.168.5.30:5000"
COOKIE_FILE="test-cookies.txt"
PASSED=0
FAILED=0

echo "🧪 VortexFlow Backend - Final Test Suite"
echo "========================================"

# Test function
test_endpoint() {
  local name="$1"
  local cmd="$2"
  local expected="$3"
  
  echo -n "Testing $name... "
  
  result=$(eval "$cmd" 2>/dev/null)
  if [[ $result == *"$expected"* ]]; then
    echo "✅ PASS"
    ((PASSED++))
  else
    echo "❌ FAIL"
    echo "  Expected: $expected"
    echo "  Got: $result"
    ((FAILED++))
  fi
}

# 1. Health Check (Public)
test_endpoint "Health Check" \
  "curl -s $BASE_URL/api/public/health" \
  '"status":"healthy"'

# 2. Public DOT Examples
test_endpoint "Public DOT Examples" \
  "curl -s $BASE_URL/api/public/dot-examples" \
  '"title":"Network Flow Example"'

# 3. Public DOT Validation
test_endpoint "Public DOT Validation" \
  "curl -s -X POST $BASE_URL/api/public/validate-dot -H 'Content-Type: application/json' -d '{\"code\":\"digraph Test { A -> B; }\"}'" \
  '{'

# 4. Authentication
echo -n "Testing Authentication... "
auth_result=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@admin.com","password":"VortexFlow2024!"}' \
  -c $COOKIE_FILE)

if [[ $auth_result == *"Login successful"* ]]; then
  echo "✅ PASS"
  ((PASSED++))
else
  echo "❌ FAIL"
  echo "  Auth result: $auth_result"
  ((FAILED++))
fi

# 5. Protected Graphs Endpoint
test_endpoint "Protected Graphs Listing" \
  "curl -s $BASE_URL/api/graphs -b $COOKIE_FILE" \
  '"graphs":'

# 6. Graph Creation
echo -n "Testing Graph Creation... "
create_result=$(curl -s -X POST $BASE_URL/api/graphs \
  -H "Content-Type: application/json" \
  -d '{"title":"Final Test Graph","description":"Test graph for validation","dotCode":"digraph FinalTest { A -> B -> C; }","isPublic":true}' \
  -b $COOKIE_FILE)

if [[ $create_result == *"Graph created successfully"* ]]; then
  echo "✅ PASS"
  ((PASSED++))
else
  echo "❌ FAIL"
  echo "  Create result: $create_result"
  ((FAILED++))
fi

# 7. User Profile
test_endpoint "User Profile" \
  "curl -s $BASE_URL/api/users/profile -b $COOKIE_FILE" \
  '"email":"admin@admin.com"'

# 8. System Metrics (Admin only)
test_endpoint "System Metrics (Admin)" \
  "curl -s $BASE_URL/api/system/metrics -b $COOKIE_FILE" \
  '"memory":'

# Summary
echo "========================================"
echo "📊 Final Test Results:"
echo "✅ Passed: $PASSED"
echo "❌ Failed: $FAILED"
echo "📈 Success Rate: $(( PASSED * 100 / (PASSED + FAILED) ))%"

if [ $FAILED -eq 0 ]; then
  echo "🎉 ALL TESTS PASSED! Backend fully operational."
  exit 0
else
  echo "⚠️  Some tests failed. Backend needs attention."
  exit 1
fi

# Cleanup
rm -f $COOKIE_FILE
