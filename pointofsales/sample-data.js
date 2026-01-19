// File Upload and Excel/CSV Parser
let dataDateRange = { min: null, max: null };

function initFileUpload() {
    const uploadZone = document.getElementById('uploadZone');
    const uploadBtn = document.getElementById('uploadBtn');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileStats = document.getElementById('fileStats');

    // Click to upload
    uploadBtn.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('click', (e) => {
        if (e.target !== uploadBtn) fileInput.click();
    });

    // Drag and drop
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('drag-over');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            handleMultipleFiles(files);
        }
    });

    // File input change - handle multiple files
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleMultipleFiles(Array.from(e.target.files));
        }
    });

    // Handle multiple files
    async function handleMultipleFiles(files) {
        console.log(`📦 Processing ${files.length} file(s)...`);

        const allData = [];
        let processedCount = 0;
        let fileNames = [];

        for (const file of files) {
            try {
                const data = await processFile(file);
                if (data && data.length > 0) {
                    allData.push(...data);
                    fileNames.push(file.name);
                    processedCount++;
                    console.log(`✅ ${file.name}: ${data.length} records`);
                } else {
                    console.warn(`⚠️ ${file.name}: No valid data`);
                }
            } catch (error) {
                console.error(`❌ ${file.name}:`, error);
            }
        }

        if (allData.length === 0) {
            alert(`無法從 ${files.length} 個檔案中解析出有效資料。\n\n請確認：\n1. 檔案是 iChef 後台匯出的發票記錄\n2. 包含結帳時間和金額欄位\n\n請查看瀏覽器 Console 了解詳細錯誤訊息。`);
            return;
        }

        // Update global data
        window.salesData = allData;

        // Calculate date range
        const dates = allData.map(d => d.date);
        dataDateRange.min = new Date(Math.min(...dates));
        dataDateRange.max = new Date(Math.max(...dates));

        // Update date inputs
        const startInput = document.getElementById('startDate');
        const endInput = document.getElementById('endDate');

        startInput.valueAsDate = dataDateRange.min;
        endInput.valueAsDate = dataDateRange.max;

        // Set min/max attributes
        startInput.min = dataDateRange.min.toISOString().split('T')[0];
        startInput.max = dataDateRange.max.toISOString().split('T')[0];
        endInput.min = dataDateRange.min.toISOString().split('T')[0];
        endInput.max = dataDateRange.max.toISOString().split('T')[0];

        // Show file info
        if (fileNames.length === 1) {
            fileName.textContent = fileNames[0];
        } else {
            fileName.textContent = `${fileNames.length} 個檔案`;
        }
        fileStats.textContent = `${allData.length} 筆交易記錄 | ${dataDateRange.min.toLocaleDateString('zh-TW')} - ${dataDateRange.max.toLocaleDateString('zh-TW')}`;
        fileInfo.style.display = 'flex';

        // Apply filters and render
        applyFilters();

        console.log(`✅ 成功載入 ${processedCount}/${files.length} 個檔案，共 ${allData.length} 筆交易記錄`);
    }

    // Process single file (returns Promise)
    function processFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            const fileExtension = file.name.split('.').pop().toLowerCase();

            reader.onload = (e) => {
                try {
                    let data = [];

                    if (fileExtension === 'csv') {
                        console.log(`📄 Parsing CSV: ${file.name}`);
                        data = parseCSV(e.target.result);
                    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
                        console.log(`📊 Parsing Excel: ${file.name}`);
                        const workbook = XLSX.read(e.target.result, { type: 'binary' });
                        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                        const csvData = XLSX.utils.sheet_to_csv(firstSheet);
                        data = parseCSV(csvData);
                    } else {
                        reject(new Error('Unsupported file format'));
                        return;
                    }

                    resolve(data);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error('File read error'));

            if (fileExtension === 'csv') {
                reader.readAsText(file);
            } else {
                reader.readAsBinaryString(file);
            }
        });
    }

    function handleFile(file) {
        const reader = new FileReader();
        const fileExtension = file.name.split('.').pop().toLowerCase();

        reader.onload = (e) => {
            try {
                let data = [];

                if (fileExtension === 'csv') {
                    // Parse CSV
                    console.log('📄 Parsing CSV file...');
                    data = parseCSV(e.target.result);
                } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
                    // Parse Excel using SheetJS
                    console.log('📊 Parsing Excel file...');
                    const workbook = XLSX.read(e.target.result, { type: 'binary' });
                    console.log('Sheet names:', workbook.SheetNames);

                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const csvData = XLSX.utils.sheet_to_csv(firstSheet);

                    // Debug: Show first few lines
                    const lines = csvData.split('\n').slice(0, 5);
                    console.log('First 5 lines of converted CSV:');
                    lines.forEach((line, i) => console.log(`Line ${i}:`, line));

                    data = parseCSV(csvData);
                } else {
                    alert('不支援的檔案格式。請上傳 .xlsx 或 .csv 檔案。');
                    return;
                }

                console.log(`Parsed ${data.length} records`);

                if (data.length === 0) {
                    alert('檔案中沒有有效的資料。請檢查檔案格式。\n\n請確認：\n1. 檔案包含結帳記錄\n2. 日期格式為「2025/9/1 下午 5:23:55」\n3. 包含金額欄位\n\n請查看瀏覽器 Console 了解詳細錯誤訊息。');
                    return;
                }

                // Update global data
                window.salesData = data;

                // Calculate date range
                const dates = data.map(d => d.date);
                dataDateRange.min = new Date(Math.min(...dates));
                dataDateRange.max = new Date(Math.max(...dates));

                // Update date inputs
                const startInput = document.getElementById('startDate');
                const endInput = document.getElementById('endDate');

                startInput.valueAsDate = dataDateRange.min;
                endInput.valueAsDate = dataDateRange.max;

                // Set min/max attributes
                startInput.min = dataDateRange.min.toISOString().split('T')[0];
                startInput.max = dataDateRange.max.toISOString().split('T')[0];
                endInput.min = dataDateRange.min.toISOString().split('T')[0];
                endInput.max = dataDateRange.max.toISOString().split('T')[0];

                // Show file info
                fileName.textContent = file.name;
                fileStats.textContent = `${data.length} 筆交易記錄 | ${dataDateRange.min.toLocaleDateString('zh-TW')} - ${dataDateRange.max.toLocaleDateString('zh-TW')}`;
                fileInfo.style.display = 'flex';

                // Apply filters and render
                applyFilters();

                console.log(`✅ 成功載入 ${data.length} 筆交易記錄`);
            } catch (error) {
                console.error('解析檔案時發生錯誤:', error);
                alert(`解析檔案時發生錯誤：${error.message}\n\n請查看瀏覽器 Console 了解詳細錯誤訊息。`);
            }
        };

        if (fileExtension === 'csv') {
            reader.readAsText(file);
        } else {
            reader.readAsBinaryString(file);
        }
    }
}

