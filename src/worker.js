//genHhKey() -> generationHHKey(hhAuthCode, hhClientID)

/* 
    --------- Параметры ---------
*/

const debugON = true
const checkNameOnResume = false
const manifest = chrome.runtime.getManifest();
let stopTimer = false
let Settings = {}

// Заполним дефолтные настройки
chrome.storage.local.set({"serverURL": 'URL_SERVER'});

//Возможные ссылки для резюме
const arrSite = [
    "hh.ru/resume/",
    [
        "avito.ru/",
        "/rezume/"
    ],
    [
        "/sd/operator/#uuid:",
        "candidate",
        "resume"
    ],
    "superjob.ru/resume",
    "career.habr.com/"
]

/* 
    --------- Инициализация модулей ---------
*/

// Модуль функций для Сервис Деска
importScripts('./modules/serviceDesk.js');

// Модуль функций для HH.ru
importScripts('./modules/hh.js');

// Модуль функций для Avito.ru
importScripts('./modules/avito.js');

// Модуль функций для SuperJob.ru
importScripts('./modules/superjob.js');

// Модуль функций для career.habr.com
importScripts('./modules/habr.js');


/* 
    --------- Методы ---------
*/

// Метод запуска
function __init() {
    setTimeout(function() {
        updateStateOnSD()
        getSecrets('hh')
        updateTokenHHOnSD()
    }, 2000 );
    
    // Циклический запуск через 1 минуту
    setTimeout(__init, 600000 );
} 

// Обновление переменной настроек из памяти
function updateSettings() {
    getAllStorageData().then(items => {
        Object.assign(Settings, items);
    });
    return Settings
}

// Метод для получения всех данных из Chrome.Strorage.Local
function getAllStorageData() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(null, (items) => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            resolve(items);
        });
    });
}

// Метод для логирования
function debugLogs(text, mode, port = null) {
    if (typeof(debugON) === "boolean") {
  
        let str = '%c(' + new Date().toString().substr(0, 24) + ') %c[' + mode + '] %c' + text
    
        switch (mode) {
            case 'error':
                console.log(str, 'color: green', 'color: red', 'color: white');
            break;

            case 'warn':
                console.log(str, 'color: green', 'color: yellow', 'color: white');
            break;

            case 'log':
                console.log(str, 'color: green', 'color: white', 'color: white');
            break;

            case 'JSON':
                console.log(text);
            break;
    
            default:
                console.log(str, 'color: green', 'color: white', 'color: white');
            break;
        }
        
        if (port && port.name == 'mainPopup') {
            try {
                port.postMessage({ "log" : text})
            } catch (e) {}
        }

    }
}

// Метод получения Base64 из ссылки на фото 
const toDataURL = url => fetch(url).then(response => response.blob())
    .then(blob => new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(blob)
}))

// Таймер выполнения операции
function timeOperation() {
    if (typeof(debugON) === "boolean") {
        var step = 50;
        var endsAfter = 0
        let maxTime = 20000
    
        var interval = setInterval(function() {
            endsAfter += step
            if (stopTimer) {
                clearInterval(interval)
                debugLogs('Операция заняла: ' + endsAfter + 'мс', 'log')
                stopTimer = false
            }
            if (endsAfter >= maxTime) {
                clearInterval(interval)
                debugLogs('Операция выполяется больше ' + maxTime + 'мс. Выполняю остановку процесса', 'error')
            }
        }, step);
    }
}

// Метод для созданя Badge расширения
function setBadge(tabID, text, color) {
    chrome.action.setBadgeBackgroundColor({ color: color }, () => {
        chrome.action.setBadgeText({ tabId: tabID, text: text});
    });
}

// Метод для обработки станицы для добавления Badge
function renderBadge(activeTab) {
    setTimeout(function() {
        let tabId = activeTab.id
        chrome.tabs.get(tabId).then(function(tab) {
            if ( tab.url.indexOf(arrSite[0]) != -1) {  // HH Resume
                setBadge(tab.id, 'HH', '#F00')
            } else if ( tab.url.indexOf(arrSite[1][0]) != -1 && tab.url.indexOf(arrSite[1][1]) != -1 ){ // Avito Resume
                setBadge(tab.id, 'Avito', '#01aaff')
            } else if ( tab.url.indexOf(arrSite[2][0]) != -1 && ( tab.url.indexOf(arrSite[2][1]) != -1 || tab.url.indexOf(arrSite[2][2]) != -1) ){ // Avito Resume
                setBadge(tab.id, 'SD', '#01aaff')
            } else if ( tab.url.indexOf(arrSite[3]) != -1 ){ // SuperJob Resume
                setBadge(tab.id, 'SJ', '#00aa87')
            } else if ( tab.url.indexOf(arrSite[4]) != -1 ){ // SuperJob Resume
                setBadge(tab.id, 'Habr', '#303b44')
            } else {
                setBadge(tab.id, '', '#F00')
            }
        });
    }, 1000 );
}

