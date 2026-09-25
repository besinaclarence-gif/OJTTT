// Default users data (including Clarence as initial user)
const DEFAULT_USERS = {
    "admin@ojt.local": {
        password: "Admin@123",
        name: "OJT Administrator",
        role: "admin",
        timeRecords: {},
        holidays: [],
        absences: [],
        timePreferences: { timeIn: '08:00', timeOut: '18:00' },
        documents: { daily: [], weekly: [], monthly: [] }
    },
    "besina.clarence@llcc.edu.ph": {
        password: "LLCCITD@008",
        name: "Clarence Besina",
        course: "Bachelor of Science in Information Technology",
        school: "Liceo de Cagayan University",
        timeRecords: {},
        holidays: [],
        absences: [],
        timePreferences: { timeIn: '08:00', timeOut: '18:00' },
        documents: { daily: [], weekly: [], monthly: [] }
    }
};

// Global state
let users = {};
let currentUser = null;
let currentDate = new Date();
let selectedDate = null;
let dtrCurrentDate = new Date();
let holidayCache = {};

const OJT_TARGET_HOURS = 1800;
const ADMIN_EMAIL = 'admin@ojt.local';
const HOLIDAY_COUNTRY_CODE = 'PH';
const HOLIDAY_API_BASE_URL = 'https://date.nager.at/api/v3/PublicHolidays';
const LUNCH_START_MINUTES = 12 * 60;
const LUNCH_END_MINUTES = 13 * 60;

// Initialize app
function initApp() {
    loadHolidayCache();
    populateTimeDropdowns();

    // First, check if we have old data but haven't migrated it
    const oldTimeRecords = localStorage.getItem('timeRecords');
    const hasOldData = oldTimeRecords && Object.keys(JSON.parse(oldTimeRecords)).length > 0;
    const hasNewUsers = localStorage.getItem('ojtUsers');
    
    // If we have old data and either don't have new users or new users have empty data, do migration
    if (hasOldData) {
        const usersData = hasNewUsers ? JSON.parse(localStorage.getItem('ojtUsers')) : null;
        const needsMigration = !usersData || 
            !usersData['besina.clarence@llcc.edu.ph'] || 
            Object.keys(usersData['besina.clarence@llcc.edu.ph'].timeRecords).length === 0;
        
        if (needsMigration) {
            // Force migration
            localStorage.removeItem('ojtUsers');
            localStorage.removeItem('currentUserEmail');
        }
    }
    
    loadUsers();
    
    // Check if user is already logged in
    const savedUserEmail = localStorage.getItem('currentUserEmail');
    if (savedUserEmail && users[savedUserEmail]) {
        loginUser(savedUserEmail, false);
    } else {
        document.getElementById('loginPage').style.display = 'flex';
    }
    
    // Initialize UI event listeners
    setupAuthListeners();
    setupAppListeners();
}

// Load users from localStorage or defaults
function loadUsers() {
    const savedUsers = localStorage.getItem('ojtUsers');
    if (savedUsers) {
        users = JSON.parse(savedUsers);
    } else {
        // Try to migrate old data first!
        const oldTimeRecords = localStorage.getItem('timeRecords');
        const oldHolidays = localStorage.getItem('holidays');
        const oldDocuments = localStorage.getItem('documents');
        
        if (oldTimeRecords || oldHolidays || oldDocuments) {
            // Found old data - migrate it!
            users = { ...DEFAULT_USERS };
            
            if (oldTimeRecords) {
                users['besina.clarence@llcc.edu.ph'].timeRecords = JSON.parse(oldTimeRecords);
            }
            
            if (oldHolidays) {
                users['besina.clarence@llcc.edu.ph'].holidays = JSON.parse(oldHolidays);
            }
            
            if (oldDocuments) {
                users['besina.clarence@llcc.edu.ph'].documents = JSON.parse(oldDocuments);
            }
            
            saveUsers();
        } else {
            // No old data, use defaults
            users = { ...DEFAULT_USERS };
            saveUsers();
        }
    }

    // Keep the administrator account available for existing installations too.
    if (!users[ADMIN_EMAIL]) {
        users[ADMIN_EMAIL] = { ...DEFAULT_USERS[ADMIN_EMAIL] };
        saveUsers();
    }

    let recordsUpdated = false;
    Object.values(users).forEach(user => {
        if (!user.absences) {
            user.absences = [];
        }
        if (!user.timePreferences) {
            user.timePreferences = { timeIn: '08:00', timeOut: '18:00' };
        }
        Object.values(user.timeRecords || {}).forEach(record => {
            if (!record?.timeIn || !record?.timeOut) return;

            const hours = calculateHours(record.timeIn, record.timeOut);
            if (record.hours !== hours) {
                record.hours = hours;
                recordsUpdated = true;
            }
        });
    });

    if (recordsUpdated) saveUsers();
}

