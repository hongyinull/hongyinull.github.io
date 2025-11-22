document.addEventListener('DOMContentLoaded', () => {
    // Check if siteData exists
    if (!window.siteData) {
        console.error("Site data not loaded");
        // Display Error to User
        document.body.innerHTML = `
            <div style="height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; font-family: monospace; background: #f0f0f0; color: #333; padding: 2rem;">
                <h2 style="color: #e74c3c; margin-bottom: 1rem;">⚠️ Data Loading Error</h2>
                <p style="max-width: 600px; line-height: 1.6;">
                    The website content could not be loaded. This is usually caused by a syntax error in <strong>data.js</strong> (e.g., a missing comma, quote, or bracket).
                </p>
                <p style="margin-top: 1rem; font-size: 0.9rem; color: #666;">
                    Please check the console (F12) for specific error details.
                </p>
            </div>
        `;
        return;
    }

    const { bio, projects } = window.siteData;

    renderHeader(bio);
    renderFilterMenu(projects);
    renderProjects(projects); // Initial render with all projects
    renderMedia();
    initThemeToggle();
    initLanguageToggle();

    // Initialize Typography Effects Animation Loop
    initTypographyEffects();

    // Bio Animations (Requested by User)
    // initBioAnimations(); // Debug panel removed

    // Default Animation (Pixelate) is now triggered by renderHeader()
    // Removed redundant setTimeout call here to prevent double-triggering bug.

    // Handle Deep Linking (Hash Scroll)
    handleHashScroll();
});

function handleHashScroll() {
    const hash = window.location.hash;
    if (hash) {
        // Wait for dynamic content to render
        setTimeout(() => {
            const target = document.querySelector(hash);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        }, 300); // Small delay to ensure DOM is ready
    }
}

// --- Animation Implementations ---

