const stocks = {

    SBER: {
        name: 'SBERBANK',
        ticker: 'SBER',
        price: '342.15 ₽',
        change: '+2.34%'
    },

    GAZP: {
        name: 'GAZPROM',
        ticker: 'GAZP',
        price: '168.42 ₽',
        change: '-1.21%'
    },

    YDEX: {
        name: 'YANDEX',
        ticker: 'YDEX',
        price: '5120.00 ₽',
        change: '+0.87%'
    }

};

const ctx = document.getElementById('stockChart');

const data = {
    '1D': [335, 337, 336, 339, 338, 341, 340, 342, 341, 344, 342],

    '1W': [320, 325, 323, 330, 328, 335, 342],

    '1M': [290, 300, 295, 310, 305, 320, 315, 330, 342],

    '1Y': [180, 195, 210, 200, 230, 250, 240, 270, 290, 310, 330, 342]
};


const labels = {
    '1D': ['10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00'],

    '1W': ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],

    '1M': ['1', '5', '10', '15', '20', '25', '28', '29', '30'],

    '1Y': ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
};


const chart = new Chart(ctx, {

    type: 'line',

    data: {

        labels: labels['1D'],

        datasets: [{
            label: 'SBER',
            data: data['1D'],
            borderWidth: 2,
            tension: 0.3
        }]

    },

    options: {

        responsive: true,

        plugins: {
            legend: {
                display: false
            }
        }

    }

});
const buttons = document.querySelectorAll('.periods button');

buttons.forEach(button => {

    button.addEventListener('click', () => {

        const period = button.textContent;

        chart.data.labels = labels[period];

        chart.data.datasets[0].data = data[period];

        chart.update();

    });

});

const tickerInput = document.getElementById('tickerInput');
const searchButton = document.getElementById('searchButton');

searchButton.addEventListener('click', () => {

    const ticker = tickerInput.value.toUpperCase();

    const stock = stocks[ticker];

    if (!stock) {
        alert('Акция не найдена');
        return;
    }

    document.querySelector('.stock-header h2').textContent = stock.name;

    document.querySelector('.stock-header p').textContent = stock.ticker;

    document.querySelector('.stock-price span:first-child').textContent = stock.price;

    document.querySelector('.positive').textContent = stock.change;

});