document.addEventListener('DOMContentLoaded', () => {
    console.log('[LOG] DOM loaded. Initializing GitHub Pages solution with CORS Proxy.');

    // --- КОНФИГУРАЦИЯ ---
    const SPREADSHEET_ID = '1WMYjDhP1JWBE94G5AomiqV7GXRnVLZYrGiDs5RaN2ag';
    // Бесплатный прокси, который решает проблему CORS
    const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

    // --- ЭЛЕМЕНТЫ DOM ---
    const statusIndicator = document.getElementById('status-indicator');
    const scheduleContainer = document.getElementById('schedule-container');
    const weekButtons = document.querySelectorAll('.controls button');

    // --- КОНСТАНТЫ ---
    const DAY_NAMES_RU = {
        'Monday': 'Понедельник', 'Tuesday': 'Вторник', 'Wednesday': 'Среда',
        'Thursday': 'Четверг', 'Friday': 'Пятница', 'Saturday': 'Суббота'
    };

    // --- ОБРАБОТЧИКИ СОБЫТИЙ ---
    weekButtons.forEach(button => {
        button.addEventListener('click', () => {
            const gid = button.dataset.gid;
            loadSchedule(gid);
            weekButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        });
    });

    /**
     * Загружает расписание через CORS прокси, используя /export ссылку.
     */
    async function loadSchedule(gid) {
        console.group(`[PROCESS] Loading schedule for GID: ${gid}`);
        statusIndicator.textContent = 'Загрузка данных из Google...';
        scheduleContainer.innerHTML = '';

        // 1. Формируем нужную нам /export ссылку
        const googleSheetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${gid}`;

        // 2. Оборачиваем ее в URL прокси (обязательно кодируем)
        const proxyUrl = `${CORS_PROXY}${encodeURIComponent(googleSheetUrl)}`;

        console.info(`[FETCH] Requesting via proxy: ${proxyUrl}`);

        try {
            const response = await fetch(proxyUrl);
            if (!response.ok) {
                throw new Error(`Ошибка сети: ${response.statusText}`);
            }
            const csvText = await response.text();

            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: false,
                complete: (results) => {
                    const records = results.data.filter(row => Object.values(row).some(val => val && val.trim() !== ''));
                    if (records.length === 0) throw new Error("Данные не найдены.");

                    console.info('[RENDER] Starting table generation...');
                    renderSchedule(records);
                    statusIndicator.textContent = 'Расписание загружено.';
                },
                error: (err) => { throw new Error(`Ошибка парсинга CSV: ${err.message}`); }
            });
        } catch (error) {
            console.error('💥 [CRITICAL] An error occurred:', error);
            statusIndicator.textContent = `Не удалось загрузить расписание. Ошибка: ${error.message}.`;
        } finally {
            console.groupEnd();
        }
    }

    /**
     * Генерирует HTML-таблицу с правильной структурой и rowspan.
     */
    function renderSchedule(records) {
        const firstRow = records[0];
        const scheduleData = records.slice(1);
        const headers = Object.keys(firstRow);

        const groups = [];
        let currentGroup = null;
        headers.forEach(header => {
            if (header.startsWith('БПАД')) {
                currentGroup = { name: header, subgroups: [{ key: header, label: firstRow[header] }] };
                groups.push(currentGroup);
            } else if (header.startsWith('Unnamed:') && currentGroup && firstRow[header]) {
                currentGroup.subgroups.push({ key: header, label: firstRow[header] });
            }
        });

        const scheduleByDay = {};
        let currentDay = '';
        scheduleData.forEach(row => {
            const dayValue = (row[''] || '').trim();
            if (dayValue) currentDay = dayValue.split('\n')[0];
            if (!currentDay || !row['Time slot']) return;
            if (!scheduleByDay[currentDay]) scheduleByDay[currentDay] = [];
            scheduleByDay[currentDay].push(row);
        });

        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const headerRow1 = document.createElement('tr');
        headerRow1.innerHTML = `<th rowspan="2" style="width: 120px;">День</th><th rowspan="2" style="width: 120px;">Время</th>`;
        groups.forEach(group => {
            const th = document.createElement('th');
            th.colSpan = group.subgroups.length || 1;
            th.textContent = group.name;
            headerRow1.appendChild(th);
        });
        const headerRow2 = document.createElement('tr');
        groups.forEach(group => {
            group.subgroups.forEach(sub => {
                const th = document.createElement('th');
                th.textContent = sub.label;
                headerRow2.appendChild(th);
            });
        });
        thead.appendChild(headerRow1);
        thead.appendChild(headerRow2);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        for (const day in scheduleByDay) {
            const dayRows = scheduleByDay[day];
            dayRows.forEach((row, index) => {
                const tr = document.createElement('tr');
                if (index === 0) {
                    const dayCell = document.createElement('td');
                    dayCell.className = 'day-header';
                    dayCell.rowSpan = dayRows.length;
                    dayCell.textContent = DAY_NAMES_RU[day] || day;
                    tr.appendChild(dayCell);
                }
                const timeCell = document.createElement('td');
                timeCell.className = 'time-header';
                timeCell.textContent = row['Time slot'];
                tr.appendChild(timeCell);

                groups.forEach(group => {
                    group.subgroups.forEach(sub => {
                        const cell = document.createElement('td');
                        const lessonText = row[sub.key];
                        if (lessonText) {
                            const div = document.createElement('div');
                            div.className = 'lesson ' + getClassForLesson(String(lessonText));
                            const parts = String(lessonText).split('\n').filter(p => p.trim() !== '');
                            div.innerHTML = `<div class="lesson-title">${parts[0] || ''}</div>
                                           <div class="lesson-details">${parts.slice(1).join('<br>')}</div>`;
                            cell.appendChild(div);
                        }
                        tr.appendChild(cell);
                    });
                });
                tbody.appendChild(tr);
            });
        }
        table.appendChild(tbody);
        scheduleContainer.innerHTML = '';
        scheduleContainer.appendChild(table);
    }

    function getClassForLesson(text) {
        const lowerText = text.toLowerCase();
        if (lowerText.includes('lecture')) return 'lecture';
        if (lowerText.includes('english') || lowerText.includes('esl')) return 'english';
        if (lowerText.includes('seminar')) return 'seminar';
        if (lowerText.includes('online')) return 'online';
        return '';
    }

    // Запускаем загрузку для второй недели по умолчанию
    console.log('[LOG] Triggering initial load for the default week.');
    document.querySelector('button[data-gid="477471212"]').click();
});