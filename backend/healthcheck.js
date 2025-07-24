/**
 * Health check script for Docker container
 * 
 * This script performs basic health checks to ensure the application 
 * is running properly. It can be expanded to include database connection
 * checks, API endpoint tests, or other service-specific health validations.
 */

const http = require('http');
const { hostname } = require('os');

// Configuration
const options = {
  host: 'localhost',
  port: process.env.PORT || 3001,
  path: '/api/health',
  timeout: 2000,
  headers: {
    'User-Agent': 'Docker-Healthcheck'
  }
};

// Perform a health check
const healthCheck = () => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let output = '';
      
      res.on('data', (chunk) => {
        output += chunk;
      });
      
      res.on('end', () => {
        try {
          // Parse response if it's JSON
          let response;
          try {
            response = JSON.parse(output);
          } catch (e) {
            response = { status: output.trim() };
          }
          
          // Check if the health endpoint returned a success status
          if (res.statusCode === 200) {
            console.log(`Health check passed: ${res.statusCode} ${JSON.stringify(response)}`);
            resolve();
          } else {
            console.error(`Health check failed: ${res.statusCode} ${JSON.stringify(response)}`);
            reject(new Error(`Health check failed: ${res.statusCode}`));
          }
        } catch (error) {
          console.error(`Error parsing health check response: ${error.message}`);
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error(`Health check request error: ${error.message}`);
      reject(error);
    });
    
    req.on('timeout', () => {
      console.error('Health check request timed out');
      req.destroy();
      reject(new Error('Health check timed out'));
    });
    
    req.end();
  });
};

// Execute health check and exit with appropriate code
healthCheck()
  .then(() => {
    process.exit(0); // Success
  })
  .catch(() => {
    process.exit(1); // Failure
  });