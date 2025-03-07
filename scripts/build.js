const fs = require('fs').promises;
const path = require('path');
const { marked } = require('marked');

// Add gray-matter for frontmatter parsing
const matter = require('gray-matter');

async function readTemplate(name) {
    return await fs.readFile(`src/templates/${name}.html`, 'utf-8');
}

async function readPartial(name) {
    return await fs.readFile(`src/templates/partials/${name}.html`, 'utf-8');
}

async function ensureDir(dir) {
    await fs.mkdir(dir, { recursive: true });
}

async function processMarkdown(content) {
    return marked(content, {
        gfm: true,
        breaks: true,
        smartLists: true
    });
}

async function applyTemplate(template, data) {
    // First replace partials
    const header = await readPartial('header');
    const footer = await readPartial('footer');
    
    let result = template
        .replace('{{header}}', header)
        .replace('{{footer}}', footer);
    
    // Then replace data variables
    for (const [key, value] of Object.entries(data)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        result = result.replace(regex, value || '');
    }
    
    return result;
}

async function buildBlogPosts() {
    const blogTemplate = await readTemplate('blog');
    const blogDir = 'src/blog';
    const outputDir = 'dist/blog';
    await ensureDir(outputDir);
    
    const posts = [];
    const files = await fs.readdir(blogDir);
    
    for (const file of files) {
        if (file.endsWith('.md')) {
            const content = await fs.readFile(path.join(blogDir, file), 'utf-8');
            const { data, content: markdown } = matter(content);
            const html = await processMarkdown(markdown);
            
            // Generate URL-friendly slug from filename
            const slug = file.replace('.md', '');
            const url = `/blog/${slug}`;
            
            // Store post data for the listing page
            posts.push({
                ...data,
                url,
                excerpt: markdown.split('\n').slice(0, 2).join('\n'), // Simple excerpt from first 2 lines
                date: data.date ? new Date(data.date).toLocaleDateString() : 'Undated'
            });
            
            // Generate individual blog post
            const postHtml = await applyTemplate(blogTemplate, {
                title: `${data.title || 'Untitled'} - My Blog`,
                date: data.date ? new Date(data.date).toLocaleDateString() : '',
                content: html,
                styles: ''
            });
            
            await fs.writeFile(path.join(outputDir, `${slug}.html`), postHtml);
        }
    }
    
    // Sort posts by date
    posts.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Generate blog listing page
    const listTemplate = await readTemplate('blog-list');
    const postsHtml = await Promise.all(posts.map(async post => {
        const processedExcerpt = await processMarkdown(post.excerpt);
        return `
            <article class="blog-preview">
                <h2><a href="${post.url}">${post.title}</a></h2>
                <div class="blog-preview-meta">
                    <time datetime="${post.date}">${post.date}</time>
                </div>
                <p>${processedExcerpt}</p>
                <a href="${post.url}" class="read-more">Read more →</a>
            </article>
        `;
    }));
    
    const listHtml = await applyTemplate(listTemplate, {
        title: 'Blog - My Site',
        posts: postsHtml.join('\n'),
        styles: ''
    });
    
    await fs.writeFile(path.join('dist', 'blog', 'index.html'), listHtml);
}

async function buildSite() {
    try {
        // Create dist directory
        await ensureDir('dist');
        
        // Copy index.html directly
        await fs.copyFile('src/index.html', 'dist/index.html');
        
        // Build blog posts
        await buildBlogPosts();
        
        // Read template
        const template = await readTemplate('base');
        
        // Read and process markdown files
        const contentDir = 'src/content';
        const files = await fs.readdir(contentDir);
        
        for (const file of files) {
            if (file.endsWith('.md')) {
                const content = await fs.readFile(path.join(contentDir, file), 'utf-8');
                const html = await processMarkdown(content);
                
                // Use template for all markdown files
                const page = await applyTemplate(template, {
                    content: html,
                    title: 'My Site',
                    styles: ''
                });
                
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