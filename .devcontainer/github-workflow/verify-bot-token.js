#!/usr/bin/env node
const https = require('https');

async function verifyToken(token, tokenName) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            port: 443,
            path: '/user',
            method: 'GET',
            headers: {
                'Authorization': `token ${token}`,
                'User-Agent': 'Bot-Token-Verifier'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const user = JSON.parse(data);
                    if (user.login) {
                        console.log(`✅ ${tokenName}: ${user.login} (ID: ${user.id})`);
                        resolve(user);
                    } else {
                        console.log(`❌ ${tokenName}: Invalid token or error`);
                        console.log(`   Response: ${data}`);
                        reject(new Error(`Invalid token: ${tokenName}`));
                    }
                } catch (error) {
                    console.log(`❌ ${tokenName}: Parse error`);
                    console.log(`   Raw response: ${data}`);
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            console.log(`❌ ${tokenName}: Network error`);
            reject(error);
        });

        req.end();
    });
}

async function main() {
    console.log('🔍 Verifying GitHub tokens...\n');
    
    const tokens = [
        { name: 'GITHUB_PERSONAL_ACCESS_TOKEN', value: process.env.GITHUB_PERSONAL_ACCESS_TOKEN },
        { name: 'GITHUB_PAT', value: process.env.GITHUB_PAT },
        { name: 'AGENT_TOKEN', value: process.env.AGENT_TOKEN }
    ];

    for (const token of tokens) {
        if (token.value) {
            try {
                await verifyToken(token.value, token.name);
            } catch (error) {
                // Error already logged in verifyToken
            }
        } else {
            console.log(`⚠️  ${token.name}: Not set`);
        }
    }

    console.log('\n📝 Next steps:');
    console.log('1. Log into your BOT account (not your main account)');
    console.log('2. Go to Settings → Developer settings → Personal access tokens');
    console.log('3. Generate new token with "repo" scope');
    console.log('4. Replace the token in your environment variables');
    console.log('5. Run this script again to verify');
}

main().catch(console.error);