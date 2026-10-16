
const stocks = {
    SBER: { name: 'SBERBANK', ticker: 'SBER' },
    GAZP: { name: 'GAZPROM', ticker: 'GAZP' },
    YDEX: { name: 'YANDEX', ticker: 'YDEX' },
    X5: { name: 'X5 GROUP', ticker: 'X5' }
};

const PERIODS = {
    '1D': { days: 1, interval: 10, label: 'Изменение за день' },
    '1W': { days: 7, interval: 60, label: 'Изменение за неделю' },
    '1M': { days: 30, interval: 60, label: 'Изменение за месяц' },
    '1Y': { days: 365, interval: 24, label: 'Изменение за год' }
};

const HISTORY_KEY = 'stockTrackerSearchHistory';
const FAVORITES_KEY = 'stockTrackerFavorites';
const MAX_HISTORY = 8;

let currentTicker = 'SBER';
let currentPeriod = '1D';
let isSearching = false;


// ==========================
// ПОЛУЧЕНИЕ ТЕКУЩЕЙ ЦЕНЫ
// ==========================

async function getStock(ticker) {
    const url =
        `https://iss.moex.com/iss/engines/stock/markets/shares/boards/TQBR/securities/${ticker}.json`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Ошибка MOEX: HTTP ${response.status}`);
    }

    const data = await response.json();
    const marketData = data.marketdata;

    if (!marketData || marketData.data.length === 0) {
        throw new Error(`Не найдены данные о цене для ${ticker}`);
    }

    const lastIndex = marketData.columns.indexOf('LAST');
    const changeIndex = marketData.columns.indexOf('LASTTOPREVPRICE');

    const row = marketData.data[0];
    const price = row[lastIndex];
    const change = row[changeIndex];

    if (price === null || price === undefined) {
        throw new Error(`Текущая цена ${ticker} недоступна`);
    }

    return { price, change };
}


// ==========================
// ПОЛУЧЕНИЕ СВЕЧЕЙ MOEX
// ==========================

async function getCandles(ticker, period) {
    const settings = PERIODS[period];

    const today = new Date();
    const from = new Date(today);

    from.setDate(from.getDate() - settings.days);

    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    }

    const url =
        `https://iss.moex.com/iss/engines/stock/markets/shares/boards/TQBR/securities/${ticker}/candles.json` +
        `?from=${formatDate(from)}` +
        `&till=${formatDate(today)}` +
        `&interval=${settings.interval}` +
        `&iss.meta=off`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(
            `Ошибка загрузки графика: HTTP ${response.status}`
        );
    }

    const data = await response.json();
    const candles = data.candles;

    if (!candles || candles.data.length === 0) {
        throw new Error(
            `Нет свечей для ${ticker} за период ${period}`
        );
    }

    const columns = candles.columns;
    const timeIndex = columns.indexOf('begin');
    const openIndex = columns.indexOf('open');
    const closeIndex = columns.indexOf('close');

    return candles.data
        .filter(row =>
            row[timeIndex] !== null &&
            row[closeIndex] !== null
        )
        .map(row => ({
            time: row[timeIndex],
            open: row[openIndex],
            price: row[closeIndex]
        }));
}


// ==========================
// РАСЧЁТ ИЗМЕНЕНИЯ ЗА ПЕРИОД
// ==========================

function calculatePeriodChange(candles) {
    if (candles.length < 2) {
        return null;
    }

    const firstPrice = Number(candles[0].price);
    const lastPrice = Number(candles[candles.length - 1].price);

    if (
        !Number.isFinite(firstPrice) ||
        !Number.isFinite(lastPrice) ||
        firstPrice === 0
    ) {
        return null;
    }

    return ((lastPrice - firstPrice) / firstPrice) * 100;
}


// ==========================
// СОЗДАНИЕ ГРАФИКА
// ==========================

const ctx = document.getElementById('stockChart');