// Save users to localStorage
function saveUsers() {
    localStorage.setItem('ojtUsers', JSON.stringify(users));
}

// Authentication listeners
function setupAuthListeners() {
    // Tab switching
    document.getElementById('loginTabBtn').addEventListener('click', () => {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('loginTabBtn').classList.add('active');
        document.getElementById('registerTabBtn').classList.remove('active');
    });
    
    document.getElementById('registerTabBtn').addEventListener('click', () => {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
        document.getElementById('loginTabBtn').classList.remove('active');
        document.getElementById('registerTabBtn').classList.add('active');
    });
    
    // Login button
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    
    // Register button
    document.getElementById('registerBtn').addEventListener('click', handleRegister);
}

// Handle login
function handleLogin() {
    const email = document.getElementById('emailInput').value.toLowerCase().trim();
    const password = document.getElementById('passwordInput').value;
    
    if (users[email] && users[email].password === password) {
        loginUser(email, true);
        document.getElementById('loginErrorMessage').style.display = 'none';
    } else {
        document.getElementById('loginErrorMessage').style.display = 'block';
    }
}

// Handle registration
function handleRegister() {
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.toLowerCase().trim();
    const password = document.getElementById('registerPassword').value;
    const course = document.getElementById('registerCourse').value.trim();
    const school = document.getElementById('registerSchool').value.trim();
    
    if (!name || !email || !password || !course || !school) {
        document.getElementById('registerErrorMessage').textContent = 'Please fill in all fields';
        document.getElementById('registerErrorMessage').style.display = 'block';
        document.getElementById('registerSuccessMessage').style.display = 'none';
        return;
    }
    
    if (users[email]) {
        document.getElementById('registerErrorMessage').textContent = 'Email already registered';
        document.getElementById('registerErrorMessage').style.display = 'block';
        document.getElementById('registerSuccessMessage').style.display = 'none';
        return;
    }
    
    // Create new user
    users[email] = {
        password: password,
        name: name,
        course: course,
        school: school,
        timeRecords: {},
        holidays: [],
        absences: [],
        timePreferences: { timeIn: '08:00', timeOut: '18:00' },
        documents: { daily: [], weekly: [], monthly: [] }
    };
    
    saveUsers();
    
    document.getElementById('registerErrorMessage').style.display = 'none';
    document.getElementById('registerSuccessMessage').style.display = 'block';
    
    // Clear form
    document.getElementById('registerName').value = '';
    document.getElementById('registerEmail').value = '';
    document.getElementById('registerPassword').value = '';
    document.getElementById('registerCourse').value = '';
    document.getElementById('registerSchool').value = '';
}

// Login user and show app
function loginUser(email, saveState = true) {
    currentUser = users[email];
    if (saveState) {
        localStorage.setItem('currentUserEmail', email);
    }

    document.getElementById('loginPage').style.display = 'none';
    if (currentUser.role === 'admin') {
        document.getElementById('adminApp').style.display = 'flex';
        renderAdminDashboard();
        return;
    }

    populateTimeDropdowns();
    document.getElementById('mainApp').style.display = 'flex';
    
    // Update student info in DTR
    document.getElementById('dtrStudentName').textContent = currentUser.name;
    document.getElementById('dtrStudentCourse').textContent = currentUser.course;
    document.getElementById('dtrStudentSchool').textContent = currentUser.school;
    
    void refreshDashboard();
}

// Logout
function logout() {
    currentUser = null;
    localStorage.removeItem('currentUserEmail');
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('adminApp').style.display = 'none';
    document.getElementById('loginPage').style.display = 'flex';
    
    // Clear form
    document.getElementById('emailInput').value = '';
    document.getElementById('passwordInput').value = '';
}

// App listeners
function setupAppListeners() {
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('adminLogoutBtn').addEventListener('click', logout);
    
    // Calendar navigation
    document.getElementById('prevMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        void loadHolidayYears([currentDate.getFullYear()]).then(renderCalendar);
    });
    
    document.getElementById('nextMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        void loadHolidayYears([currentDate.getFullYear()]).then(renderCalendar);
    });
    
    // Save/Delete buttons
    document.getElementById('saveBtn').addEventListener('click', saveTimeRecord);
    document.getElementById('deleteBtn').addEventListener('click', deleteTimeRecord);
    document.getElementById('toggleHolidayBtn').addEventListener('click', toggleHoliday);
    document.getElementById('toggleAbsentBtn').addEventListener('click', toggleAbsence);
    
    // Tab functionality
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            
            // Hide all overlays first
            document.getElementById('reports').style.display = 'none';
            document.getElementById('dtr').style.display = 'none';
            
            if (tabId === 'reports') {
                document.getElementById('reports').style.display = 'flex';
            } else if (tabId === 'dtr') {
                document.getElementById('dtr').style.display = 'flex';
                renderDtrReport();
            }
            
            // Update active tab button
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
    
    // Close reports when clicking outside content
    document.getElementById('reports').addEventListener('click', (e) => {
        if (e.target === document.getElementById('reports')) {
            closeReports();
        }
    });
    
    // Close DTR when clicking outside content
    document.getElementById('dtr').addEventListener('click', (e) => {
        if (e.target === document.getElementById('dtr')) {
            closeDtr();
        }
    });
    
    // DTR Navigation
    document.getElementById('dtrPrevMonth').addEventListener('click', () => {
        dtrCurrentDate.setMonth(dtrCurrentDate.getMonth() - 1);
        void loadHolidayYears([dtrCurrentDate.getFullYear()]).then(renderDtrReport);
    });
    
    document.getElementById('dtrNextMonth').addEventListener('click', () => {
        dtrCurrentDate.setMonth(dtrCurrentDate.getMonth() + 1);
        void loadHolidayYears([dtrCurrentDate.getFullYear()]).then(renderDtrReport);
    });
    
    // PDF Export
    document.getElementById('exportPdfBtn').addEventListener('click', () => {
        window.print();
    });
}