// Процесс для запуска обработки резюме HH
function processingHH(Settings, resumeURL, port = null) {

    // Находим уникальный ID резюме
    let resumeID = resumeURL.substr(resumeURL.indexOf('/resume/') + 8, resumeURL.length)
    if (resumeID.indexOf('?') != -1) {
        resumeID = resumeID.substr(0, resumeID.indexOf('?'))
    }

    // Запускаем верификацию токена Сервис Деск
    verifServiceDeskTOKEN(port)

    // Начинаю отсчет времени
    timeOperation() 

    port.postMessage({ "log" : "Запуск импорта резюме c HH.ru"});
        
    if (Settings.Client_id_hh && Settings.Client_secret_hh && Settings.ServiceDeskTOKEN) {
        // Запускаем верификацию токена HH
        hhTOKEN(Settings, port)
        setTimeout(getResumeOnHHpage, 1000, Settings, resumeID, port)
    }
}

// Процесс для запуска обработки резюме Super Job
function processingSJ(Settings, resumeURL, port = null) {

    // Находим уникальный ID резюме
    resumeID = resumeURL.substr(resumeURL.indexOf('/resume/') + 8)
    resumeID = resumeID.substr(0, resumeID.indexOf('.html'))
    resumeID = resumeID.split('-')
    resumeID = resumeID[resumeID.length - 1]

    // Запускаем верификацию токена Сервис Деск
    verifServiceDeskTOKEN(port)

    // Начинаю отсчет времени
    timeOperation() 

    port.postMessage({ "log" : "Запуск импорта резюме c SuperJob.ru"});
        
    if (Settings.Client_id_sj && Settings.Client_secret_sj && Settings.ServiceDeskTOKEN) {
        // Запускаем верификацию токена SJ
        sjTOKEN(port)
        setTimeout(getResumeOnSJpage, 1000, resumeID, port)
    }
}

// Процесс для запуска обработки резюме Хабр Карьера
function processingHabr(Settings, resumeURL, port = null) {

    // Находим уникальный ID резюме
    resumeID = resumeURL.split('/')
    resumeID = resumeID[resumeID.length - 1]

    // Запускаем верификацию токена Сервис Деск
    verifServiceDeskTOKEN(port)

    // Начинаю отсчет времени
    timeOperation() 

    port.postMessage({ "log" : "Запуск импорта резюме c Хабр Карьера"});

    if (Settings.Client_id_habr && Settings.Client_secret_habr && Settings.ServiceDeskTOKEN) {
        // Запускаем верификацию токена SJ
        habrTOKEN(Settings, port)
        setTimeout(getResumeOnHabrPage, 1000, updateSettings(), resumeID, port)
    }

}

// Процесс для запуска обработки резюме Avito
function processingAvito(resumeURL, port) {

    // Находим уникальный ID резюме
    let resumeID = resumeURL.substr(resumeURL.lastIndexOf('_') + 1, resumeURL.length);
    // Запускаем верификацию токена Сервис Деск
    verifServiceDeskTOKEN(port)
    // Начинаю отсчет времени
    timeOperation() 

    port.postMessage({ "log" : "Запуск импорта резюме c Авито"});
    
    // Запускаю верификацию токена Авито
    avitoTOKEN(port)
    // Запускаем основоной код
    createResumeAvito(resumeID)
}

// Процесс для запуска обработки резюме SD
function processingSD(Settings, resumeURL, port) {

    // Есть открытая карточка кандидата или резюме, определим тип карточки
    let type = resumeURL.substr(resumeURL.indexOf('#uuid:') + 6, resumeURL.length)
    type = type.substr(0, type.indexOf('$'))

    // Определим UUID обьекта
    let sUUID = resumeURL.substr(resumeURL.indexOf('$') + 1, resumeURL.length)

    // Уберем мусор если он есть
    if (sUUID.indexOf('!') != -1 ) { sUUID = sUUID.substr(0, sUUID.indexOf('!')) }
    if (sUUID.indexOf('%') != -1 ) { sUUID = sUUID.substr(0, sUUID.indexOf('%')) }

    let url = `https://${Settings.serverURL}/sd/services/rest/exec-post?accessKey=${Settings.ServiceDeskTOKEN}&func=modules.extensionHR.getlinkfromURL&params='${type}','${sUUID}'`
    fetch(url, {
        method: "POST"
    })
    .then((response) => response.text())
    .then((data) => {

        var patt = /<a[^>]*href=["']([^"']*)["']/g
        while(match=patt.exec(data)){
            resumeURL = match[1]
        }

        if (data.indexOf('hh.ru') != -1) {
            processingHH(Settings, resumeURL, port)
        } else if (data.indexOf('avito.ru') != -1) {
            processingAvito(resumeURL, port)
        } else {
            port.postMessage({ "mode" : "close"});
            port.postMessage({ "log" : 'К сожалению, обновление данного резюме - не возможно'})
        }

    })
}


