import axios from 'axios';

const BACKEND_URL = 'http://localhost:5000';

async function loginAdmin(): Promise<string> {
  try {
    const response = await axios.post(`${BACKEND_URL}/api/auth/login`, {
      email: 'admin@ijebuodecollege.com',
      password: 'admin123',
    });

    if (response.data.token) {
      console.log('✓ Admin login successful');
      return response.data.token;
    } else {
      throw new Error('No token received');
    }
  } catch (error: any) {
    console.error('✗ Admin login failed:', error.response?.data || error.message);
    throw error;
  }
}

async function runLiveMigration(token: string): Promise<void> {
  try {
    console.log('\nStarting LIVE migration...');
    console.log('WARNING: This will modify production data!');
    console.log('Press Ctrl+C to cancel now...\n');

    // Wait 3 seconds to allow cancellation
    await new Promise(resolve => setTimeout(resolve, 3000));

    const response = await axios.post(
      `${BACKEND_URL}/api/migrations/session-term-period`,
      {},
      {
        params: {}, // No dryRun parameter = live migration
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log('\n=== LIVE MIGRATION RESULTS ===');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('✗ Migration failed:', error.response?.data || error.message);
    throw error;
  }
}

async function main(): Promise<void> {
  try {
    const token = await loginAdmin();
    await runLiveMigration(token);
  } catch (error) {
    console.error('\n✗ Script failed');
    process.exit(1);
  }
}

main();
