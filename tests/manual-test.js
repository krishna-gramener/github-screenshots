/**
 * Manual test script for the screenshot action
 * 
 * This script allows you to test the screenshot functionality with different parameters
 * Run it with: node tests/manual-test.js
 */

// Set environment variables to simulate GitHub Actions inputs
process.env.GITHUB_WORKSPACE = process.cwd();

// Test case configuration
const testCases = [
  {
    name: 'Basic local server test',
    env: {
      INPUT_URL: 'http://localhost:3000/tests/test.html',
      INPUT_OUTPUT: 'test-results/basic.webp'
    }
  },
  {
    name: 'Multiple URLs test',
    env: {
      INPUT_URL: 'http://localhost:3000/tests/test.html,https://example.com',
      INPUT_OUTPUT: 'test-results/local.webp,test-results/remote.webp'
    }
  },
  {
    name: 'Custom viewport size test',
    env: {
      INPUT_URL: 'http://localhost:3000/tests/test.html',
      INPUT_OUTPUT: 'test-results/custom-viewport.webp',
      INPUT_WIDTH: '1440',
      INPUT_HEIGHT: '900'
    }
  },
  {
    name: 'Different image formats test',
    env: {
      INPUT_URL: 'http://localhost:3000/tests/test.html,http://localhost:3000/tests/test.html,http://localhost:3000/tests/test.html',
      INPUT_OUTPUT: 'test-results/test.webp,test-results/test.png,test-results/test.jpg',
      INPUT_WEBP_OPTIONS: '{"quality":80,"effort":4}',
      INPUT_PNG_OPTIONS: '{"quality":95}',
      INPUT_JPEG_OPTIONS: '{"quality":85,"progressive":true}'
    }
  }
];

// Create test-results directory if it doesn't exist
const fs = require('fs');
const path = require('path');
const testResultsDir = path.join(process.cwd(), 'test-results');
if (!fs.existsSync(testResultsDir)) {
  fs.mkdirSync(testResultsDir);
}

// Run the selected test case
async function runTest(testCaseIndex) {
  if (testCaseIndex === undefined) {
    console.log('Available test cases:');
    testCases.forEach((testCase, index) => {
      console.log(`${index}: ${testCase.name}`);
    });
    console.log('\nRun a specific test with: node tests/manual-test.js <test-number>');
    return;
  }
  
  const testCase = testCases[testCaseIndex];
  if (!testCase) {
    console.error(`Test case ${testCaseIndex} not found`);
    return;
  }
  
  console.log(`Running test: ${testCase.name}`);
  console.log('Environment variables:');
  
  // Set environment variables for this test
  Object.entries(testCase.env).forEach(([key, value]) => {
    process.env[key] = value;
    console.log(`  ${key}=${value}`);
  });
  
  console.log('\nStarting test...\n');
  
  try {
    // Import the screenshot script
    require('../screenshot.js');
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Get test case index from command line argument
const testCaseIndex = process.argv[2] ? parseInt(process.argv[2], 10) : undefined;
runTest(testCaseIndex);
