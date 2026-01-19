// Dashboard State
let currentViz = 'heatmap';
let currentMetric = 'sales'; // 'sales' or 'revenue'
let currentCompareMode = 'period'; // Deprecated but kept for safety
let customSeries = [];
let customChartSettings = {
    xAxisMode: 'absolute',
    chartType: 'line',
    metric: 'sales'
};
let filteredData = [];
let chart = null;

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initFileUpload();
    initThemeToggle();
    initDateInputs();
    initFilters();
    initVizButtons();
    initCustomBuilder();
    // Don't call applyFilters() here - wait for file upload
});

// File Upload
function initFileUpload() {
    const dropZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');

    // Drag and drop handlers
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    // Click handlers
    uploadBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });
}

async function handleFiles(files) {
    if (files.length === 0) return;

    const allData = [];
    let processedCount = 0;

    // Show loading state
    const uploadSection = document.querySelector('.upload-section');
    uploadSection.classList.add('loading');

    for (const file of files) {
        try {
            const data = await parseExcelFile(file);
            allData.push(...data);
        } catch (err) {
            console.error(`Error parsing ${file.name}:`, err);
            alert(`無法讀取檔案 ${file.name} / Error reading file ${file.name}`);
        }
        processedCount++;
    }

    if (allData.length > 0) {
        // Sort by date
        window.salesData = allData.sort((a, b) => a.date - b.date);

        // Update UI
        updateFileInfo(files, allData.length);
        uploadSection.classList.add('compact');
        uploadSection.classList.remove('loading');

        // Initial filter application
        applyFilters();
    }
}

function parseExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                let headerRowIdx = -1;
                let dateIdx = -1;
                let salesIdx = -1;

                // 1. Find Header Row & Date Column (Date is usually distinct)
                for (let r = 0; r < Math.min(10, jsonData.length); r++) {
                    const row = jsonData[r];
                    if (!row || row.length === 0) continue;

                    row.forEach((cell, i) => {
                        if (!cell) return;
                        const header = cell.toString().trim();
                        if (header.match(/(時間|日期|Date|Time)/i)) {
                            headerRowIdx = r;
                            dateIdx = i;
                        }
                    });
                    if (headerRowIdx !== -1) break;
                }

                if (headerRowIdx === -1) {
                    headerRowIdx = 0;
                    dateIdx = 0; // Fallback
                }

                // 2. Content-Based Revenue Detection
                // If we can't rely on headers, let's look at the data.
                // We will scan the first 50 rows of data to find the "Money Column".
                // Heuristic: The column with the highest numerical sum is likely the Total Revenue.
                // (Revenue > Tax > Service Charge > Quantity)

                const candidateColumns = {}; // colIndex -> totalSum

                const startRow = headerRowIdx + 1;
                const endRow = Math.min(startRow + 50, jsonData.length);

                for (let i = startRow; i < endRow; i++) {
                    const row = jsonData[i];
                    if (!row) continue;

                    row.forEach((cell, colIndex) => {
                        if (colIndex === dateIdx) return; // Skip date column

                        // Check if header looks like an ID (skip if so)
                        const headerVal = jsonData[headerRowIdx][colIndex];
                        if (headerVal && headerVal.toString().match(/(ID|No|編號|電話|Tel|統一編號|發票)/i)) {
                            return;
                        }

                        // Parse value
                        let val = 0;
                        if (typeof cell === 'number') {
                            val = cell;
                        } else if (typeof cell === 'string') {
                            // Remove commas, currency symbols, whitespace
                            const cleanVal = cell.replace(/[$,\s¥NT]/g, '');
                            if (cleanVal && !isNaN(cleanVal)) {
                                val = parseFloat(cleanVal);
                            }
                        }

                        if (val > 0) {
                            if (!candidateColumns[colIndex]) candidateColumns[colIndex] = 0;
                            candidateColumns[colIndex] += val;
                        }
                    });
                }

                // Find column with max sum
                let maxSum = -1;
                let bestCol = -1;

                for (const [col, sum] of Object.entries(candidateColumns)) {
                    if (sum > maxSum) {
                        maxSum = sum;
                        bestCol = parseInt(col);
                    }
                }

                if (bestCol !== -1) {
                    salesIdx = bestCol;
                    console.log(`Detected Revenue Column: Index ${salesIdx} (Sum: ${maxSum})`);
                }

                // 3. Parse Data
                const parsedRows = [];

                for (let i = headerRowIdx + 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    if (!row || row.length === 0) continue;

                    const dateStr = row[dateIdx];
                    if (!dateStr) continue;

                    let dateObj;
                    if (typeof dateStr === 'number') {
                        dateObj = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
                    } else {
                        dateObj = new Date(dateStr);
                    }

                    if (isNaN(dateObj.getTime())) continue;

                    let revenue = 0;
                    if (salesIdx !== -1) {
                        const rawVal = row[salesIdx];
                        if (typeof rawVal === 'number') {
                            revenue = rawVal;
                        } else if (typeof rawVal === 'string') {
                            const cleanVal = rawVal.replace(/[$,\s¥NT]/g, '');
                            revenue = parseFloat(cleanVal) || 0;
                        }
                    }

                    parsedRows.push({
                        date: dateObj,
                        dayOfWeek: dateObj.getDay(),
                        hour: dateObj.getHours(),
                        sales: 1,
                        revenue: revenue
                    });
                }

                resolve(parsedRows);
            } catch (err) {
                reject(err);
            }
        };

        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function updateFileInfo(files, totalRows) {
    const info = document.getElementById('fileInfo');
    const nameSpan = document.getElementById('fileName');
    const statsSpan = document.getElementById('fileStats');

    info.style.display = 'flex';

    if (files.length === 1) {
        nameSpan.textContent = files[0].name;
    } else {
        nameSpan.textContent = `${files.length} 個檔案 / Files`;
    }

    statsSpan.textContent = `共 ${totalRows.toLocaleString()} 筆資料 / Total Records`;
}

