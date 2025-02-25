const fs = require('fs').promises;
const path = require('path');
const { marked } = require('marked');

async function buildSite() {
    try {
        // Create dist directory
        await fs.mkdir('dist', { recursive: true });
        
        // Read template
        const template = await fs.readFile('src/templates/base.html', 'utf-8');
        
        // Read and process markdown files
        const contentDir = 'src/content';
        const files = await fs.readdir(contentDir);
        
        for (const file of files) {
            if (file.endsWith('.md')) {
                const content = await fs.readFile(path.join(contentDir, file), 'utf-8');
                const html = marked(content);
                
                // Simple template replacement
                const page = template
                    .replace('{{content}}', html)
                    .replace('{{title}}', 'My Site'); // You can extract title from markdown later
                
                // Write HTML file
                const outFile = file.replace('.md', '.html');
                await fs.writeFile(path.join('dist', outFile), page);
            }
        }
        
        // Copy static assets
        await fs.cp('src/public', 'dist', { recursive: true });
        
    } catch (error) {
        console.error('Build failed:', error);
    }
}

buildSite(); 