const { spawn } = require('child_process');

const npx = spawn('npx', [
    'hardhat',
    'node',
    '--fork', 'https://bsc-dataseed1.binance.org',
    '--port', '8545',
    '--hostname', '0.0.0.0'
], {
    stdio: 'inherit',
    cwd: process.cwd()
});

npx.on('close', (code) => {
    console.log(`BSC fork node exited with code ${code}`);
});

process.on('SIGINT', () => {
    npx.kill('SIGINT');
});

process.on('SIGTERM', () => {
    npx.kill('SIGTERM');
});
