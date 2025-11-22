document.addEventListener('DOMContentLoaded', () => {
    console.log("Project.js loaded");
    if (!window.siteData) {
        console.error("Site data not loaded");
        return;
    }

    console.log("Initializing features...");
    initThemeToggle();
    initLanguageToggle();

    // Check if we are on the Links page
    if (window.location.pathname.endsWith('links.html')) {
        renderLinksPage();
    } else {
        loadProject();
    }

    // Initialize Physics for Slant Effect
    initTypographyEffects();
});

let currentLang = localStorage.getItem('lang') || 'en';

// --- Physics Engine (Ported from main.js) ---
let animationFrameId;

function initTypographyEffects() {
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

            const deltaX = mouseX - charX;
            const deltaY = mouseY - charY;
            const dist = Math.hypot(deltaX, deltaY);
            const maxDist = 600;

            let targetSkew = 0;

            if (dist < maxDist) {
                let angleDeg = Math.atan(deltaX / deltaY) * (180 / Math.PI);
                if (deltaY === 0) {
                    angleDeg = deltaX > 0 ? 90 : -90;
                }
                let skew = Math.max(-10, Math.min(20, angleDeg));

                if (char.classList.contains('backslash')) {
                    targetSkew = skew - 15;
                } else {
                    targetSkew = skew;
                }
            } else {
                targetSkew = char.classList.contains('backslash') ? 0 : 15;
            }

            char.targetSkew = targetSkew;
            if (typeof char.currentSkew === 'undefined') {
                char.currentSkew = targetSkew;
            }
            char.currentSkew = lerp(char.currentSkew, targetSkew, 0.08);
            char.style.transform = `skewX(${char.currentSkew}deg)`;
        });

        animationFrameId = requestAnimationFrame(loop);
    };
    loop();
}

// --- Animation (Ported from main.js) ---
function animatePixelate(element) {
    if (!element) return;

    if (element.dataset.animInterval) {
        clearInterval(parseInt(element.dataset.animInterval));
        element.dataset.animInterval = '';
    }

    if (!element.dataset.originalText) {
        element.dataset.originalText = element.innerText;
    }
    const text = element.dataset.originalText;

    const blocks = ['█', '▓', '▒', '░'];

    element.style.whiteSpace = 'pre-wrap';
    element.innerHTML = '';

    const wrappers = [];

    for (let i = 0; i < text.length; i++) {
        let char = text[i];
        if (char === '\n') {
            element.appendChild(document.createTextNode('\n'));
            continue;
        }
        if (/[/\\\uFF3C]/.test(char)) char = '\\';

        const wrapper = document.createElement('span');
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-block';

        const realChar = document.createElement('span');
        realChar.textContent = char;
        realChar.style.opacity = '0';
        if (/[lLI\\]/.test(char)) {
            realChar.className = char === '\\' ? 'slant-char backslash' : 'slant-char';
        }

        const blockChar = document.createElement('span');
        blockChar.textContent = blocks[0];
        blockChar.style.position = 'absolute';
        blockChar.style.left = '0';
        blockChar.style.top = '0';
        blockChar.style.color = 'var(--text-color)';

        if (char === ' ') {
            blockChar.innerHTML = '&nbsp;';
            realChar.innerHTML = '&nbsp;';
        }

        wrapper.appendChild(realChar);
        wrapper.appendChild(blockChar);
        element.appendChild(wrapper);
        wrappers.push({ wrapper, real: realChar, block: blockChar, char: char });
    }

    let step = 0;
    const maxSteps = 15;

    const interval = setInterval(() => {
        step++;
        wrappers.forEach(obj => {
            if (obj.char === ' ') return;

            if (step > maxSteps) {
                obj.block.style.display = 'none';
                obj.real.style.opacity = '1';
            } else {
                obj.block.textContent = blocks[Math.floor(Math.random() * blocks.length)];
            }
        });

        if (step > maxSteps + 5) {
            clearInterval(interval);
            element.dataset.animInterval = '';

            // Cleanup
            const finalHTML = document.createDocumentFragment();
            wrappers.forEach(obj => {
                if (obj.char === ' ') {
                    finalHTML.appendChild(document.createTextNode(' '));
                } else {
                    obj.real.style.opacity = '1';
                    finalHTML.appendChild(obj.real);
                }
            });
            element.innerHTML = '';
            element.appendChild(finalHTML);

            // Re-init physics for new chars
            // initTypographyEffects is running loop, so it will pick up new .slant-char
        }
    }, 50);

    element.dataset.animInterval = interval;
}