// Theme Toggle
function initThemeToggle() {
    const btn = document.querySelector('.theme-toggle');
    const sunIcon = `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
    const moonIcon = `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

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

        // Redraw chart with new theme
        if (currentViz !== 'heatmap' && currentViz !== 'stats') {
            renderChart();
        }
    });
}

// Date Inputs
function initDateInputs() {
    const startInput = document.getElementById('startDate');
    const endInput = document.getElementById('endDate');

    // Set default to cover CSV data range (Sept 1, 2025 onwards)
    // Since CSV starts from 2025/9/1, we'll use that as default start
    const today = new Date();
    const csvStartDate = new Date(2025, 8, 1); // Sept 1, 2025 (month is 0-indexed)

    startInput.valueAsDate = csvStartDate;
    endInput.valueAsDate = today;

    startInput.addEventListener('change', applyFilters);
    endInput.addEventListener('change', applyFilters);

    // Preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.preset;
            const today = new Date();
            let start = new Date(today);

            switch (preset) {
                case '7days':
                    start.setDate(today.getDate() - 7);
                    break;
                case '30days':
                    start.setDate(today.getDate() - 30);
                    break;
                case 'thisMonth':
                    start = new Date(today.getFullYear(), today.getMonth(), 1);
                    break;
                case 'lastMonth':
                    start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                    const end = new Date(today.getFullYear(), today.getMonth(), 0);
                    endInput.valueAsDate = end;
                    break;
            }

            startInput.valueAsDate = start;
            if (preset !== 'lastMonth') {
                endInput.valueAsDate = today;
            }

            // Update active state
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            applyFilters();
        });
    });
}