// Helper functions
function formatTime(timeStr) {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':').map(Number);
    let period = 'AM';
    let displayHours = hours;
    
    if (hours >= 12) {
        period = 'PM';
        displayHours = hours > 12 ? hours - 12 : hours;
    }
    
    if (displayHours === 0) displayHours = 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function calculateHours(timeIn, timeOut) {
    const [inH, inM] = timeIn.split(':').map(Number);
    const [outH, outM] = timeOut.split(':').map(Number);

    const timeInMinutes = inH * 60 + inM;
    const timeOutMinutes = outH * 60 + outM;
    const workedMinutes = timeOutMinutes - timeInMinutes;

    // Exclude only the portion of the fixed 12:00 PM–1:00 PM lunch break
    // that falls within the recorded shift.
    const lunchMinutes = Math.max(
        0,
        Math.min(timeOutMinutes, LUNCH_END_MINUTES) - Math.max(timeInMinutes, LUNCH_START_MINUTES)
    );

    return parseFloat(((workedMinutes - lunchMinutes) / 60).toFixed(2));
}

function renderAdminDashboard() {
    const studentEntries = Object.entries(users)
        .filter(([, user]) => user.role !== 'admin')
        .sort(([, studentA], [, studentB]) => studentA.name.localeCompare(studentB.name));
    const studentsBody = document.getElementById('adminStudentsBody');
    const recordsBody = document.getElementById('adminRecordsBody');
    const totalStudents = document.getElementById('adminStudentCount');
    const totalHours = document.getElementById('adminTotalHours');

    let allHours = 0;
    let recordCount = 0;
    studentsBody.innerHTML = '';
    recordsBody.innerHTML = '';

    const appendRow = (body, values, emphasizedColumn) => {
        const row = document.createElement('tr');
        values.forEach((value, index) => {
            const cell = document.createElement('td');
            cell.textContent = value;
            if (index === emphasizedColumn) cell.className = 'admin-hours';
            row.appendChild(cell);
        });
        body.appendChild(row);
    };

    studentEntries.forEach(([email, student]) => {
        const records = Object.entries(student.timeRecords || {}).sort(([dateA], [dateB]) => dateB.localeCompare(dateA));
        const hours = records.reduce((total, [, record]) => total + Number(record.hours || 0), 0);
        allHours += hours;
        recordCount += records.length;

        appendRow(studentsBody, [
            student.name,
            email,
            student.course || '-',
            student.school || '-',
            records.length,
            `${hours.toFixed(2)} hrs`
        ], 5);

        records.forEach(([date, record]) => {
            appendRow(recordsBody, [
                student.name,
                date,
                formatTime(record.timeIn),
                formatTime(record.timeOut),
                `${Number(record.hours || 0).toFixed(2)} hrs`
            ], 4);
        });
    });

    totalStudents.textContent = studentEntries.length;
    totalHours.textContent = allHours.toFixed(1);
    document.getElementById('adminRecordCount').textContent = recordCount;

    if (studentEntries.length === 0) {
        studentsBody.innerHTML = '<tr><td colspan="6" class="admin-empty">No students have registered yet.</td></tr>';
    }
    if (recordCount === 0) {
        recordsBody.innerHTML = '<tr><td colspan="5" class="admin-empty">No time records have been saved yet.</td></tr>';
    }
}

function getMostCommonTime(type) {
    if (!currentUser) return type === 'timeIn' ? '08:00' : '18:00';

    const preferenceValue = currentUser.timePreferences?.[type];
    if (preferenceValue) return preferenceValue;

    const counts = {};
    Object.values(currentUser.timeRecords).forEach(record => {
        const value = record?.[type];
        if (!value) return;
        counts[value] = (counts[value] || 0) + 1;
    });

    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return entries.length > 0 ? entries[0][0] : (type === 'timeIn' ? '08:00' : '18:00');
}

