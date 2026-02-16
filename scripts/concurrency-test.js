import http from 'http';
import https from 'https';

/**
 * APPXV Concurrency Test Script
 * This script simulates multiple concurrent SSE connections to test server capacity.
 * 
 * Usage: node scripts/concurrency-test.js <eventId> <connectionsCount>
 */

const eventId = process.argv[2] || 'test-event';
const connectionsCount = parseInt(process.argv[3]) || 50;
const baseUrl = process.argv[4] || 'http://localhost:10000';
const endpoints = [
    `/api/raffle/${eventId}/stream`,
    `/api/confessions/${eventId}/stream`,
    `/api/events/${eventId}/stream`
];

console.log(`\n🚀 Starting Concurrency Test for APPXV`);
console.log(`-----------------------------------------`);
console.log(`📍 Server: ${baseUrl}`);
console.log(`🎯 Event ID: ${eventId}`);
console.log(`👥 Target Connections: ${connectionsCount}`);
console.log(`-----------------------------------------\n`);

let activeConnections = 0;
let errors = 0;
const startTimes = [];

function createConnection(id) {
    const endpoint = endpoints[id % endpoints.length];
    const url = `${baseUrl}${endpoint}?clientId=test-user-${id}`;

    const startTime = Date.now();
    const client = baseUrl.startsWith('https') ? https : http;

    const req = client.get(url, (res) => {
        if (res.statusCode !== 200) {
            console.error(`❌ Connection ${id} failed with status: ${res.statusCode}`);
            errors++;
            return;
        }

        activeConnections++;
        const responseTime = Date.now() - startTime;
        startTimes.push(responseTime);

        if (activeConnections % 10 === 0 || activeConnections === connectionsCount) {
            console.log(`✅ [${activeConnections}/${connectionsCount}] Connections active...`);
        }

        res.on('data', (chunk) => {
            // Keep connection alive, consume data
            // console.log(`📩 Connection ${id} received data`);
        });

        res.on('end', () => {
            activeConnections--;
            // console.log(`🛑 Connection ${id} ended`);
        });
    });

    req.on('error', (err) => {
        errors++;
        console.error(`❌ Connection ${id} error: ${err.message}`);
    });
}

// Gradually open connections to avoid initial burst issues
let i = 0;
const interval = setInterval(() => {
    if (i >= connectionsCount) {
        clearInterval(interval);

        // Final report after all attempts
        setTimeout(() => {
            const avgResponseTime = startTimes.reduce((a, b) => a + b, 0) / startTimes.length || 0;
            console.log(`\n-----------------------------------------`);
            console.log(`📊 TEST RESULTS`);
            console.log(`-----------------------------------------`);
            console.log(`✅ Successful Connections: ${activeConnections}`);
            console.log(`❌ Failed Connections: ${errors}`);
            console.log(`⏱️  Avg Connection Time: ${avgResponseTime.toFixed(2)}ms`);
            console.log(`-----------------------------------------`);
            console.log(`💡 Note: Technical capacity depends on Node.js memory and OS file descriptor limits.`);
            console.log(`💡 Current plan limits apply per event (e.g., Freemium: 20, VIP: 300).`);
            console.log(`-----------------------------------------\n`);

            // Keep connections open for a bit more or exit
            // process.exit(0); 
        }, 2000);
        return;
    }
    createConnection(i);
    i++;
}, 50); // Open 20 connections per second
