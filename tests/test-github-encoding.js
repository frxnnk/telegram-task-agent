#!/usr/bin/env node

/**
 * Test para GitHub Repository Encoding/Decoding
 * Verifica que los nombres de repos se codifican/decodifican correctamente
 */

// Mock the improved encoding functions from bot.js
const repoNameCache = new Map();

function encodeRepoForCallback(fullName) {
  const basicEncoded = fullName.replace('/', '__SLASH__');
  const fullCallbackData = `github_select_${basicEncoded}`;
  
  // If the full callback data exceeds Telegram's 64-char limit, use hash
  if (fullCallbackData.length > 64) {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(fullName).digest('hex').substring(0, 8);
    repoNameCache.set(hash, fullName);
    return `hash_${hash}`;
  }
  
  return basicEncoded;
}

function decodeRepoFromCallback(encoded) {
  // Check if it's a hash-based encoding
  if (encoded.startsWith('hash_')) {
    const hash = encoded.substring(5);
    const fullName = repoNameCache.get(hash);
    if (!fullName) {
      throw new Error('Repository not found in cache. Please refresh the repository list.');
    }
    return fullName;
  }
  
  // Standard decoding
  return encoded.replace('__SLASH__', '/');
}

function testGitHubEncoding() {
  console.log('🧪 TESTING GitHub Repository Encoding/Decoding');
  console.log('='.repeat(50));

  const testCases = [
    'facebook/react',
    'microsoft/vscode',
    'user_name/repo_name',
    'org-name/project-name',
    'complex_user/complex_repo_name',
    'user/repo_with_underscores_and_dashes'
  ];

  let allPassed = true;

  testCases.forEach((originalRepo, index) => {
    console.log(`\n${index + 1}. Testing: ${originalRepo}`);
    
    // Encode
    const encoded = encodeRepoForCallback(originalRepo);
    console.log(`   Encoded: ${encoded}`);
    
    // Decode
    const decoded = decodeRepoFromCallback(encoded);
    console.log(`   Decoded: ${decoded}`);
    
    // Verify round trip
    const passed = originalRepo === decoded;
    console.log(`   Round trip: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    
    if (!passed) {
      allPassed = false;
      console.log(`   Expected: ${originalRepo}`);
      console.log(`   Got: ${decoded}`);
    }
  });

  console.log('\n' + '='.repeat(50));
  if (allPassed) {
    console.log('🎉 ALL ENCODING TESTS PASSED!');
    console.log('✅ GitHub repository names will be handled correctly');
  } else {
    console.log('❌ SOME ENCODING TESTS FAILED!');
    console.log('⚠️ GitHub integration may have issues with certain repo names');
  }

  // Test callback data length limits
  console.log('\n📏 Testing callback data length limits...');
  const longRepoName = 'very-long-organization-name/very-long-repository-name-with-many-characters';
  const encodedLong = `github_select_${encodeRepoForCallback(longRepoName)}`;
  console.log(`Long callback data: ${encodedLong}`);
  console.log(`Length: ${encodedLong.length} characters`);
  
  if (encodedLong.length > 64) {
    console.log('⚠️ WARNING: Callback data exceeds Telegram 64-char limit');
    console.log('   Consider using shorter encoding or hash-based approach');
  } else {
    console.log('✅ Callback data length within Telegram limits');
  }

  return allPassed;
}

// Execute test if called directly
if (require.main === module) {
  const success = testGitHubEncoding();
  process.exit(success ? 0 : 1);
}

module.exports = { testGitHubEncoding, encodeRepoForCallback, decodeRepoFromCallback };