/* 
    --------- Основной код ---------
*/

// Запускаем фоновые задачи
__init()

// Слушатель сообщений с фронта 
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.Client_id_avito || message.Client_secret_avito) {
        chrome.storage.local.set({
            "Client_id_avito": message.Client_id_avito,
            "Client_secret_avito": message.Client_secret_avito
        });
        updateSettings()
    } else {
        if (message.hh_authorization_code ) {
            chrome.storage.local.set({"hh_authorization_code": message.hh_authorization_code})
            debugLogs(`Получен новый hh_authorization_code: ${message.hh_authorization_code}`, 'debug')
        } else if (message.sj_authorization_code ) {
            chrome.storage.local.set({"sj_authorization_code": message.sj_authorization_code})
            debugLogs(`Получен новый sj_authorization_code: ${message.sj_authorization_code}`, 'debug')
        } else if (message.habr_authorization_code ) {
            chrome.storage.local.set({"habr_authorization_code": message.habr_authorization_code})
            debugLogs(`Получен новый habr_authorization_code: ${message.habr_authorization_code}`, 'debug')
        } else {
            if (message.updateResume) {
                console.log('Обновление')
            } else {
                console.error(message)
            }
        }
    }
});

// Слушатель для вызова расширения
// Вызывается, когда пользователь нажимает на действие браузера.
chrome.runtime.onConnect.addListener(function(port) {
    port.onMessage.addListener(function(msg) {
        switch (msg) {
            case 'run_proc':
                // Отправить сообщение на активную вкладку
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {

                    // Обновляем переменную с настройками
                    Settings = updateSettings()       
        
                    // По ссылке определю что выполнять
                    if ( tabs[0].url.indexOf(arrSite[0]) != -1) {  // HH Resume
                        
                        // Запускаем процесс обработки резюме
                        processingHH(Settings, tabs[0].url, port)
            
                    } else if ( tabs[0].url.indexOf(arrSite[1][0]) != -1 && tabs[0].url.indexOf(arrSite[1][1]) != -1 ) {  // Avito Resume

                        // Запускаем процесс обработки резюме
                        processingAvito(tabs[0].url, port)                        
            
                    } else if (tabs[0].url.indexOf(arrSite[2][0]) != -1 ) { // Обновление резюме из карточки резюме Service Desk
                        if (tabs[0].url.indexOf(arrSite[2][1]) != -1 || tabs[0].url.indexOf(arrSite[2][2]) != -1) {
                            
                            // Запускаем процесс обработки резюме
                            processingSD(Settings, tabs[0].url, port)

                        } else {
                            // port.postMessage({ "mode" : "close"});
                            port.postMessage({ "log" : 'К сожалению, действий на данной странице не обнаружено'})
                        }
                    }  else if (tabs[0].url.indexOf(arrSite[3]) != -1 ) { // Обновление резюме из SuperJob
                        if (tabs[0].url.indexOf('search_resume') == -1) {
                            // Запускаем процесс обработки резюме
                            processingSJ(Settings, tabs[0].url, port)
                        } else {
                            // port.postMessage({ "mode" : "close"});
                            port.postMessage({ "log" : 'К сожалению, действий на данной странице не обнаружено'})
                        }
                    }  else if (tabs[0].url.indexOf(arrSite[4]) != -1 ) { // Обновление резюме из Хабр Карьера
                        // Запускаем процесс обработки резюме
                        processingHabr(Settings, tabs[0].url, port)
                    } else {
                        port.postMessage({ "log" : 'К сожалению данный сайт еще не поддерживается функцией автоматического импорта кандидатов!'})
                    }
                });
            break;

            case 'getSDname':
                debugLogs('Ветка проверки соединения с Service Desk', 'debug')
                verifServiceDeskTOKEN(port)
                return getNameEmpl()
            break;

            case 'getHHsecrets':
                debugLogs('Ветка получения ключей от HH.ru', 'debug')
                verifServiceDeskTOKEN()
                getSecrets('hh')
            break;

            case 'getSJsecrets':
                debugLogs('Ветка получения ключей от SuperJob.ru', 'debug')
                verifServiceDeskTOKEN()
                getSecrets('sj')
            break;

            case 'getHabrsecrets':
                debugLogs('Ветка получения ключей от Хабр Карьера', 'debug')
                verifServiceDeskTOKEN()
                getSecrets('habr')
            break;

            default:
                console.log(msg)
            break;
        }
    });
})

// Слушатели для создания Badge
// При переходте на уже существующую страницу
chrome.tabs.onActivated.addListener(function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        activeTab = tabs[0]
        renderBadge(activeTab)
    });
});
// При открытии новой страницы
chrome.tabs.onCreated.addListener( activeTab => {
    renderBadge(activeTab)
});

