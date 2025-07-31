require('dotenv').config();
const LinearManager = require('../src/integrations/LinearManager');

async function testTEL15Search() {
  const linear = new LinearManager(process.env.LINEAR_API_KEY);

  try {
    console.log('🧪 Testing TEL-15 search functionality...\n');
    
    // Test 1: Direct identifier search
    console.log('1️⃣ Testing direct identifier search...');
    const directResult = await linear.getIssueByIdentifier('TEL-15');
    
    if (directResult) {
      console.log('✅ Found TEL-15 using direct identifier search!');
      console.log(`   Title: ${directResult.title}`);
      console.log(`   Status: ${directResult.state.name}`);
      console.log(`   Team: ${directResult.team?.key || 'No team'}`);
      console.log(`   URL: ${directResult.url}\n`);
    } else {
      console.log('❌ TEL-15 not found using direct identifier search\n');
    }
    
    // Test 1b: Try to get TEL-15 using team and number
    console.log('1️⃣b Testing team + number search...');
    try {
      const numberResult = await linear.getIssueByNumber('TEL', 15);
      if (numberResult) {
        console.log('✅ Found TEL-15 using team + number search!');
        console.log(`   Title: ${numberResult.title}`);
        console.log(`   Status: ${numberResult.state.name}`);
        console.log(`   URL: ${numberResult.url}\n`);
      } else {
        console.log('❌ TEL-15 not found using team + number search\n');
      }
    } catch (error) {
      console.log(`❌ Error with team + number search: ${error.message}\n`);
    }
    
    // Test 2: Text search for TEL-15
    console.log('2️⃣ Testing text search for "TEL-15"...');
    const textResults = await linear.searchIssues('TEL-15', 10);
    
    if (textResults.length > 0) {
      console.log(`✅ Found ${textResults.length} results using text search:`);
      textResults.forEach((result, i) => {
        console.log(`   ${i+1}. ${result.identifier}: ${result.title}`);
        console.log(`      Team: ${result.team?.key || 'No team'} | Status: ${result.state.name}`);
      });
      console.log('');
    } else {
      console.log('❌ No results found using text search\n');
    }
    
    // Test 3: Search for any TEL-* tasks
    console.log('3️⃣ Searching for any TEL-* tasks...');
    const telResults = await linear.searchIssues('TEL', 20);
    const telTasks = telResults.filter(r => r.identifier.startsWith('TEL-'));
    
    if (telTasks.length > 0) {
      console.log(`✅ Found ${telTasks.length} TEL-* tasks:`);
      telTasks.forEach((task, i) => {
        console.log(`   ${i+1}. ${task.identifier}: ${task.title}`);
        console.log(`      Team: ${task.team?.key || 'No team'} | Status: ${task.state.name}`);
      });
      console.log('');
    } else {
      console.log('❌ No TEL-* tasks found\n');
    }
    
    // Test 4: List all teams to understand structure
    console.log('4️⃣ Available teams:');
    const teams = await linear.getTeams();
    teams.forEach(team => {
      console.log(`   • ${team.key}: ${team.name} (${team.issueCount} issues)`);
    });
    
    console.log('\n✅ Test completed!');
    
  } catch (error) {
    console.error('❌ Error during testing:', error.message);
    
    if (!process.env.LINEAR_API_KEY) {
      console.log('\n💡 Please set LINEAR_API_KEY in your .env file');
    }
  }
}

// Run the test
testTEL15Search();