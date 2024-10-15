document.addEventListener('DOMContentLoaded', function() {
    console.log('網頁已加載完成！');
    
    const projectsContainer = document.getElementById('projects-container');
    const categorySelect = document.getElementById('category-select');
    
    // 顯示所有專案
    displayProjects(projects);
    
    // 添加下拉選單的事件監聽器
    categorySelect.addEventListener('change', function() {
        const selectedCategory = this.value;
        if (selectedCategory === 'all') {
            displayProjects(projects);
        } else {
            const filteredProjects = projects.filter(project => project.tags.includes(selectedCategory));
            displayProjects(filteredProjects);
        }
    });

    function displayProjects(projectsToShow) {
        projectsContainer.innerHTML = '';
        projectsToShow.forEach(project => {
            const projectElement = document.createElement('div');
            projectElement.className = 'project';
            projectElement.innerHTML = `
                <a href="#" class="project-link">
                    <div class="project-info">
                        <div class="project-title">${project.title}</div>
                        <div class="project-date">${project.date}</div>
                    </div>
                    <div class="project-description">${project.description}</div>
                    <div class="project-tags">${project.tags.join(', ')}</div>
                    <div class="project-thumbnail">
                        <img src="${project.thumbnail}" alt="${project.title}">
                    </div>
                </a>
            `;
            projectsContainer.appendChild(projectElement);
        });
    }
});