// Filters
function initFilters() {
    // Weekday buttons
    document.querySelectorAll('.weekday-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');

            // Deactivate special filters
            document.getElementById('weekendOnly').classList.remove('active');
            document.getElementById('weekdayOnly').classList.remove('active');

            applyFilters();
        });
    });

    // Weekend/Weekday only toggles
    document.getElementById('weekendOnly').addEventListener('click', function () {
        this.classList.toggle('active');
        if (this.classList.contains('active')) {
            document.getElementById('weekdayOnly').classList.remove('active');
            // Activate only weekend days
            document.querySelectorAll('.weekday-btn').forEach((btn, idx) => {
                btn.classList.toggle('active', idx === 0 || idx === 6);
            });
        }
        applyFilters();
    });

    document.getElementById('weekdayOnly').addEventListener('click', function () {
        this.classList.toggle('active');
        if (this.classList.contains('active')) {
            document.getElementById('weekendOnly').classList.remove('active');
            // Activate only weekday days
            document.querySelectorAll('.weekday-btn').forEach((btn, idx) => {
                btn.classList.toggle('active', idx > 0 && idx < 6);
            });
        }
        applyFilters();
    });
}

// Visualization Buttons




function initVizButtons() {
    document.querySelectorAll('.viz-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.viz-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentViz = btn.dataset.viz;

            // Toggle Custom Builder
            const customBuilder = document.getElementById('customBuilder');
            if (currentViz === 'compare') {
                customBuilder.style.display = 'block';
                // Add a default series if empty
                if (customSeries.length === 0) {
                    addCustomSeries();
                }
            } else {
                customBuilder.style.display = 'none';
            }

            renderVisualization();
        });
    });
}

function initCompareControls() {
    // Compare Type Radio
    document.querySelectorAll('input[name="compareType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            currentCompareMode = e.target.value;
            if (currentViz === 'compare') {
                renderVisualization();
            }
        });
    });

    // Metric Toggle
    document.querySelectorAll('.metric-toggle-group .metric-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const metric = btn.dataset.metric;
            if (currentMetric === metric) return;

            currentMetric = metric;

            // Update active state
            document.querySelectorAll('.metric-toggle-group .metric-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.metric === metric);
            });

            if (currentViz === 'compare') {
                renderVisualization();
            }
        });
    });
}

// Apply Filters
function applyFilters() {
    const startDate = document.getElementById('startDate').valueAsDate;
    const endDate = document.getElementById('endDate').valueAsDate;

    if (!startDate || !endDate) return;

    // Get selected weekdays
    const selectedDays = Array.from(document.querySelectorAll('.weekday-btn.active'))
        .map(btn => parseInt(btn.dataset.day));

    // Filter data
    filteredData = window.salesData.filter(item => {
        const itemDate = new Date(item.date);
        itemDate.setHours(0, 0, 0, 0);
        const start = new Date(startDate);
        const end = new Date(endDate);

        return itemDate >= start &&
            itemDate <= end &&
            selectedDays.includes(item.dayOfWeek);
    });

    renderVisualization();
}

// Render Visualization
function renderVisualization() {
    // Hide all containers
    document.getElementById('chartContainer').style.display = 'none';
    document.getElementById('heatmapContainer').style.display = 'none';
    document.getElementById('statsContainer').style.display = 'none';

    switch (currentViz) {
        case 'heatmap':
            renderHeatmap();
            break;
        case 'bar':
            renderBarChart();
            break;
        case 'line':
            renderLineChart();
            break;
        case 'hourly':
            renderHourlyChart();
            break;
        case 'stats':
            renderStats();
            break;
        case 'compare':
            renderCustomChart();
            break;
    }
}

