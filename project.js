document.addEventListener('DOMContentLoaded', () => {
    if (!window.siteData) {
        console.error("Site data not loaded");
        return;
    }

    initThemeToggle();
    loadProject();

    // Apply special typography concept
    stylizeTypography(document.body);
});

function stylizeTypography(root) {
    const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    const nodesToReplace = [];
    let node;
    while (node = walker.nextNode()) {
        // Process if contains l, L, I OR forward slash /
        if ((/[lLI/]/.test(node.nodeValue)) &&
            node.parentElement.tagName !== 'SCRIPT' &&
            node.parentElement.tagName !== 'STYLE') {
            nodesToReplace.push(node);
        }
    }

    nodesToReplace.forEach(node => {
        const fragment = document.createDocumentFragment();
        const text = node.nodeValue;
        let lastIndex = 0;

        // Regex to find l, L, I OR /
        const regex = /[lLI/]/g;
        let match;

        while ((match = regex.exec(text)) !== null) {
            // Append text before match
            fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));

            const char = match[0];

            if (char === '/') {
                // Replace / with \
                fragment.appendChild(document.createTextNode('\\'));
            } else {
                // Stylize l, L, I
                const span = document.createElement('span');
                span.className = 'slant-char';
                span.textContent = char;
                fragment.appendChild(span);
            }

            lastIndex = regex.lastIndex;
        }

        // Append remaining text
        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
        node.parentNode.replaceChild(fragment, node);
    });
}

function loadProject() {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('id');

    if (!projectId) {
        window.location.href = 'index.html';
        return;
    }

    // Search in both projects and experiments
    const project = window.siteData.projects.find(p => p.id === projectId) ||
        window.siteData.experiments.find(e => e.id === projectId);

    if (!project) {
        document.getElementById('project-container').innerHTML = '<p>Project not found.</p>';
        return;
    }

    renderProjectDetail(project);
    updateSEO(project);
}

function updateSEO(project) {
    // 1. Update Title
    document.title = `${project.title} - HongYinull`;

    // 2. Update Meta Description
    const description = project.description || `Details about ${project.title}`;
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = "description";
        document.head.appendChild(metaDesc);
    }
    metaDesc.content = description;

    // 3. Update Open Graph
    const updateMeta = (property, content) => {
        let tag = document.querySelector(`meta[property="${property}"]`);
        if (!tag) {
            tag = document.createElement('meta');
            tag.setAttribute('property', property);
            document.head.appendChild(tag);
        }
        tag.content = content;
    };

    updateMeta('og:title', project.title);
    updateMeta('og:description', description);
    updateMeta('og:url', window.location.href);

    // 4. Inject JSON-LD for AI (Schema.org/CreativeWork)
    const schema = {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        "name": project.title,
        "headline": project.title,
        "author": {
            "@type": "Person",
            "name": "HongYinull"
        },
        "description": description,
        "dateCreated": project.year,
        "genre": project.category,
        "url": window.location.href
    };

    let script = document.querySelector('#project-jsonld');
    if (!script) {
        script = document.createElement('script');
        script.id = 'project-jsonld';
        script.type = 'application/ld+json';
        document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(schema, null, 2);
}

function renderProjectDetail(project) {
    const container = document.getElementById('project-container');

    // Use content if available, otherwise fallback to description
    const content = project.content || `<p>${project.description}</p>`;

    container.innerHTML = `
        <h1 class="project-detail-title">${project.title}</h1>
        <div class="project-detail-meta">
            <span>${project.category}</span>
            <span>${project.year}</span>
        </div>
        <div class="project-content">
            ${content}
        </div>
    `;
}

// Reusing Theme Toggle Logic
function initThemeToggle() {
    const btn = document.createElement('button');
    btn.className = 'theme-toggle';
    btn.setAttribute('aria-label', 'Toggle Dark Mode');
    document.body.appendChild(btn);

    const sunIcon = `<svg viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.29 1.29c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.29 1.29c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41l-1.29-1.29zm1.41-13.78c-.39-.39-1.02-.39-1.41 0a.996.996 0 000 1.41l1.29 1.29c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41l-1.29-1.29zM7.28 17.28c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l1.29 1.29c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41l-1.29-1.29z"/></svg>`;

    const moonIcon = `<svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/></svg>`;

    const updateIcon = (isDark) => {
        btn.innerHTML = isDark ? sunIcon : moonIcon;
    };

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        updateIcon(true);
    } else {
        updateIcon(false);
    }

    btn.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        const isDark = document.body.classList.contains('dark-theme');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updateIcon(isDark);
    });
}
