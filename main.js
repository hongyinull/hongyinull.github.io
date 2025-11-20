document.addEventListener('DOMContentLoaded', () => {
    // Check if siteData exists
    if (!window.siteData) {
        console.error("Site data not loaded");
        return;
    }

    const { bio, projects, experiments } = window.siteData;

    renderHeader(bio);
    renderFilterMenu(projects);
    renderProjects(projects); // Initial render with all projects
    renderExperiments(experiments);
    initThemeToggle();

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
                // Replace / with \ (no slant class needed, just char replacement)
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

function renderFilterMenu(projects) {
    const container = document.querySelector('.projects-section');
    const list = document.querySelector('.project-list');

    // Extract all unique tags
    const tags = new Set(['All']);
    projects.forEach(p => {
        if (p.category) {
            // Split by backslash (escaped)
            p.category.split('\\').forEach(tag => {
                tags.add(tag.trim());
            });
        }
    });

    // Create Menu
    const menu = document.createElement('div');
    menu.className = 'filter-menu';

    tags.forEach(tag => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        if (tag === 'All') btn.classList.add('active');
        btn.textContent = tag;

        btn.addEventListener('click', () => {
            // Update active state
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Filter projects
            if (tag === 'All') {
                renderProjects(projects);
            } else {
                const filtered = projects.filter(p => p.category && p.category.includes(tag));
                renderProjects(filtered);
            }

            // Re-apply typography to new content
            stylizeTypography(list);
        });

        menu.appendChild(btn);
    });

    // Insert before project list
    container.insertBefore(menu, list);
}

function initThemeToggle() {
    const btn = document.createElement('button');
    btn.className = 'theme-toggle';
    btn.setAttribute('aria-label', 'Toggle Dark Mode');
    document.body.appendChild(btn);

    // Icons
    const sunIcon = `<svg viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.29 1.29c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.29 1.29c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41l-1.29-1.29zm1.41-13.78c-.39-.39-1.02-.39-1.41 0a.996.996 0 000 1.41l1.29 1.29c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41l-1.29-1.29zM7.28 17.28c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l1.29 1.29c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41l-1.29-1.29z"/></svg>`;

    const moonIcon = `<svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/></svg>`;

    const updateIcon = (isDark) => {
        btn.innerHTML = isDark ? sunIcon : moonIcon;
    };

    // Load saved theme
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

function renderHeader(bio) {
    // Bio
    const bioEl = document.querySelector('.bio-intro');
    if (bioEl) {
        // Render English and Chinese with variants
        bioEl.innerHTML = `
            <div class="bio-en" style="margin-bottom: 1.5rem; font-weight: 400;">${bio.introEn}</div>
            <div class="bio-cn" style="font-size: 1.1em; line-height: 1.8;">
                <div style="font-weight: 400;">${bio.introCn[0]}</div>
                <div style="font-weight: 600; margin-top: 0.5rem;">${bio.introCn[1]}</div>
                <div style="font-weight: 300; margin-top: 0.5rem; opacity: 0.9;">${bio.introCn[2]}</div>
            </div>
        `;
    }

    // Contact
    const contactList = document.querySelector('.contact-list');
    if (contactList) {
        bio.contact.forEach(item => {
            const li = document.createElement('li');
            li.className = 'info-item';
            li.innerHTML = `
                <a href="${item.url}" target="_blank" class="info-label">${item.label} ↗</a>
            `;
            contactList.appendChild(li);
        });
    }

    // Experience
    const expList = document.querySelector('.exp-list');
    if (expList) {
        bio.experience.forEach(item => {
            const li = document.createElement('li');
            li.className = 'info-item';
            li.innerHTML = `
                <span class="info-label">${item.role}</span>
                <span class="info-value">${item.company} ${item.year}</span>
            `;
            expList.appendChild(li);
        });
    }
}

function renderProjects(projects) {
    const container = document.querySelector('.project-list');
    if (!container) return;

    container.innerHTML = ''; // Clear existing

    projects.forEach(project => {
        const item = document.createElement('a');
        item.href = `project.html?id=${project.id}`; // Link to detail page
        item.className = 'project-item';
        item.style.textDecoration = 'none'; // Remove default underline
        item.style.cursor = 'pointer';

        item.innerHTML = `
            <div class="project-main">
                <div class="project-title">${project.title}</div>
                <div class="project-desc">${project.description}</div>
            </div>
            <div class="project-meta">
                <span>${project.category}</span>
                <span>${project.year}</span>
            </div>
        `;
        container.appendChild(item);
    });
}

function renderExperiments(experiments) {
    const container = document.querySelector('.experiment-list');
    if (!container) return;

    experiments.forEach(exp => {
        const item = document.createElement('div');
        item.className = 'experiment-item';
        item.innerHTML = `
            <span>${exp.title}</span>
            <span style="color: var(--meta-color);">${exp.category}</span>
        `;
        container.appendChild(item);
    });
}
