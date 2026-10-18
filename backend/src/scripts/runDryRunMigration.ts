import axios from 'axios';

const BACKEND_URL = 'http://localhost:5000';

async function runDryRunMigration(): Promise<void> {
  try {
    console.log('Starting dry-run migration...');
    const response = await axios.post(
      `${BACKEND_URL}/api/migrations/session-term-period`,
      {},
      {
        params: { dryRun: 'true' },
      }
    );

    console.log('\n=== DRY RUN RESULTS ===');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('✗ Migration failed:', error.response?.data || error.message);
    throw error;
  }
}

async function main(): Promise<void> {
  try {
    await runDryRunMigration();
  } catch (error) {
    console.error('\n✗ Script failed');
    process.exit(1);
  }
}

main();