// Heatmap
function renderHeatmap() {
    const container = document.getElementById('heatmapContainer');
    container.style.display = 'block';
    container.innerHTML = '';

    // Add local metric toggle for heatmap
    const controls = document.createElement('div');
    controls.className = 'heatmap-controls';
    controls.innerHTML = `
        <div class="heatmap-legend">
            <span class="legend-item ${currentMetric === 'sales' ? 'active' : ''}" onclick="switchHeatmapMetric('sales')">
                <span class="color-box" style="background: var(--chart-primary)"></span> 結帳筆數
            </span>
            <span class="legend-item ${currentMetric === 'revenue' ? 'active' : ''}" onclick="switchHeatmapMetric('revenue')">
                <span class="color-box" style="background: var(--chart-secondary)"></span> 營收金額
            </span>
        </div>
    `;
    container.appendChild(controls);

    // Aggregate by day of week and hour
    const heatmapData = {};
    const dayNames = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

    filteredData.forEach(item => {
        const key = `${item.dayOfWeek}-${item.hour}`;
        if (!heatmapData[key]) {
            heatmapData[key] = { count: 0, total: 0, revenue: 0 };
        }
        heatmapData[key].count++;
        heatmapData[key].total += item.sales;
        heatmapData[key].revenue += item.revenue;
    });

    const getValue = (data) => {
        if (!data) return 0;
        return currentMetric === 'sales' ? data.count : data.revenue;
    };

    let maxVal = 0;
    Object.values(heatmapData).forEach(d => {
        const val = getValue(d);
        if (val > maxVal) maxVal = val;
    });

    // Create header
    const header = document.createElement('div');
    header.className = 'heatmap-header';

    // Determine active hours (hours with any data)
    const activeHours = [];
    for (let h = 0; h < 24; h++) {
        let hasData = false;
        for (let d = 0; d < 7; d++) {
            const key = `${d}-${h}`;
            if (heatmapData[key] && (heatmapData[key].count > 0 || heatmapData[key].revenue > 0)) {
                hasData = true;
                break;
            }
        }
        if (hasData) activeHours.push(h);
    }

    // If no data, show all hours or just 0-23? Let's show all if empty to avoid broken UI
    const hoursToShow = activeHours.length > 0 ? activeHours : Array.from({ length: 24 }, (_, i) => i);

    // Update grid layout dynamically
    const gridTemplate = `80px repeat(${hoursToShow.length}, 1fr)`;

    header.style.gridTemplateColumns = gridTemplate;
    header.innerHTML = '<div></div>';

    hoursToShow.forEach(h => {
        header.innerHTML += `<div class="heatmap-hour">${h}</div>`;
    });
    container.appendChild(header);

    // Create rows
    for (let day = 0; day < 7; day++) {
        const row = document.createElement('div');
        row.className = 'heatmap-row';
        row.style.gridTemplateColumns = gridTemplate;

        const label = document.createElement('div');
        label.className = 'heatmap-label';
        label.textContent = dayNames[day];
        row.appendChild(label);

        hoursToShow.forEach(hour => {
            const key = `${day}-${hour}`;
            const data = heatmapData[key];
            const val = getValue(data);
            const intensity = maxVal > 0 ? val / maxVal : 0;

            const cell = document.createElement('div');
            cell.className = 'heatmap-cell';
            cell.style.background = getHeatColor(intensity);

            let displayVal = val;
            let tooltipVal = val.toLocaleString();

            if (currentMetric === 'revenue') {
                tooltipVal = '$' + tooltipVal;
                // Format revenue for display (e.g. 1.2k) if too long
                if (val >= 10000) {
                    displayVal = (val / 10000).toFixed(1) + 'w';
                } else if (val >= 1000) {
                    displayVal = (val / 1000).toFixed(1) + 'k';
                }
            }

            cell.textContent = val > 0 ? displayVal : '';
            cell.title = `${dayNames[day]} ${hour}:00 - ${currentMetric === 'sales' ? '結帳' : '營收'}: ${tooltipVal}`;

            row.appendChild(cell);
        });

        container.appendChild(row);
    }
}

// Helper for heatmap switching
window.switchHeatmapMetric = (metric) => {
    if (currentMetric === metric) return;
    currentMetric = metric;
    renderHeatmap();
};