function stylizeTypography(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    const nodesToReplace = [];
    let node;
    while (node = walker.nextNode()) {
        if ((/[lLI/]/.test(node.nodeValue)) &&
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
        const regex = /[lLI/]/g;
        let match;

        while ((match = regex.exec(text)) !== null) {
            fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
            const char = match[0];
            if (char === '/') {
                const span = document.createElement('span');
                span.className = 'slant-char backslash';
                span.textContent = '\\';
                fragment.appendChild(span);
            } else {
                const span = document.createElement('span');
                span.className = 'slant-char';
                span.textContent = char;
                fragment.appendChild(span);
            }
            lastIndex = regex.lastIndex;
        }
        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
        node.parentNode.replaceChild(fragment, node);
    });
}

function loadProject() {
    try {
        const params = new URLSearchParams(window.location.search);
        let projectId = params.get('id');

        if (!projectId) {
            const path = window.location.pathname;
            const filename = path.split('/').pop();
            if (filename && filename.endsWith('.html')) {
                projectId = filename.replace('.html', '');
            }
        }

        if (!projectId) {
            console.warn("No project ID found");
            return;
        }

        const project = (window.siteData.projects && window.siteData.projects.find(p => p.id === projectId)) ||
            (window.siteData.experiments && window.siteData.experiments.find(e => e.id === projectId));

        if (!project) {
            document.getElementById('project-container').innerHTML = '<p>Project not found.</p>';
            return;
        }

        renderProjectDetail(project);
        updateSEO(project);
    } catch (e) {
        console.error("Error in loadProject:", e);
    }
}

function renderLinksPage() {
    const container = document.getElementById('project-container');
    const title = "Links";

    container.innerHTML = `
        <h1 class="project-detail-title">${title}</h1>
        <div class="project-content" id="links-list">
            <!-- Links will be injected here -->
        </div>
    `;

    const linksContainer = document.getElementById('links-list');
    const linksData = window.siteData.links || [];

    linksData.forEach(section => {
        const sectionEl = document.createElement('div');
        sectionEl.style.marginBottom = '4rem';

        const h3 = document.createElement('h3');
        h3.textContent = section.category;
        h3.className = 'section-title'; // Reuse existing style
        sectionEl.appendChild(h3);

        const list = document.createElement('div');
        list.className = 'project-list'; // Reuse list style

        section.items.forEach(item => {
            const link = document.createElement('a');
            link.href = item.url;
            link.target = "_blank";
            link.className = 'experiment-item';
            link.style.textDecoration = 'none';
            link.style.color = 'inherit';
            link.innerHTML = `
                <span class="experiment-title">${item.label}</span>
                <span class="experiment-category">Link -></span>
            `;
            list.appendChild(link);
        });

        sectionEl.appendChild(list);
        linksContainer.appendChild(sectionEl);
    });

    updateBreadcrumb(title);

    // Animate Title
    const titleEl = container.querySelector('.project-detail-title');
    if (titleEl) animatePixelate(titleEl);

    stylizeTypography(container);
}

function updateSEO(project) {
    const title = currentLang === 'en' ? (project.title_en || project.title) : (project.title_cn || project.title);
    const description = currentLang === 'en' ? (project.description_en || project.description) : (project.description_cn || project.description);
    document.title = `${title} - HongYinull`;
}

function renderProjectDetail(project) {
    const container = document.getElementById('project-container');

    const title = currentLang === 'en' ? (project.title_en || project.title) : (project.title_cn || project.title);
    const category = project.category;
    const year = project.year;

    let content = '';
    if (currentLang === 'en') {
        content = project.content_en || project.content || `<p>${project.description_en || project.description}</p>`;
    } else {
        content = project.content_cn || project.content || `<p>${project.description_cn || project.description}</p>`;
    }

    container.innerHTML = `
        <h1 class="project-detail-title">${title}</h1>
        <div class="project-detail-meta">
            <span>${category}</span>
            <span>${year}</span>
        </div>
        <div class="project-content">
            ${content}
        </div>
    `;

    if (project.links && project.links.length > 0) {
        const linksSection = document.createElement('div');
        linksSection.className = 'experiments-section';
        linksSection.style.marginTop = '4rem';
        linksSection.style.borderTop = '1px solid #eee';
        linksSection.style.paddingTop = '2rem';

        const sectionTitle = document.createElement('div');
        sectionTitle.className = 'section-title';
        sectionTitle.textContent = 'Related Links & Press';
        linksSection.appendChild(sectionTitle);

        const linksList = document.createElement('div');
        linksList.className = 'project-list';

        project.links.forEach(link => {
            const item = document.createElement('a');
            item.href = link.url;
            item.target = "_blank";
            item.className = 'experiment-item';
            item.style.textDecoration = 'none';
            item.style.color = 'inherit';
            item.innerHTML = `
                <span class="experiment-title">${link.title}</span>
                <span class="experiment-category">Link -></span>
            `;
            linksList.appendChild(item);
        });

        linksSection.appendChild(linksList);
        container.appendChild(linksSection);
    }

    updateBreadcrumb(title);

    // Animate Title
    const titleEl = container.querySelector('.project-detail-title');
    if (titleEl) animatePixelate(titleEl);

    stylizeTypography(container);
}

