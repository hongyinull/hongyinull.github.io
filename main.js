document.addEventListener('DOMContentLoaded', () => {
    // Check if siteData exists
    if (!window.siteData) {
        console.error("Site data not loaded");
        return;
    }

    const { bio, projects } = window.siteData;

    renderHeader(bio);
    renderFilterMenu(projects);
    renderProjects(projects); // Initial render with all projects
    renderMedia();
    initThemeToggle();

    // Apply special typography concept
    stylizeTypography(document.body);
    // Initialize Typography Effects
    initTypographyEffects();
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
        // Process if contains l, L, I, /, \, or ＼ (Fullwidth Backslash)
        if ((/[lLI/\\\uFF3C]/.test(node.nodeValue)) &&
            node.parentElement.tagName !== 'SCRIPT' &&
            node.parentElement.tagName !== 'STYLE') {
            nodesToReplace.push(node);
        }
    }

    nodesToReplace.forEach(node => {
        const fragment = document.createDocumentFragment();
        const text = node.nodeValue;
        let lastIndex = 0;

        // Regex to find l, L, I, /, \, or ＼
        const regex = /[lLI/\\\uFF3C]/g;
        let match;

        while ((match = regex.exec(text)) !== null) {
            // Append text before match
            fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));

            const char = match[0];

            if (char === '/' || char === '\\' || char === '\uFF3C') {
                // Replace / with \ and wrap in span for animation
                // Also wrap existing \ and ＼
                const span = document.createElement('span');
                span.className = 'slant-char backslash'; // Add specific class for backslash
                span.textContent = '\\'; // Normalize to normal backslash
                fragment.appendChild(span);
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

// Typography Effects
let animationFrameId;

function initTypographyEffects() {
    // Start Loop directly, no toggle button
    startEffectLoop();
}

function startEffectLoop() {
    let mouseX = 0;
    let mouseY = 0;

    const updateMouse = (x, y) => {
        mouseX = x;
        mouseY = y;
    };

    document.addEventListener('mousemove', (e) => {
        updateMouse(e.clientX, e.clientY);
    });

    // Add touch support for mobile
    document.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) {
            updateMouse(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: true });

    const lerp = (start, end, factor) => {
        return start + (end - start) * factor;
    };

    const loop = () => {
        const chars = document.querySelectorAll('.slant-char');

        chars.forEach(char => {
            const rect = char.getBoundingClientRect();
            const charX = rect.left + rect.width / 2;
            const charY = rect.top + rect.height / 2;

            // Calculate vector to mouse
            const deltaX = mouseX - charX;
            const deltaY = mouseY - charY;
            const dist = Math.hypot(deltaX, deltaY);
            const maxDist = 600; // Distance threshold

            let targetSkew = 0;

            // Only update target if within distance
            if (dist < maxDist) {
                // Use atan(dx/dy) to get the slope angle relative to Vertical
                let angleDeg = Math.atan(deltaX / deltaY) * (180 / Math.PI);

                // Handle case where deltaY is 0
                if (deltaY === 0) {
                    angleDeg = deltaX > 0 ? 90 : -90;
                }

                // Clamp to [-10, 20]
                let skew = Math.max(-10, Math.min(20, angleDeg));

                if (char.classList.contains('backslash')) {
                    // Backslash has inherent slant (-15deg).
                    // Applied skew = skew - 15
                    targetSkew = skew - 15;
                } else {
                    targetSkew = skew;
                }
            } else {
                // If out of range, return to default (gracefully via lerp)
                // Default: l=15deg (Brand Slant), \=0deg (Natural Slant)
                targetSkew = char.classList.contains('backslash') ? 0 : 15;
            }

            // Store target for next frame (for the freeze effect)
            char.targetSkew = targetSkew;

            // Initialize currentSkew if not present
            if (typeof char.currentSkew === 'undefined') {
                char.currentSkew = targetSkew;
            }

            // Smoothly interpolate towards target
            char.currentSkew = lerp(char.currentSkew, targetSkew, 0.08);

            char.style.transform = `skewX(${char.currentSkew}deg)`;
        });

        animationFrameId = requestAnimationFrame(loop);
    };
    loop();
}

function renderFilterMenu(projects) {
    const container = document.querySelector('.projects-section');
    const list = document.querySelector('.project-list');
    if (!container || !list) return;

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
    // Check if toggle already exists
    if (document.querySelector('.theme-toggle')) return;

    const btn = document.createElement('button');
    btn.className = 'theme-toggle';
    btn.setAttribute('aria-label', 'Toggle Dark Mode');

    // Append to Header Title row
    const headerTitle = document.querySelector('.site-title');
    if (headerTitle) {
        headerTitle.appendChild(btn);
    } else {
        document.body.appendChild(btn);
    }

    // Icons
    const sunIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;

    const moonIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

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
        const cnLines = bio.introCn.map((line) => {
            // Uniform style for all lines, handled by CSS now
            return `<div>${line}</div>`;
        }).join('');

        bioEl.innerHTML = `
            <div class="bio-en">${bio.introEn}</div>
            <div class="bio-cn">
                ${cnLines}
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
                <a href="${item.url}" target="_blank" class="info-label">${item.label} <span class="link-arrow">-></span></a>
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

const renderMedia = () => {
    const container = document.getElementById('media-list');
    if (!container) return;

    const media = window.siteData.media || [];

    media.forEach(item => {
        const div = document.createElement('a');
        div.href = item.url;
        div.target = "_blank";
        div.className = 'experiment-item'; // Keep same class for styling
        div.style.textDecoration = 'none';
        div.style.color = 'inherit';
        div.innerHTML = `
            <span class="experiment-title">${item.title}</span>
            <span class="experiment-category">${item.source} \\ ${item.year}</span>
        `;
        container.appendChild(div);
    });
};

function renderProjects(projects) {
    const container = document.querySelector('.project-list');
    if (!container) return;

    container.innerHTML = ''; // Clear existing

    projects.forEach(project => {
        const item = document.createElement('a');
        item.href = `projects/${project.id}.html`; // Link to static page
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