function getHeatColor(intensity) {
    const isDark = document.body.classList.contains('dark-theme');

    if (isDark) {
        // Dark theme: Transparent -> Red
        return `rgba(255, 99, 71, ${0.1 + intensity * 0.9})`;
    } else {
        // Light theme: Transparent -> OrangeRed
        return `rgba(255, 69, 0, ${0.05 + intensity * 0.95})`;
    }
}

// Bar Chart
function renderBarChart() {
    document.getElementById('chartContainer').style.display = 'block';

    // Aggregate by date
    const dailyData = {};
    filteredData.forEach(item => {
        const dateKey = item.date.toISOString().split('T')[0];
        if (!dailyData[dateKey]) {
            dailyData[dateKey] = { sales: 0, revenue: 0 };
        }
        dailyData[dateKey].sales += item.sales;
        dailyData[dateKey].revenue += item.revenue;
    });

    const labels = Object.keys(dailyData).sort();
    const salesValues = labels.map(date => dailyData[date].sales);
    const revenueValues = labels.map(date => Math.round(dailyData[date].revenue));

    renderChart({
        type: 'bar',
        data: {
            labels: labels.map(d => formatDateWithWeekday(d)),
            datasets: [
                {
                    label: '每日結帳筆數',
                    data: salesValues,
                    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-primary').trim(),
                    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-primary').trim(),
                    borderWidth: 1,
                    yAxisID: 'y'
                },
                {
                    label: '每日營收',
                    data: revenueValues,
                    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-secondary').trim(),
                    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-secondary').trim(),
                    borderWidth: 1,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    labels: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim(),
                        font: { family: 'Inter, sans-serif' }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                if (context.dataset.yAxisID === 'y1') {
                                    label += new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(context.parsed.y);
                                } else {
                                    label += context.parsed.y;
                                }
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '結帳筆數',
                        color: getComputedStyle(document.documentElement).getPropertyValue('--meta-color').trim(),
                        font: { family: 'Inter, sans-serif' }
                    },
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--meta-color').trim(),
                        font: { family: 'Inter, sans-serif' }
                    },
                    grid: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim()
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '營收金額',
                        color: getComputedStyle(document.documentElement).getPropertyValue('--meta-color').trim(),
                        font: { family: 'Inter, sans-serif' }
                    },
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--meta-color').trim(),
                        font: { family: 'Inter, sans-serif' }
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                },
                x: {
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--meta-color').trim(),
                        font: { family: 'Inter, sans-serif' }
                    },
                    grid: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim()
                    }
                }
            }
        }
    });
}

// Line Chart
function renderLineChart() {
    document.getElementById('chartContainer').style.display = 'block';

    // Aggregate by date
    const dailyData = {};
    filteredData.forEach(item => {
        const dateKey = item.date.toISOString().split('T')[0];
        if (!dailyData[dateKey]) {
            dailyData[dateKey] = { sales: 0, revenue: 0 };
        }
        dailyData[dateKey].sales += item.sales;
        dailyData[dateKey].revenue += item.revenue;
    });

    const labels = Object.keys(dailyData).sort();
    const salesValues = labels.map(date => dailyData[date].sales);
    const revenueValues = labels.map(date => Math.round(dailyData[date].revenue));

    renderChart({
        type: 'line',
        data: {
            labels: labels.map(d => formatDateWithWeekday(d)),
            datasets: [
                {
                    label: '結帳筆數',
                    data: salesValues,
                    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-primary').trim(),
                    backgroundColor: 'transparent',
                    tension: 0.3,
                    borderWidth: 2
                },
                {
                    label: '營收 (元)',
                    data: revenueValues,
                    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-secondary').trim(),
                    backgroundColor: 'transparent',
                    tension: 0.3,
                    borderWidth: 2,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    labels: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim(),
                        font: { family: 'Inter, sans-serif' }
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true,
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--meta-color').trim(),
                        font: { family: 'Inter, sans-serif' }
                    },
                    grid: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim()
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    beginAtZero: true,
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--meta-color').trim(),
                        font: { family: 'Inter, sans-serif' }
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                },
                x: {
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--meta-color').trim(),
                        font: { family: 'Inter, sans-serif' }
                    },
                    grid: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim()
                    }
                }
            }
        }
    });
}