function updateTimePreferences(timeIn, timeOut) {
    if (!currentUser) return;

    currentUser.timePreferences = {
        timeIn: timeIn || currentUser.timePreferences?.timeIn || '08:00',
        timeOut: timeOut || currentUser.timePreferences?.timeOut || '18:00'
    };
    saveUsers();
}

function populateTimeDropdowns() {
    const timeInSelect = document.getElementById('timeIn');
    const timeOutSelect = document.getElementById('timeOut');

    if (!timeInSelect || !timeOutSelect) return;

    const buildOptions = () => {
        const options = [];
        options.push({ value: '', label: 'Select time' });

        const preferredIn = getMostCommonTime('timeIn');
        const preferredOut = getMostCommonTime('timeOut');
        const favorites = [preferredIn, preferredOut, '07:00', '07:30', '08:00', '08:30', '12:00', '13:00', '16:00', '17:00', '18:00'];

        favorites.forEach(value => {
            if (!value || options.some(option => option.value === value)) return;
            options.push({ value, label: `${formatTime(value)}${value === preferredIn || value === preferredOut ? '  • usual' : ''}` });
        });

        for (let hour = 0; hour < 24; hour++) {
            for (let minute = 0; minute < 60; minute += 30) {
                const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                if (options.some(option => option.value === value)) continue;
                options.push({ value, label: formatTime(value) });
            }
        }

        return options;
    };

    const options = buildOptions();

    [timeInSelect, timeOutSelect].forEach(select => {
        select.innerHTML = options.map(option => `<option value="${option.value}">${option.label}</option>`).join('');
    });

    document.getElementById('timeInLabel').textContent = `Time In (${formatTime(getMostCommonTime('timeIn'))} usual)`;
    document.getElementById('timeOutLabel').textContent = `Time Out (${formatTime(getMostCommonTime('timeOut'))} usual)`;
}

function setDropdownValue(selectId, value) {
    const select = document.getElementById(selectId);
    if (!select) return;

    if (value && !Array.from(select.options).some(option => option.value === value)) {
        const customOption = document.createElement('option');
        customOption.value = value;
        customOption.textContent = `${formatTime(value)} (saved)`;
        customOption.dataset.custom = 'true';
        select.appendChild(customOption);
    }

    select.value = value || '';
}

function applyUsualTimesIfEmpty() {
    const timeInSelect = document.getElementById('timeIn');
    const timeOutSelect = document.getElementById('timeOut');

    if (timeInSelect && !timeInSelect.value) {
        timeInSelect.value = getMostCommonTime('timeIn');
    }

    if (timeOutSelect && !timeOutSelect.value) {
        timeOutSelect.value = getMostCommonTime('timeOut');
    }
}

function loadHolidayCache() {
    const savedCache = localStorage.getItem('ojtHolidayCache');
    if (!savedCache) {
        holidayCache = {};
        return;
    }

    try {
        holidayCache = JSON.parse(savedCache) || {};
    } catch (error) {
        holidayCache = {};
    }
}

function saveHolidayCache() {
    localStorage.setItem('ojtHolidayCache', JSON.stringify(holidayCache));
}

function getHolidayDatesForYear(year) {
    return holidayCache[year] || [];
}

function getRecordYears(timeRecords = currentUser?.timeRecords || {}) {
    return [...new Set(Object.keys(timeRecords).map(dateStr => Number(dateStr.slice(0, 4))))]
        .filter(year => Number.isFinite(year));
}

async function ensureHolidayYearLoaded(year) {
    if (!Number.isFinite(year)) return [];

    if (holidayCache[year]) {
        return holidayCache[year];
    }

    const response = await fetch(`${HOLIDAY_API_BASE_URL}/${year}/${HOLIDAY_COUNTRY_CODE}`);
    if (!response.ok) {
        holidayCache[year] = [];
        saveHolidayCache();
        return [];
    }

    const holidays = await response.json();
    holidayCache[year] = holidays
        .filter(holiday => holiday && holiday.date)
        .map(holiday => holiday.date);
    saveHolidayCache();
    return holidayCache[year];
}

async function loadHolidayYears(years) {
    const uniqueYears = [...new Set(years)].filter(year => Number.isFinite(year));
    if (uniqueYears.length === 0) return;

    await Promise.all(uniqueYears.map(year => ensureHolidayYearLoaded(year)));
}

function isManualHoliday(dateStr) {
    return Boolean(currentUser && currentUser.holidays.includes(dateStr));
}

function isAbsentDate(dateStr) {
    return Boolean(currentUser && currentUser.absences.includes(dateStr));
}

function isApiHoliday(dateStr) {
    const year = Number(dateStr.slice(0, 4));
    return getHolidayDatesForYear(year).includes(dateStr);
}