function animatePixelate(element) {
    if (!element) return;

    // Prevent Double Animation & Dirty Reads
    // 1. Clear existing interval if running
    if (element.dataset.animInterval) {
        clearInterval(parseInt(element.dataset.animInterval));
        element.dataset.animInterval = '';
    }

    // 2. Get Clean Text
    // If we already saved the original text, use it. Otherwise, save current innerText.
    // This prevents reading "████" as the text if animation is re-triggered mid-way.
    if (!element.dataset.originalText) {
        element.dataset.originalText = element.innerText;
    }
    const text = element.dataset.originalText;

    const blocks = ['█', '▓', '▒', '░'];
    const cjkRegex = /[\u4E00-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/;
    const slantRegex = /[lLI/\\\uFF3C]/;

    // 1. Prepare Container
    // Ensure white-space is handled correctly for newlines
    element.style.whiteSpace = 'pre-wrap';

    // Clear content but keep visibility (we will hide individual chars)
    element.innerHTML = '';

    const wrappers = [];

    // 2. Build DOM: Wrappers with Invisible Real Char + Absolute Block
    for (let i = 0; i < text.length; i++) {
        let char = text[i];

        if (char === '\n') {
            element.appendChild(document.createTextNode('\n'));
            continue;
        }

        // Normalize slashes for Slant effect
        if (/[/\\\uFF3C]/.test(char)) {
            char = '\\';
        }

        // Create Wrapper
        const wrapper = document.createElement('span');
        wrapper.dataset.final = char;
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline'; // Default to inline to preserve kerning

        // Apply Classes
        let isSpecial = false;
        if (cjkRegex.test(char)) {
            wrapper.classList.add('cjk-char');
            // cjk-char might need inline-block in CSS, but here we let CSS handle it
            // If CSS says inline-block, wrapper becomes inline-block.
            isSpecial = true;
        }
        if (slantRegex.test(char) || char === '\\') {
            wrapper.classList.add('slant-char');
            if (char === '\\') {
                wrapper.classList.add('backslash');
            }
            // .slant-char is inline-block in CSS, so this wrapper will be inline-block
            isSpecial = true;
        }
        wrapper.dataset.isSpecial = isSpecial;

        // 1. Real Char (Invisible placeholder for layout)
        const realChar = document.createElement('span');
        realChar.textContent = char;
        realChar.style.opacity = '0'; // Invisible but takes up space
        wrapper.appendChild(realChar);

        // 2. Block Overlay (Visible animation)
        // Skip blocks for spaces
        let block = null;
        if (char !== ' ') {
            block = document.createElement('span');
            block.textContent = blocks[0];
            block.style.position = 'absolute';
            block.style.left = '0';
            block.style.bottom = '0'; // Align to baseline
            block.style.color = 'var(--text-color)';
            block.style.pointerEvents = 'none'; // Don't block interaction
            block.style.whiteSpace = 'nowrap'; // Prevent wrapping
            // Note: We don't clip width here, allowing "glitch" bleed effect
            // which is better than layout shift.
            wrapper.appendChild(block);
        }

        element.appendChild(wrapper);
        wrappers.push({ wrapper, realChar, block, char });
    }

    let steps = 12;
    let currentStep = 0;
    let isFinished = false;

    const cleanup = () => {
        if (isFinished) return;
        isFinished = true;

        if (element.dataset.animInterval) {
            clearInterval(parseInt(element.dataset.animInterval));
            element.dataset.animInterval = '';
        }

        // Restore DOM to clean state
        wrappers.forEach(item => {
            const { wrapper, char } = item;

            // If special (CJK/Slant), keep the wrapper (it has the class)
            // but remove the inner spans (realChar/block) and just set text
            if (wrapper.dataset.isSpecial === 'true') {
                wrapper.innerHTML = '';
                wrapper.textContent = char;
                wrapper.style.position = '';
                wrapper.style.display = '';
            } else {
                // If normal char, replace wrapper with simple text node
                // This restores perfect original DOM structure (no extra spans)
                const textNode = document.createTextNode(char);
                wrapper.parentNode.replaceChild(textNode, wrapper);
            }
        });

        // Re-apply global styles safely (just in case, though structure should be correct)
        // Actually, since we manually reconstructed the structure with classes,
        // we might not need this, but it's safe to run for any missed listeners.
        try {
            // applyGlobalStyles(element); // Skipped to prevent any jump
        } catch (e) { }
    };

    const interval = setInterval(() => {
        try {
            wrappers.forEach(item => {
                const { wrapper, realChar, block, char } = item;

                // Skip spaces or already revealed
                if (!block || wrapper.dataset.revealed === 'true') return;

                if (Math.random() > 0.3) {
                    const progress = currentStep / steps;

                    if (progress >= 1) {
                        // Reveal
                        realChar.style.opacity = '1';
                        if (block) block.style.display = 'none';
                        wrapper.dataset.revealed = 'true';
                    } else {
                        const blockIndex = Math.floor(progress * blocks.length);
                        if (Math.random() < progress * 0.5) {
                            // Flash real char
                            block.textContent = char;
                        } else {
                            block.textContent = blocks[Math.min(blockIndex, blocks.length - 1)];
                        }
                    }
                }
            });

            currentStep++;
            if (currentStep > steps + 5) {
                cleanup();
            }
        } catch (e) {
            console.error("Animation error:", e);
            cleanup();
        }
    }, 80);

    // Store interval ID
    element.dataset.animInterval = interval;

    // Safety Timeout
    setTimeout(cleanup, (steps + 10) * 80 + 500);
}

let currentLang = localStorage.getItem('lang') || 'en'; // Load saved lang

function initLanguageToggle() {
    // Check if toggle already exists
    if (document.querySelector('.lang-toggle')) return;

    const btn = document.createElement('button');
    btn.className = 'control-btn lang-toggle'; // Use shared class
    // Initial Text
    btn.textContent = currentLang === 'en' ? '中' : 'EN';

    // Removed inline styles, handled in CSS

    btn.addEventListener('click', () => {
        currentLang = currentLang === 'en' ? 'cn' : 'en';
        localStorage.setItem('lang', currentLang); // Save preference
        btn.textContent = currentLang === 'en' ? '中' : 'EN';
        updateContent();

        // Trigger Animation on switch
        const bioEl = document.querySelector('.bio-intro');
        if (bioEl) {
            const target = bioEl.querySelector(currentLang === 'en' ? '.bio-en' : '.bio-cn');
            if (target) animatePixelate(target);
        }
    });

    // Append to Header Controls
    const controls = document.querySelector('.header-controls');
    if (controls) {
        controls.appendChild(btn);
    } else {
        // Fallback
        const headerTitle = document.querySelector('.site-title');
        if (headerTitle) headerTitle.appendChild(btn);
    }
}

function updateContent() {
    const { bio, projects } = window.siteData;
    renderHeader(bio);
    renderProjects(projects);
    // Re-apply global styles
    applyGlobalStyles(document.body);
}

function applyGlobalStyles(root) {
    if (!root) return;
    // 1. Scale CJK characters
    stylizeCJK(root);
    // 2. Apply Slant effects
    stylizeSlant(root);
}

function stylizeCJK(root) {
    const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    const nodesToReplace = [];
    let node;
    // Regex for CJK characters (Hanzi + Common CJK Punctuation)
    // \u4E00-\u9FFF: Common Hanzi
    // \u3000-\u303F: CJK Symbols and Punctuation
    // \uFF00-\uFFEF: Halfwidth and Fullwidth Forms
    const cjkRegex = /[\u4E00-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/;

    while (node = walker.nextNode()) {
        if (cjkRegex.test(node.nodeValue) &&
            node.parentElement.tagName !== 'SCRIPT' &&
            node.parentElement.tagName !== 'STYLE' &&
            !node.parentElement.classList.contains('cjk-char')) { // Avoid double wrapping
            nodesToReplace.push(node);
        }
    }

    nodesToReplace.forEach(node => {
        const fragment = document.createDocumentFragment();
        const text = node.nodeValue;
        let lastIndex = 0;
        const regex = /[\u4E00-\u9FFF\u3000-\u303F\uFF00-\uFFEF]+/g; // Match sequences
        let match;

        while ((match = regex.exec(text)) !== null) {
            // Text before
            fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));

            // Wrapped CJK
            const span = document.createElement('span');
            span.className = 'cjk-char';
            span.textContent = match[0];
            fragment.appendChild(span);

            lastIndex = regex.lastIndex;
        }

        // Remaining text
        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
        node.parentNode.replaceChild(fragment, node);
    });
}