const chart = new Chart(ctx, {
    type: 'line',

    data: {
        labels: [],
        datasets: [{
            label: 'SBER',
            data: [],
            borderColor: '#3ddc84',
            backgroundColor: 'rgba(61, 220, 132, 0.08)',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.2,
            fill: true
        }]
    },

    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,

        interaction: {
            intersect: false,
            mode: 'index'
        },

        plugins: {
            legend: {
                display: false
            },

            zoom: {
                pan: {
                    enabled: true,
                    mode: 'x',
                    threshold: 5
                },

                zoom: {
                    wheel: {
                        enabled: false
                    },
                    pinch: {
                        enabled: false
                    },
                    drag: {
                        enabled: false
                    },
                    mode: 'x'
                }
            }
        },

        scales: {
            x: {
                ticks: {
                    maxTicksLimit: 10,
                    color: '#888'
                },
                grid: {
                    color: 'rgba(255,255,255,0.05)'
                }
            },

            y: {
                ticks: {
                    color: '#888'
                },
                grid: {
                    color: 'rgba(255,255,255,0.07)'
                }
            }
        }
    }
});


// ==========================
// ОТОБРАЖЕНИЕ ГРАФИКА
// ==========================

function formatCandleTime(time, period) {
    const date = new Date(time);

    if (period === '1D') {
        return date.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    if (period === '1Y') {
        return date.toLocaleDateString('ru-RU', {
            month: '2-digit',
            year: '2-digit'
        });
    }

    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit'
    });
}

function renderChart(ticker, period, candles) {
    chart.data.labels = candles.map(candle =>
        formatCandleTime(candle.time, period)
    );

    chart.data.datasets[0].data =
        candles.map(candle => candle.price);

    chart.data.datasets[0].label = ticker;

    // Показываем последние 80% данных.
    // Остальные данные доступны при перемещении влево.

    const total = candles.length;
    const visibleCount = Math.max(2, Math.ceil(total * 0.8));

    chart.options.scales.x.min = Math.max(0, total - visibleCount);
    chart.options.scales.x.max = Math.max(0, total - 1);

    chart.update('none');
}


// ==========================
// ОТОБРАЖЕНИЕ ПРОЦЕНТА
// ==========================

function renderPeriodChange(candles, period) {
    const changeElement = document.getElementById('stockChange');
    const labelElement = document.getElementById('periodLabel');

    labelElement.textContent = PERIODS[period].label;

    const change = calculatePeriodChange(candles);

    if (change === null) {
        changeElement.textContent = 'Недостаточно данных';
        changeElement.className = '';
        return;
    }

    const sign = change > 0 ? '+' : '';

    changeElement.textContent = `${sign}${change.toFixed(2)}%`;

    changeElement.className =
        change > 0 ? 'positive' :
        change < 0 ? 'negative' : '';
}


// ==========================
// ИСТОРИЯ ПОИСКОВ
// ==========================

function getHistory() {
    try {
        const history = JSON.parse(
            localStorage.getItem(HISTORY_KEY) || '[]'
        );

        return Array.isArray(history) ? history : [];
    } catch {
        return [];
    }
}

function saveToHistory(ticker) {
    const history = getHistory();

    const updatedHistory = [
        ticker,
        ...history.filter(item => item !== ticker)
    ].slice(0, MAX_HISTORY);

    localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(updatedHistory)
    );

    renderHistory();
}

function renderHistory() {
    const container = document.getElementById('searchHistory');
    const history = getHistory();

    container.replaceChildren();

    if (history.length === 0) {
        const empty = document.createElement('span');
        empty.className = 'history-empty';
        empty.textContent = 'История пока пуста';

        container.appendChild(empty);
        return;
    }

    history.forEach(ticker => {
        const button = document.createElement('button');

        button.className = 'history-item';
        button.textContent = ticker;

        button.addEventListener('click', () => {
            searchStock(ticker);
        });

        container.appendChild(button);
    });
}


// ==========================
// ИЗБРАННОЕ
// ==========================

function getFavorites() {
    try {
        const favorites = JSON.parse(
            localStorage.getItem(FAVORITES_KEY) || '[]'
        );

        return Array.isArray(favorites) ? favorites : [];
    } catch {
        return [];
    }
}