function isHolidayDate(dateStr) {
    return isManualHoliday(dateStr) || isApiHoliday(dateStr);
}

function isCountableWorkDate(dateStr) {
    const dateParts = dateStr.split('-');
    const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
    return date.getDay() !== 0 && !isHolidayDate(dateStr) && !isAbsentDate(dateStr);
}

function getCountableRecords() {
    return Object.entries(currentUser.timeRecords).filter(([dateStr]) => isCountableWorkDate(dateStr));
}

function formatLocalDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function updateHolidayButtonState(dateStr) {
    const toggleHolidayBtn = document.getElementById('toggleHolidayBtn');
    const manualHoliday = isManualHoliday(dateStr);
    const apiHoliday = isApiHoliday(dateStr);

    if (apiHoliday && !manualHoliday) {
        toggleHolidayBtn.textContent = 'Official Holiday';
        toggleHolidayBtn.disabled = true;
        return;
    }

    toggleHolidayBtn.disabled = false;
    toggleHolidayBtn.textContent = manualHoliday ? 'Unmark Holiday' : 'Mark Holiday';
}

function updateAbsenceButtonState(dateStr) {
    const toggleAbsentBtn = document.getElementById('toggleAbsentBtn');
    if (!toggleAbsentBtn) return;

    const dateParts = dateStr.split('-');
    const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
    const unavailable = date.getDay() === 0 || isHolidayDate(dateStr);

    if (unavailable) {
        toggleAbsentBtn.disabled = true;
        toggleAbsentBtn.textContent = 'Mark Absent';
        return;
    }

    toggleAbsentBtn.disabled = false;
    toggleAbsentBtn.textContent = isAbsentDate(dateStr) ? 'Unmark Absent' : 'Mark Absent';
}

async function refreshDashboard() {
    if (!currentUser) return;

    const yearsToLoad = new Set([
        currentDate.getFullYear(),
        dtrCurrentDate.getFullYear(),
        ...getRecordYears(currentUser.timeRecords)
    ]);

    await loadHolidayYears([...yearsToLoad]);
    renderCalendar();
    await updateProgress();
    renderMonthlyTotals();
    renderOjtMapping();
    renderDocuments();

    if (document.getElementById('dtr').style.display === 'flex') {
        await renderDtrReport();
    }
}

// Calendar
function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    document.getElementById('monthYear').textContent = 
        currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDay = firstDay.getDay();
    const totalDays = lastDay.getDate();
    
    const calendarGrid = document.getElementById('calendarGrid');
    calendarGrid.innerHTML = '';
    
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    days.forEach(day => {
        const header = document.createElement('div');
        header.className = 'day-header';
        header.textContent = day;
        calendarGrid.appendChild(header);
    });
    
    for (let i = 0; i < startingDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'day-cell disabled';
        calendarGrid.appendChild(empty);
    }
    
    for (let day = 1; day <= totalDays; day++) {
        const date = new Date(year, month, day);
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        const cell = document.createElement('div');
        cell.className = 'day-cell';
        
        if (date.getDay() === 0) {
            cell.classList.add('sunday');
        }
        
        if (isHolidayDate(dateStr)) {
            cell.classList.add('holiday');
        }

        if (isAbsentDate(dateStr)) {
            cell.classList.add('absent');
        }
        
        if (currentUser.timeRecords[dateStr]) {
            cell.classList.add('has-data');
        }
        
        if (selectedDate === dateStr) {
            cell.classList.add('selected');
        }
        
        cell.innerHTML = `<div class="date">${day}</div>`;
        
        if (currentUser.timeRecords[dateStr]) {
            const record = currentUser.timeRecords[dateStr];
            cell.innerHTML += `
                <div class="time-display">
                    <div class="time-entry"><span class="time-label">In:</span>${formatTime(record.timeIn)}</div>
                    <div class="time-entry"><span class="time-label">Out:</span>${formatTime(record.timeOut)}</div>
                </div>
                <div class="hours">${record.hours.toFixed(1)}hrs</div>
            `;
        }
        
        cell.addEventListener('click', () => selectDate(dateStr));
        calendarGrid.appendChild(cell);
    }
}

function selectDate(dateStr) {
    selectedDate = dateStr;
    renderCalendar();
    
    const dateParts = dateStr.split('-');
    const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
    
    document.getElementById('selectedDateTitle').textContent = 
        date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    
    if (currentUser.timeRecords[dateStr]) {
        const record = currentUser.timeRecords[dateStr];
        setDropdownValue('timeIn', record.timeIn);
        setDropdownValue('timeOut', record.timeOut);
    } else {
        setDropdownValue('timeIn', '');
        setDropdownValue('timeOut', '');
        applyUsualTimesIfEmpty();
    }
    
    const isSunday = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]).getDay() === 0;
    document.getElementById('holidaySection').style.display = isSunday ? 'none' : 'flex';
    document.getElementById('absenceSection').style.display = (isSunday || isHolidayDate(dateStr)) ? 'none' : 'flex';

    updateHolidayButtonState(dateStr);
    updateAbsenceButtonState(dateStr);
}