function parseCSV(csvText) {
    const lines = csvText.split('\n');
    const data = [];
    let dateColIndex = -1;
    let amountColIndex = -1;
    let totalColIndex = -1;
    let statusColIndex = -1;

    // Try to detect column structure from first few lines
    for (let i = 0; i < Math.min(10, lines.length); i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(',');

        // Look for date pattern in first column (most common)
        if (parts[0] && parts[0].match(/\d{4}\/\d{1,2}\/\d{1,2}/)) {
            dateColIndex = 0;

            // Try to find amount columns
            for (let j = 1; j < parts.length; j++) {
                const val = parts[j].trim();
                // Look for numeric values
                if (val && !isNaN(parseFloat(val))) {
                    if (amountColIndex === -1) amountColIndex = j;
                    else if (totalColIndex === -1 && j > amountColIndex + 1) totalColIndex = j;
                }
                // Look for status column
                if (val && (val.includes('已開立') || val.includes('已作廢'))) {
                    statusColIndex = j;
                }
            }
            break;
        }
    }

    console.log(`Column detection: date=${dateColIndex}, amount=${amountColIndex}, total=${totalColIndex}, status=${statusColIndex}`);

    // Parse each line
    lines.forEach((line, index) => {
        if (!line.trim()) return;

        const parts = line.split(',');
        if (parts.length < 3) return; // Need at least date and amount

        const dateTimeStr = parts[dateColIndex]?.trim();
        if (!dateTimeStr || !dateTimeStr.match(/\d{4}\/\d{1,2}\/\d{1,2}/)) return;

        // Get amount (try total first, then amount)
        let revenue = 0;
        if (totalColIndex >= 0 && parts[totalColIndex]) {
            revenue = parseFloat(parts[totalColIndex]);
        }
        if (!revenue && amountColIndex >= 0 && parts[amountColIndex]) {
            revenue = parseFloat(parts[amountColIndex]);
        }
        if (!revenue || isNaN(revenue)) return;

        // Check status if available
        if (statusColIndex >= 0 && parts[statusColIndex]) {
            const status = parts[statusColIndex].trim();
            if (status.includes('已作廢')) return;
        }

        try {
            // Parse date and time
            const [datePart, ...timeParts] = dateTimeStr.split(' ');
            const [year, month, day] = datePart.split('/').map(Number);

            let hour = 12; // default to noon if no time
            let minute = 0;
            let second = 0;

            // Try to parse time if available
            if (timeParts.length > 0) {
                const timePart = timeParts.join(' ');
                const timeMatch = timePart.match(/(上午|下午)?\s*(\d+):(\d+)(?::(\d+))?/);
                if (timeMatch) {
                    const period = timeMatch[1];
                    hour = parseInt(timeMatch[2]);
                    minute = parseInt(timeMatch[3]);
                    second = timeMatch[4] ? parseInt(timeMatch[4]) : 0;

                    if (period === '下午' && hour !== 12) {
                        hour += 12;
                    } else if (period === '上午' && hour === 12) {
                        hour = 0;
                    }
                }
            }

            const date = new Date(year, month - 1, day, hour, minute, second);
            if (isNaN(date.getTime())) return; // Invalid date

            const dayOfWeek = date.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            data.push({
                date: date,
                hour: hour,
                dayOfWeek: dayOfWeek,
                isWeekend: isWeekend,
                sales: 1,
                revenue: revenue
            });
        } catch (e) {
            // Silently skip invalid lines
        }
    });

    return data;
}

// Initialize empty data
window.salesData = [];
dataDateRange = { min: null, max: null };
