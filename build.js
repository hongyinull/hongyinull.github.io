const fs = require('fs');
const path = require('path');

// Mock window object to load data.js
global.window = {};
const siteData = require('./data.js');

const templatePath = path.join(__dirname, 'project_template.html');
const outputDir = path.join(__dirname, 'projects');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

const template = fs.readFileSync(templatePath, 'utf8');

console.log('Starting build process...');

siteData.projects.forEach(project => {
    let html = template;

    // Prepare data
    const title = project.title;
    const description = project.description || '';
    const category = project.category || '';
    const year = project.year || '';
    const content = project.content || `<p>${description}</p>`;
    const url = `https://hongyinull.github.io/projects/${project.id}.html`;

    // JSON-LD
    const schema = {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        "name": title,
        "headline": title,
        "author": {
            "@type": "Person",
            "name": "HongYinull"
        },
        "description": description,
        "dateCreated": year,
        "genre": category,
        "url": url
    };

    // Replace placeholders
    html = html.replace(/{{TITLE}}/g, title);
    html = html.replace(/{{DESCRIPTION}}/g, description);
    html = html.replace(/{{CATEGORY}}/g, category);
    html = html.replace(/{{YEAR}}/g, year);
    html = html.replace(/{{CONTENT}}/g, content);
    html = html.replace(/{{URL}}/g, url);
    html = html.replace(/{{JSON_LD}}/g, JSON.stringify(schema, null, 2));

    // Write file
    const outputPath = path.join(outputDir, `${project.id}.html`);
    fs.writeFileSync(outputPath, html);
    console.log(`Generated: projects/${project.id}.html`);
});

console.log('Build complete! Static files are ready in /projects folder.');
