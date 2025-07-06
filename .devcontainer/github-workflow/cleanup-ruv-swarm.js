#!/usr/bin/env node

/**
 * Cleanup script for ruv-swarm agents
 * This script clears the IndexedDB data that ruv-swarm uses for persistence
 */

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function cleanupRuvSwarm() {
    console.log('🧹 ruv-swarm Cleanup Utility\n');
    
    // Show current status
    console.log('📊 Current Status:');
    try {
        const statusOutput = execSync('npx ruv-swarm status', { encoding: 'utf8' });
        const agentMatch = statusOutput.match(/Total Agents: (\d+)/);
        const swarmMatch = statusOutput.match(/Active Swarms: (\d+)/);
        
        if (agentMatch) {
            console.log(`   Total Agents: ${agentMatch[1]}`);
        }
        if (swarmMatch) {
            console.log(`   Active Swarms: ${swarmMatch[1]}`);
        }
    } catch (error) {
        console.log('   Unable to get status');
    }
    
    console.log('\n⚠️  WARNING: This will delete ALL ruv-swarm data including:');
    console.log('   - All spawned agents');
    console.log('   - All swarm configurations');
    console.log('   - All memory and neural patterns');
    console.log('   - All task history\n');
    
    const answer = await question('Are you sure you want to continue? (yes/no): ');
    
    if (answer.toLowerCase() !== 'yes') {
        console.log('\n❌ Cleanup cancelled');
        rl.close();
        return;
    }
    
    console.log('\n🔄 Attempting to clear ruv-swarm data...\n');
    
    try {
        // Method 1: Try using Node.js to clear IndexedDB directory
        const os = require('os');
        const path = require('path');
        const fs = require('fs');
        
        // Common IndexedDB locations
        const possiblePaths = [
            path.join(os.homedir(), '.config', 'ruv-swarm'),
            path.join(os.homedir(), '.local', 'share', 'ruv-swarm'),
            path.join(os.homedir(), '.ruv-swarm'),
            '/workspaces/devtemplate/.ruv-swarm',
            path.join(process.cwd(), '.ruv-swarm')
        ];
        
        let cleaned = false;
        
        for (const dbPath of possiblePaths) {
            if (fs.existsSync(dbPath)) {
                console.log(`Found data at: ${dbPath}`);
                try {
                    // Remove the directory
                    fs.rmSync(dbPath, { recursive: true, force: true });
                    console.log(`✅ Cleaned: ${dbPath}`);
                    cleaned = true;
                } catch (err) {
                    console.log(`❌ Failed to clean ${dbPath}: ${err.message}`);
                }
            }
        }
        
        // Method 2: Create a fresh initialization with force flag
        console.log('\n🔄 Force reinitializing ruv-swarm...');
        
        // Create a minimal ruv-swarm script that clears data
        const cleanScript = `
import { getDatabase } from 'ruv-swarm';

async function clearAll() {
    try {
        const db = await getDatabase();
        await db.clear('swarms');
        await db.clear('agents');
        await db.clear('tasks');
        await db.clear('memories');
        await db.clear('neural_patterns');
        console.log('✅ Database cleared successfully');
    } catch (error) {
        console.error('Failed to clear database:', error);
    }
}

clearAll();
`;
        
        // Try to execute cleanup via ruv-swarm's internal database
        try {
            fs.writeFileSync('/tmp/ruv-swarm-clear.mjs', cleanScript);
            execSync('node /tmp/ruv-swarm-clear.mjs', { stdio: 'inherit' });
            fs.unlinkSync('/tmp/ruv-swarm-clear.mjs');
        } catch (err) {
            // This might fail if we can't access the internal API
            console.log('⚠️  Direct database clear not available');
        }
        
        // Method 3: Nuclear option - reinitialize with a new empty swarm
        console.log('\n🔄 Creating fresh swarm environment...');
        execSync('npx ruv-swarm init mesh 1 --force', { stdio: 'inherit' });
        
        console.log('\n✅ Cleanup complete!');
        console.log('\n📊 New Status:');
        
        // Show new status
        try {
            const newStatus = execSync('npx ruv-swarm status', { encoding: 'utf8' });
            console.log(newStatus);
        } catch (error) {
            console.log('Status check failed');
        }
        
    } catch (error) {
        console.error('\n❌ Cleanup failed:', error.message);
        console.log('\n💡 Alternative solution:');
        console.log('1. Stop all Node.js processes');
        console.log('2. Clear browser IndexedDB if using web interface');
        console.log('3. Delete ~/.ruv-swarm directory if it exists');
        console.log('4. Run: npx ruv-swarm init --force');
    }
    
    rl.close();
}

// Run the cleanup
cleanupRuvSwarm();