function saveFavorites(favorites) {
    localStorage.setItem(
        FAVORITES_KEY,
        JSON.stringify(favorites)
    );
}

function renderFavorites() {
    const container = document.getElementById('favoritesList');

    if (!container) return;

    const favorites = getFavorites();

    container.replaceChildren();

    if (favorites.length === 0) {
        const empty = document.createElement('span');

        empty.className = 'history-empty';
        empty.textContent = 'Добавь первую акцию ⭐';

        container.appendChild(empty);
    }

    favorites.forEach(ticker => {
        const button = document.createElement('button');

        button.className = 'history-item';
        button.textContent = `★ ${ticker}`;
        button.title = 'Открыть акцию';

        button.addEventListener('click', () => {
            searchStock(ticker);
        });

        container.appendChild(button);
    });

    updateFavoriteButton();
}

function updateFavoriteButton() {
    const button = document.getElementById('favoriteButton');

    if (!button) return;

    const isFavorite = getFavorites().includes(currentTicker);

    button.textContent = isFavorite ? '★' : '☆';
    button.classList.toggle('is-favorite', isFavorite);

    button.title = isFavorite
        ? 'Убрать из избранного'
        : 'Добавить в избранное';
}

document.getElementById('favoriteButton')
    .addEventListener('click', () => {
        const favorites = getFavorites();
        const index = favorites.indexOf(currentTicker);

        if (index === -1) {
            favorites.push(currentTicker);
        } else {
            favorites.splice(index, 1);
        }

        saveFavorites(favorites);
        renderFavorites();
    });


// ==========================
// ПОИСК АКЦИИ
// ==========================

const tickerInput = document.getElementById('tickerInput');
const searchButton = document.getElementById('searchButton');

async function searchStock(inputTicker) {
    if (isSearching) return;

    const ticker = inputTicker.trim().toUpperCase();

    if (!ticker) {
        alert('Введите тикер');
        return;
    }

    isSearching = true;

    searchButton.disabled = true;
    searchButton.textContent = 'Загрузка...';

    try {
        // Загружаем цену и свечи одновременно.
        // Интерфейс обновляем только после успеха обоих запросов.

        const [market, candles] = await Promise.all([
            getStock(ticker),
            getCandles(ticker, currentPeriod)
        ]);

        const stock = stocks[ticker] || {
            name: ticker,
            ticker: ticker
        };

        document.querySelector(
            '.stock-header h2'
        ).textContent = stock.name;

        document.querySelector(
            '.stock-header p'
        ).textContent = stock.ticker;

        document.getElementById(
            'stockPrice'
        ).textContent = `${Number(market.price).toFixed(2)} ₽`;

        currentTicker = ticker;

        renderChart(ticker, currentPeriod, candles);
        renderPeriodChange(candles, currentPeriod);

        tickerInput.value = ticker;

        saveToHistory(ticker);
        updateFavoriteButton();

    } catch (error) {
        console.error('Ошибка поиска:', error);

        alert(
            `Не удалось загрузить ${ticker}.\n${error.message}`
        );

    } finally {
        isSearching = false;
        searchButton.disabled = false;
        searchButton.textContent = 'Найти';
    }
}


// ==========================
// ПОИСК: КНОПКА И ENTER
// ==========================

searchButton.addEventListener('click', () => {
    searchStock(tickerInput.value);
});

tickerInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
        event.preventDefault();
        searchStock(tickerInput.value);
    }
});


// ==========================
// ПЕРЕКЛЮЧЕНИЕ ПЕРИОДОВ
// ==========================

document.querySelectorAll('.periods button')
    .forEach(button => {
        button.addEventListener('click', async () => {
            const period = button.dataset.period;

            if (period === currentPeriod || isSearching) {
                return;
            }

            currentPeriod = period;

            document.querySelectorAll('.periods button')
                .forEach(item => {
                    item.classList.toggle(
                        'active',
                        item.dataset.period === period
                    );
                });

            await searchStock(currentTicker);
        });
    });


// ==========================
// ПЕРВЫЙ ЗАПУСК
// ==========================

renderHistory();
renderFavorites();
searchStock('SBER');