function stylizeSlant(root) {
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
            node.parentElement.tagName !== 'STYLE' &&
            !node.parentElement.classList.contains('slant-char')) {
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
            applyGlobalStyles(list);
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
    btn.className = 'control-btn theme-toggle'; // Use shared class
    btn.setAttribute('aria-label', 'Toggle Dark Mode');

    // Append to Header Controls
    const controls = document.querySelector('.header-controls');
    if (controls) {
        controls.insertBefore(btn, controls.firstChild); // Theme toggle first
    } else {
        // Fallback
        const headerTitle = document.querySelector('.site-title');
        if (headerTitle) headerTitle.appendChild(btn);
    }

    // Icons - Refined
    const sunIcon = `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;

    const moonIcon = `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

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
        if (currentLang === 'en') {
            bioEl.innerHTML = `<div class="bio-en">${bio.introEn}</div>`;
        } else {
            const cnLines = bio.introCn.map(line => `<div>${line}</div>`).join('');
            bioEl.innerHTML = `<div class="bio-cn">${cnLines}</div>`;
        }

        // Trigger Animation
        const target = bioEl.querySelector(currentLang === 'en' ? '.bio-en' : '.bio-cn');
        if (target) {
            animatePixelate(target);
        }
    }

    // Contact (Separate Section)
    const contactList = document.querySelector('.contact-list');
    if (contactList) {
        contactList.innerHTML = '';
        bio.contact.forEach(item => {
            const li = document.createElement('li');
            li.className = 'info-item';
            // Removed inline styles to let CSS handle flex/justify
            li.innerHTML = `
            <a href="${item.url}" target="_blank" class="info-label">${item.label} <span class="link-arrow">-></span></a>
        `;
            contactList.appendChild(li);
        });
    }

    // Experience & Exhibitions (Split Columns)
    const expColumn = document.querySelector('.info-column:nth-child(1)'); // Left Column
    const exhColumn = document.querySelector('.info-column:nth-child(2)'); // Right Column

    if (expColumn && exhColumn) {
        expColumn.innerHTML = '';
        exhColumn.innerHTML = '';

        const createSection = (container, title, data) => {
            const h3 = document.createElement('h3');
            h3.textContent = title;
            container.appendChild(h3);

            const ul = document.createElement('ul');
            ul.className = 'info-list';

            const items = data[currentLang] || data['en'];

            items.forEach(group => {
                group.items.forEach(text => {
                    const li = document.createElement('li');
                    li.className = 'info-item';
                    li.style.marginBottom = '0.5rem';
                    li.innerHTML = `
                        <span class="info-label" style="flex: 1;">${text}</span>
                        <span class="info-value" style="margin-left: 1rem; color: var(--meta-color);">${group.year}</span>
                    `;
                    ul.appendChild(li);
                });
            });
            container.appendChild(ul);
        };

        if (bio.cv_experience) {
            createSection(expColumn, 'Experience & Awards', bio.cv_experience);
        }

        if (bio.cv_exhibitions) {
            createSection(exhColumn, 'Group Exhibitions', bio.cv_exhibitions);
        }
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

        // Dynamic Content based on Language
        const title = currentLang === 'en' ? (project.title_en || project.title) : (project.title_cn || project.title);
        const desc = currentLang === 'en' ? (project.description_en || project.description) : (project.description_cn || project.description);

        item.innerHTML = `
            <div class="project-main">
                <div class="project-title">${title}</div>
                <div class="project-desc">${desc}</div>
            </div>
            <div class="project-meta">
                <span>${project.category}</span>
                <span>${project.year}</span>
            </div>
        `;
        container.appendChild(item);
    });
}