// Stats
function renderStats() {
    const container = document.getElementById('statsContainer');
    container.style.display = 'grid';
    container.innerHTML = '';

    // Calculate statistics
    const totalSales = filteredData.reduce((sum, item) => sum + item.sales, 0);
    const totalRevenue = filteredData.reduce((sum, item) => sum + item.revenue, 0);
    const avgSales = totalSales / (filteredData.length || 1);

    // Daily aggregation
    const dailyData = {};
    filteredData.forEach(item => {
        const dateKey = item.date.toISOString().split('T')[0];
        if (!dailyData[dateKey]) {
            dailyData[dateKey] = { sales: 0, revenue: 0 };
        }
        dailyData[dateKey].sales += item.sales;
        dailyData[dateKey].revenue += item.revenue;
    });

    const days = Object.keys(dailyData).length;
    const avgDailySales = totalSales / (days || 1);
    const avgDailyRevenue = totalRevenue / (days || 1);

    // Peak hour
    const hourlyData = {};
    filteredData.forEach(item => {
        if (!hourlyData[item.hour]) {
            hourlyData[item.hour] = 0;
        }
        hourlyData[item.hour] += item.sales;
    });
    const peakHour = Object.entries(hourlyData).sort((a, b) => b[1] - a[1])[0];

    const stats = [
        {
            label: '總結帳筆數',
            value: totalSales.toLocaleString(),
            subtitle: `${days} 天資料`
        },
        {
            label: '總營收',
            value: `$${Math.round(totalRevenue).toLocaleString()}`,
            subtitle: '新台幣'
        },
        {
            label: '日均結帳',
            value: Math.round(avgDailySales).toLocaleString(),
            subtitle: '筆/天'
        },
        {
            label: '日均營收',
            value: `$${Math.round(avgDailyRevenue).toLocaleString()}`,
            subtitle: '新台幣/天'
        },
        {
            label: '尖峰時段',
            value: peakHour ? `${peakHour[0]}:00` : 'N/A',
            subtitle: peakHour ? `${Math.round(peakHour[1])} 筆` : ''
        },
        {
            label: '平均客單價',
            value: `$${Math.round(totalRevenue / totalSales)}`,
            subtitle: '新台幣'
        }
    ];

    stats.forEach(stat => {
        const card = document.createElement('div');
        card.className = 'stat-card';
        card.innerHTML = `
            <div class="stat-label">${stat.label}</div>
            <div class="stat-value">${stat.value}</div>
            <div class="stat-subtitle">${stat.subtitle}</div>
        `;
        container.appendChild(card);
    });
}

// Chart Helper
function renderChart(config) {
    if (chart) {
        chart.destroy();
    }

    const ctx = document.getElementById('mainChart').getContext('2d');
    chart = new Chart(ctx, config);
}

// Helper: Format date with weekday (e.g., "11/2一")
function formatDateWithWeekday(dateString) {
    const date = new Date(dateString);
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = dayNames[date.getDay()];
    return `${month}/${day}${weekday}`;
}