function saveTimeRecord() {
    if (!selectedDate) return;
    
    const timeIn = document.getElementById('timeIn').value;
    const timeOut = document.getElementById('timeOut').value;
    
    if (!timeIn || !timeOut) return;
    if (timeIn >= timeOut) return;
    
    const hours = calculateHours(timeIn, timeOut);
    
    currentUser.timeRecords[selectedDate] = {
        timeIn: timeIn,
        timeOut: timeOut,
        hours: hours
    };

    updateTimePreferences(timeIn, timeOut);

    const absentIdx = currentUser.absences.indexOf(selectedDate);
    if (absentIdx > -1) {
        currentUser.absences.splice(absentIdx, 1);
    }
    
    saveUsers();
    void refreshDashboard();
}

function deleteTimeRecord() {
    if (!selectedDate) return;
    
    delete currentUser.timeRecords[selectedDate];
    const absentIdx = currentUser.absences.indexOf(selectedDate);
    if (absentIdx > -1) {
        currentUser.absences.splice(absentIdx, 1);
    }
    saveUsers();
    
    setDropdownValue('timeIn', '');
    setDropdownValue('timeOut', '');

    void refreshDashboard();
}

function toggleHoliday() {
    if (!selectedDate) return;

    if (isApiHoliday(selectedDate) && !isManualHoliday(selectedDate)) {
        return;
    }
    
    const idx = currentUser.holidays.indexOf(selectedDate);
    if (idx > -1) {
        currentUser.holidays.splice(idx, 1);
    } else {
        currentUser.holidays.push(selectedDate);
    }
    
    saveUsers();
    void refreshDashboard();
}

function toggleAbsence() {
    if (!selectedDate) return;

    const dateParts = selectedDate.split('-');
    const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
    if (date.getDay() === 0 || isHolidayDate(selectedDate)) {
        return;
    }

    const idx = currentUser.absences.indexOf(selectedDate);
    if (idx > -1) {
        currentUser.absences.splice(idx, 1);
    } else {
        currentUser.absences.push(selectedDate);
        delete currentUser.timeRecords[selectedDate];
        setDropdownValue('timeIn', '');
        setDropdownValue('timeOut', '');
    }

    saveUsers();
    void refreshDashboard();
}

// Progress
async function updateProgress() {
    const recordYears = getRecordYears();
    await loadHolidayYears(recordYears);

    const countableRecords = getCountableRecords();
    let totalHours = 0;

    countableRecords.forEach(([, record]) => {
        totalHours += record.hours;
    });

    const remaining = Math.max(OJT_TARGET_HOURS - totalHours, 0);
    const avgPerDay = countableRecords.length > 0
        ? totalHours / countableRecords.length
        : 0;

    document.getElementById('renderedHours').textContent = totalHours.toFixed(1);
    document.getElementById('remainingHours').textContent = remaining.toFixed(1);

    if (totalHours > 0 && remaining > 0 && avgPerDay > 0) {
        const daysNeeded = Math.ceil(remaining / avgPerDay);
        const endDate = new Date();
        let daysAdded = 0;

        while (daysAdded < daysNeeded) {
            endDate.setDate(endDate.getDate() + 1);
            await ensureHolidayYearLoaded(endDate.getFullYear());

            if (endDate.getDay() !== 0 && !isHolidayDate(formatLocalDateKey(endDate))) {
                daysAdded++;
            }
        }

        document.getElementById('endDateValue').textContent = 
            endDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    } else {
        document.getElementById('endDateValue').textContent = 'Estimated Completion';
    }
}

function getMonthlyTotals() {
    const monthlyTotals = {};

    Object.entries(currentUser.timeRecords).forEach(([dateStr, record]) => {
        if (!isCountableWorkDate(dateStr)) {
            return;
        }

        const [year, month] = dateStr.split('-');
        const key = `${year}-${month}`;

        if (!monthlyTotals[key]) {
            const monthDate = new Date(Number(year), Number(month) - 1, 1);
            monthlyTotals[key] = {
                key,
                label: monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
                totalHours: 0
            };
        }

        monthlyTotals[key].totalHours += record.hours;
    });

    return Object.entries(monthlyTotals)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([, value]) => value);
}

