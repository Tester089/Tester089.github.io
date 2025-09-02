document.addEventListener('DOMContentLoaded', () => {
    const SPREADSHEET_ID = '1WMYjDhP1JWBE94G5AomiqV7GXRnVLZYrGiDs5RaN2ag';
    const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
    const DEFAULT_GID = '477471212';
    const DAY_NAMES_RU = {
        'Monday': 'Пн', 'Tuesday': 'Вт', 'Wednesday': 'Ср',
        'Thursday': 'Чт', 'Friday': 'Пт', 'Saturday': 'Сб'
    };

    const statusIndicator = document.getElementById('status-indicator');
    const scheduleContainer = document.getElementById('schedule-container');
    const controls = document.querySelector('.controls');

    const parseCsv = (csvText) => new Promise((resolve, reject) => {
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => resolve(results.data),
            error: (err) => reject(new Error(`Ошибка парсинга CSV: ${err.message}`)),
        });
    });

    const getClassForLesson = (text) => {
        const lowerText = (text || '').toLowerCase();
        const classMap = {
            lecture: 'lecture', seminar: 'seminar',
            english: 'english', esl: 'english', online: 'online'
        };
        for (const key in classMap) {
            if (lowerText.includes(key)) return classMap[key];
        }
        return '';
    };

    const createLessonHtml = (lessonText) => {
        if (!lessonText) return '';
        const parts = lessonText.split('\n').filter(p => p.trim());
        const className = getClassForLesson(lessonText);
        return `
            <div class="lesson ${className}">
                <div class="lesson-title">${parts[0] || ''}</div>
                <div class="lesson-details">${parts.slice(1).join('<br>')}</div>
            </div>`;
    };

    const renderSchedule = (records) => {
        const [firstRow, ...dataRows] = records;
        const headers = Object.keys(firstRow);

        const groups = headers.reduce((acc, header) => {
            if (header.startsWith('БПАД')) {
                acc.push({ name: header, subgroups: [{ key: header, label: firstRow[header] }] });
            } else if (header.startsWith('Unnamed:') && acc.length > 0 && firstRow[header]) {
                acc[acc.length - 1].subgroups.push({ key: header, label: firstRow[header] });
            }
            return acc;
        }, []);

        const scheduleByDay = dataRows.reduce((acc, row) => {
            const day = (row[''] || (acc.lastDay || '')).trim().split('\n')[0];
            if (day && row['Time slot']) {
                (acc.days[day] = acc.days[day] || []).push(row);
                acc.lastDay = day;
            }
            return acc;
        }, { days: {}, lastDay: '' }).days;

        const tableHtml = `
            <table>
                <thead>
                    <tr>
                        <th rowspan="2" style="width: 120px;">День</th>
                        <th rowspan="2" style="width: 120px;">Время</th>
                        ${groups.map(g => `<th colspan="${g.subgroups.length}">${g.name}</th>`).join('')}
                    </tr>
                    <tr>
                        ${groups.flatMap(g => g.subgroups.map(sub => `<th>${sub.label}</th>`)).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(scheduleByDay).map(([day, rows]) => 
                        rows.map((row, i) => `
                            <tr>
                                ${i === 0 ? `<td class="day-header" rowspan="${rows.length}">${DAY_NAMES_RU[day] || day}</td>` : ''}
                                <td class="time-header">${row['Time slot']}</td>
                                ${groups.flatMap(g => g.subgroups.map(sub => `<td>${createLessonHtml(row[sub.key])}</td>`)).join('')}
                            </tr>`
                        ).join('')
                    ).join('')}
                </tbody>
            </table>`;

        scheduleContainer.innerHTML = tableHtml;
    };

    const loadSchedule = async (gid) => {
        statusIndicator.textContent = 'Загрузка данных...';
        scheduleContainer.innerHTML = '';
        try {
            const url = `${CORS_PROXY}${encodeURIComponent(`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${gid}`)}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Ошибка сети: ${response.statusText}`);

            const csvText = await response.text();
            const records = await parseCsv(csvText);

            if (records.length === 0) throw new Error("Получены пустые данные.");

            renderSchedule(records);
            statusIndicator.textContent = 'Расписание загружено.';
        } catch (error) {
            console.error(error);
            statusIndicator.textContent = `Ошибка: ${error.message}`;
        }
    };

    controls.addEventListener('click', (e) => {
        const button = e.target.closest('button[data-gid]');
        if (!button) return;

        controls.querySelector('.active')?.classList.remove('active');
        button.classList.add('active');
        loadSchedule(button.dataset.gid);
    });

    const init = () => {
        const initialButton = controls.querySelector(`button[data-gid="${DEFAULT_GID}"]`);
        if (initialButton) {
            initialButton.click();
        } else {
            statusIndicator.textContent = 'Кнопка для загрузки по умолчанию не найдена.';
        }
    };

    init();
});