function updateBreadcrumb(projectTitle) {
    const backLink = document.querySelector('.back-link');
    if (backLink) {
        const isSubDir = window.location.pathname.includes('/projects/') || window.location.pathname.includes('/links.html');
        const homePath = window.location.pathname.includes('/projects/') ? '../index.html' : 'index.html';

        const newContainer = document.createElement('div');
        newContainer.className = 'back-link-container';
        newContainer.style.marginBottom = '2rem';
        newContainer.style.fontFamily = 'var(--font-main)'; // Updated to Serif
        newContainer.style.fontSize = '0.9rem';
        newContainer.style.color = 'var(--meta-color)';
        newContainer.style.display = 'flex';
        newContainer.style.alignItems = 'center';
        newContainer.style.textTransform = 'uppercase';

        newContainer.innerHTML = `
            <a href="${homePath}" style="text-decoration: none; color: inherit; border-bottom: 1px solid transparent; transition: border-color 0.2s;">HOME</a>
            <span class="slant-char backslash" style="margin: 0 0.8rem; color: var(--text-color);">\\</span>
            <span class="breadcrumb-current" style="color: var(--text-color);">${projectTitle}</span>
        `;

        const homeLink = newContainer.querySelector('a');
        homeLink.addEventListener('mouseenter', () => homeLink.style.borderBottomColor = 'var(--text-color)');
        homeLink.addEventListener('mouseleave', () => homeLink.style.borderBottomColor = 'transparent');

        backLink.parentNode.replaceChild(newContainer, backLink);
    } else {
        const currentSpan = document.querySelector('.breadcrumb-current');
        if (currentSpan) currentSpan.textContent = projectTitle;
    }
}

function initLanguageToggle() {
    let controls = document.querySelector('.header-controls');
    if (!controls) {
        const header = document.querySelector('header');
        controls = document.createElement('div');
        controls.className = 'header-controls';
        controls.style.position = 'absolute';
        controls.style.top = '4rem';
        controls.style.right = '2rem';
        controls.style.display = 'flex';
        controls.style.gap = '1.5rem';
        controls.style.zIndex = '100';

        const container = document.querySelector('.container');
        if (container) {
            container.style.position = 'relative';
            container.appendChild(controls);
        } else {
            document.body.appendChild(controls);
        }
    }

    if (controls.querySelector('.lang-toggle')) return;

    const btn = document.createElement('button');
    btn.className = 'control-btn lang-toggle';
    btn.textContent = currentLang === 'en' ? '中' : 'EN';
    btn.style.fontFamily = 'var(--font-main)';
    btn.style.fontSize = '1.1rem';
    btn.style.cursor = 'pointer';
    btn.style.background = 'none';
    btn.style.border = 'none';
    btn.style.color = 'var(--text-color)';
    btn.style.padding = '0';
    btn.style.opacity = '0.5';
    btn.style.transition = 'opacity 0.2s';

    btn.onmouseover = () => btn.style.opacity = '1';
    btn.onmouseout = () => btn.style.opacity = '0.5';

    btn.addEventListener('click', () => {
        currentLang = currentLang === 'en' ? 'cn' : 'en';
        localStorage.setItem('lang', currentLang);
        btn.textContent = currentLang === 'en' ? '中' : 'EN';

        if (window.location.pathname.endsWith('links.html')) {
            renderLinksPage();
        } else {
            loadProject();
        }
    });

    controls.appendChild(btn);
}

function initThemeToggle() {
    let controls = document.querySelector('.header-controls');
    if (!controls) {
        const container = document.querySelector('.container');
        controls = document.createElement('div');
        controls.className = 'header-controls';
        controls.style.position = 'absolute';
        controls.style.top = '4rem';
        controls.style.right = '2rem';
        controls.style.display = 'flex';
        controls.style.gap = '1.5rem';
        controls.style.zIndex = '100';
        if (container) {
            container.style.position = 'relative';
            container.appendChild(controls);
        } else {
            document.body.appendChild(controls);
        }
    }

    if (controls.querySelector('.theme-toggle')) return;

    const btn = document.createElement('button');
    btn.className = 'control-btn theme-toggle';
    btn.setAttribute('aria-label', 'Toggle Dark Mode');
    btn.style.background = 'none';
    btn.style.border = 'none';
    btn.style.cursor = 'pointer';
    btn.style.color = 'var(--text-color)';
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.padding = '0';
    btn.style.opacity = '0.5';
    btn.style.transition = 'opacity 0.2s';

    btn.onmouseover = () => btn.style.opacity = '1';
    btn.onmouseout = () => btn.style.opacity = '0.5';

    controls.insertBefore(btn, controls.firstChild);

    const sunIcon = `<svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;

    const moonIcon = `<svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

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