function renderMonthlyTotals() {
    const monthlyTotals = getMonthlyTotals();
    ['dashboardMonthlyTotalsList', 'monthlyTotalsList'].forEach(listId => {
        const list = document.getElementById(listId);
        if (!list) return;

        list.innerHTML = '';

        if (monthlyTotals.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'monthly-total-empty';
            emptyState.textContent = 'No hours recorded yet.';
            list.appendChild(emptyState);
            return;
        }

        monthlyTotals.forEach(month => {
            const item = document.createElement('div');
            item.className = 'monthly-total-item';

            const label = document.createElement('span');
            label.className = 'monthly-total-label';
            label.textContent = month.label;

            const value = document.createElement('span');
            value.className = 'monthly-total-value';
            value.textContent = `${month.totalHours.toFixed(1)} hrs`;

            item.appendChild(label);
            item.appendChild(value);
            list.appendChild(item);
        });
    });
}

function renderOjtMapping() {
    const monthBody = document.getElementById('ojtMappingMonths');
    if (!monthBody) return;

    const monthlyTotals = getMonthlyTotals();
    const firstSemesterMonths = new Set([5, 6, 7, 8, 9, 10]);
    let firstSemesterTotal = 0;
    let secondSemesterTotal = 0;
    let grandTotal = 0;

    monthBody.innerHTML = '';

    if (monthlyTotals.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.className = 'mapping-empty-row';
        emptyRow.innerHTML = '<td colspan="2">No OJT hours recorded yet.</td>';
        monthBody.appendChild(emptyRow);
    } else {
        monthlyTotals.forEach(month => {
            const date = new Date(`${month.key}-01T00:00:00`);
            const total = Number(month.totalHours) || 0;
            grandTotal += total;

            if (firstSemesterMonths.has(date.getMonth())) firstSemesterTotal += total;
            else secondSemesterTotal += total;

            const row = document.createElement('tr');
            row.innerHTML = `<td>${month.label}</td><td>${total.toFixed(1)}</td>`;
            monthBody.appendChild(row);
        });
    }

    document.getElementById('firstSemesterHours').textContent = firstSemesterTotal.toFixed(1);
    document.getElementById('secondSemesterHours').textContent = secondSemesterTotal.toFixed(1);
    document.getElementById('ojtMappingGrandTotal').textContent = grandTotal.toFixed(1);
    document.getElementById('semesterGrandTotal').textContent = grandTotal.toFixed(1);
}

// Documents
function renderDocuments() {
    renderDocumentList('daily');
    renderDocumentList('weekly');
    renderDocumentList('monthly');
}

