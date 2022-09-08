// Соединяемся с беком
var port = chrome.runtime.connect({ name: "mainPopup" });

// Получаем обьект манифеста и заполяем данные
let manifest = chrome.runtime.getManifest();
document.getElementById('name').innerHTML = manifest.name

// Обработчик входящмх запросов
port.onMessage.addListener(function(msg) {
    if (msg.log) {
        document.getElementsByClassName('desc')[0].innerHTML  = msg.log
    }
    if (msg.mode) {
        switch (msg.mode) {
            case 'close':
                window.close()
                break;
        }
    }
});

// Кидаем команду начала процееса
port.postMessage("run_proc");