// Hourly Chart - Shows sales/revenue by hour across all filtered days
function renderHourlyChart() {
    document.getElementById('chartContainer').style.display = 'block';

    // Aggregate by hour
    const hourlyData = {};
    for (let h = 0; h < 24; h++) {
        hourlyData[h] = { sales: 0, revenue: 0, count: 0 };
    }

    filteredData.forEach(item => {
        hourlyData[item.hour].sales += item.sales;
        hourlyData[item.hour].revenue += item.revenue;
        hourlyData[item.hour].count++;
    });

    const hours = Array.from({ length: 24 }, (_, i) => i);

    // Determine active hours (hours with any data across all days)
    const activeHours = hours.filter(h => hourlyData[h].count > 0 || hourlyData[h].sales > 0 || hourlyData[h].revenue > 0);

    // If no data, fallback to all or empty
    const hoursToShow = activeHours.length > 0 ? activeHours : hours;

    const salesValues = hoursToShow.map(h => hourlyData[h].sales);
    const revenueValues = hoursToShow.map(h => hourlyData[h].revenue);

    renderChart({
        type: 'bar',
        data: {
            labels: hoursToShow.map(h => `${h}:00`),
            datasets: [
                {
                    label: '總結帳筆數',
                    data: salesValues,
                    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-primary').trim(),
                    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-primary').trim(),
                    borderWidth: 1,
                    yAxisID: 'y'
                },
                {
                    label: '總營收',
                    data: revenueValues,
                    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-secondary').trim(),
                    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-secondary').trim(),
                    borderWidth: 1,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    labels: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim(),
                        font: { family: 'Inter, sans-serif' }
                    }
                },
                title: {
                    display: true,
                    text: '每小時銷售與營收分析',
                    color: getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim(),
                    font: { family: 'Inter, sans-serif', size: 14 }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                if (context.dataset.yAxisID === 'y1') {
                                    label += new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(context.parsed.y);
                                } else {
                                    label += context.parsed.y;
                                }
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '總結帳筆數',
                        color: getComputedStyle(document.documentElement).getPropertyValue('--meta-color').trim(),
                        font: { family: 'Inter, sans-serif' }
                    },
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--meta-color').trim(),
                        font: { family: 'Inter, sans-serif' }
                    },
                    grid: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim()
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '總營收',
                        color: getComputedStyle(document.documentElement).getPropertyValue('--meta-color').trim(),
                        font: { family: 'Inter, sans-serif' }
                    },
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--meta-color').trim(),
                        font: { family: 'Inter, sans-serif' }
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '時段',
                        color: getComputedStyle(document.documentElement).getPropertyValue('--meta-color').trim(),
                        font: { family: 'Inter, sans-serif' }
                    },
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--meta-color').trim(),
                        font: { family: 'Inter, sans-serif' }
                    },
                    grid: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim()
                    }
                }
