#!/usr/bin/env node

/**
 * VortexFlow Backend - Comprehensive Test Suite
 * Tests all critical endpoints and functionalities
 */

const axios = require('axios');
const logger = require('./src/utils/logger');

const BASE_URL = 'http://192.168.5.30:5000';
const TEST_USER = {
  email: 'admin@admin.com',
  password: 'VortexFlow2024!'
};

let authCookie = '';

// Test utilities
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, success, details = '') {
  const status = success ? '✅ PASS' : '❌ FAIL';
  logger.info(`${status} - ${name}${details ? ': ' + details : ''}`);
  
  testResults.tests.push({ name, success, details });
  if (success) testResults.passed++;
  else testResults.failed++;
}

// Test functions
async function testHealthCheck() {
  try {
    const response = await axios.get(`${BASE_URL}/api/system/health`);
    const healthy = response.data.status === 'healthy';
    logTest('Health Check', healthy, `Status: ${response.data.status}`);
    return healthy;
  } catch (error) {
    logTest('Health Check', false, error.message);
    return false;
  }
}

async function testPublicEndpoints() {
  try {
    // Test DOT examples
    const examplesResponse = await axios.get(`${BASE_URL}/api/public/dot-examples`);
    const hasExample = examplesResponse.data.example && examplesResponse.data.example.code;
    logTest('Public DOT Examples', hasExample, 'Example code retrieved');

    // Test DOT validation
    const validationResponse = await axios.post(`${BASE_URL}/api/public/validate-dot`, {
      code: 'digraph Test { A -> B; }'
    });
    logTest('Public DOT Validation', validationResponse.status === 200, 'Validation successful');

    return hasExample && validationResponse.status === 200;
  } catch (error) {
    logTest('Public Endpoints', false, error.message);
    return false;
  }
}

async function testAuthentication() {
  try {
    const response = await axios.post(`${BASE_URL}/api/auth/login`, TEST_USER);
    const success = response.data.message === 'Login successful';
    
    if (success && response.headers['set-cookie']) {
      authCookie = response.headers['set-cookie'][0].split(';')[0];
      logTest('Authentication', true, `User: ${response.data.user.email}`);
    } else {
      logTest('Authentication', false, 'No session cookie received');
    }
    
    return success;
  } catch (error) {
    logTest('Authentication', false, error.message);
    return false;
  }
}

async function testProtectedEndpoints() {
  if (!authCookie) {
    logTest('Protected Endpoints', false, 'No authentication cookie');
    return false;
  }

  try {
    // Test graphs listing
    const graphsResponse = await axios.get(`${BASE_URL}/api/graphs`, {
      headers: { Cookie: authCookie }
    });
    logTest('Graphs Listing', graphsResponse.status === 200, 
      `Found ${graphsResponse.data.graphs.length} graphs`);

    // Test graph creation
    const newGraph = {
      title: 'Test Graph - ' + Date.now(),
      description: 'Automated test graph',
      dotCode: 'digraph TestGraph { A -> B [label="test"]; B -> C; }',
      isPublic: true
    };

    const createResponse = await axios.post(`${BASE_URL}/api/graphs`, newGraph, {
      headers: { Cookie: authCookie }
    });
    
    const created = createResponse.status === 201 || createResponse.status === 200;
    logTest('Graph Creation', created, 
      created ? `Graph ID: ${createResponse.data.graph.id}` : 'Creation failed');

    return graphsResponse.status === 200 && created;
  } catch (error) {
    logTest('Protected Endpoints', false, error.message);
    return false;
  }
}

async function testUserEndpoints() {
  if (!authCookie) {
    logTest('User Endpoints', false, 'No authentication cookie');
    return false;
  }

  try {
    const profileResponse = await axios.get(`${BASE_URL}/api/users/profile`, {
      headers: { Cookie: authCookie }
    });
    
    const success = profileResponse.status === 200 && profileResponse.data.user;
    logTest('User Profile', success, 
      success ? `User: ${profileResponse.data.user.email}` : 'Profile retrieval failed');
    
    return success;
  } catch (error) {
    logTest('User Endpoints', false, error.message);
    return false;
  }
}

async function testSystemEndpoints() {
  if (!authCookie) {
    logTest('System Endpoints', false, 'No authentication cookie');
    return false;
  }

  try {
    const metricsResponse = await axios.get(`${BASE_URL}/api/system/metrics`, {
      headers: { Cookie: authCookie }
    });
    
    const success = metricsResponse.status === 200;
    logTest('System Metrics', success, 
      success ? 'Metrics retrieved' : 'Metrics retrieval failed');
    
    return success;
  } catch (error) {
    logTest('System Endpoints', false, error.message);
    return false;
  }
}

// Main test execution
async function runComprehensiveTests() {
  logger.info('🧪 Starting VortexFlow Backend Comprehensive Tests');
  logger.info('=' .repeat(60));

  // Run all tests
  await testHealthCheck();
  await testPublicEndpoints();
  await testAuthentication();
  await testProtectedEndpoints();
  await testUserEndpoints();
  await testSystemEndpoints();

  // Summary
  logger.info('=' .repeat(60));
  logger.info(`📊 Test Results Summary:`);
  logger.info(`✅ Passed: ${testResults.passed}`);
  logger.info(`❌ Failed: ${testResults.failed}`);
  logger.info(`📈 Success Rate: ${Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100)}%`);
  
  if (testResults.failed === 0) {
    logger.info('🎉 ALL TESTS PASSED! Backend is fully operational.');
  } else {
    logger.error('⚠️  Some tests failed. Check the logs above for details.');
  }

  logger.info('=' .repeat(60));
  return testResults.failed === 0;
}

// Execute tests
if (require.main === module) {
  runComprehensiveTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      logger.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { runComprehensiveTests };
