const stocks = {
    SBER: {
        name: 'SBERBANK',
        ticker: 'SBER'
    },

    GAZP: {
        name: 'GAZPROM',
        ticker: 'GAZP'
    },

    YDEX: {
        name: 'YANDEX',
        ticker: 'YDEX'
    }
};


// ==========================
// MOEX — ТЕКУЩАЯ ЦЕНА
// ==========================

async function getStock(ticker) {

    const url =
        `https://iss.moex.com/iss/engines/stock/markets/shares/boards/TQBR/securities/${ticker}.json`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error('Ошибка запроса к MOEX');
    }

    const data = await response.json();

    const marketData = data.marketdata;

    if (!marketData || marketData.data.length === 0) {
        throw new Error('Акция не найдена на MOEX');
    }

    const lastIndex =
        marketData.columns.indexOf('LAST');

    const changeIndex =
        marketData.columns.indexOf('LASTTOPREVPRICE');

    const row = marketData.data[0];

    return {
        price: row[lastIndex],
        change: row[changeIndex]
    };
}


// ==========================
// MOEX — СВЕЧИ ДЛЯ ГРАФИКА
// ==========================

async function getCandles(ticker, period) {

    const today = new Date();

    let from = new Date(today);
    let till = new Date(today);

    let interval;


    // --------------------------
    // 1 день
    // --------------------------

    if (period === '1D') {

        from.setDate(today.getDate() - 1);

        // 10 минут
        interval = 10;
    }


    // --------------------------
    // 1 неделя
    // --------------------------

    if (period === '1W') {

        from.setDate(today.getDate() - 7);

        // 1 час
        interval = 60;
    }


    // --------------------------
    // 1 месяц
    // --------------------------

    if (period === '1M') {

        from.setDate(today.getDate() - 30);

        // 1 час
        interval = 60;
    }


    // --------------------------
    // 1 год
    // --------------------------

    if (period === '1Y') {

        from.setFullYear(today.getFullYear() - 1);

        // 1 день
        interval = 24;
    }


    // Превращаем дату в YYYY-MM-DD

    const formatDate = (date) => {

        return date.toISOString().split('T')[0];

    };


    const url =
        `https://iss.moex.com/iss/engines/stock/markets/shares/boards/TQBR/securities/${ticker}/candles.json` +
        `?from=${formatDate(from)}` +
        `&till=${formatDate(till)}` +
        `&interval=${interval}`;


    const response = await fetch(url);


    if (!response.ok) {

        throw new Error('Ошибка получения свечей');

    }


    const data = await response.json();


    const candles = data.candles;


    if (!candles || candles.data.length === 0) {

        throw new Error('Нет данных для графика');

    }


    const columns = candles.columns;


    const beginIndex =
        columns.indexOf('begin');

    const closeIndex =
        columns.indexOf('close');


    return candles.data.map(row => {

        return {
            time: row[beginIndex],
            price: row[closeIndex]
        };

    });

}


// ==========================
// ГРАФИК
// ==========================

const ctx =
    document.getElementById('stockChart');


const chart = new Chart(ctx, {

    type: 'line',

    data: {

        labels: [],

        datasets: [{

            label: 'SBER',

            data: [],

            borderWidth: 2,

            tension: 0.3

        }]

    },


    options: {

        responsive: true,

        maintainAspectRatio: false,

        plugins: {

            legend: {

                display: false

            }

        },

        scales: {

            x: {

                ticks: {

                    maxTicksLimit: 10

                }

            }

        }

    }

});


// ==========================
// ОБНОВЛЕНИЕ ГРАФИКА
// ==========================

async function updateChart(ticker, period) {

    try {

        const candles =
            await getCandles(ticker, period);


        chart.data.labels =
            candles.map(candle => {

                const date =
                    new Date(candle.time);

                if (period === '1D') {

                    return date.toLocaleTimeString(
                        'ru-RU',
                        {
                            hour: '2-digit',
                            minute: '2-digit'
                        }
                    );

                }


                return date.toLocaleDateString(
                    'ru-RU',
                    {
                        day: '2-digit',
                        month: '2-digit'
                    }
                );

            });


        chart.data.datasets[0].data =
            candles.map(candle => candle.price);


        chart.data.datasets[0].label =
            ticker;


        chart.update();


    } catch (error) {

        console.error(error);

        alert(
            `Не удалось загрузить график для ${ticker}`
        );

    }

}


// ==========================
// ПЕРИОДЫ
// ==========================

const buttons =
    document.querySelectorAll('.periods button');


buttons.forEach(button => {

    button.addEventListener('click', async () => {

        const period =
            button.textContent;


        const ticker =
            document
                .querySelector('.stock-header p')
                .textContent;


        await updateChart(
            ticker,
            period
        );

    });

});


// ==========================
// ПОИСК АКЦИИ
// ==========================

const tickerInput =
    document.getElementById('tickerInput');


const searchButton =
    document.getElementById('searchButton');


searchButton.addEventListener('click', async () => {

    const ticker =
        tickerInput.value.trim().toUpperCase();


    if (!ticker) {

        alert('Введите тикер');

        return;

    }


    try {

        // Получаем текущую цену

        const market =
            await getStock(ticker);


        // Получаем данные графика

        const candles =
            await getCandles(ticker, '1D');


        // Если тикера нет
        // в нашем списке,
        // просто используем сам тикер

        const stock =
            stocks[ticker] || {

                name: ticker,

                ticker: ticker

            };


        // --------------------------
        // Название
        // --------------------------

        document.querySelector(
            '.stock-header h2'
        ).textContent =
            stock.name;


        // --------------------------
        // Тикер
        // --------------------------

        document.querySelector(
            '.stock-header p'
        ).textContent =
            stock.ticker;


        // --------------------------
        // Цена
        // --------------------------

        document.querySelector(
            '.stock-price span:first-child'
        ).textContent =
            `${market.price} ₽`;


        // --------------------------
        // Изменение цены
        // --------------------------

        const changeElement =
            document.querySelector('.positive');


        changeElement.textContent =
            `${market.change ?? 0}%`;


        if (market.change >= 0) {

            changeElement.className =
                'positive';

        } else {

            changeElement.className =
                'negative';

        }


        // --------------------------
        // График
        // --------------------------

        chart.data.labels =
            candles.map(candle => {

                const date =
                    new Date(candle.time);

                return date.toLocaleTimeString(
                    'ru-RU',
                    {
                        hour: '2-digit',
                        minute: '2-digit'
                    }
                );

            });


        chart.data.datasets[0].data =
            candles.map(candle =>
                candle.price
            );


        chart.data.datasets[0].label =
            ticker;


        chart.update();


    } catch (error) {

        console.error(error);

        alert(
            `Не удалось получить данные для ${ticker}`
        );

    }

});