function renderDocumentList(type) {
    const list = document.getElementById(`${type}List`);
    list.innerHTML = '';
    
    currentUser.documents[type].forEach((doc, idx) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <span class="name">${doc.name}</span>
            <div class="actions">
                <button onclick="viewDocument('${type}', ${idx})">View</button>
                <button onclick="deleteDocument('${type}', ${idx})">Delete</button>
            </div>
        `;
        list.appendChild(item);
    });
}

function handleFileUpload(event, type) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        currentUser.documents[type].push({
            name: file.name,
            type: file.type,
            data: e.target.result
        });
        saveUsers();
        renderDocuments();
    };
    
    if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        reader.readAsDataURL(file);
    } else {
        reader.readAsDataURL(file);
    }
}

function viewDocument(type, idx) {
    const doc = currentUser.documents[type][idx];
    if (!doc) return;
    
    const modal = document.getElementById('previewModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    modalTitle.textContent = doc.name;
    
    if (doc.type === 'application/pdf') {
        modalBody.innerHTML = `<div class="iframe-container"><iframe src="${doc.data}" style="width:100%; height:100%; border: none;"></iframe></div>`;
    } else if (doc.type.startsWith('image/')) {
        modalBody.innerHTML = `<div style="display: flex; justify-content: center;"><img src="${doc.data}" style="max-width: 100%; height: auto; border-radius: 10px;"></div>`;
    } else {
        let fileIcon = '📄';
        let fileType = 'Document';
        if (doc.name.toLowerCase().endsWith('.docx') || doc.name.toLowerCase().endsWith('.doc')) {
            fileIcon = '📝';
            fileType = 'Word Document';
        } else if (doc.name.toLowerCase().endsWith('.xlsx') || doc.name.toLowerCase().endsWith('.xls')) {
            fileIcon = '📊';
            fileType = 'Excel Spreadsheet';
        } else if (doc.name.toLowerCase().endsWith('.pptx') || doc.name.toLowerCase().endsWith('.ppt')) {
            fileIcon = '📽️';
            fileType = 'PowerPoint';
        }
        
        modalBody.innerHTML = `
            <div style="text-align: center; padding: 60px 40px;">
                <div style="font-size: 5rem; margin-bottom: 20px;">${fileIcon}</div>
                <h3 style="color: #333333; margin-bottom: 10px; font-size: 1.5rem;">${fileType}</h3>
                <p style="color: #888; font-size: 1rem; margin-bottom: 30px;">This file type can't be previewed in the browser.</p>
                <p style="color: #666; margin-bottom: 25px;">Download it to view in your preferred application.</p>
                <a href="${doc.data}" download="${doc.name}" class="btn btn-primary" style="display: inline-block; background: linear-gradient(135deg, #333333, #555555); padding: 16px 40px; border-radius: 16px; color: white; text-decoration: none; font-weight: 700; font-size: 1.1rem; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4); transition: all 0.3s;">
                    <span style="margin-right: 10px;">⬇️</span> Download ${fileType}
                </a>
            </div>
        `;
    }
    
    modal.classList.add('active');
}

function deleteDocument(type, idx) {
    currentUser.documents[type].splice(idx, 1);
    saveUsers();
    renderDocuments();
}

function closeModal() {
    document.getElementById('previewModal').classList.remove('active');
}

// Reports
function closeReports() {
    document.getElementById('reports').style.display = 'none';
    document.querySelector('.tab-btn[data-tab="calendar"]').classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="calendar"]').classList.add('active');
}

function closeDtr() {
    document.getElementById('dtr').style.display = 'none';
    document.querySelector('.tab-btn[data-tab="calendar"]').classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="calendar"]').classList.add('active');
}

// DTR Report
async function renderDtrReport() {
    const year = dtrCurrentDate.getFullYear();
    const month = dtrCurrentDate.getMonth();

    await loadHolidayYears([year]);
    
    document.getElementById('dtrMonthYear').textContent = 
        dtrCurrentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const tbody = document.getElementById('dtrTableBody');
    tbody.innerHTML = '';
    
    let totalHours = 0;
    let workDaysCount = 0;
    
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const date = new Date(year, month, day);
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const fullDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        const isSunday = date.getDay() === 0;
        const isHoliday = isHolidayDate(dateStr);
        const isAbsent = isAbsentDate(dateStr);
        const hasEntry = currentUser.timeRecords[dateStr];
        const countsTowardTotal = hasEntry && !isSunday && !isHoliday && !isAbsent;
        
        const tr = document.createElement('tr');
        
        if (countsTowardTotal) {
            tr.classList.add('has-data');
        } else if (isSunday) {
            tr.classList.add('sunday');
        } else if (isHoliday) {
            tr.classList.add('holiday');
        } else if (isAbsent) {
            tr.classList.add('absent');
        }
        
        const tdDate = document.createElement('td');
        tdDate.textContent = fullDate;
        tr.appendChild(tdDate);
        
        const tdDay = document.createElement('td');
        tdDay.textContent = dayName;
        tr.appendChild(tdDay);
        
        const tdTimeIn = document.createElement('td');
        tdTimeIn.textContent = hasEntry ? formatTime(currentUser.timeRecords[dateStr].timeIn) : '-';
        tr.appendChild(tdTimeIn);
        
        const tdTimeOut = document.createElement('td');
        tdTimeOut.textContent = hasEntry ? formatTime(currentUser.timeRecords[dateStr].timeOut) : '-';
        tr.appendChild(tdTimeOut);
        
        const tdHours = document.createElement('td');
        if (hasEntry) {
            tdHours.textContent = currentUser.timeRecords[dateStr].hours.toFixed(2) + ' hrs';
            tdHours.style.fontWeight = '700';
            tdHours.style.color = countsTowardTotal ? '#059669' : '#6b7280';
            if (countsTowardTotal) {
                totalHours += currentUser.timeRecords[dateStr].hours;
                workDaysCount++;
            }
        } else {
            tdHours.textContent = '-';
        }
        tr.appendChild(tdHours);
        
        const tdStatus = document.createElement('td');
        if (hasEntry || isHoliday || isSunday || isAbsent) {
            const statusBadge = document.createElement('span');
            statusBadge.classList.add('status-badge');
            
            if (countsTowardTotal) {
                statusBadge.classList.add('status-present');
                statusBadge.textContent = 'Present';
            } else if (isAbsent) {
                statusBadge.classList.add('status-absent');
                statusBadge.textContent = 'Absent';
            } else if (isHoliday) {
                statusBadge.classList.add('status-holiday');
                statusBadge.textContent = 'Holiday';
            } else if (isSunday) {
                statusBadge.classList.add('status-sunday');
                statusBadge.textContent = 'Sunday';
            }
            
            tdStatus.appendChild(statusBadge);
        } else {
            tdStatus.textContent = '';
        }
        
        tr.appendChild(tdStatus);
        tbody.appendChild(tr);
    }
    
    document.getElementById('dtrTotalDays').textContent = workDaysCount;
    document.getElementById('dtrTotalHours').textContent = totalHours.toFixed(1);
    document.getElementById('dtrAvgHours').textContent = workDaysCount > 0 ? (totalHours / workDaysCount).toFixed(1) : '0';
    document.getElementById('dtrRemaining').textContent = Math.max(OJT_TARGET_HOURS - totalHours, 0).toFixed(1);
    document.getElementById('dtrTotalHoursFooter').textContent = totalHours.toFixed(1) + ' hours';
    renderMonthlyTotals();
}

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', initApp);
