import { WebBrowser } from '../src/tools/WebBrowser';

async function runTest() {
    console.log('=== Starting Manual Browser Test ===');

    const browser = new WebBrowser();
    
    try {
        // Test 1: Navigation
        console.log('Step 1: Navigating to Hacker News...');
        const navResult = await browser.navigate('https://news.ycombinator.com/');
        console.log(`Result: ${navResult.split('\n')[0]}`);
        
        if (navResult.includes('Error')) {
            throw new Error(`Navigation failed: ${navResult}`);
        }

        // Test 2: Content Extraction
        console.log('\nStep 2: Extracting content...');
        const content = await browser.extractContent();
        console.log(`Result: ${content.substring(0, 200)}...`);
        
        if (content.includes('Error')) {
            throw new Error('Content extraction failed');
        }

        // Test 3: Semantic Snapshot & Ref targeting
        console.log('\nStep 3: Getting semantic snapshot...');
        const snapshot = await browser.getSemanticSnapshot();
        console.log('Snapshot (first 5 lines):');
        console.log(snapshot.split('\n').slice(0, 10).join('\n'));

        // Find the "new" link ref
        const newLinkMatch = snapshot.match(/link "new" \[ref=(\d+)\]/);
        if (newLinkMatch) {
            const ref = newLinkMatch[1];
            console.log(`\nStep 4: Clicking "new" link using ref=${ref}...`);
            const clickResult = await browser.click(ref);
            console.log(`Result: ${clickResult.split('\n')[0]}`);
            
            const newUrl = browser.page?.url();
            console.log(`New URL: ${newUrl}`);
            
            if (newUrl?.includes('newest')) {
                console.log('✓ Success: Navigated to newest stories');
            } else {
                console.log('⚠ Warning: URL does not match expected "newest"');
            }
        } else {
            console.log('\nStep 4: "new" link not found in snapshot, skipping click test.');
        }

        // Test 5: Search
        console.log('\nStep 5: Testing web search (DuckDuckGo)...');
        const searchResult = await browser.search('Playwright documentation');
        console.log(`Result (first 100 chars): ${searchResult.substring(0, 100)}...`);

    } catch (error) {
        console.error(`\n❌ Test failed: ${error}`);
    } finally {
        console.log('\nClosing browser...');
        await browser.close();
        console.log('=== Test Finished ===');
    }
}

runTest().catch(console.error);
