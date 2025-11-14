// Set yesterday's date as completed
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const yesterdayString = yesterday.toISOString().split('T')[0];

localStorage.setItem('kuzu-maze-daily', JSON.stringify({
    date: yesterdayString,
    attempts: 3,
    completed: true,
    completedAttempts: 3
}));

// Reload the page
location.reload();

// RUN THIS IN THE CONSOLE