// Global handler for weekday toggle in series card
window.toggleSeriesWeekday = function (seriesId, day, btnElement) {
                    const series = customSeries.find(s => s.id === seriesId);
                    if (!series) return;

                    const index = series.weekdays.indexOf(day);
                    if (index === -1) {
                        series.weekdays.push(day);
                        btnElement.classList.add('active');
                    } else {
                        series.weekdays = series.weekdays.filter(d => d !== day);
                        btnElement.classList.remove('active');
                    }
                    renderCustomChart();
                };

                // Expose removeSeries globally
                window.removeSeries = removeSeries;
                window.updateSeries = updateSeries;

                function renderCustomChart() {
        document.getElementById('chartContainer').style.display = 'block';

        if(customSeries.length === 0) {
        if (chart) chart.destroy();
        return;
    }

    const datasets = [];
    let allLabels = new Set();

    // Process Data based on X-Axis Mode
    if (customChartSettings.xAxisMode === 'absolute') {
        // Absolute Date Mode
        customSeries.forEach(series => {
            const data = getSeriesData(series);
            // Aggregate by Date
            const dailyData = {};
            data.forEach(item => {
                const dateKey = item.date.toISOString().split('T')[0];
                if (!dailyData[dateKey]) dailyData[dateKey] = 0;
                dailyData[dateKey] += (customChartSettings.metric === 'sales' ? item.sales : item.revenue);
                allLabels.add(dateKey);
            });

            datasets.push({
                label: series.name,
                data: dailyData, // Will be mapped later
                borderColor: series.color,
                backgroundColor: customChartSettings.chartType === 'bar' ? series.color : 'transparent',
                tension: 0.3,
                borderWidth: 2
            });
        });

        // Sort labels
        const sortedLabels = Array.from(allLabels).sort();

        // Map data to labels
        datasets.forEach(ds => {
            ds.data = sortedLabels.map(date => ds.data[date] || 0);
        });

        renderChart({
            type: customChartSettings.chartType,
            data: {
                labels: sortedLabels.map(d => formatDateWithWeekday(d)),
                datasets: datasets
            },
            options: getCommonChartOptions()
        });

    } else if (customChartSettings.xAxisMode === 'relative') {
        // Relative Day Mode (Day 1, Day 2...)
        let maxDays = 0;

        customSeries.forEach(series => {
            const data = getSeriesData(series);
            // Aggregate by Date first to handle multiple entries per day
            const dailyMap = {};
            data.forEach(item => {
                const k = item.date.toISOString().split('T')[0];
                if (!dailyMap[k]) dailyMap[k] = 0;
                dailyMap[k] += (customChartSettings.metric === 'sales' ? item.sales : item.revenue);
            });

            // Convert to array sorted by date
            const sortedValues = Object.keys(dailyMap).sort().map(k => dailyMap[k]);
            if (sortedValues.length > maxDays) maxDays = sortedValues.length;

            datasets.push({
                label: series.name,
                data: sortedValues,
                borderColor: series.color,
                backgroundColor: customChartSettings.chartType === 'bar' ? series.color : 'transparent',
                tension: 0.3,
                borderWidth: 2
            });
        });

        const labels = Array.from({ length: maxDays }, (_, i) => `Day ${i + 1}`);

        renderChart({
            type: customChartSettings.chartType,
            data: {
                labels: labels,
                datasets: datasets
            },
            options: getCommonChartOptions()
        });

    } else if (customChartSettings.xAxisMode === 'hourly') {
        // Hourly Mode (0-23)
        customSeries.forEach(series => {
            const data = getSeriesData(series);
            const hourlyData = new Array(24).fill(0);

            // For averaging
            const distinctDates = new Set();

            data.forEach(item => {
                hourlyData[item.hour] += (customChartSettings.metric === 'sales' ? item.sales : item.revenue);
                distinctDates.add(item.date.toDateString());
            });

            // Normalize to Average
            const daysCount = distinctDates.size || 1;
            const avgData = hourlyData.map(v => v / daysCount);

            datasets.push({
                label: series.name,
                data: avgData,
                borderColor: series.color,
                backgroundColor: customChartSettings.chartType === 'bar' ? series.color : 'transparent',
                tension: 0.3,
                borderWidth: 2
            });
        });

        renderChart({
            type: customChartSettings.chartType,
            data: {
                labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
                datasets: datasets
            },
            options: getCommonChartOptions()
        });
    }
}

function getSeriesData(series) {
    if (!window.salesData) return [];

    return window.salesData.filter(item => {
        const itemDate = new Date(item.date);
        itemDate.setHours(0, 0, 0, 0);

        // Date Range Filter
        if (itemDate < series.startDate || itemDate > series.endDate) return false;

        // Weekday Filter
        if (!series.weekdays.includes(item.dayOfWeek)) return false;

        return true;
    });
}

function getCommonChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false
        },
        plugins: {
            title: {
                display: true,
                text: `自訂比較分析 (${customChartSettings.metric === 'sales' ? '結帳筆數' : '營收'})`,
                color: getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim(),
                font: { family: 'Inter, sans-serif', size: 16 }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim() },
                ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--meta-color').trim() }
            },
            x: {
                grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim() },
                ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--meta-color').trim() }
            }
        }
    };
}

function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

function formatDate(date) {
    return `${date.getMonth() + 1}/${date.getDate()}`;
}
